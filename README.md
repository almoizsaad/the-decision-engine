# The Decision Engine

A decision layer that takes a proposed action and its context and returns exactly one of
**execute · ask · defer · escalate · refuse** — with confidence, a risk score, the evidence it
used, what's missing, a reversibility assessment, and a full audit trail. Four domains are
wired into the same, unmodified scoring function: support ticket triage, refund approval, code
deploy gating, and content moderation.

> **Live demo:**[https://decision-engine-rouge.vercel.app/](https://decision-engine-rouge.vercel.app/)


## Why this exists

Most "AI agent" demos wire a model up to tools and call it done. The interesting problem isn't
calling tools — it's an explicit, inspectable layer that decides whether to act *at all*, and
can say no, or "not yet," or "ask someone with more authority," instead of always finding a way
to say yes. See [THESIS.md](./THESIS.md) for where this goes over the next two years.

## Quickstart

```bash
git clone <this-repo-url>
cd the-decision-engine
npm install
npm run dev       # → http://localhost:3000
```



Other useful commands:

```bash
npm run test        # vitest — 40+ cases covering matrix boundaries, the feedback loop, and
                     # every example action in every domain
npm run lint         # eslint
npm run build        # type-check + production build
npm run decisions    # prints every domain's decision to the terminal — a 5-second sanity
                     # check when you change a domain's numbers, see scripts/print-decisions.ts
```

## Using the demo

1. Pick a domain from the top nav (**Support ticket triage**, **Refund approval**,
   **Code deploy gate**, **Content moderation**).
2. The queue on the left lists every pending proposed action in that domain, each with a
   colored outcome chip and its confidence/risk numbers. Click one.
3. The decision stage on the right shows the full picture: the outcome, why (in plain language
   and as a signal-by-signal trace you can expand), the evidence used vs. what's missing, and
   reversibility/blast-radius/cost-of-being-wrong. The action buttons match the outcome —
   `execute` gets a one-click "run it," `ask` gets approve/edit/reject, `defer` gets an
   acknowledge, `escalate` gets a routing button, and `refuse` explains itself and offers only
   an acknowledgment.
4. Every response you make appends a row to the **audit trail** at the bottom — click a row to
   expand its full JSON trace.
5. Click **"This wasn't the right call"** on any decision to discount the signal that drove it —
   the discount is scoped to that domain (see [ARCHITECTURE.md](./ARCHITECTURE.md#the-feedback-loop-srcenginefeedbackts)) and shows up immediately
   in the banner under the domain description and in the signal trace as "weight adjusted."
6. Click **"Run the failure case"** in any domain to load a deliberately adversarial example —
   see [FAILURE_TESTS.md](./FAILURE_TESTS.md) for what each one is designed to expose and why the
   engine still gets it wrong.

## How it's built

```
src/
  engine/            domain-agnostic core — the whole "decision layer"
    types.ts           shared contracts (ProposedAction, Signal, Decision, ...)
    decisionEngine.ts  decide() — the five-way matrix, ~230 lines, zero domain imports
    feedback.ts        "not the priority" → scoped signal-weight discounting
    audit.ts           localStorage-backed audit log + id formatting
    __tests__/         boundary tests for all of the above
  domains/           one file per domain, each building ProposedAction[] for decide()
    ticketTriage.ts, refundApproval.ts, deployGate.ts, contentModeration.ts
    domainHelpers.ts   shared evidence-building utilities
    __tests__/domainConformance.test.ts   same decide(), all four domains, asserted outcomes
  hooks/useDecisionSession.ts   wires domains + engine + feedback + audit into UI state
  components/         QueueList, DecisionStage, EvidencePanel, SignalTrace, ActionControls,
                      AuditTrail, Gauge, plus shadcn/ui primitives in components/ui/
```

Stack: React 19 + TypeScript + Vite + Tailwind. No router (one screen), no backend, no API keys.
Full data-flow diagram and the reasoning behind the matrix ordering: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Submission checklist (self-graded against the rubric)

- [x] **Decision layer returns one of execute/ask/defer/escalate/refuse** — `decide()` in
      `src/engine/decisionEngine.ts`, tested at exact boundary values in
      `decisionEngine.test.ts`.
- [x] **Confidence, risk, evidence, missing information, reversibility per decision** — all on
      the `Decision` type, all rendered in the decision stage.
- [x] **Full audit trail per decision** — `AuditTrail.tsx` + `engine/audit.ts`; every response
      appends, nothing edits or removes an entry from the UI.
- [x] **At least 3 example domains** — four: ticket triage, refund approval, code deploy,
      content moderation.
- [x] **One deliberate failure test** — four, one per domain: [FAILURE_TESTS.md](./FAILURE_TESTS.md).
- [x] **Architecture snapshot** — [ARCHITECTURE.md](./ARCHITECTURE.md).
- [x] **Two-year thesis, ≤300 words** — [THESIS.md](./THESIS.md) (287 words).
- [x] **Notes: AI tools, key decisions, out of scope** — [NOTES.md](./NOTES.md).
- [x] **Public repo, runs from a clean clone, has a README** — this file; `npm install && npm run dev`.
- [ ] **Live demo URL** — deploy before submitting, see [DEPLOYMENT.md](./DEPLOYMENT.md). Nothing in
      this repo requires a backend or secrets, so this is a ~2-minute step.
- [ ] **90-second Loom walkthrough** — optional but recommended by the brief; not included in
      this repo since it has to be recorded against the live deploy. A suggested walkthrough
      script is in [DEPLOYMENT.md](./DEPLOYMENT.md#loom-script) once you've deployed.

## What this is not

Not a chatbot, not a prompt wrapper, and not scored by an LLM call — see
[NOTES.md](./NOTES.md#explicitly-out-of-scope) for the full, honest list of what's out of scope
and why, including exactly what a production version of this would need that this repo
deliberately doesn't build.
