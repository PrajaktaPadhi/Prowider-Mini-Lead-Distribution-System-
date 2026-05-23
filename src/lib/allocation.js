import dbConnect from './db.js';
import Provider from './models/Provider.js';
import Lead from './models/Lead.js';
import LeadAssignment from './models/LeadAssignment.js';
import RoundRobinState from './models/RoundRobinState.js';
import Service from './models/Service.js';
import { MANDATORY_RULES, FAIR_POOLS, PROVIDERS_PER_LEAD } from './config.js';

/**
 * Allocate providers for a newly created lead.
 * 
 * Algorithm:
 * 1. Identify mandatory providers for this service
 * 2. Attempt to assign mandatory providers (skip if quota exhausted)
 * 3. Fill remaining slots via round-robin from fair pool
 * 4. All quota decrements are atomic (findOneAndUpdate with $lt guard)
 * 5. Round-robin pointer is atomically advanced
 * 
 * @param {string} leadId - The ID of the lead to allocate
 * @returns {Object} - { success, assignments, errors }
 */
export async function allocateProviders(leadId) {
  await dbConnect();

  const lead = await Lead.findById(leadId).populate('serviceId');
  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  const service = lead.serviceId;
  if (!service) {
    return { success: false, error: 'Service not found for lead' };
  }

  const serviceSlug = service.slug;
  const mandatoryProviderNames = MANDATORY_RULES[serviceSlug] || [];
  const fairPoolNames = FAIR_POOLS[serviceSlug] || [];

  // Load all providers into a name->doc map
  const allProviders = await Provider.find({});
  const providerMap = {};
  for (const p of allProviders) {
    providerMap[p.name] = p;
  }

  const assignedProviderIds = [];
  const assignments = [];
  const errors = [];

  // Step 1: Assign mandatory providers
  for (const provName of mandatoryProviderNames) {
    if (assignedProviderIds.length >= PROVIDERS_PER_LEAD) break;

    const provider = providerMap[provName];
    if (!provider) {
      errors.push(`Mandatory provider ${provName} not found`);
      continue;
    }

    // Atomic quota check + decrement
    const updated = await Provider.findOneAndUpdate(
      {
        _id: provider._id,
        leadsReceived: { $lt: provider.monthlyQuota },
      },
      { $inc: { leadsReceived: 1 } },
      { new: true }
    );

    if (updated) {
      assignedProviderIds.push(provider._id);
      assignments.push({
        leadId: lead._id,
        providerId: provider._id,
        serviceId: service._id,
        assignedAt: new Date(),
        providerName: provider.name,
      });
    } else {
      errors.push(`Mandatory provider ${provName} has exhausted quota`);
    }
  }

  // Step 2: Fill remaining slots from fair pool using round-robin
  const remainingSlots = PROVIDERS_PER_LEAD - assignedProviderIds.length;

  if (remainingSlots > 0 && fairPoolNames.length > 0) {
    // Atomically get and advance the round-robin pointer
    // We advance by the number of slots we need to fill — this gives us a unique starting position
    const rrState = await RoundRobinState.findOneAndUpdate(
      { serviceSlug },
      { $inc: { nextIndex: remainingSlots } },
      { new: false, upsert: true } // return the OLD value (before increment)
    );

    const startIndex = rrState ? rrState.nextIndex : 0;
    let filled = 0;
    let attempts = 0;
    const maxAttempts = fairPoolNames.length * 2; // prevent infinite loop

    while (filled < remainingSlots && attempts < maxAttempts) {
      const poolIndex = (startIndex + filled + attempts) % fairPoolNames.length;
      const provName = fairPoolNames[poolIndex];
      const provider = providerMap[provName];
      attempts++;

      if (!provider) continue;

      // Skip if already assigned as mandatory
      if (assignedProviderIds.some(id => id.toString() === provider._id.toString())) {
        continue;
      }

      // Atomic quota check + decrement
      const updated = await Provider.findOneAndUpdate(
        {
          _id: provider._id,
          leadsReceived: { $lt: provider.monthlyQuota },
        },
        { $inc: { leadsReceived: 1 } },
        { new: true }
      );

      if (updated) {
        assignedProviderIds.push(provider._id);
        assignments.push({
          leadId: lead._id,
          providerId: provider._id,
          serviceId: service._id,
          assignedAt: new Date(),
          providerName: provider.name,
        });
        filled++;
      }
      // If update returned null, provider's quota is full — skip to next
    }
  }

  // Step 3: Write all assignments to database
  if (assignments.length > 0) {
    try {
      await LeadAssignment.insertMany(
        assignments.map(a => ({
          leadId: a.leadId,
          providerId: a.providerId,
          serviceId: a.serviceId,
          assignedAt: a.assignedAt,
        })),
        { ordered: false } // continue even if one fails (shouldn't happen with unique index)
      );
    } catch (err) {
      // Handle duplicate key errors gracefully
      if (err.code !== 11000) {
        throw err;
      }
      errors.push('Some assignments may have been duplicates');
    }
  }

  // Step 4: Update lead status
  const newStatus = assignments.length === PROVIDERS_PER_LEAD ? 'assigned' : 
                    assignments.length > 0 ? 'partial' : 'pending';
  await Lead.findByIdAndUpdate(leadId, { status: newStatus });

  return {
    success: assignments.length > 0,
    totalAssigned: assignments.length,
    assignments: assignments.map(a => ({
      providerName: a.providerName,
      providerId: a.providerId,
    })),
    errors,
  };
}
