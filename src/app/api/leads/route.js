import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/lib/models/Lead';
import Service from '@/lib/models/Service';
import { allocateProviders } from '@/lib/allocation';

export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { name, phone, city, serviceId, description } = body;

    // Validate required fields
    if (!name || !phone || !city || !serviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone, city, serviceId' },
        { status: 400 }
      );
    }

    // Validate phone format (basic)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Phone number must be at least 10 digits' },
        { status: 400 }
      );
    }

    // Verify service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return NextResponse.json(
        { error: 'Invalid service selected' },
        { status: 400 }
      );
    }

    // Create the lead — duplicate rule enforced by unique compound index
    let lead;
    try {
      lead = await Lead.create({
        name,
        phone: cleanPhone,
        city,
        serviceId,
        description: description || '',
        status: 'pending',
      });
    } catch (err) {
      if (err.code === 11000) {
        return NextResponse.json(
          { error: 'A lead with this phone number already exists for the selected service' },
          { status: 409 }
        );
      }
      throw err;
    }

    // Trigger automatic allocation
    const allocationResult = await allocateProviders(lead._id);

    return NextResponse.json({
      success: true,
      lead: {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        city: lead.city,
        service: service.name,
        status: allocationResult.success ? 'assigned' : 'pending',
      },
      allocation: allocationResult,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}
