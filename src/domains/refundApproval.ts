/**
 * Domain: refund approval.
 *
 * Proposed action: approve and issue a refund automatically instead of
 * routing it to a billing specialist. Money moving makes this domain's
 * reversibility story different from ticket triage — a refund can't be
 * un-sent the way a ticket can be reopened, which is exactly the kind of
 * distinction reversibility.reversible exists to carry into the matrix.
 */
import type { DomainDefinition, ProposedAction, CostOfWrongAction } from "@/engine/types";
import { buildEvidence, clamp01, num, bool, type EvidenceSpec } from "./domainHelpers";

const SPECS: EvidenceSpec[] = [
  { key: "order_value_usd", label: "Order value (USD)", source: "Billing.order.total_usd" },
  { key: "days_since_purchase", label: "Days since purchase", source: "Billing.order.purchased_at" },
  { key: "refund_policy_window_days", label: "Refund policy window (days)", source: "Billing.policy.refund_window_days" },
  { key: "defect_evidence_provided", label: "Defect evidence provided (photo/description)", source: "Support.case.attachments" },
  { key: "customer_refund_count_180d", label: "This customer's refunds (180d)", source: "Billing.customer.refund_count_180d" },
  { key: "customer_chargeback_history", label: "Chargeback on file", source: "Billing.customer.chargeback_flag" },
  { key: "policy_violation", label: "Hard policy match", source: "Billing.fraud_model.hard_flags" },
];

function costTier(orderValue: number): CostOfWrongAction {
  if (orderValue >= 1000) return "severe";
  if (orderValue >= 300) return "high";
  if (orderValue >= 50) return "medium";
  return "low";
}

function buildAction(id: string, title: string, description: string, raw: Record<string, unknown>): ProposedAction {
  const evidence = buildEvidence(raw, SPECS);
  const orderValue = num(raw, "order_value_usd", 0);
  const daysSince = num(raw, "days_since_purchase", 0);
  const windowDays = num(raw, "refund_policy_window_days", 30);
  const defectEvidence = bool(raw, "defect_evidence_provided", false);
  const refundCount = num(raw, "customer_refund_count_180d", 0);
  const chargebackHistory = bool(raw, "customer_chargeback_history", false);

  const withinWindow = daysSince <= windowDays;
  const windowFit = withinWindow ? clamp01(1 - daysSince / Math.max(windowDays, 1) + 0.3) : 0.1;

  return {
    id,
    domain: "refund-approval",
    domainLabel: "Refund approval",
    type: "auto_approve_refund",
    title,
    description,
    reversibility: {
      reversible: false,
      blastRadius: "single-customer",
      costOfWrongAction: costTier(orderValue),
      rationale: `Once issued, a refund of $${orderValue.toFixed(0)} has to be clawed back manually (chargeback dispute or invoice) rather than simply undone — cost of being wrong scales with order value.`,
    },
    evidence,
    requiredEvidenceKeys: [
      "order_value_usd",
      "days_since_purchase",
      "refund_policy_window_days",
      "defect_evidence_provided",
      "customer_refund_count_180d",
      "customer_chargeback_history",
    ],
    signals: [
      {
        id: "policy_window_fit",
        label: "Within refund policy window",
        kind: "confidence",
        weight: 0.35,
        strength: clamp01(windowFit),
        rationale: `Requested ${daysSince} day(s) after purchase; policy window is ${windowDays} day(s) — ${withinWindow ? "within window" : "outside window"}.`,
        evidenceKeys: ["days_since_purchase", "refund_policy_window_days"],
      },
      {
        id: "defect_evidence",
        label: "Defect evidence on file",
        kind: "confidence",
        weight: 0.25,
        strength: defectEvidence ? 1 : 0.3,
        rationale: defectEvidence
          ? "Customer attached photo/description evidence supporting the defect claim."
          : "No defect evidence was attached — claim rests on the customer's word alone.",
        evidenceKeys: ["defect_evidence_provided"],
      },
      {
        id: "amount_risk",
        label: "Order value exposure",
        kind: "risk",
        weight: 0.3,
        strength: clamp01(orderValue / 2000),
        rationale: `Refund amount is $${orderValue.toFixed(0)}.`,
        evidenceKeys: ["order_value_usd"],
      },
      {
        id: "refund_frequency_risk",
        label: "Refund frequency",
        kind: "risk",
        weight: 0.3,
        strength: clamp01(refundCount / 5),
        rationale: `This customer has requested ${refundCount} refund(s) in the last 180 days.`,
        evidenceKeys: ["customer_refund_count_180d"],
      },
      {
        id: "chargeback_history_risk",
        label: "Chargeback history",
        kind: "risk",
        weight: 0.35,
        strength: chargebackHistory ? 1 : 0,
        rationale: chargebackHistory
          ? "Customer has a chargeback on file — a pattern strongly correlated with refund fraud."
          : "No chargeback history on this account.",
        evidenceKeys: ["customer_chargeback_history"],
      },
    ],
    raw,
  };
}

const actions: ProposedAction[] = [
  buildAction(
    "refund-approval:1",
    "Refund $18 to customer #90142 — wrong size, unopened",
    "Small clothing order, unopened, returned within the window, photo of the unopened package attached.",
    {
      order_value_usd: 18,
      days_since_purchase: 4,
      refund_policy_window_days: 30,
      defect_evidence_provided: true,
      customer_refund_count_180d: 0,
      customer_chargeback_history: false,
    }
  ),
  buildAction(
    "refund-approval:2",
    "Refund $145 to customer #90188 — item arrived damaged",
    "Mid-value electronics accessory, described as damaged in transit, no photo attached yet.",
    {
      order_value_usd: 145,
      days_since_purchase: 9,
      refund_policy_window_days: 30,
      defect_evidence_provided: false,
      customer_refund_count_180d: 1,
      customer_chargeback_history: false,
    }
  ),
  buildAction(
    "refund-approval:3",
    "Refund $62 to customer #90201 — \"not as described\"",
    "Customer requests a refund; the order record is missing its policy-window field due to a billing-system migration last week.",
    {
      order_value_usd: 62,
      days_since_purchase: 12,
      defect_evidence_provided: false,
      customer_refund_count_180d: 0,
      customer_chargeback_history: false,
      // refund_policy_window_days intentionally omitted — lost in migration.
    }
  ),
  buildAction(
    "refund-approval:4",
    "Refund $1,240 to customer #90233 — annual plan cancellation",
    "Customer wants a pro-rated refund on an annual subscription cancelled two months in. High value, plausible claim, but this size of refund is new territory for this account.",
    {
      order_value_usd: 1240,
      days_since_purchase: 61,
      refund_policy_window_days: 90,
      defect_evidence_provided: true,
      customer_refund_count_180d: 0,
      customer_chargeback_history: false,
    }
  ),
  buildAction(
    "refund-approval:5",
    "Refund $980 to customer #90266 — sixth refund this quarter, chargeback on file",
    "Order is within policy window with a defect claim attached, but this is the customer's sixth refund in 180 days, the largest yet, and there's a chargeback on file from a prior dispute — no confirmed fraud match, but enough combined weight to route to a person with account-level authority rather than a one-click confirmation.",
    {
      order_value_usd: 980,
      days_since_purchase: 6,
      refund_policy_window_days: 30,
      defect_evidence_provided: true,
      customer_refund_count_180d: 6,
      customer_chargeback_history: true,
    }
  ),
  buildAction(
    "refund-approval:6",
    "Refund $89 to customer #90299 — matches known chargeback-fraud pattern",
    "The fraud model hard-flags this request: same shipping address has filed chargebacks on three other accounts in the last 30 days.",
    {
      order_value_usd: 89,
      days_since_purchase: 3,
      refund_policy_window_days: 30,
      defect_evidence_provided: false,
      customer_refund_count_180d: 0,
      customer_chargeback_history: true,
      policy_violation: true,
    }
  ),
];

const failureCase = buildAction(
  "refund-approval:failure",
  "Refund $24 to customer #90312 — small, clean, policy-perfect",
  "Every signal here reads as textbook-safe: tiny amount, brand-new account so no refund history exists yet, inside the window, photo attached. What the signals can't see: this is the first of what will become 40 near-identical $24 refund requests from 40 different brand-new accounts over the next hour, all shipping to the same address — a fraud pattern that only shows up in aggregate, one request at a time.",
  {
    order_value_usd: 24,
    days_since_purchase: 1,
    refund_policy_window_days: 30,
    defect_evidence_provided: true,
    customer_refund_count_180d: 0,
    customer_chargeback_history: false,
  }
);

export const refundApprovalDomain: DomainDefinition = {
  id: "refund-approval",
  label: "Refund approval",
  description:
    "Decides whether to auto-approve a refund request, or route it to a billing specialist.",
  thresholds: {
    executeConfidence: 75,
    executeMaxRisk: 30,
    refuseMinRisk: 75,
    escalateMinRisk: 55,
    minEvidenceCoverage: 0.85,
  },
  actions,
  failureCase,
};
