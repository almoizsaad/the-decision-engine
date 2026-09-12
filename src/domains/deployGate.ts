/**
 * Domain: code deploy gate.
 *
 * Proposed action: auto-merge and deploy a pull request to production
 * instead of waiting for a human to click deploy. This domain is where
 * "blast radius" earns its keep — the same confidence score means
 * something very different on a docs typo fix than on a change touching
 * auth or payments.
 */
import type { DomainDefinition, ProposedAction, BlastRadius, CostOfWrongAction } from "@/engine/types";
import { buildEvidence, clamp01, num, bool, str, type EvidenceSpec } from "./domainHelpers";

const SPECS: EvidenceSpec[] = [
  { key: "ci_status", label: "CI status", source: "CI.pipeline.status" },
  { key: "test_coverage_delta_pct", label: "Test coverage delta (%)", source: "CI.coverage.delta_pct" },
  { key: "diff_size_lines", label: "Diff size (lines changed)", source: "GitHost.pull_request.diff_stats" },
  { key: "touches_auth_or_payments", label: "Touches auth or payments code", source: "GitHost.pull_request.path_classifier" },
  { key: "has_rollback_plan", label: "Rollback plan documented", source: "GitHost.pull_request.description_parser" },
  { key: "reviewer_approvals_count", label: "Reviewer approvals", source: "GitHost.pull_request.reviews" },
  { key: "prior_deploy_failure_rate_pct", label: "Prior deploy failure rate for this service (%)", source: "Deploys.service.failure_rate_90d" },
  { key: "is_weekend_or_freeze_window", label: "Inside a deploy freeze window", source: "Deploys.calendar.freeze_windows" },
  { key: "policy_violation", label: "Hard policy match", source: "CI.gate.hard_blocks" },
];

function buildAction(id: string, title: string, description: string, raw: Record<string, unknown>): ProposedAction {
  const evidence = buildEvidence(raw, SPECS);
  const ciStatus = str(raw, "ci_status", "unknown");
  const coverageDelta = num(raw, "test_coverage_delta_pct", 0);
  const diffSize = num(raw, "diff_size_lines", 0);
  const touchesSensitive = bool(raw, "touches_auth_or_payments", false);
  const hasRollback = bool(raw, "has_rollback_plan", false);
  const approvals = num(raw, "reviewer_approvals_count", 0);
  const failureRate = num(raw, "prior_deploy_failure_rate_pct", 0);
  const freezeWindow = bool(raw, "is_weekend_or_freeze_window", false);

  const blastRadius: BlastRadius = touchesSensitive ? "system-wide" : "multi-customer";
  let costOfWrongAction: CostOfWrongAction;
  if (touchesSensitive && !hasRollback) costOfWrongAction = "severe";
  else if (touchesSensitive || !hasRollback) costOfWrongAction = "high";
  else if (diffSize > 200) costOfWrongAction = "medium";
  else costOfWrongAction = "low";

  return {
    id,
    domain: "deploy-gate",
    domainLabel: "Code deploy gate",
    type: "auto_merge_and_deploy",
    title,
    description,
    reversibility: {
      reversible: hasRollback,
      blastRadius,
      costOfWrongAction,
      rationale: hasRollback
        ? "A documented rollback plan exists, so a bad deploy can be reverted quickly."
        : "No rollback plan is documented — a bad deploy would need an ad-hoc fix under pressure.",
    },
    evidence,
    requiredEvidenceKeys: [
      "ci_status",
      "test_coverage_delta_pct",
      "touches_auth_or_payments",
      "diff_size_lines",
      "has_rollback_plan",
      "reviewer_approvals_count",
    ],
    signals: [
      {
        id: "ci_pass",
        label: "CI status",
        kind: "confidence",
        weight: 0.3,
        strength: ciStatus === "passed" ? 1 : ciStatus === "unknown" ? 0.2 : 0,
        rationale: `CI reports "${ciStatus}".`,
        evidenceKeys: ["ci_status"],
      },
      {
        id: "review_coverage",
        label: "Reviewer approvals",
        kind: "confidence",
        weight: 0.25,
        strength: clamp01(approvals / 2),
        rationale: `${approvals} reviewer approval(s) on this pull request.`,
        evidenceKeys: ["reviewer_approvals_count"],
      },
      {
        id: "test_coverage_signal",
        label: "Test coverage trend",
        kind: "confidence",
        weight: 0.2,
        strength: coverageDelta >= 0 ? clamp01(0.7 + coverageDelta / 20) : clamp01(0.5 + coverageDelta / 10),
        rationale: `Test coverage delta is ${coverageDelta >= 0 ? "+" : ""}${coverageDelta}%.`,
        evidenceKeys: ["test_coverage_delta_pct"],
      },
      {
        id: "blast_size_risk",
        label: "Diff size",
        kind: "risk",
        weight: 0.2,
        strength: clamp01(diffSize / 500),
        rationale: `${diffSize} lines changed.`,
        evidenceKeys: ["diff_size_lines"],
      },
      {
        id: "sensitive_area_risk",
        label: "Touches auth or payments",
        kind: "risk",
        weight: 0.35,
        strength: touchesSensitive ? 1 : 0.1,
        rationale: touchesSensitive
          ? "This change touches authentication or payments code paths."
          : "This change doesn't touch authentication or payments code paths.",
        evidenceKeys: ["touches_auth_or_payments"],
      },
      {
        id: "freeze_window_risk",
        label: "Deploy freeze window",
        kind: "risk",
        weight: 0.2,
        strength: freezeWindow ? 0.8 : 0.1,
        rationale: freezeWindow
          ? "This would deploy inside a declared freeze window (weekend / low on-call coverage)."
          : "Outside any declared freeze window.",
        evidenceKeys: ["is_weekend_or_freeze_window"],
      },
      {
        id: "failure_history_risk",
        label: "Service failure history",
        kind: "risk",
        weight: 0.25,
        strength: clamp01(failureRate / 30),
        rationale: `This service's deploys have failed ${failureRate}% of the time in the last 90 days.`,
        evidenceKeys: ["prior_deploy_failure_rate_pct"],
      },
    ],
    raw,
  };
}

const actions: ProposedAction[] = [
  buildAction(
    "deploy-gate:1",
    "Deploy PR #2291 — fix typo in onboarding email copy",
    "One-line copy fix in a transactional email template. CI green, one approval, tiny diff.",
    {
      ci_status: "passed",
      test_coverage_delta_pct: 0,
      diff_size_lines: 3,
      touches_auth_or_payments: false,
      has_rollback_plan: true,
      reviewer_approvals_count: 1,
      prior_deploy_failure_rate_pct: 2,
      is_weekend_or_freeze_window: false,
    }
  ),
  buildAction(
    "deploy-gate:2",
    "Deploy PR #2304 — refactor shared date-formatting utility",
    "Touches a utility used across the dashboard. CI green, coverage up slightly, one reviewer.",
    {
      ci_status: "passed",
      test_coverage_delta_pct: 1.5,
      diff_size_lines: 140,
      touches_auth_or_payments: false,
      has_rollback_plan: true,
      reviewer_approvals_count: 1,
      prior_deploy_failure_rate_pct: 8,
      is_weekend_or_freeze_window: false,
    }
  ),
  buildAction(
    "deploy-gate:3",
    "Deploy PR #2317 — new caching layer for search results",
    "CI pipeline is still running when this action was proposed — status hasn't reported back yet.",
    {
      test_coverage_delta_pct: -2,
      diff_size_lines: 260,
      touches_auth_or_payments: false,
      has_rollback_plan: true,
      reviewer_approvals_count: 1,
      prior_deploy_failure_rate_pct: 6,
      is_weekend_or_freeze_window: false,
      // ci_status intentionally omitted — pipeline hadn't reported back yet.
    }
  ),
  buildAction(
    "deploy-gate:4",
    "Deploy PR #2325 — rework subscription billing webhook handling",
    "Large diff touching payments code, filed Friday afternoon before a declared weekend freeze window, single reviewer approval, no rollback plan documented in the PR description.",
    {
      ci_status: "passed",
      test_coverage_delta_pct: 0.5,
      diff_size_lines: 480,
      touches_auth_or_payments: true,
      has_rollback_plan: false,
      reviewer_approvals_count: 1,
      prior_deploy_failure_rate_pct: 14,
      is_weekend_or_freeze_window: true,
    }
  ),
  buildAction(
    "deploy-gate:5",
    "Deploy PR #2331 — add rate limiting to public API",
    "Well-tested, two approvals, moderate size, doesn't touch auth or payments directly, rollback plan documented.",
    {
      ci_status: "passed",
      test_coverage_delta_pct: 4,
      diff_size_lines: 190,
      touches_auth_or_payments: false,
      has_rollback_plan: true,
      reviewer_approvals_count: 2,
      prior_deploy_failure_rate_pct: 5,
      is_weekend_or_freeze_window: false,
    }
  ),
  buildAction(
    "deploy-gate:6",
    "Deploy PR #2338 — bypass auth check for internal admin tool",
    "CI failed on the security-lint step, and the change touches auth. The pipeline's hard gate blocks any deploy that fails security lint on an auth-path change, independent of everything else about the PR.",
    {
      ci_status: "failed",
      test_coverage_delta_pct: -5,
      diff_size_lines: 60,
      touches_auth_or_payments: true,
      has_rollback_plan: true,
      reviewer_approvals_count: 1,
      prior_deploy_failure_rate_pct: 10,
      is_weekend_or_freeze_window: false,
      policy_violation: true,
    }
  ),
];

const failureCase = buildAction(
  "deploy-gate:failure",
  "Deploy PR #2350 — bump a pinned dependency patch version",
  "Every visible signal says this is the safest possible deploy: one-line lockfile change, CI green, two approvals, tiny diff, doesn't touch auth or payments, rollback plan on file. What the signals can't see: the patch version silently changed the default timeout behavior of an HTTP client used deep in the payment-retry path — a transitive risk with no evidence field in this domain's schema captures it.",
  {
    ci_status: "passed",
    test_coverage_delta_pct: 0,
    diff_size_lines: 4,
    touches_auth_or_payments: false,
    has_rollback_plan: true,
    reviewer_approvals_count: 2,
    prior_deploy_failure_rate_pct: 3,
    is_weekend_or_freeze_window: false,
  }
);

export const deployGateDomain: DomainDefinition = {
  id: "deploy-gate",
  label: "Code deploy gate",
  description:
    "Decides whether to auto-merge and deploy a pull request to production, or hold it for a human to deploy.",
  thresholds: {
    executeConfidence: 80,
    executeMaxRisk: 30,
    refuseMinRisk: 75,
    escalateMinRisk: 55,
    minEvidenceCoverage: 0.85,
  },
  actions,
  failureCase,
};
