/** Tiers in ascending order. Unproven is the lowest. */
export type Tier = 'unproven' | 'bronze' | 'silver' | 'gold';

/**
 * LAX and ACP record of one agent, per the SEAT2 interface_fixed contract.
 * Missing, null, negative, non-numeric or out-of-range fields count as absent
 * (or are clamped). scoreAgent never throws on a record.
 */
export interface AgentRecord {
  /** Whole days since the LAX listing was created. */
  listing_age_days?: number | null;
  /** Accepted deliveries on LAX. */
  accepted?: number | null;
  /** Rejected deliveries on LAX. */
  rejected?: number | null;
  /** Admission test: true passed, false failed, null or absent not taken. */
  admission_passed?: boolean | null;
  /** Listing shows the AIAX ready badge. */
  aiax_ready?: boolean | null;
  /** ACP score from 0 to 100, null or absent when there is none. */
  acp_score?: number | null;
}

/** Second opinion from 0 to 100 (for example Helixa). */
export type OutsideScore = number | { score: number; source?: string } | null | undefined;

/** Optional blend weight for tests and callers that need it. Not part of the fixed two-arg interface. */
export interface ScoreOptions {
  /** Weight of the outside score in the blend, 0 to 0.5. Default 0.2. */
  outsideWeight?: number;
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  reasons: string[];
}
