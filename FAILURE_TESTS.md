# Failure tests

The brief asks for one deliberate failure case. This repo has four — one per domain — because
"knowing when not to act" is only interesting if you can show *specific* ways it fails, not just
assert that it sometimes might. Each one is loadable in the running demo via the **Run the
failure case** toggle at the bottom of the queue panel for that domain.

None of these are bugs in `decide()`. All four are **schema poverty**: the engine scores exactly
what it's given, correctly, and the thing that would have changed the right answer was never in
the evidence schema for that domain to begin with. That distinction matters — a scoring bug gets
fixed by changing a number; schema poverty gets fixed (if it's fixable at all) by adding a new
evidence field and asking whether it's even observable at decision time.

## 1. Ticket triage — the confirmed-happy customer who isn't the customer

**Seed:** a support ticket ends with "never mind, figured it out — thanks!", matches a
high-confidence KB article, and comes from an account with a clean history.

**What the engine does:** `execute`, confidence 97, risk 14. Every signal this domain tracks —
KB match strength, resolution precedent, sentiment, severity, tier, escalation history — reads
as close to ideal as this domain's data ever gets.

**What's actually happening:** the account was flagged for a suspected takeover 40 minutes
earlier by a different system. This ticket is the attacker confirming access, not a customer
being satisfied. Nothing in this domain's evidence schema — `kb_match_confidence`,
`sentiment_score`, `customer_tier`, `similar_tickets_resolved_count`, `product_severity_tag`,
`prior_escalations_90d` — has a field for "a security system flagged this account recently."
The ticket-triage domain simply doesn't talk to account-security systems.

**Failure class:** missing cross-system evidence. The fix isn't a better threshold, it's wiring
a new evidence source in — and knowing to ask the question "what system would know if this
looked different" in the first place.

## 2. Refund approval — the fraud pattern that only exists in aggregate

**Seed:** a $24 refund, brand-new account (so no refund history exists yet), inside the policy
window, photo attached.

**What the engine does:** `execute`, confidence 100, risk 2. Every per-record signal is about as
clean as this domain's schema can produce — that's the point of picking a brand-new account: it
has no history to look suspicious with.

**What's actually happening:** this is request #1 of 40 near-identical $24 refunds from 40
different brand-new accounts, all arriving within the hour, all shipping to the same address.
That pattern is only visible in aggregate, across records, over a time window — and this engine
scores one `ProposedAction` at a time with no memory of the other 39.

**Failure class:** aggregate/velocity fraud invisible to per-record scoring. This is arguably the
sharpest limit of the whole architecture: the decision layer as built has no concept of "this
looks like the first of a batch." A production system would need a separate aggregation layer
feeding a `velocity_risk`-style evidence field back into the per-record decision — which this
repo doesn't build, and says so plainly rather than hand-waving it.

## 3. Code deploy gate — the transitive risk with no evidence field

**Seed:** a one-line lockfile bump to a pinned dependency's patch version. CI green, two
reviewer approvals, tiny diff, doesn't touch auth or payments, rollback plan on file.

**What the engine does:** `execute`, confidence 92, risk 7 — the safest-looking deploy in the
domain's example set, by design.

**What's actually happening:** the patch silently changed the default timeout behavior of an
HTTP client used deep in the payment-retry path. This domain's schema (`ci_status`,
`test_coverage_delta_pct`, `diff_size_lines`, `touches_auth_or_payments`, `has_rollback_plan`,
`reviewer_approvals_count`, `prior_deploy_failure_rate_pct`, `is_weekend_or_freeze_window`) has
no field for "does this transitively touch a sensitive code path three dependencies away" —
`touches_auth_or_payments` is a direct-path classifier, not a dependency-graph one.

**Failure class:** transitive/indirect blast radius. The domain's own reversibility model
(`has_rollback_plan`) assumes the *deploy* is what needs rolling back; it doesn't model "the
dependency's behavior changed underneath a code path nothing here inspected."

## 4. Content moderation — the case where "ask" doesn't help either

This one is different from the other three, and that difference is the point.

**Seed:** a post using in-group reclaimed language scores high on the toxicity classifier
(0.88) with fairly high classifier confidence (0.79), from an account with no strikes and only
2 reports.

**What the engine does:** `ask`, confidence 47, risk 25 — *not* a confident wrong execute. Low
report volume and no strike history keep the weighted confidence too low to clear the execute
bar, so the engine correctly routes this to a human instead of acting alone.

**What's actually happening:** the account belongs to a moderator of a support community for
the group in question, and the language is reclaimed use within that community — context this
domain's schema has no field for (`toxicity_score`, `classifier_confidence`, `user_prior_strikes`,
`report_count`, `is_verified_public_figure`, `context_flag_satire_or_news` — none of these
represent in-group/out-of-group speaker identity).

**Why this is the more interesting failure:** the first three cases show the engine confidently
executing the wrong action. This one shows that routing to "ask" isn't automatically a fix. A
human moderator handed the same toxicity score and the same missing context field can rubber-stamp
the same wrong removal one click later — they have no more visibility into the speaker's
community role than the model did. **A decision layer that hides the right outcome behind a
human checkpoint has moved the failure, not resolved it, if the human's evidence is the same
evidence the model had.** This is why the "why this outcome" reasoning trace always lists what's
missing, not just what fired — the honest move here isn't a more confident model, it's a visibly
incomplete decision that names its own blind spot.

## What the feedback loop does and doesn't fix here

"Not the priority" discounts the domain signal that contributed most to a wrong outcome, scoped
to that domain, for future actions of the same type — see `ARCHITECTURE.md`. It is a real,
tested mechanism (`src/engine/__tests__/feedback.test.ts`), and it is the right tool for
**miscalibration** — a signal that's weighted too aggressively relative to how predictive it
actually is.

It is the wrong tool for all four cases above, and this repo doesn't pretend otherwise:

- None of the four failures come from an existing signal being over- or under-weighted. They
  come from a signal that **doesn't exist yet** — discounting an existing signal's weight can't
  manufacture evidence the schema never collected.
- The override has no rate limit. Nothing stops a person from clicking "not the priority"
  repeatedly to walk a signal's weight down to the 20% floor for reasons that have nothing to
  do with signal quality.
- Overrides live in the same in-memory session state as everything else. They're read back from
  `localStorage` on reload in the same browser, but there's no server-side record of who changed
  what weight or why, and nothing here would survive a redeploy of the app itself.
- There's no mechanism at all for the aggregate-pattern failure (#2) — no amount of per-signal
  weight adjustment gives a per-record scorer memory of the other 39 records.

## What would actually help

Not built here, on purpose (see `NOTES.md` for the scope line): a velocity/aggregation layer
feeding derived evidence back into individual decisions, a dependency-graph-aware blast-radius
classifier for the deploy domain, an identity/context-aware evidence source for moderation, and
an audit-side sampling process that periodically checks *executed* decisions against
after-the-fact outcomes — since the whole premise of this engine is that the model shouldn't be
the last line of review for its own confident mistakes.
