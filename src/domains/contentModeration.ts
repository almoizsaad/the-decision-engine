/**
 * Domain: content moderation.
 *
 * Proposed action: automatically remove a reported post instead of leaving
 * it up pending a human moderator. Note what "refuse" means here — it does
 * NOT mean "the post is confirmed fine." It means the engine won't
 * auto-remove it on its own authority; the post is held for a moderator
 * either way. That distinction is called out in the UI copy for this
 * domain specifically, and in FAILURE_TESTS.md.
 */
import type { DomainDefinition, ProposedAction, CostOfWrongAction } from "@/engine/types";
import { buildEvidence, clamp01, num, bool, type EvidenceSpec } from "./domainHelpers";

const SPECS: EvidenceSpec[] = [
  { key: "toxicity_score", label: "Toxicity classifier score", source: "TrustSafety.classifier.toxicity_score" },
  { key: "classifier_confidence", label: "Classifier confidence", source: "TrustSafety.classifier.confidence" },
  { key: "user_prior_strikes", label: "Poster's prior strikes", source: "TrustSafety.account.strike_count" },
  { key: "report_count", label: "User reports on this post", source: "TrustSafety.post.report_count" },
  { key: "is_verified_public_figure", label: "Poster is a verified public figure", source: "TrustSafety.account.verified_flag" },
  { key: "context_flag_satire_or_news", label: "Context suggests satire or news reporting", source: "TrustSafety.classifier.context_flag" },
  { key: "policy_violation", label: "Hard zero-tolerance policy match", source: "TrustSafety.classifier.tier1_match" },
];

function buildAction(id: string, title: string, description: string, raw: Record<string, unknown>): ProposedAction {
  const evidence = buildEvidence(raw, SPECS);
  const toxicity = clamp01(num(raw, "toxicity_score", 0));
  const classifierConfidence = clamp01(num(raw, "classifier_confidence", 0));
  const priorStrikes = num(raw, "user_prior_strikes", 0);
  const reportCount = num(raw, "report_count", 0);
  const isPublicFigure = bool(raw, "is_verified_public_figure", false);
  const isSatireOrNews = bool(raw, "context_flag_satire_or_news", false);

  const costOfWrongAction: CostOfWrongAction = isPublicFigure
    ? "high"
    : isSatireOrNews
    ? "medium"
    : "low";

  return {
    id,
    domain: "content-moderation",
    domainLabel: "Content moderation",
    type: "auto_remove_post",
    title,
    description,
    reversibility: {
      reversible: true,
      blastRadius: "single-record",
      costOfWrongAction,
      rationale: isPublicFigure
        ? "A post can be restored, but wrongly removing a public figure's post carries outsized reputational and press cost before anyone notices the mistake."
        : "A wrongly removed post can be restored on appeal, and the cost of a brief incorrect takedown is low for a non-public account.",
    },
    evidence,
    requiredEvidenceKeys: [
      "toxicity_score",
      "classifier_confidence",
      "user_prior_strikes",
      "report_count",
      "is_verified_public_figure",
    ],
    signals: [
      {
        id: "classifier_confidence_signal",
        label: "Classifier confidence",
        kind: "confidence",
        weight: 0.4,
        strength: classifierConfidence,
        rationale: `The policy classifier reports ${Math.round(classifierConfidence * 100)}% confidence in its read of this post.`,
        evidenceKeys: ["classifier_confidence"],
      },
      {
        id: "corroboration_signal",
        label: "User report corroboration",
        kind: "confidence",
        weight: 0.2,
        strength: clamp01(reportCount / 10),
        rationale: `${reportCount} user report(s) on this post.`,
        evidenceKeys: ["report_count"],
      },
      {
        id: "repeat_offender_signal",
        label: "Poster's strike history",
        kind: "confidence",
        weight: 0.15,
        strength: clamp01(priorStrikes / 3),
        rationale: `Poster has ${priorStrikes} prior strike(s) on their account.`,
        evidenceKeys: ["user_prior_strikes"],
      },
      {
        id: "toxicity_risk",
        label: "Toxicity score",
        kind: "risk",
        weight: 0.3,
        strength: toxicity,
        rationale: `Toxicity classifier scored this post at ${Math.round(toxicity * 100)}%.`,
        evidenceKeys: ["toxicity_score"],
      },
      {
        id: "public_figure_risk",
        label: "Public-figure exposure",
        kind: "risk",
        weight: 0.25,
        strength: isPublicFigure ? 0.8 : 0.1,
        rationale: isPublicFigure
          ? "Poster is a verified public figure — higher scrutiny and newsworthiness considerations apply."
          : "Poster is not a verified public figure.",
        evidenceKeys: ["is_verified_public_figure"],
      },
      {
        id: "context_ambiguity_risk",
        label: "Satire / news context",
        kind: "risk",
        weight: 0.3,
        strength: isSatireOrNews ? 0.85 : 0.1,
        rationale: isSatireOrNews
          ? "Classifier flagged context suggesting satire or news reporting — a common source of false-positive takedowns."
          : "No satire or news-context flag on this post.",
        evidenceKeys: ["context_flag_satire_or_news"],
      },
    ],
    raw,
  };
}

const actions: ProposedAction[] = [
  buildAction(
    "content-moderation:1",
    "Remove post #771002 — direct targeted harassment",
    "High-toxicity, high-confidence match on direct harassment against a named private individual. No ambiguity flags.",
    {
      toxicity_score: 0.94,
      classifier_confidence: 0.92,
      user_prior_strikes: 2,
      report_count: 14,
      is_verified_public_figure: false,
      context_flag_satire_or_news: false,
    }
  ),
  buildAction(
    "content-moderation:2",
    "Remove post #771015 — borderline insult, low report volume",
    "Moderate toxicity score, moderate classifier confidence, single report so far.",
    {
      toxicity_score: 0.58,
      classifier_confidence: 0.51,
      user_prior_strikes: 0,
      report_count: 1,
      is_verified_public_figure: false,
      context_flag_satire_or_news: false,
    }
  ),
  buildAction(
    "content-moderation:3",
    "Remove post #771029 — reported meme, classifier didn't return a confidence score",
    "The classifier's confidence field failed to populate due to a model-serving timeout, though a toxicity score did come through.",
    {
      toxicity_score: 0.67,
      user_prior_strikes: 1,
      report_count: 5,
      is_verified_public_figure: false,
      context_flag_satire_or_news: false,
      // classifier_confidence intentionally omitted — model-serving timeout.
    }
  ),
  buildAction(
    "content-moderation:4",
    "Remove post #771041 — public figure, high reports, satire flag present",
    "A verified public figure's post is drawing heavy reports and high toxicity, but the classifier also flags likely satirical framing — exactly the combination that produces the most contested takedown calls.",
    {
      toxicity_score: 0.81,
      classifier_confidence: 0.63,
      user_prior_strikes: 0,
      report_count: 220,
      is_verified_public_figure: true,
      context_flag_satire_or_news: true,
    }
  ),
  buildAction(
    "content-moderation:5",
    "Remove post #771058 — clear-cut spam/scam link",
    "High-confidence match on a known scam-link pattern, repeat offender, no ambiguity.",
    {
      toxicity_score: 0.4,
      classifier_confidence: 0.97,
      user_prior_strikes: 3,
      report_count: 9,
      is_verified_public_figure: false,
      context_flag_satire_or_news: false,
    }
  ),
  buildAction(
    "content-moderation:6",
    "Remove post #771066 — matches zero-tolerance policy category",
    "The classifier hard-flags this post as matching a zero-tolerance policy category — this class of match is never left to autonomous action regardless of confidence.",
    {
      toxicity_score: 0.9,
      classifier_confidence: 0.88,
      user_prior_strikes: 0,
      report_count: 3,
      is_verified_public_figure: false,
      context_flag_satire_or_news: false,
      policy_violation: true,
    }
  ),
];

const failureCase = buildAction(
  "content-moderation:failure",
  "Remove post #771080 — reclaimed slur used within an affected community",
  "The toxicity classifier fires high on specific words alone. Low report volume and no strike history actually keep the engine's confidence too low to auto-remove — it asks a human instead, which looks like the system working. What the signals still can't see: the account belongs to a moderator of a support community for the group in question, and the post uses in-group reclaimed language in a context this domain's evidence schema has no field to represent. A reviewer who only sees the same toxicity score and no context field can rubber-stamp the same wrong removal one click later — \"ask\" routes around a confidently-wrong auto-execute, but it doesn't fix a decision that's missing the one fact that mattered. See FAILURE_TESTS.md.",
  {
    toxicity_score: 0.88,
    classifier_confidence: 0.79,
    user_prior_strikes: 0,
    report_count: 2,
    is_verified_public_figure: false,
    context_flag_satire_or_news: false,
  }
);

export const contentModerationDomain: DomainDefinition = {
  id: "content-moderation",
  label: "Content moderation",
  description:
    "Decides whether to auto-remove a reported post, or hold it for a human moderator. \"Refuse\" here means the engine won't act on its own authority — not that the post is cleared.",
  thresholds: {
    executeConfidence: 85,
    executeMaxRisk: 25,
    refuseMinRisk: 80,
    escalateMinRisk: 55,
    minEvidenceCoverage: 0.85,
  },
  actions,
  failureCase,
};
