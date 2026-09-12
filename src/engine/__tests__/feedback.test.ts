import { describe, it, expect } from "vitest";
import { decide } from "../decisionEngine";
import { applyNotThePriorityFeedback, resetOverridesForDomain, overridesForDomain, type WeightOverrides } from "../feedback";
import type { DecisionThresholds, ProposedAction } from "../types";

const thresholds: DecisionThresholds = {
  executeConfidence: 80,
  executeMaxRisk: 35,
  refuseMinRisk: 80,
  escalateMinRisk: 60,
  minEvidenceCoverage: 0.8,
};

function makeAction(domain: string): ProposedAction {
  return {
    id: `${domain}:1`,
    domain,
    domainLabel: domain,
    type: "test_action",
    title: "t",
    description: "d",
    reversibility: { reversible: true, blastRadius: "single-record", costOfWrongAction: "low", rationale: "r" },
    evidence: [
      { key: "a", label: "A", present: true, value: 1, source: "s" },
      { key: "b", label: "B", present: true, value: 1, source: "s" },
    ],
    requiredEvidenceKeys: ["a", "b"],
    signals: [
      { id: "dominant_risk", label: "Dominant risk", kind: "risk", weight: 5, strength: 0.9, rationale: "r", evidenceKeys: [] },
      { id: "minor_risk", label: "Minor risk", kind: "risk", weight: 1, strength: 0.2, rationale: "r", evidenceKeys: [] },
      { id: "conf1", label: "Conf1", kind: "confidence", weight: 1, strength: 0.9, rationale: "r", evidenceKeys: [] },
    ],
    raw: {},
  };
}

describe("applyNotThePriorityFeedback", () => {
  it("discounts the signal with the largest contribution, not just the first one", () => {
    const action = makeAction("domain-a");
    const decision = decide(action, thresholds);
    const result = applyNotThePriorityFeedback({}, decision);
    expect(result.adjustedSignalId).toBe("dominant_risk");
    expect(result.overrides["domain-a:dominant_risk"]).toBeCloseTo(0.8);
  });

  it("never discounts the two structural (engine-level) signals", () => {
    // An action where the structural signals would dominate if considered.
    const action: ProposedAction = {
      ...makeAction("domain-b"),
      signals: [{ id: "tiny", label: "Tiny", kind: "risk", weight: 0.01, strength: 0.01, rationale: "r", evidenceKeys: [] }],
      reversibility: { reversible: false, blastRadius: "system-wide", costOfWrongAction: "severe", rationale: "r" },
    };
    const decision = decide(action, thresholds);
    const result = applyNotThePriorityFeedback({}, decision);
    expect(result.adjustedSignalId).toBe("tiny");
    expect(result.adjustedSignalId).not.toBe("evidence_gap");
    expect(result.adjustedSignalId).not.toBe("cost_of_wrong_action");
  });

  it("floors the discount at 20% of the original weight after repeated overrides", () => {
    const action = makeAction("domain-c");
    const decision = decide(action, thresholds);
    let overrides: WeightOverrides = {};
    for (let i = 0; i < 10; i++) {
      const result = applyNotThePriorityFeedback(overrides, decision);
      overrides = result.overrides;
    }
    expect(overrides["domain-c:dominant_risk"]).toBeCloseTo(0.2);
  });

  it("scopes overrides to the domain the feedback was given in — no cross-domain leak", () => {
    const actionA = makeAction("domain-a");
    const actionB = makeAction("domain-b");
    const decisionA = decide(actionA, thresholds);

    const result = applyNotThePriorityFeedback({}, decisionA);
    expect(Object.keys(result.overrides)).toEqual(["domain-a:dominant_risk"]);

    // The same signal id used in a different domain is untouched.
    const decisionBBefore = decide(actionB, thresholds, {});
    const decisionBAfter = decide(actionB, thresholds, result.overrides);
    expect(decisionBAfter.risk).toBe(decisionBBefore.risk);
    expect(decisionBAfter.overridesApplied).toHaveLength(0);
  });
});

describe("resetOverridesForDomain / overridesForDomain", () => {
  it("clears only the target domain's overrides", () => {
    const overrides = {
      "domain-a:sig1": 0.5,
      "domain-a:sig2": 0.3,
      "domain-b:sig1": 0.4,
    };
    const cleared = resetOverridesForDomain(overrides, "domain-a");
    expect(cleared).toEqual({ "domain-b:sig1": 0.4 });
  });

  it("lists overrides scoped to a domain with the domain prefix stripped", () => {
    const overrides = { "domain-a:sig1": 0.5, "domain-b:sig1": 0.4 };
    const list = overridesForDomain(overrides, "domain-a");
    expect(list).toEqual([{ signalId: "sig1", factor: 0.5 }]);
  });
});
