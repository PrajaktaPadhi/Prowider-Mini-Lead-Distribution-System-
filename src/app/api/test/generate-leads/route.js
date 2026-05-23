import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/lib/models/Lead';
import Service from '@/lib/models/Service';
import { allocateProviders } from '@/lib/allocation';

export async function POST(request) {
  try {
    await dbConnect();

    const services = await Service.find({});
    if (services.length === 0) {
      return NextResponse.json(
        { error: 'No services found. Please run the seed script first.' },
        { status: 400 }
      );
    }

    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'];
    const results = [];
    const errors = [];

    // Generate 10 leads concurrently
    const promises = Array.from({ length: 10 }, async (_, i) => {
      const service = services[i % services.length];
      const timestamp = Date.now();
      const uniquePhone = `${9000000000 + timestamp + i}`; // Ensure unique phone numbers

      try {
        const lead = await Lead.create({
          name: `Test User ${timestamp}-${i}`,
          phone: uniquePhone,
          city: cities[i % cities.length],
          serviceId: service._id,
          description: `Auto-generated test lead #${i + 1}`,
          status: 'pending',
        });

        const allocation = await allocateProviders(lead._id);

        return {
          index: i + 1,
          leadId: lead._id,
          service: service.name,
          phone: uniquePhone,
          allocation: {
            totalAssigned: allocation.totalAssigned,
            providers: allocation.assignments.map(a => a.providerName),
            errors: allocation.errors,
          },
        };
      } catch (err) {
        return {
          index: i + 1,
          error: err.message,
        };
      }
    });

    const allResults = await Promise.all(promises);

    const successful = allResults.filter(r => !r.error);
    const failed = allResults.filter(r => r.error);

    return NextResponse.json({
      success: true,
      summary: {
        total: 10,
        successful: successful.length,
        failed: failed.length,
      },
      results: allResults,
    });

  } catch (error) {
    console.error('Error generating test leads:', error);
    return NextResponse.json(
      { error: 'Failed to generate test leads' },
      { status: 500 }
    );
  }
}
