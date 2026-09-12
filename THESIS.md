# Two-year thesis: decision layers become infrastructure, not application code

Today, "should this agent act" logic is scattered inside whatever application happens to be
calling the model — a `if confidence > 0.8` in one repo, a different threshold in the next,
none of it shared, none of it auditable across systems. That won't last, for the same reason
authentication didn't stay bespoke-per-app: once enough incidents trace back to "the threshold
was wrong and nobody could see why," the decision layer gets pulled out and centralized.

Three concrete predictions:

**1. Decision layers become a platform primitive, not a library choice.** Within two years,
"attach a decision policy to this tool call" will be a first-class capability of agent
frameworks and model providers, not something every team hand-rolls — the same way rate
limiting moved from app code into infrastructure.

**2. Reversibility becomes a required field, not a judgment call left to the model.** Every
serious agent framework will require an explicit, structured reversibility and blast-radius
annotation on any tool an agent can call — because the failure cases in `FAILURE_TESTS.md`
share a pattern: the model's *confidence* was fine, its *authority to act irreversibly* wasn't
examined at all. This repo's `reversibility` field is a bet on that becoming table stakes.

**3. "Ask" gets cheaper before "refuse" gets rarer.** The industry will spend the next two years
making human-confirmation UX fast enough that routing to a person stops feeling like a
bottleneck — not making models confident enough to skip the person. Confidence calibration is
the harder, slower problem; cheap disagreement is the tractable one, so that's where the
investment goes first.

**Falsifiable check, mid-2028:** if the leading agent frameworks still don't have a
standardized reversibility/blast-radius schema on tool definitions, this thesis was wrong about
what gets fixed first.

(287 words)
