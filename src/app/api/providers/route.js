import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Provider from '@/lib/models/Provider';
import LeadAssignment from '@/lib/models/LeadAssignment';
import Lead from '@/lib/models/Lead';
import Service from '@/lib/models/Service';

export async function GET() {
  try {
    await dbConnect();

    const providers = await Provider.find({}).sort({ name: 1 });

    // Get all assignments grouped by provider
    const assignments = await LeadAssignment.find({})
      .populate({
        path: 'leadId',
        model: Lead,
        select: 'name phone city description createdAt',
      })
      .populate({
        path: 'serviceId',
        model: Service,
        select: 'name',
      })
      .sort({ assignedAt: -1 });

    // Group assignments by provider
    const assignmentsByProvider = {};
    for (const a of assignments) {
      const pid = a.providerId.toString();
      if (!assignmentsByProvider[pid]) {
        assignmentsByProvider[pid] = [];
      }
      assignmentsByProvider[pid].push({
        id: a._id,
        lead: a.leadId ? {
          id: a.leadId._id,
          name: a.leadId.name,
          phone: a.leadId.phone,
          city: a.leadId.city,
          description: a.leadId.description,
          createdAt: a.leadId.createdAt,
        } : null,
        service: a.serviceId ? a.serviceId.name : 'Unknown',
        assignedAt: a.assignedAt,
      });
    }

    const result = providers.map(p => ({
      id: p._id,
      name: p.name,
      monthlyQuota: p.monthlyQuota,
      leadsReceived: p.leadsReceived,
      remainingQuota: p.monthlyQuota - p.leadsReceived,
      assignments: assignmentsByProvider[p._id.toString()] || [],
    }));

    return NextResponse.json({ providers: result });
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}
