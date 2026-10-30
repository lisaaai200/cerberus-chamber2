# Cerberus chamber 2: trust score from the LAX and ACP record

Pure TypeScript module (no dependencies, no network, no clock). Built by Genie, an AI agent operated by Lord JC, for the Kognai LAX seat job 7c61c8b7-5084-415f-baa6-3f04fae8f754 (SEAT2). Companion to [cerberus-chamber1](https://github.com/lisaaai200/cerberus-chamber1).

## Interface (fixed)

`scoreAgent(record, outside?) -> { score, tier, reasons[] }`

```ts
type AgentRecord = {
  listing_age_days?: number | null;  // whole days since the LAX listing was created
  accepted?: number | null;          // accepted deliveries on LAX
  rejected?: number | null;          // rejected deliveries on LAX
  admission_passed?: boolean | null; // true passed, false failed, null or absent not taken
  aiax_ready?: boolean | null;       // the listing shows the AIAX ready badge
  acp_score?: number | null;         // ACP score 0 to 100
};
type OutsideScore = number | { score: number; source?: string } | null | undefined;
type Tier = 'unproven' | 'bronze' | 'silver' | 'gold';
```

- Missing, null, negative, non-numeric or out-of-range fields count as absent or are clamped. `scoreAgent` never throws on a record.
- An empty record `{}` is **unproven**. The agent is never refused.
- `outside` is a second opinion from 0 to 100 (or `{ score, source? }`). It can move the tier by **at most one step**.

## How the score works (100 points)

| Part | Points |
| --- | --- |
| Deliveries: acceptance rate, scaled by volume (half weight at the first accepted delivery, full at 10) | 40 |
| Admission test passed | 20 |
| Listing age, full at 180 days | 15 |
| AIAX ready | 5 |
| ACP score, scaled | 20 |

## Tier boundaries

Exported as `TIER_BOUNDARIES`, `SILVER_MIN` (60) and `GOLD_MIN` (80):

| Tier | Score range |
| --- | --- |
| unproven | no accepted delivery (any score) |
| bronze | 0 to 59 |
| silver | 60 to 79 |
| gold | 80 to 100 |

An agent with no accepted delivery is **unproven**, the lowest tier, whatever its score. The outside score cannot lift it out of unproven. If the blend would jump two proven tiers, the tier stops one step away and the score is pulled to the edge of that tier.

## Tests

`npm test` runs table-driven tests on every tier boundary (59/60, 79/80, zero vs one accepted delivery), the never-refused rule, invalid input, OutsideScore object form, the one-step rule in both directions, monotonicity on the fixed fields, and a 2,000-case deterministic sweep. Coverage is 100 percent of statements, branches, functions and lines. `npm run typecheck` passes under strict mode.

MIT licence.
