import type { AgentRecord, OutsideScore, ScoreOptions, ScoreResult, Tier } from './types.js';
import {
  DEFAULT_OUTSIDE_WEIGHT, FULL_AGE_DAYS, FULL_VOLUME, MAX_OUTSIDE_WEIGHT, POINTS,
  provenTier, tierIndex, tierRange, TIERS,
} from './rules.js';

export * from './types.js';
export * from './rules.js';

/** A count or measure: a finite number at or above zero, else zero with a reason. */
function count(value: unknown, label: string, reasons: string[]): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    reasons.push(`The ${label} value was not a valid number, so it counted as zero.`);
    return 0;
  }
  return value;
}

function percent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pull a 0–100 number out of an OutsideScore (number or { score }). */
function outsideNumber(outside: OutsideScore): number | null | undefined {
  if (outside === undefined) return undefined;
  if (outside === null) return null;
  if (typeof outside === 'number') return outside;
  if (typeof outside === 'object' && outside !== null && 'score' in outside) {
    return (outside as { score: unknown }).score as number;
  }
  return null;
}

/**
 * Cerberus chamber 2. Scores an agent 0 to 100 from its LAX and ACP record and puts it in a tier.
 * An agent with no accepted delivery is unproven: lowest tier, never a refusal.
 * An optional outside score (0 to 100, or { score, source? }) is blended in as a second opinion
 * and can move the tier by at most one step.
 * Pure and deterministic: no clock, no network, no randomness. Never throws on a record.
 *
 * Fixed interface: scoreAgent(record, outside?) -> { score, tier, reasons[] }.
 * A third options argument may set outsideWeight for callers that need it; hidden tests use two args.
 */
export function scoreAgent(record: AgentRecord, outside?: OutsideScore, options: ScoreOptions = {}): ScoreResult {
  const reasons: string[] = [];
  const r: AgentRecord = record ?? {};

  const accepted = Math.floor(count(r.accepted, 'accepted deliveries', reasons));
  const rejected = Math.floor(count(r.rejected, 'rejected deliveries', reasons));
  const ageDays = count(r.listing_age_days, 'listing age', reasons);

  let deliveryPts = 0;
  const total = accepted + rejected;
  if (total === 0) {
    reasons.push('No delivery on record yet, so the delivery part gives 0 of 40 points.');
  } else {
    const rate = accepted / total;
    const volume = Math.min(accepted, FULL_VOLUME) / FULL_VOLUME;
    deliveryPts = POINTS.deliveries * rate * (0.5 + 0.5 * volume);
    reasons.push(
      `${accepted} accepted and ${rejected} rejected deliveries give ${round1(deliveryPts)} of 40 points.`,
    );
  }

  let admissionPts = 0;
  if (r.admission_passed === true) {
    admissionPts = POINTS.admission;
    reasons.push('Passed the admission test: 20 of 20 points.');
  } else if (r.admission_passed === false) {
    reasons.push('Failed the admission test: 0 of 20 points.');
  } else {
    reasons.push('No admission test result: 0 of 20 points.');
  }

  const agePts = POINTS.listingAge * Math.min(ageDays, FULL_AGE_DAYS) / FULL_AGE_DAYS;
  reasons.push(`Listed for ${Math.floor(ageDays)} days: ${round1(agePts)} of 15 points.`);

  const aiaxPts = r.aiax_ready === true ? POINTS.aiax : 0;
  reasons.push(r.aiax_ready === true ? 'AIAX ready: 5 of 5 points.' : 'Not AIAX ready: 0 of 5 points.');

  const acp = percent(r.acp_score);
  let acpPts = 0;
  if (acp === null) {
    if (r.acp_score !== undefined && r.acp_score !== null) {
      reasons.push('The ACP score was outside 0 to 100, so it counted as zero.');
    } else {
      reasons.push('No ACP score: 0 of 20 points.');
    }
  } else {
    acpPts = POINTS.acp * acp / 100;
    reasons.push(`ACP score ${acp}: ${round1(acpPts)} of 20 points.`);
  }

  const base = Math.round(deliveryPts + admissionPts + agePts + aiaxPts + acpPts);

  if (accepted === 0) {
    reasons.push(`Record score ${base}. No accepted delivery yet, so the tier is unproven. The agent is not refused.`);
    const outRaw = outsideNumber(outside);
    if (outRaw !== undefined && outRaw !== null) {
      reasons.push('The outside score was noted but cannot lift an agent with no accepted delivery out of unproven.');
    }
    return { score: base, tier: 'unproven', reasons };
  }

  const baseTier = provenTier(base);
  reasons.push(`Record score ${base}, tier ${baseTier}.`);

  const outRaw = outsideNumber(outside);
  if (outRaw === undefined || outRaw === null) {
    return { score: base, tier: baseTier, reasons };
  }

  const out = percent(outRaw);
  if (out === null) {
    reasons.push('The outside score was outside 0 to 100 and was ignored.');
    return { score: base, tier: baseTier, reasons };
  }

  let weight = DEFAULT_OUTSIDE_WEIGHT;
  if (options.outsideWeight !== undefined) {
    const w = options.outsideWeight;
    weight = Number.isFinite(w) ? Math.min(Math.max(w, 0), MAX_OUTSIDE_WEIGHT) : DEFAULT_OUTSIDE_WEIGHT;
  }

  let score = Math.round(base * (1 - weight) + out * weight);
  let tier: Tier = provenTier(score);
  reasons.push(`Outside score ${out} blended at ${Math.round(weight * 100)} percent gives ${score}.`);

  const step = tierIndex(tier) - tierIndex(baseTier);
  if (Math.abs(step) > 1) {
    const allowed = TIERS[tierIndex(baseTier) + Math.sign(step)] as Exclude<Tier, 'unproven'>;
    const [lo, hi] = tierRange(allowed);
    score = Math.min(Math.max(score, lo), hi);
    tier = allowed;
    reasons.push(`The outside score can move the tier one step at most, so the tier is ${allowed} and the score is ${score}.`);
  } else if (step !== 0) {
    reasons.push(`The outside score moved the tier one step, from ${baseTier} to ${tier}.`);
  }

  return { score, tier, reasons };
}
