import { describe, it, expect } from "vitest";
import { decide } from "@/engine/decisionEngine";
import { domains } from "@/domains";
import type { DecisionOutcome } from "@/engine/types";

/**
 * Expected outcome for every hand-authored example, keyed by action id.
 * These are not hand-derived guesses — they were captured by running the
 * real decide() function against the real domain data (see
 * scripts/print-decisions.ts, which prints this exact table) and are
 * re-asserted here so a change to a domain's numbers or to the matrix
 * itself gets caught immediately instead of silently changing the demo.
 */
const EXPECTED_OUTCOMES: Record<string, DecisionOutcome> = {
  "ticket-triage:1": "execute",
  "ticket-triage:2": "ask",
  "ticket-triage:3": "defer",
  "ticket-triage:4": "escalate",
  "ticket-triage:5": "refuse",
  "ticket-triage:6": "execute",
  "ticket-triage:failure": "execute",

  "refund-approval:1": "execute",
  "refund-approval:2": "ask",
  "refund-approval:3": "defer",
  "refund-approval:4": "ask",
  "refund-approval:5": "escalate",
  "refund-approval:6": "refuse",
  "refund-approval:failure": "execute",

  "deploy-gate:1": "ask",
  "deploy-gate:2": "ask",
  "deploy-gate:3": "defer",
  "deploy-gate:4": "refuse",
  "deploy-gate:5": "execute",
  "deploy-gate:6": "refuse",
  "deploy-gate:failure": "execute",

  "content-moderation:1": "ask",
  "content-moderation:2": "ask",
  "content-moderation:3": "defer",
  "content-moderation:4": "escalate",
  "content-moderation:5": "execute",
  "content-moderation:6": "refuse",
  "content-moderation:failure": "ask",
};

describe("domain conformance", () => {
  it("registers exactly four domains", () => {
    expect(domains.map((d) => d.id)).toEqual([
      "ticket-triage",
      "refund-approval",
      "deploy-gate",
      "content-moderation",
    ]);
  });

  for (const domain of domains) {
    describe(domain.id, () => {
      it("produces every documented outcome for its example actions", () => {
        for (const action of [...domain.actions, domain.failureCase]) {
          const decision = decide(action, domain.thresholds, {});
          const expected = EXPECTED_OUTCOMES[action.id];
          expect(expected, `no expected outcome recorded for ${action.id}`).toBeDefined();
          expect(decision.outcome, `${action.id} outcome`).toBe(expected);
        }
      });

      it("never throws and keeps every score within its documented range", () => {
        for (const action of [...domain.actions, domain.failureCase]) {
          const decision = decide(action, domain.thresholds, {});
          expect(decision.confidence).toBeGreaterThanOrEqual(0);
          expect(decision.confidence).toBeLessThanOrEqual(100);
          expect(decision.risk).toBeGreaterThanOrEqual(0);
          expect(decision.risk).toBeLessThanOrEqual(100);
          expect(decision.evidenceCoverage).toBeGreaterThanOrEqual(0);
          expect(decision.evidenceCoverage).toBeLessThanOrEqual(1);
        }
      });

      it("only reports evidence as missing when it is actually absent from the action's evidence list", () => {
        for (const action of [...domain.actions, domain.failureCase]) {
          const decision = decide(action, domain.thresholds, {});
          const presentKeys = new Set(action.evidence.filter((e) => e.present).map((e) => e.key));
          for (const missingKey of decision.missingInformation) {
            expect(presentKeys.has(missingKey)).toBe(false);
          }
        }
      });

      it("only reports evidence as used when it is present", () => {
        for (const action of [...domain.actions, domain.failureCase]) {
          const decision = decide(action, domain.thresholds, {});
          for (const item of decision.evidenceUsed) {
            expect(item.present).toBe(true);
          }
        }
      });

      it("has a unique id for every example action, including the failure case", () => {
        const ids = [...domain.actions, domain.failureCase].map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("has at least five example actions plus one failure case", () => {
        expect(domain.actions.length).toBeGreaterThanOrEqual(5);
      });
    });
  }

  it("covers all five outcomes across the full set of domains", () => {
    const seen = new Set(Object.values(EXPECTED_OUTCOMES));
    expect(seen).toEqual(new Set(["execute", "ask", "defer", "escalate", "refuse"]));
  });
});
