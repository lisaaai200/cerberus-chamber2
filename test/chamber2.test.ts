import { describe, expect, it } from 'vitest';
import {
  scoreAgent, provenTier, tierRange, tierIndex, GOLD_MIN, SILVER_MIN, TIER_BOUNDARIES,
  type AgentRecord, type Tier,
} from '../src/index.js';

const proven10 = { accepted: 10, rejected: 0, aiax_ready: true } as const;

describe('tier boundaries (table driven)', () => {
  const rows: Array<[string, AgentRecord, number, Tier]> = [
    ['empty record', {}, 0, 'unproven'],
    ['strong record but nothing accepted', { accepted: 0, admission_passed: true, aiax_ready: true, acp_score: 100, listing_age_days: 180 }, 60, 'unproven'],
    ['first accepted delivery only', { accepted: 1 }, 22, 'bronze'],
    ['just under silver', { ...proven10, acp_score: 70 }, SILVER_MIN - 1, 'bronze'],
    ['exactly silver', { ...proven10, acp_score: 75 }, SILVER_MIN, 'silver'],
    ['just under gold', { ...proven10, admission_passed: true, acp_score: 70 }, GOLD_MIN - 1, 'silver'],
    ['exactly gold', { ...proven10, admission_passed: true, acp_score: 75 }, GOLD_MIN, 'gold'],
    ['full marks', { ...proven10, admission_passed: true, acp_score: 100, listing_age_days: 400 }, 100, 'gold'],
  ];
  it.each(rows)('%s', (_name, record, score, tier) => {
    const r = scoreAgent(record);
    expect(r.score).toBe(score);
    expect(r.tier).toBe(tier);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.every((s) => typeof s === 'string' && s.trim().length > 0)).toBe(true);
  });

  it.each([
    [0, 'bronze'], [SILVER_MIN - 1, 'bronze'], [SILVER_MIN, 'silver'], [GOLD_MIN - 1, 'silver'], [GOLD_MIN, 'gold'], [100, 'gold'],
  ] as const)('provenTier(%i) is %s', (s, t) => expect(provenTier(s)).toBe(t));

  it('tier ranges and TIER_BOUNDARIES cover 0 to 100 without gaps', () => {
    expect(tierRange('bronze')).toEqual([0, SILVER_MIN - 1]);
    expect(tierRange('silver')).toEqual([SILVER_MIN, GOLD_MIN - 1]);
    expect(tierRange('gold')).toEqual([GOLD_MIN, 100]);
    expect(TIER_BOUNDARIES.bronze).toEqual({ min: 0, max: SILVER_MIN - 1 });
    expect(TIER_BOUNDARIES.silver).toEqual({ min: SILVER_MIN, max: GOLD_MIN - 1 });
    expect(TIER_BOUNDARIES.gold).toEqual({ min: GOLD_MIN, max: 100 });
  });
});

describe('unproven agents are never refused', () => {
  it('returns a result with the lowest tier and says it is not refused', () => {
    const r = scoreAgent({ rejected: 3, admission_passed: false });
    expect(r.tier).toBe('unproven');
    expect(r.reasons.join(' ')).toMatch(/not refused/);
    expect(r.reasons.join(' ')).toMatch(/Failed the admission test/);
  });
  it('the outside score cannot lift an unproven agent', () => {
    const r = scoreAgent({}, 100, { outsideWeight: 0.5 });
    expect(r.tier).toBe('unproven');
    expect(r.reasons.join(' ')).toMatch(/cannot lift/);
  });
  it('survives a null or missing record and bad values', () => {
    expect(scoreAgent(null as unknown as AgentRecord).tier).toBe('unproven');
    const r = scoreAgent({
      accepted: -2,
      rejected: Number.NaN,
      listing_age_days: 'x' as unknown as number,
      acp_score: 150,
      admission_passed: null,
      aiax_ready: null,
    });
    expect(r).toMatchObject({ score: 0, tier: 'unproven' });
    expect(r.reasons.filter((x) => /counted as zero/.test(x))).toHaveLength(4);
  });
});

describe('outside score as a second opinion', () => {
  const silver = { ...proven10, acp_score: 75 }; // record score 60
  it('blends at 20 percent by default and can move one step', () => {
    const down = scoreAgent(silver, 0);
    expect(down).toMatchObject({ score: 48, tier: 'bronze' });
    expect(down.reasons.join(' ')).toMatch(/moved the tier one step, from silver to bronze/);
    const up = scoreAgent({ ...proven10, admission_passed: true, acp_score: 70 }, 100);
    expect(up).toMatchObject({ score: 83, tier: 'gold' });
  });
  it('accepts OutsideScore as { score, source? }', () => {
    const r = scoreAgent(silver, { score: 0, source: 'helixa' });
    expect(r).toMatchObject({ score: 48, tier: 'bronze' });
  });
  it('treats a non-score outside value as absent', () => {
    expect(scoreAgent(silver, 'nope' as unknown as number)).toMatchObject({ score: 60, tier: 'silver' });
    expect(scoreAgent(silver, {} as unknown as number)).toMatchObject({ score: 60, tier: 'silver' });
  });
  it('keeps the tier when the blend stays inside it', () => {
    expect(scoreAgent(silver, 60)).toMatchObject({ score: 60, tier: 'silver' });
  });
  it('clamps a two step move to one step (gold to bronze becomes silver)', () => {
    const gold = { ...proven10, admission_passed: true as const, acp_score: 75 }; // 80
    const r = scoreAgent(gold, 0, { outsideWeight: 0.5 });
    expect(r).toMatchObject({ score: SILVER_MIN, tier: 'silver' });
    expect(r.reasons.join(' ')).toMatch(/one step at most/);
  });
  it('clamps a two step move up (bronze to gold becomes silver)', () => {
    const bronze = { ...proven10, acp_score: 70 }; // 59
    const r = scoreAgent(bronze, 100, { outsideWeight: 0.5 });
    expect(r).toMatchObject({ score: GOLD_MIN - 1, tier: 'silver' });
  });
  it('ignores an outside score out of range, and caps or defaults the weight', () => {
    expect(scoreAgent(silver, 101).score).toBe(60);
    expect(scoreAgent(silver, 101).reasons.join(' ')).toMatch(/ignored/);
    expect(scoreAgent(silver, null)).toMatchObject({ score: 60, tier: 'silver' });
    expect(scoreAgent(silver, 0, { outsideWeight: 9 }).reasons.join(' ')).toMatch(/50 percent/);
    expect(scoreAgent(silver, 0, { outsideWeight: Number.NaN }).reasons.join(' ')).toMatch(/20 percent/);
    expect(scoreAgent(silver, 0, { outsideWeight: -1 }).score).toBe(60);
  });
  it('never moves the tier more than one step for any input (deterministic sweep)', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 2000; i++) {
      const admissionRoll = Math.floor(rnd() * 3);
      const rec: AgentRecord = {
        accepted: Math.floor(rnd() * 15),
        rejected: Math.floor(rnd() * 5),
        listing_age_days: Math.floor(rnd() * 400),
        admission_passed: admissionRoll === 0 ? true : admissionRoll === 1 ? false : null,
        aiax_ready: rnd() > 0.5,
        acp_score: Math.floor(rnd() * 101),
      };
      const out = Math.floor(rnd() * 101);
      const w = rnd() * 0.5;
      const base = scoreAgent(rec);
      const blended = scoreAgent(rec, out, { outsideWeight: w });
      expect(Math.abs(tierIndex(blended.tier) - tierIndex(base.tier))).toBeLessThanOrEqual(1);
      expect(blended.score).toBeGreaterThanOrEqual(0);
      expect(blended.score).toBeLessThanOrEqual(100);
      expect(scoreAgent(rec, out, { outsideWeight: w })).toEqual(blended);
      // object form of OutsideScore matches the number form
      expect(scoreAgent(rec, { score: out })).toEqual(scoreAgent(rec, out));
    }
  });
});

describe('monotonicity on the fixed fields', () => {
  it('more accepted, longer listing, passed admission, aiax ready or higher ACP never lower the score', () => {
    const base: AgentRecord = { accepted: 2, rejected: 1, listing_age_days: 10, admission_passed: false, aiax_ready: false, acp_score: 40 };
    const s0 = scoreAgent(base).score;
    expect(scoreAgent({ ...base, accepted: 5 }).score).toBeGreaterThanOrEqual(s0);
    expect(scoreAgent({ ...base, listing_age_days: 180 }).score).toBeGreaterThanOrEqual(s0);
    expect(scoreAgent({ ...base, admission_passed: true }).score).toBeGreaterThanOrEqual(s0);
    expect(scoreAgent({ ...base, aiax_ready: true }).score).toBeGreaterThanOrEqual(s0);
    expect(scoreAgent({ ...base, acp_score: 90 }).score).toBeGreaterThanOrEqual(s0);
  });
  it('more rejected deliveries never raise the score', () => {
    const base: AgentRecord = { accepted: 5, rejected: 0, listing_age_days: 30, admission_passed: true, aiax_ready: true, acp_score: 50 };
    const s0 = scoreAgent(base).score;
    expect(scoreAgent({ ...base, rejected: 5 }).score).toBeLessThanOrEqual(s0);
  });
});
