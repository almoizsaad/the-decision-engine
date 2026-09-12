import { OUTCOME_VISUALS } from "@/lib/decisionVisuals";
import { Gauge } from "@/components/Gauge";
import { EvidencePanel } from "@/components/EvidencePanel";
import { SignalTrace } from "@/components/SignalTrace";
import { ActionControls } from "@/components/ActionControls";
import type { Decision, HumanResponseType, ProposedAction } from "@/engine/types";

interface DecisionStageProps {
  action: ProposedAction;
  decision: Decision;
  onRespond: (type: HumanResponseType, note?: string) => void;
  onNotThePriority: () => void;
  lastLoggedNote: string | null;
}

const RISK_COLOR: Record<Decision["outcome"], string> = {
  execute: "bg-decision-execute",
  ask: "bg-decision-ask",
  defer: "bg-decision-defer",
  escalate: "bg-decision-escalate",
  refuse: "bg-decision-refuse",
};

export function DecisionStage({ action, decision, onRespond, onNotThePriority, lastLoggedNote }: DecisionStageProps) {
  const visual = OUTCOME_VISUALS[decision.outcome];
  const Icon = visual.icon;

  return (
    <div className="scan-surface relative h-full overflow-y-auto">
      <div className="relative z-10 space-y-5 p-5">
        {/* Outcome header */}
        <div className={`flex items-start gap-3 rounded-lg border p-4 ${visual.borderClass} ${visual.bgClass}`}>
          <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${visual.textClass}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className={`font-serif text-xl font-semibold ${visual.textClass}`}>{visual.label}</h3>
              <span className="font-mono text-xs text-ink-300">{action.domainLabel}</span>
            </div>
            <p className="mt-1 text-sm text-ink-100">{visual.description}</p>
          </div>
        </div>

        {/* Proposed action */}
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink-50">{action.title}</h2>
          <p className="mt-1 text-sm text-ink-200">{action.description}</p>
        </div>

        {/* Gauges */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Gauge label="Confidence" value={decision.confidence} colorClass="bg-signal" />
          <Gauge label="Risk score" value={decision.risk} colorClass={RISK_COLOR[decision.outcome]} />
        </div>

        {/* Reversibility strip */}
        <div className="grid grid-cols-1 gap-3 rounded-md border border-ink-700 bg-ink-800 p-3 text-xs sm:grid-cols-3">
          <div>
            <div className="text-ink-300">Reversible</div>
            <div className="mt-0.5 font-mono text-ink-50">{decision.reversible ? "yes" : "no"}</div>
          </div>
          <div>
            <div className="text-ink-300">Blast radius</div>
            <div className="mt-0.5 font-mono text-ink-50">{decision.blastRadius}</div>
          </div>
          <div>
            <div className="text-ink-300">Cost of being wrong</div>
            <div className="mt-0.5 font-mono text-ink-50">{decision.costOfWrongAction}</div>
          </div>
        </div>

        {/* Evidence */}
        <EvidencePanel
          evidence={decision.evidenceUsed}
          missingKeys={decision.missingInformation}
          allSpecs={action.evidence}
        />

        {/* Reasoning */}
        <div>
          <h4 className="mb-2 font-sans text-xs font-semibold text-ink-200">Why this outcome</h4>
          <ul className="space-y-1.5">
            {decision.reasoning.map((line, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink-100">
                <span className="text-ink-400">—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Signal trace */}
        <SignalTrace
          confidenceTrace={decision.confidenceTrace}
          riskTrace={decision.riskTrace}
          overriddenIds={decision.overridesApplied}
        />

        {/* Action controls */}
        <div className="border-t border-ink-700 pt-4">
          <ActionControls
            action={action}
            decision={decision}
            onRespond={onRespond}
            onNotThePriority={onNotThePriority}
          />
          {lastLoggedNote && (
            <p className="mt-3 rounded-md bg-ink-800 px-3 py-2 font-mono text-[11px] text-ink-300">
              {lastLoggedNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
