/**
 * The decision layer itself.
 *
 * `decide()` is the entire "does this get to act" logic for every domain in
 * this repo. It never imports from src/domains — it only knows about the
 * shapes in types.ts. A domain's job is to normalize its own data into a
 * ProposedAction (signals + evidence + reversibility); this file's job is
 * to turn that into one of five outcomes with a number attached to every
 * claim it makes. See ARCHITECTURE.md for the full data flow and NOTES.md
 * for why the matrix is an explicit, ordered set of rules rather than a
 * learned model.
 */
import type {
  Decision,
  DecisionOutcome,
  DecisionThresholds,
  ProposedAction,
  Signal,
  SignalTraceEntry,
} from "./types";

/** Cost-of-wrong-action maps to a fixed risk contribution, engine-wide, so no domain can quietly under-weight a severe blast radius. */
const COST_TO_RISK_STRENGTH: Record<ProposedAction["reversibility"]["costOfWrongAction"], number> = {
  low: 0.1,
  medium: 0.4,
  high: 0.7,
  severe: 1.0,
};

/** Weighted average of signal.strength, using (possibly overridden) weights. Returns 0 if the list is empty. */
function weightedAverage(entries: SignalTraceEntry[]): number {
  const totalWeight = entries.reduce((sum, e) => sum + e.signal.weight, 0);
  if (totalWeight <= 0) return 0;
  const totalContribution = entries.reduce((sum, e) => sum + e.contribution, 0);
  return totalContribution / totalWeight;
}

function toTrace(signals: Signal[]): SignalTraceEntry[] {
  return signals.map((signal) => ({
    signal,
    contribution: signal.weight * signal.strength,
  }));
}

interface EvidenceAssessment {
  coverage: number;
  missing: string[];
}

function assessEvidence(action: ProposedAction): EvidenceAssessment {
  const required = action.requiredEvidenceKeys;
  if (required.length === 0) return { coverage: 1, missing: [] };
  const presentKeys = new Set(
    action.evidence.filter((e) => e.present).map((e) => e.key)
  );
  const missing = required.filter((key) => !presentKeys.has(key));
  return {
    coverage: (required.length - missing.length) / required.length,
    missing,
  };
}

/**
 * Applies weight overrides learned from prior "not the priority" feedback.
 * Overrides are scoped to `${domain}:${signalId}` — see feedback.ts — so a
 * correction made in one domain never touches another domain's signals,
 * even when both domains happen to define a signal with the same id.
 */
function applyOverrides(
  domain: string,
  signals: Signal[],
  overrides: Record<string, number>
): { signals: Signal[]; appliedIds: string[] } {
  const appliedIds: string[] = [];
  const adjusted = signals.map((signal) => {
    const key = `${domain}:${signal.id}`;
    const factor = overrides[key];
    if (factor === undefined || factor === 1) return signal;
    appliedIds.push(signal.id);
    return { ...signal, weight: signal.weight * factor };
  });
  return { signals: adjusted, appliedIds };
}

/**
 * The five-way decision matrix. Rules are evaluated in this fixed order —
 * refuse and escalate are checked before execute ever gets a chance to
 * fire, so a high-risk case can never slip through on high confidence
 * alone. This ordering is the actual "decision layer": everything above it
 * is just producing the two numbers (confidence, risk) the matrix reads.
 */
function applyMatrix(params: {
  confidence: number;
  risk: number;
  coverage: number;
  reversible: boolean;
  costOfWrongAction: ProposedAction["reversibility"]["costOfWrongAction"];
  blastRadius: ProposedAction["reversibility"]["blastRadius"];
  thresholds: DecisionThresholds;
  policyViolation: boolean;
}): { outcome: DecisionOutcome; reasoning: string[] } {
  const {
    confidence,
    risk,
    coverage,
    reversible,
    costOfWrongAction,
    blastRadius,
    thresholds,
    policyViolation,
  } = params;
  const reasoning: string[] = [];

  if (policyViolation) {
    reasoning.push(
      "A hard policy-violation signal is present — refused regardless of confidence or risk score."
    );
    return { outcome: "refuse", reasoning };
  }

  if (risk >= thresholds.refuseMinRisk) {
    reasoning.push(
      `Risk score ${risk} is at or above the refuse threshold (${thresholds.refuseMinRisk}) — the engine will not propose this action for approval at all.`
    );
    return { outcome: "refuse", reasoning };
  }

  if (!reversible && costOfWrongAction === "severe" && confidence < thresholds.executeConfidence) {
    reasoning.push(
      `Action is irreversible with a severe cost of being wrong, and confidence (${confidence}) hasn't cleared the execute bar (${thresholds.executeConfidence}) — refused rather than risked.`
    );
    return { outcome: "refuse", reasoning };
  }

  if (risk >= thresholds.escalateMinRisk) {
    reasoning.push(
      `Risk score ${risk} is at or above the escalate threshold (${thresholds.escalateMinRisk}) — routed to a human decision-maker with authority, not just a confirmation click.`
    );
    return { outcome: "escalate", reasoning };
  }

  if (blastRadius === "system-wide" && confidence < thresholds.executeConfidence) {
    reasoning.push(
      `Blast radius is system-wide and confidence (${confidence}) is below the execute bar (${thresholds.executeConfidence}) — escalated regardless of the risk score alone.`
    );
    return { outcome: "escalate", reasoning };
  }

  if (coverage < thresholds.minEvidenceCoverage) {
    reasoning.push(
      `Evidence coverage is ${Math.round(coverage * 100)}%, below the ${Math.round(
        thresholds.minEvidenceCoverage * 100
      )}% the engine requires before rendering an opinion — deferred pending more information rather than guessed.`
    );
    return { outcome: "defer", reasoning };
  }

  if (confidence < thresholds.executeConfidence || risk > thresholds.executeMaxRisk) {
    reasoning.push(
      `Confidence (${confidence}) and risk (${risk}) fall short of the execute bar (≥${thresholds.executeConfidence} confidence, ≤${thresholds.executeMaxRisk} risk) — a human is asked to confirm before anything happens.`
    );
    return { outcome: "ask", reasoning };
  }

  if (!reversible && costOfWrongAction !== "low") {
    reasoning.push(
      `Confidence and risk both clear the execute bar, but the action is irreversible with a non-trivial cost of being wrong — a human confirms once, then the engine acts.`
    );
    return { outcome: "ask", reasoning };
  }

  reasoning.push(
    `Confidence (${confidence}) clears the execute bar (≥${thresholds.executeConfidence}), risk (${risk}) is at or below the ceiling (≤${thresholds.executeMaxRisk}), evidence coverage is sufficient, and the action is reversible or low-cost to undo — executed autonomously.`
  );
  return { outcome: "execute", reasoning };
}

export function decide(
  action: ProposedAction,
  thresholds: DecisionThresholds,
  weightOverrides: Record<string, number> = {}
): Decision {
  const { signals: overriddenSignals, appliedIds } = applyOverrides(
    action.domain,
    action.signals,
    weightOverrides
  );

  const { coverage, missing } = assessEvidence(action);

  // Two engine-level signals apply to every domain uniformly, so no domain
  // can quietly hide missing evidence or an irreversible blast radius
  // inside a favorable-looking confidence number.
  const universalRiskSignals: Signal[] = [
    {
      id: "evidence_gap",
      label: "Evidence gap",
      kind: "risk",
      weight: 0.25,
      strength: 1 - coverage,
      rationale:
        missing.length > 0
          ? `${missing.length} of ${action.requiredEvidenceKeys.length} required fields are missing: ${missing.join(", ")}.`
          : "All required evidence fields are present.",
      evidenceKeys: missing,
    },
    {
      id: "cost_of_wrong_action",
      label: "Cost of being wrong",
      kind: "risk",
      weight: 0.3,
      strength: COST_TO_RISK_STRENGTH[action.reversibility.costOfWrongAction],
      rationale: `Reversibility assessment: ${action.reversibility.rationale}`,
      evidenceKeys: [],
    },
  ];

  const confidenceSignals = overriddenSignals.filter((s) => s.kind === "confidence");
  const riskSignals = [
    ...overriddenSignals.filter((s) => s.kind === "risk"),
    ...universalRiskSignals,
  ];

  const confidenceTrace = toTrace(confidenceSignals);
  const riskTrace = toTrace(riskSignals);

  const rawConfidence = weightedAverage(confidenceTrace) * 100;
  const rawRisk = weightedAverage(riskTrace) * 100;

  // Missing evidence caps how confident the engine is allowed to sound —
  // a domain can't report high confidence built on data it doesn't have.
  const confidence = Math.round(rawConfidence * coverage);
  const risk = Math.round(rawRisk);

  const policyViolation = action.evidence.some(
    (e) => e.key === "policy_violation" && e.present && e.value === true
  );

  const { outcome, reasoning } = applyMatrix({
    confidence,
    risk,
    coverage,
    reversible: action.reversibility.reversible,
    costOfWrongAction: action.reversibility.costOfWrongAction,
    blastRadius: action.reversibility.blastRadius,
    thresholds,
    policyViolation,
  });

  if (missing.length > 0) {
    reasoning.unshift(
      `Missing from context: ${missing.join(", ")}.`
    );
  }

  const timestamp = new Date().toISOString();

  return {
    // Not globally sequential — decide() is pure and gets called far more
    // often than a decision actually gets recorded (every queue row is
    // scored on every render). The human-readable "DEC-00007" label a
    // person sees is assigned only when a decision is appended to the
    // audit trail — see hooks/useDecisionSession.ts — so it reflects the
    // audit trail's real order, not this function's call count.
    id: `${action.id}@${timestamp}`,
    actionId: action.id,
    domain: action.domain,
    outcome,
    confidence,
    risk,
    reversible: action.reversibility.reversible,
    blastRadius: action.reversibility.blastRadius,
    costOfWrongAction: action.reversibility.costOfWrongAction,
    evidenceUsed: action.evidence.filter((e) => e.present),
    missingInformation: missing,
    confidenceTrace,
    riskTrace,
    reasoning,
    thresholdsApplied: thresholds,
    evidenceCoverage: coverage,
    timestamp,
    overridesApplied: appliedIds,
  };
}
