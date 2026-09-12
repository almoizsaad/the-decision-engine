# Architecture

One sentence: **every domain builds the same shape, one function scores it.**

```
inputs                signals                    decision                    audit
──────                ───────                    ────────                    ─────

raw record      →     domain builds:        →    decide() in                 AuditEntry
(ticket,              • Signal[]                 decisionEngine.ts:          appended when a
 refund,               (confidence + risk,        1. apply weight             human responds
 PR, post)             normalized 0–1,                overrides                (approve / edit /
                       weighted, with a           2. score evidence            reject / escalate /
 +                     one-line rationale)            coverage                 defer / refuse-ack /
                                                  3. add 2 universal            override feedback)
 domain's        →    • EvidenceItem[]               risk signals
 required              (present/absent,              (evidence_gap,          stored in
 evidence keys         with a source label)          cost_of_wrong_action)   localStorage,
                                                  4. weighted-average         rendered as an
 +                    • ReversibilityAssessment       confidence & risk       append-only ledger,
                       (reversible?, blast          5. run the 5-way          exportable as JSON
 domain's        →     radius, cost of                 decision matrix         via the expand
 thresholds            being wrong)                    (refuse → escalate      arrow on each row
 (5 numbers                                              → defer → ask →
 per domain)                                              execute, in that
                                                           order)
```

## The core contract (`src/engine/types.ts`)

A domain's entire job is to produce one `ProposedAction`:

```ts
ProposedAction {
  reversibility: { reversible, blastRadius, costOfWrongAction, rationale }
  evidence: EvidenceItem[]            // what's present AND what's absent
  requiredEvidenceKeys: string[]      // what "complete" looks like for this action
  signals: Signal[]                   // confidence- and risk-flavored readings, each in [0,1]
}
```

`decide(action, thresholds, weightOverrides)` in `src/engine/decisionEngine.ts` is the
entire decision layer. It is ~230 lines, has zero imports from `src/domains`, and is called
identically by all four domains and by every test in `src/engine/__tests__` and
`src/domains/__tests__/domainConformance.test.ts`. Nothing about a domain — its name, its
field names, its business logic — is visible inside it.

## Why the matrix is ordered rules, not a score threshold

A single "risk score > X → block" rule can't distinguish two very different failure modes:

- **High but bounded risk** → *escalate*. Something is concerning enough that a confirmation
  click isn't enough, but a person with the right authority can still make the call.
- **Low measured risk, but irreversible + severe cost + insufficient confidence** → *refuse*.
  The risk *score* might not even be that high — the point is that if the model is wrong,
  there's no cheap way back, so the bar for confidence has to be near-certain, and if it
  isn't met, the answer is no rather than "let's find out."

`applyMatrix()` checks these as separate, ordered conditions specifically so a high-confidence
read can never talk its way past an irreversibility problem, and a merely-elevated risk score
can never get waved through just because nothing crossed the hard refuse line. See the six
`it(...)` blocks in `decisionEngine.test.ts` under "matrix boundaries" — each one exists because
it is the one case where two adjacent outcomes could otherwise be confused.

## Two signals no domain can hide

Every domain supplies its own confidence and risk signals, but `decide()` always adds two more
to the risk side, computed by the engine itself:

- `evidence_gap` — `1 − evidenceCoverage`. A domain that doesn't check for missing fields still
  gets penalized for missing fields.
- `cost_of_wrong_action` — a fixed mapping from `costOfWrongAction` (`low`→0.1 … `severe`→1.0).
  A domain can't quietly under-report how bad it would be to get this wrong.

This is also *why* `decide()` can stay domain-agnostic: the two facts that matter most for
"should an AI act autonomously here" — how much is actually known, and how bad is being wrong —
are structural, not domain-specific, so they live in the engine, once.

## The feedback loop (`src/engine/feedback.ts`)

"Not the right call" doesn't just re-sort a queue. It finds the signal with the largest
contribution to that decision (excluding the two structural signals above, since those
describe facts about the action, not a domain's judgment call) and discounts its weight by
20%, scoped to `${domain}:${signalId}`, floored at 20% of the original so one bad read can't
zero a signal out. The next action of the same type in the same domain is scored with the
adjusted weight. See `src/engine/__tests__/feedback.test.ts` for the domain-scoping guarantee
and the floor behavior, and `FAILURE_TESTS.md` for what this mechanism does *not* solve.

## Audit trail (`src/engine/audit.ts`)

Every response to a decision — approve, edit, reject, escalate, defer, acknowledge a refusal,
or a weight-override — appends an `AuditEntry` (the full `Decision`, the full `ProposedAction`,
and the human's response) to a localStorage-backed array. The UI's audit panel is a direct
render of that array; nothing is summarized or dropped before display. `clearAuditLog()` exists
solely behind the demo's "reset session" control — there is no edit path for an existing entry.

## Where a real deployment would differ

This is a frontend-only demo with realistic synthetic data, by design — see `NOTES.md` for what's
deliberately out of scope. In production: `EvidenceItem.source` strings would be real API/DB
calls (not decorative labels), the audit trail would be append-only server-side storage with
access controls, and `decisionCounter`-style pure functions would need idempotency keys so a
retried request doesn't get scored and logged twice.
