import { describe, it, expect } from "vitest";
import { decide } from "../decisionEngine";
import type { DecisionThresholds, ProposedAction } from "../types";

const thresholds: DecisionThresholds = {
  executeConfidence: 80,
  executeMaxRisk: 35,
  refuseMinRisk: 80,
  escalateMinRisk: 60,
  minEvidenceCoverage: 0.8,
};

/**
 * A minimal, domain-agnostic action builder for exercising the matrix
 * directly. Signal weights of 1000 make the single domain signal
 * completely dominate the two small, fixed-weight universal risk signals
 * (evidence_gap, cost_of_wrong_action), so `strength` maps to the final
 * score predictably enough to hit exact integer boundaries — the numbers
 * below were confirmed against the real implementation, not hand-derived.
 */
function makeAction(
  riskStrength: number,
  confStrength: number,
  opts: Partial<ProposedAction> = {}
): ProposedAction {
  return {
    id: "test:1",
    domain: "test-domain",
    domainLabel: "Test",
    type: "test_action",
    title: "Test action",
    description: "A synthetic action used only to exercise the matrix.",
    reversibility: {
      reversible: true,
      blastRadius: "single-record",
      costOfWrongAction: "low",
      rationale: "synthetic",
    },
    evidence: [
      { key: "a", label: "A", present: true, value: 1, source: "s" },
      { key: "b", label: "B", present: true, value: 1, source: "s" },
    ],
    requiredEvidenceKeys: ["a", "b"],
    signals: [
      { id: "conf1", label: "Conf1", kind: "confidence", weight: 1000, strength: confStrength, rationale: "r", evidenceKeys: [] },
      { id: "risk1", label: "Risk1", kind: "risk", weight: 1000, strength: riskStrength, rationale: "r", evidenceKeys: [] },
    ],
    raw: {},
    ...opts,
  };
}

function makeCoverageAction(requiredCount: number, presentCount: number): ProposedAction {
  const evidence = [];
  const required: string[] = [];
  for (let i = 0; i < requiredCount; i++) {
    const key = `k${i}`;
    required.push(key);
    evidence.push({
      key,
      label: key,
      present: i < presentCount,
      value: i < presentCount ? 1 : undefined,
      source: "s",
    });
  }
  return {
    id: "test:coverage",
    domain: "test-domain",
    domainLabel: "Test",
    type: "test_action",
    title: "Coverage test",
    description: "d",
    reversibility: { reversible: true, blastRadius: "single-record", costOfWrongAction: "low", rationale: "r" },
    evidence,
    requiredEvidenceKeys: required,
    signals: [
      { id: "conf1", label: "Conf1", kind: "confidence", weight: 1, strength: 0.95, rationale: "r", evidenceKeys: [] },
      { id: "risk1", label: "Risk1", kind: "risk", weight: 1, strength: 0.05, rationale: "r", evidenceKeys: [] },
    ],
    raw: {},
  };
}

describe("decide() — matrix boundaries", () => {
  it("executes when confidence clears the bar and risk is low", () => {
    const d = decide(makeAction(0.1, 0.95), thresholds);
    expect(d.outcome).toBe("execute");
  });

  it("asks when confidence is one point below the execute bar (79 vs 80)", () => {
    const below = decide(makeAction(0.1, 0.79), thresholds);
    const at = decide(makeAction(0.1, 0.8), thresholds);
    expect(below.confidence).toBe(79);
    expect(below.outcome).toBe("ask");
    expect(at.confidence).toBe(80);
    expect(at.outcome).toBe("execute");
  });

  it("escalates at risk 79 and refuses at risk 80 — the refuse threshold is a hard line, not a gradient", () => {
    const justBelow = decide(makeAction(0.79, 0.95), thresholds);
    const at = decide(makeAction(0.8, 0.95), thresholds);
    expect(justBelow.risk).toBe(79);
    expect(justBelow.outcome).toBe("escalate");
    expect(at.risk).toBe(80);
    expect(at.outcome).toBe("refuse");
  });

  it("defers when evidence coverage is below the minimum, even with a confident, low-risk signal read", () => {
    const d = decide(makeCoverageAction(5, 3), thresholds); // coverage 0.6
    expect(d.evidenceCoverage).toBe(0.6);
    expect(d.outcome).toBe("defer");
    expect(d.missingInformation).toHaveLength(2);
  });

  it("does NOT defer when coverage is exactly at the minimum threshold", () => {
    const d = decide(makeCoverageAction(5, 4), thresholds); // coverage 0.8, threshold is 0.8
    expect(d.evidenceCoverage).toBe(0.8);
    expect(d.outcome).not.toBe("defer");
  });

  it("refuses on a hard policy-violation evidence flag regardless of confidence or risk", () => {
    const action = makeAction(0.05, 0.99, {
      evidence: [
        { key: "a", label: "A", present: true, value: 1, source: "s" },
        { key: "b", label: "B", present: true, value: 1, source: "s" },
        { key: "policy_violation", label: "Policy", present: true, value: true, source: "s" },
      ],
    });
    const d = decide(action, thresholds);
    expect(d.outcome).toBe("refuse");
    expect(d.reasoning[0]).toMatch(/policy-violation/i);
  });

  it("does not treat a present-but-false policy_violation flag as a hard block", () => {
    const action = makeAction(0.05, 0.99, {
      evidence: [
        { key: "a", label: "A", present: true, value: 1, source: "s" },
        { key: "b", label: "B", present: true, value: 1, source: "s" },
        { key: "policy_violation", label: "Policy", present: true, value: false, source: "s" },
      ],
    });
    expect(decide(action, thresholds).outcome).toBe("execute");
  });

  it("refuses an irreversible, severe-cost action even at moderate risk when confidence hasn't cleared the execute bar", () => {
    const action = makeAction(0.2, 0.5, {
      reversibility: {
        reversible: false,
        blastRadius: "system-wide",
        costOfWrongAction: "severe",
        rationale: "irreversible and severe",
      },
    });
    const d = decide(action, thresholds);
    expect(d.outcome).toBe("refuse");
  });

  it("escalates a system-wide, low-confidence action even when the raw risk score alone would only ask", () => {
    const action = makeAction(0.2, 0.5, {
      reversibility: {
        reversible: true,
        blastRadius: "system-wide",
        costOfWrongAction: "medium",
        rationale: "system-wide but reversible",
      },
    });
    const d = decide(action, thresholds);
    expect(d.outcome).toBe("escalate");
  });

  it("asks (not executes) a reversible action with non-trivial cost even when confidence and risk both clear the execute bar", () => {
    const action = makeAction(0.05, 0.95, {
      reversibility: {
        reversible: false,
        blastRadius: "single-record",
        costOfWrongAction: "medium",
        rationale: "irreversible, medium cost",
      },
    });
    const d = decide(action, thresholds);
    expect(d.outcome).toBe("ask");
  });

  it("caps confidence by evidence coverage — high signal strength can't outrun missing data", () => {
    const d = decide(makeCoverageAction(4, 2), thresholds); // coverage 0.5
    // domain confidence signal strength is 0.95, but coverage halves the reported confidence
    expect(d.confidence).toBeLessThanOrEqual(50);
  });

  it("never applies a signal weight override to a domain other than the one it was recorded for", () => {
    const action = makeAction(0.1, 0.95);
    const withUnrelatedOverride = decide(action, thresholds, { "some-other-domain:conf1": 0.1 });
    const baseline = decide(action, thresholds, {});
    expect(withUnrelatedOverride.confidence).toBe(baseline.confidence);
    expect(withUnrelatedOverride.overridesApplied).toHaveLength(0);
  });

  it("applies a matching override and records it in overridesApplied", () => {
    const action = makeAction(0.1, 0.95, {
      signals: [
        { id: "conf1", label: "Conf1", kind: "confidence", weight: 1, strength: 0.95, rationale: "r", evidenceKeys: [] },
        { id: "conf2", label: "Conf2", kind: "confidence", weight: 1, strength: 0.5, rationale: "r", evidenceKeys: [] },
        { id: "risk1", label: "Risk1", kind: "risk", weight: 1, strength: 0.1, rationale: "r", evidenceKeys: [] },
      ],
    });
    const baseline = decide(action, thresholds, {});
    const overridden = decide(action, thresholds, { "test-domain:conf1": 0.2 });
    expect(overridden.overridesApplied).toContain("conf1");
    // conf1 (0.95) is discounted relative to conf2 (0.5) — pulling the
    // weighted average down, since a single-signal weighted average would
    // be invariant to that signal's own weight.
    expect(overridden.confidence).toBeLessThan(baseline.confidence);
  });

  it("keeps confidence and risk within [0, 100] and coverage within [0, 1] across varied inputs", () => {
    for (const rs of [0, 0.25, 0.5, 0.75, 1]) {
      for (const cs of [0, 0.25, 0.5, 0.75, 1]) {
        const d = decide(makeAction(rs, cs), thresholds);
        expect(d.confidence).toBeGreaterThanOrEqual(0);
        expect(d.confidence).toBeLessThanOrEqual(100);
        expect(d.risk).toBeGreaterThanOrEqual(0);
        expect(d.risk).toBeLessThanOrEqual(100);
        expect(d.evidenceCoverage).toBeGreaterThanOrEqual(0);
        expect(d.evidenceCoverage).toBeLessThanOrEqual(1);
      }
    }
  });
});
