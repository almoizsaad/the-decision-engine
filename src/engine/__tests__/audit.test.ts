import { describe, it, expect, beforeEach } from "vitest";
import { loadAuditLog, saveAuditLog, clearAuditLog, formatDecisionSequence } from "../audit";
import type { AuditEntry } from "../types";

function makeEntry(id: string): AuditEntry {
  return {
    action: {
      id,
      domain: "test-domain",
      domainLabel: "Test",
      type: "test_action",
      title: "t",
      description: "d",
      reversibility: { reversible: true, blastRadius: "single-record", costOfWrongAction: "low", rationale: "r" },
      evidence: [],
      requiredEvidenceKeys: [],
      signals: [],
      raw: {},
    },
    decision: {
      id: `${id}@now`,
      actionId: id,
      domain: "test-domain",
      outcome: "execute",
      confidence: 90,
      risk: 10,
      reversible: true,
      blastRadius: "single-record",
      costOfWrongAction: "low",
      evidenceUsed: [],
      missingInformation: [],
      confidenceTrace: [],
      riskTrace: [],
      reasoning: [],
      thresholdsApplied: {
        executeConfidence: 80,
        executeMaxRisk: 35,
        refuseMinRisk: 80,
        escalateMinRisk: 60,
        minEvidenceCoverage: 0.8,
      },
      evidenceCoverage: 1,
      timestamp: new Date().toISOString(),
      overridesApplied: [],
    },
  };
}

describe("audit log persistence", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it("round-trips entries through localStorage", () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    saveAuditLog(entries);
    const loaded = loadAuditLog();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].action.id).toBe("a");
    expect(loaded[1].action.id).toBe("b");
  });

  it("returns an empty array when nothing has been saved", () => {
    expect(loadAuditLog()).toEqual([]);
  });

  it("returns an empty array (not a throw) if storage holds malformed JSON", () => {
    localStorage.setItem("decision-engine.audit.v1", "{not valid json");
    expect(loadAuditLog()).toEqual([]);
  });

  it("clears the log", () => {
    saveAuditLog([makeEntry("a")]);
    clearAuditLog();
    expect(loadAuditLog()).toEqual([]);
  });
});

describe("formatDecisionSequence", () => {
  it("formats a zero-based index as a 1-based, zero-padded DEC id", () => {
    expect(formatDecisionSequence(0)).toBe("DEC-00001");
    expect(formatDecisionSequence(6)).toBe("DEC-00007");
    expect(formatDecisionSequence(99999)).toBe("DEC-100000");
  });
});
