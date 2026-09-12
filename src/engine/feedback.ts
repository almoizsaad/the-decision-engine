/**
 * The feedback loop.
 *
 * When a human overrides a decision (the domain's "Not the priority" /
 * "Wrong call" action), the engine doesn't just re-sort a list — it turns
 * the correction into a weight adjustment on whichever signal drove the
 * outcome, scoped to that domain. The next action of the same type in the
 * same domain is scored with the adjusted weight. This is the whole answer
 * to "is this just a hardcoded rule table": the weights are data, not
 * source code, and they move in response to a human saying no.
 *
 * Scope is deliberate: overrides key on `${domain}:${signalId}`, so a
 * correction in refund-approval can never change a signal's weight in
 * ticket-triage even if both domains happen to define a signal with the
 * same id. See FAILURE_TESTS.md for what this mechanism does NOT solve
 * (it doesn't persist across a deploy, and it has no rate limiting on how
 * many times one person can override the same signal).
 */
import type { Decision } from "./types";

export type WeightOverrides = Record<string, number>;

const STRUCTURAL_SIGNAL_IDS = new Set(["evidence_gap", "cost_of_wrong_action"]);
const DECAY_FACTOR = 0.8;
const MIN_FACTOR = 0.2;

export interface FeedbackResult {
  overrides: WeightOverrides;
  adjustedSignalId: string | null;
  adjustedLabel: string | null;
  newFactor: number | null;
}

/**
 * Finds the signal that contributed most to the decision (excluding the
 * two engine-level structural signals, which reflect facts about the
 * action rather than a domain's judgment) and discounts its weight for
 * this domain by 20%, down to a floor of 20% of its original weight so a
 * single bad read can never be zeroed out entirely.
 */
export function applyNotThePriorityFeedback(
  overrides: WeightOverrides,
  decision: Decision
): FeedbackResult {
  const candidates = [...decision.confidenceTrace, ...decision.riskTrace].filter(
    (t) => !STRUCTURAL_SIGNAL_IDS.has(t.signal.id)
  );

  if (candidates.length === 0) {
    return { overrides, adjustedSignalId: null, adjustedLabel: null, newFactor: null };
  }

  const dominant = candidates.reduce((a, b) =>
    Math.abs(b.contribution) > Math.abs(a.contribution) ? b : a
  );

  const key = `${decision.domain}:${dominant.signal.id}`;
  const current = overrides[key] ?? 1;
  const next = Math.max(MIN_FACTOR, current * DECAY_FACTOR);

  return {
    overrides: { ...overrides, [key]: next },
    adjustedSignalId: dominant.signal.id,
    adjustedLabel: dominant.signal.label,
    newFactor: next,
  };
}

export function resetOverridesForDomain(
  overrides: WeightOverrides,
  domain: string
): WeightOverrides {
  const next: WeightOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith(`${domain}:`)) next[key] = value;
  }
  return next;
}

export function overridesForDomain(
  overrides: WeightOverrides,
  domain: string
): Array<{ signalId: string; factor: number }> {
  return Object.entries(overrides)
    .filter(([key]) => key.startsWith(`${domain}:`))
    .map(([key, factor]) => ({ signalId: key.split(":")[1], factor }));
}
