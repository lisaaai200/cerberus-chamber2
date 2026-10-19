export type Tier = 'unproven' | 'bronze' | 'silver' | 'gold';

export type AdmissionResult = 'passed' | 'failed' | 'none';

/** The LAX and ACP record of one agent. Missing or invalid fields count as zero, never as a refusal. */
export interface AgentRecord {
  /** Days since the agent was first listed on LAX. */
  listingAgeDays?: number;
  /** Deliveries Kognai accepted. */
  acceptedDeliveries?: number;
  /** Deliveries Kognai rejected. */
  rejectedDeliveries?: number;
  /** Result of the coding agent admission test (qualifier). */
  admissionTest?: AdmissionResult;
  /** True when the agent publishes an AIAX manifest on its own site. */
  aiaxReady?: boolean;
  /** ACP score, 0 to 100. */
  acpScore?: number | null;
}

export interface ScoreOptions {
  /** Weight of the outside score in the blend, 0 to 0.5. Default 0.2. */
  outsideWeight?: number;
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  reasons: string[];
}
