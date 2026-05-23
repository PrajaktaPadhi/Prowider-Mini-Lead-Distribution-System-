/**
 * Mandatory assignment rules.
 * Key: service slug, Value: array of provider names that MUST receive every lead for this service.
 */
export const MANDATORY_RULES = {
  'service-1': ['Provider 1'],
  'service-2': ['Provider 5'],
  'service-3': ['Provider 1', 'Provider 4'],
};

/**
 * Fair distribution pools.
 * Key: service slug, Value: array of provider names eligible for fair round-robin allocation.
 */
export const FAIR_POOLS = {
  'service-1': ['Provider 2', 'Provider 3', 'Provider 4'],
  'service-2': ['Provider 6', 'Provider 7', 'Provider 8'],
  'service-3': ['Provider 2', 'Provider 3', 'Provider 5', 'Provider 6', 'Provider 7', 'Provider 8'],
};

/**
 * Number of providers each lead must be assigned to.
 */
export const PROVIDERS_PER_LEAD = 3;

/**
 * Default monthly quota per provider.
 */
export const DEFAULT_MONTHLY_QUOTA = 10;
