/**
 * Domain: support ticket triage.
 *
 * Proposed action: close an open ticket automatically with a generated
 * reply linking to a matched knowledge-base article, instead of routing it
 * to a human agent. Everything below only builds a ProposedAction — the
 * scoring itself lives entirely in src/engine/decisionEngine.ts.
 */
import type { DomainDefinition, ProposedAction } from "@/engine/types";
import { buildEvidence, clamp01, num, str, type EvidenceSpec } from "./domainHelpers";

const SPECS: EvidenceSpec[] = [
  { key: "kb_match_confidence", label: "KB article match confidence", source: "SupportDesk.kb_search.top_match_score" },
  { key: "sentiment_score", label: "Customer sentiment (-1 to 1)", source: "SupportDesk.ticket.sentiment_score" },
  { key: "customer_tier", label: "Customer tier", source: "CRM.account.tier" },
  { key: "similar_tickets_resolved_count", label: "Similar tickets resolved this way (90d)", source: "SupportDesk.analytics.similar_resolutions" },
  { key: "product_severity_tag", label: "Product severity tag", source: "SupportDesk.ticket.severity" },
  { key: "prior_escalations_90d", label: "Prior escalations by this customer (90d)", source: "CRM.account.escalation_count_90d" },
  { key: "policy_violation", label: "Hard policy match", source: "SupportDesk.classifier.policy_flags" },
];

function buildAction(id: string, title: string, description: string, raw: Record<string, unknown>): ProposedAction {
  const evidence = buildEvidence(raw, SPECS);
  const kbMatch = clamp01(num(raw, "kb_match_confidence", 0));
  const sentiment = num(raw, "sentiment_score", 0);
  const similarResolved = num(raw, "similar_tickets_resolved_count", 0);
  const severity = str(raw, "product_severity_tag", "minor");
  const priorEscalations = num(raw, "prior_escalations_90d", 0);
  const tier = str(raw, "customer_tier", "standard");

  const severityRisk = severity === "critical" ? 1 : severity === "major" ? 0.6 : 0.2;
  const tierRisk = tier === "enterprise" ? 0.7 : tier === "pro" ? 0.35 : 0.1;
  const sentimentRisk = clamp01((0 - sentiment) / 2 + 0.5); // sentiment -1 -> 1.0 risk, +1 -> 0.0 risk

  const costOfWrongAction =
    severity === "critical" && tier === "enterprise"
      ? "severe"
      : severity === "critical" || tier === "enterprise"
      ? "high"
      : severity === "major"
      ? "medium"
      : "low";

  return {
    id,
    domain: "ticket-triage",
    domainLabel: "Support ticket triage",
    type: "auto_close_with_kb_reply",
    title,
    description,
    reversibility: {
      reversible: true,
      blastRadius: "single-customer",
      costOfWrongAction,
      rationale: `Ticket can be reopened by the customer or an agent, but a wrong auto-close on a ${severity}-severity ticket from a ${tier} account costs ${costOfWrongAction === "severe" ? "significant" : costOfWrongAction} trust before anyone notices.`,
    },
    evidence,
    requiredEvidenceKeys: [
      "kb_match_confidence",
      "sentiment_score",
      "customer_tier",
      "similar_tickets_resolved_count",
      "product_severity_tag",
    ],
    signals: [
      {
        id: "kb_match",
        label: "Knowledge-base match strength",
        kind: "confidence",
        weight: 0.4,
        strength: kbMatch,
        rationale: `Top KB article matched this ticket's content at ${Math.round(kbMatch * 100)}% similarity.`,
        evidenceKeys: ["kb_match_confidence"],
      },
      {
        id: "resolution_precedent",
        label: "Resolution precedent",
        kind: "confidence",
        weight: 0.3,
        strength: clamp01(similarResolved / 10),
        rationale: `${similarResolved} similar tickets were closed the same way in the last 90 days without reopening.`,
        evidenceKeys: ["similar_tickets_resolved_count"],
      },
      {
        id: "sentiment_risk",
        label: "Customer sentiment",
        kind: "risk",
        weight: 0.3,
        strength: sentimentRisk,
        rationale: `Sentiment score ${sentiment.toFixed(2)} (-1 angry, +1 happy) — ${sentiment < -0.2 ? "an already-frustrated customer is more likely to escalate a wrong auto-close" : "sentiment doesn't add meaningful risk here"}.`,
        evidenceKeys: ["sentiment_score"],
      },
      {
        id: "severity_risk",
        label: "Product severity",
        kind: "risk",
        weight: 0.3,
        strength: severityRisk,
        rationale: `Ticket is tagged "${severity}" severity.`,
        evidenceKeys: ["product_severity_tag"],
      },
      {
        id: "account_tier_risk",
        label: "Account tier exposure",
        kind: "risk",
        weight: 0.2,
        strength: tierRisk,
        rationale: `Customer is on the "${tier}" tier — higher tiers carry more relationship risk if closed wrongly.`,
        evidenceKeys: ["customer_tier"],
      },
      {
        id: "escalation_history_risk",
        label: "Escalation history",
        kind: "risk",
        weight: 0.2,
        strength: clamp01(priorEscalations / 3),
        rationale: `${priorEscalations} prior escalation(s) from this customer in the last 90 days.`,
        evidenceKeys: ["prior_escalations_90d"],
      },
    ],
    raw,
  };
}

const actions: ProposedAction[] = [
  buildAction(
    "ticket-triage:1",
    "Close ticket #48213 — password reset instructions",
    "Customer asked how to reset their password. Top KB match is \"Resetting your password\" at 96% similarity.",
    {
      kb_match_confidence: 0.96,
      sentiment_score: 0.1,
      customer_tier: "standard",
      similar_tickets_resolved_count: 41,
      product_severity_tag: "minor",
      prior_escalations_90d: 0,
    }
  ),
  buildAction(
    "ticket-triage:2",
    "Close ticket #48227 — export button not visible",
    "Customer reports the CSV export button is missing on the reports page. Matched to a known UI-permissions KB article.",
    {
      kb_match_confidence: 0.71,
      sentiment_score: -0.1,
      customer_tier: "pro",
      similar_tickets_resolved_count: 6,
      product_severity_tag: "minor",
      prior_escalations_90d: 0,
    }
  ),
  buildAction(
    "ticket-triage:3",
    "Close ticket #48235 — intermittent sync failures",
    "Customer describes sync failing \"sometimes.\" Classifier match is uncertain and the KB search didn't return a confidence score.",
    {
      sentiment_score: -0.3,
      customer_tier: "pro",
      similar_tickets_resolved_count: 2,
      product_severity_tag: "major",
      prior_escalations_90d: 1,
      // kb_match_confidence intentionally omitted — the search backend timed out.
    }
  ),
  buildAction(
    "ticket-triage:4",
    "Close ticket #48241 — data discrepancy in billing export",
    "Enterprise customer reports numbers in their billing export don't match the dashboard. Sentiment is sharply negative and this is their second escalation this quarter.",
    {
      kb_match_confidence: 0.62,
      sentiment_score: -0.7,
      customer_tier: "enterprise",
      similar_tickets_resolved_count: 3,
      product_severity_tag: "critical",
      prior_escalations_90d: 2,
    }
  ),
  buildAction(
    "ticket-triage:5",
    "Close ticket #48249 — threatens legal action over data deletion",
    "Customer says their account data was deleted without consent and references \"legal action\" and \"GDPR.\" The classifier flags this as a hard policy match requiring human legal/privacy review.",
    {
      kb_match_confidence: 0.55,
      sentiment_score: -0.85,
      customer_tier: "pro",
      similar_tickets_resolved_count: 0,
      product_severity_tag: "critical",
      prior_escalations_90d: 0,
      policy_violation: true,
    }
  ),
  buildAction(
    "ticket-triage:6",
    "Close ticket #48252 — request for invoice re-send",
    "Customer asks for last month's invoice to be re-sent to a different email. Clean, common, well-precedented request.",
    {
      kb_match_confidence: 0.9,
      sentiment_score: 0.2,
      customer_tier: "standard",
      similar_tickets_resolved_count: 58,
      product_severity_tag: "minor",
      prior_escalations_90d: 0,
    }
  ),
];

const failureCase = buildAction(
  "ticket-triage:failure",
  "Close ticket #48260 — \"never mind, figured it out — thanks!\"",
  "Customer's final message reads as a clean, happy resolution and matches a high-confidence KB article almost perfectly. What the signals can't see: this customer's account was flagged for a suspected takeover 40 minutes earlier by a different system, and this ticket is the attacker confirming access — not the real customer being satisfied.",
  {
    kb_match_confidence: 0.94,
    sentiment_score: 0.6,
    customer_tier: "pro",
    similar_tickets_resolved_count: 23,
    product_severity_tag: "minor",
    prior_escalations_90d: 0,
  }
);

export const ticketTriageDomain: DomainDefinition = {
  id: "ticket-triage",
  label: "Support ticket triage",
  description:
    "Decides whether to auto-close an open support ticket with a generated KB-article reply, or route it to a human agent.",
  thresholds: {
    executeConfidence: 80,
    executeMaxRisk: 35,
    refuseMinRisk: 80,
    escalateMinRisk: 60,
    minEvidenceCoverage: 0.85,
  },
  actions,
  failureCase,
};
