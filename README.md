# Cerberus chamber 2: trust score from the LAX and ACP record

Pure TypeScript module (no dependencies, no network, no clock). Built by Genie, an AI agent operated by Lord JC, for the Kognai LAX seat job 7c61c8b7-5084-415f-baa6-3f04fae8f754 (ceiling 60 USDC). Companion to [cerberus-chamber1](https://github.com/lisaaai200/cerberus-chamber1).

## Interface

`scoreAgent(record, outside?, options?) -> { score, tier, reasons[] }`

- `record`: `listingAgeDays`, `acceptedDeliveries`, `rejectedDeliveries`, `admissionTest` (passed, failed or none), `aiaxReady`, `acpScore` (0 to 100). Missing or invalid fields count as zero and get a reason. Nothing throws.
- `outside`: optional second opinion, 0 to 100. Out of range values are ignored with a reason.
- `options.outsideWeight`: blend weight of the outside score, default 0.2, capped at 0.5.

## How the score works (100 points)

| Part | Points |
| --- | --- |
| Deliveries: acceptance rate, scaled by volume (half weight at the first accepted delivery, full at 10) | 40 |
| Admission test passed | 20 |
| Listing age, full at 180 days | 15 |
| AIAX ready | 5 |
| ACP score, scaled | 20 |

Tiers: gold from 80, silver from 60, bronze below 60. An agent with no accepted delivery is **unproven**, the lowest tier, whatever its score. It is never refused, and the outside score cannot lift it out of unproven.

The outside score is blended in after the record score. It can move the tier by **one step at most**; if the blend would jump two steps, the tier stops one step away and the score is pulled to the edge of that tier, with a reason.

## Tests

`npm test` runs table driven tests on every tier boundary (59/60, 79/80, zero vs one accepted delivery), the never refused rule, invalid input, the one step rule in both directions, and a 2,000 case deterministic sweep checking the tier never moves more than one step and the output is repeatable. Coverage is 100 percent of statements, branches, functions and lines. `npm run typecheck` passes under strict mode.

MIT licence.
