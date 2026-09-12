# Notes

## AI tools used

Built with Claude (Anthropic) as a pair-programmer for the full stack: the decision matrix
design and its test boundaries, all four domain models and their synthetic data, the React UI,
and this documentation. No other AI tooling (no Copilot, no separate codegen pass). Every number
asserted in `src/domains/__tests__/domainConformance.test.ts` and the boundary values in
`decisionEngine.test.ts` were captured by actually running the code (`npm run decisions`, and
the equivalent ad-hoc scripts during development) rather than hand-calculated and hoped-for —
see the comment at the top of that test file.

## Key decisions, and why

**One `decide()` function, zero domain knowledge inside it.** The single biggest risk for a
project like this is that "decision engine" turns out to mean "a big if/else block per domain
that happens to share a UI." `src/engine/decisionEngine.ts` never imports from `src/domains`,
and `domainConformance.test.ts` runs the exact same function against all four domains' data.
Adding a fifth domain means writing a new file in `src/domains/`, not touching the engine.

**Reversibility is a first-class field, not folded into risk.** A low-risk score and an
irreversible-if-wrong action are different problems (see `ARCHITECTURE.md`'s discussion of the
matrix ordering). Modeling them as one number would have made the escalate/refuse distinction
impossible to reason about.

**Two structural risk signals live in the engine, not in any domain.** `evidence_gap` and
`cost_of_wrong_action` are computed once, centrally, so no domain can under-report a severe
blast radius or quietly skip missing-evidence detection. This was a deliberate response to the
obvious objection that a domain author could otherwise game their own numbers.

**The feedback loop is real but deliberately narrow.** "Not the priority" changes a signal
weight, scoped to a domain, with a floor so it can't be zeroed out. It is not a learned model,
it doesn't call an LLM, and it doesn't require an API key — see `FAILURE_TESTS.md` for an
honest accounting of exactly what it can't fix. The alternative (routing "not the priority"
through an LLM call to re-weight things) would have made the mechanism harder to test, harder
to explain in 90 seconds, and not obviously better at the four failure cases this repo actually
demonstrates.

**Synthetic data, not live APIs.** Every domain's examples are hand-authored but realistic
(dollar amounts, diff sizes, toxicity scores in plausible ranges) rather than lorem-ipsum
placeholders, and every `EvidenceItem.source` string names the real system a production
integration would call (`CI.pipeline.status`, `Billing.customer.chargeback_flag`, etc.) even
though nothing here actually calls it.

## Explicitly out of scope

- **No LLM in the scoring path.** Signals are computed with plain, inspectable arithmetic
  (`src/domains/*.ts`), not a model call. This was a deliberate trade: an LLM-scored signal
  would be harder to unit-test at exact boundary values (see `decisionEngine.test.ts`) and
  harder to explain to a stranger in 90 seconds, at the cost of not demonstrating LLM-based
  signal extraction from unstructured text. A production version would likely use an LLM to
  *extract* structured signals from raw text (a support ticket's body, a PR description) and
  feed that structured output into this same unchanged `decide()` function — the engine's
  contract doesn't care where a `Signal`'s `strength` number came from.
- **No backend, no database, no auth.** This is a static frontend. The audit trail persists to
  `localStorage` in the current browser only — it is a demonstration of *what* an audit trail
  should contain, not a production audit store (no access controls, no tamper-evidence, no
  server-side append-only guarantee). See `ARCHITECTURE.md`'s closing section.
- **No aggregate/cross-record analysis.** Every decision scores one `ProposedAction` in
  isolation. Failure case #2 in `FAILURE_TESTS.md` exists specifically to show why that's a real
  limit, not a hidden one.
- **No real integrations.** All evidence is synthetic. `EvidenceItem.source` strings describe
  what a real integration would be, not a live connection.
- **No authentication, multi-tenancy, or rate limiting** on the feedback-loop override
  mechanism — see `FAILURE_TESTS.md`.
