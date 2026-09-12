/**
 * The Decision Engine — core type contracts.
 *
 * These types are domain-agnostic on purpose. Every domain in src/domains/
 * produces the same shapes (ProposedAction, Signal[], EvidenceItem[]) and
 * feeds them into the same decide() function in decisionEngine.ts. Nothing
 * in this file, or in decisionEngine.ts, knows what a "refund" or a
 * "deploy" is — see ARCHITECTURE.md for why that separation is the point.
 */

export type DecisionOutcome = "execute" | "ask" | "defer" | "escalate" | "refuse";

export type BlastRadius =
  | "single-record"
  | "single-customer"
  | "multi-customer"
  | "system-wide";

export type CostOfWrongAction = "low" | "medium" | "high" | "severe";

export type SignalKind = "confidence" | "risk";

/** A single fact the decision was (or wasn't) able to draw on. */
export interface EvidenceItem {
  key: string;
  label: string;
  present: boolean;
  value?: string | number | boolean;
  /** Where this would come from in a real integration, e.g. "CRM.ticket.sentiment_score". */
  source: string;
}

/**
 * A normalized reading that feeds the decision. `strength` is always in
 * [0, 1] regardless of the domain's underlying unit — normalizing at the
 * domain boundary is what lets one engine score five unrelated domains.
 */
export interface Signal {
  id: string;
  label: string;
  kind: SignalKind;
  /** Relative importance, edited over time by the feedback loop. Not bounded to [0,1] — only relative magnitude matters, since scoring uses a weighted average. */
  weight: number;
  /** Normalized reading for this action, in [0, 1]. */
  strength: number;
  rationale: string;
  evidenceKeys: string[];
}

export interface ReversibilityAssessment {
  reversible: boolean;
  blastRadius: BlastRadius;
  costOfWrongAction: CostOfWrongAction;
  rationale: string;
}

export interface ProposedAction {
  id: string;
  domain: string;
  domainLabel: string;
  /** Machine-readable action type, e.g. "auto_close_ticket". Used by the feedback loop to scope weight overrides. */
  type: string;
  title: string;
  description: string;
  reversibility: ReversibilityAssessment;
  evidence: EvidenceItem[];
  requiredEvidenceKeys: string[];
  signals: Signal[];
  /** The underlying record, shown verbatim in the audit trail for traceability. */
  raw: Record<string, unknown>;
}

export interface DecisionThresholds {
  /** Minimum confidence (0-100) to execute autonomously. */
  executeConfidence: number;
  /** Maximum risk (0-100) still eligible for autonomous execution. */
  executeMaxRisk: number;
  /** Risk (0-100) at or above which the engine refuses outright. */
  refuseMinRisk: number;
  /** Risk (0-100) at or above which the engine escalates rather than asks. */
  escalateMinRisk: number;
  /** Fraction [0,1] of required evidence that must be present before the engine will render any opinion beyond "defer". */
  minEvidenceCoverage: number;
}

export interface SignalTraceEntry {
  signal: Signal;
  /** weight × strength, before normalization — shown so the math is checkable by hand. */
  contribution: number;
}

export interface Decision {
  id: string;
  actionId: string;
  domain: string;
  outcome: DecisionOutcome;
  confidence: number;
  risk: number;
  reversible: boolean;
  blastRadius: BlastRadius;
  costOfWrongAction: CostOfWrongAction;
  evidenceUsed: EvidenceItem[];
  missingInformation: string[];
  confidenceTrace: SignalTraceEntry[];
  riskTrace: SignalTraceEntry[];
  reasoning: string[];
  thresholdsApplied: DecisionThresholds;
  evidenceCoverage: number;
  timestamp: string;
  /** Signal ids whose weight was adjusted by the feedback loop before this decision was scored. */
  overridesApplied: string[];
}

export type HumanResponseType =
  | "executed"
  | "approved"
  | "edited"
  | "rejected"
  | "escalated_ack"
  | "deferred_ack"
  | "refused_ack"
  | "override_feedback";

export interface HumanResponse {
  type: HumanResponseType;
  note?: string;
  timestamp: string;
}

export interface AuditEntry {
  decision: Decision;
  action: ProposedAction;
  humanResponse?: HumanResponse;
}

export interface DomainDefinition {
  id: string;
  label: string;
  description: string;
  thresholds: DecisionThresholds;
  actions: ProposedAction[];
  /** A deliberately adversarial action designed to break the engine or expose a limit — see FAILURE_TESTS.md. */
  failureCase: ProposedAction;
}
