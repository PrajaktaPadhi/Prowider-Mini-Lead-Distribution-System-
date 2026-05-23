import dbConnect from '@/lib/db';
import LeadAssignment from '@/lib/models/LeadAssignment';
import Lead from '@/lib/models/Lead';
import Service from '@/lib/models/Service';
import Provider from '@/lib/models/Provider';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      await dbConnect();

      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      let lastCheckTime = new Date();

      const interval = setInterval(async () => {
        try {
          // Check for new assignments since last check
          const newAssignments = await LeadAssignment.find({
            assignedAt: { $gt: lastCheckTime },
          })
            .populate({ path: 'leadId', model: Lead, select: 'name phone city description createdAt' })
            .populate({ path: 'serviceId', model: Service, select: 'name' })
            .populate({ path: 'providerId', model: Provider, select: 'name leadsReceived monthlyQuota' })
            .sort({ assignedAt: -1 });

          if (newAssignments.length > 0) {
            lastCheckTime = new Date();

            const data = newAssignments.map(a => ({
              id: a._id,
              providerId: a.providerId?._id,
              providerName: a.providerId?.name,
              providerLeadsReceived: a.providerId?.leadsReceived,
              providerQuota: a.providerId?.monthlyQuota,
              lead: a.leadId ? {
                id: a.leadId._id,
                name: a.leadId.name,
                phone: a.leadId.phone,
                city: a.leadId.city,
                description: a.leadId.description,
                createdAt: a.leadId.createdAt,
              } : null,
              service: a.serviceId?.name || 'Unknown',
              assignedAt: a.assignedAt,
            }));

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'new_assignments', assignments: data })}\n\n`)
            );
          }
        } catch (err) {
          console.error('SSE polling error:', err);
        }
      }, 2000); // Poll every 2 seconds

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
