import type { Tier } from './types.js';

export const TIERS: readonly Tier[] = ['unproven', 'bronze', 'silver', 'gold'];

/** Lowest score for each proven tier. Scores below SILVER_MIN are bronze. */
export const SILVER_MIN = 60;
export const GOLD_MIN = 80;

/** Points available per part of the record. They add up to 100. */
export const POINTS = {
  deliveries: 40,
  admission: 20,
  listingAge: 15,
  aiax: 5,
  acp: 20,
} as const;

/** Listing age at which the age points are full. */
export const FULL_AGE_DAYS = 180;
/** Accepted deliveries at which the volume factor is full. */
export const FULL_VOLUME = 10;

export const DEFAULT_OUTSIDE_WEIGHT = 0.2;
export const MAX_OUTSIDE_WEIGHT = 0.5;

/** Tier of a proven agent for a score. Unproven is decided by the record, not by the score. */
export function provenTier(score: number): Exclude<Tier, 'unproven'> {
  if (score >= GOLD_MIN) return 'gold';
  if (score >= SILVER_MIN) return 'silver';
  return 'bronze';
}

/** Lowest and highest score that fall in a proven tier. */
export function tierRange(tier: Exclude<Tier, 'unproven'>): [number, number] {
  if (tier === 'gold') return [GOLD_MIN, 100];
  if (tier === 'silver') return [SILVER_MIN, GOLD_MIN - 1];
  return [0, SILVER_MIN - 1];
}

export function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier);
}
