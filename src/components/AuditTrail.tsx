import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { OUTCOME_VISUALS } from "@/lib/decisionVisuals";
import { formatDecisionSequence } from "@/engine/audit";
import type { AuditEntry } from "@/engine/types";

interface AuditTrailProps {
  entries: AuditEntry[];
  onReset: () => void;
}

const RESPONSE_LABEL: Record<string, string> = {
  executed: "ran automatically",
  approved: "approved",
  edited: "edited & approved",
  rejected: "rejected",
  escalated_ack: "escalated",
  deferred_ack: "deferred",
  refused_ack: "refusal acknowledged",
  override_feedback: "weight override",
};

function AuditRow({ entry, sequence }: { entry: AuditEntry; sequence: string }) {
  const [expanded, setExpanded] = useState(false);
  const visual = OUTCOME_VISUALS[entry.decision.outcome];
  const time = new Date(entry.decision.timestamp);

  return (
    <div className="border-b border-ink-700 last:border-b-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-800"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform", expanded && "rotate-90")} />
        <span className="font-mono text-[11px] text-ink-400">
          {time.toLocaleTimeString([], { hour12: false })}
        </span>
        <span className="font-mono text-[11px] text-ink-300">{sequence}</span>
        <span className={cn("font-mono text-[11px] font-semibold uppercase", visual.textClass)}>
          {visual.shortLabel}
        </span>
        <span className="truncate font-mono text-[11px] text-ink-400">{entry.decision.domain}</span>
        <span className="font-mono text-[11px] text-ink-400">conf {entry.decision.confidence}</span>
        <span className="font-mono text-[11px] text-ink-400">risk {entry.decision.risk}</span>
        {entry.humanResponse && (
          <span className="ml-auto shrink-0 rounded-sm bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-200">
            {RESPONSE_LABEL[entry.humanResponse.type] ?? entry.humanResponse.type}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-2 px-3 pb-3">
          <p className="text-xs text-ink-200">{entry.action.title}</p>
          {entry.humanResponse?.note && (
            <p className="text-xs text-ink-300">{entry.humanResponse.note}</p>
          )}
          <pre className="max-h-64 overflow-auto rounded-md bg-ink-950 p-2 font-mono text-[10px] leading-relaxed text-ink-300">
            {JSON.stringify(
              {
                action: { id: entry.action.id, type: entry.action.type, raw: entry.action.raw },
                decision: {
                  outcome: entry.decision.outcome,
                  confidence: entry.decision.confidence,
                  risk: entry.decision.risk,
                  evidenceCoverage: entry.decision.evidenceCoverage,
                  missingInformation: entry.decision.missingInformation,
                  reversible: entry.decision.reversible,
                  blastRadius: entry.decision.blastRadius,
                  costOfWrongAction: entry.decision.costOfWrongAction,
                  overridesApplied: entry.decision.overridesApplied,
                  reasoning: entry.decision.reasoning,
                },
                humanResponse: entry.humanResponse,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export function AuditTrail({ entries, onReset }: AuditTrailProps) {
  const reversed = [...entries].reverse();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5">
        <h2 className="font-sans text-xs font-semibold tracking-wide text-ink-200">
          Audit trail ({entries.length})
        </h2>
        <button
          onClick={onReset}
          className="font-mono text-[11px] text-ink-400 hover:text-decision-refuse"
        >
          reset session
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="p-4 text-xs text-ink-400">
            Nothing logged yet. Every decision the engine renders, and every
            human response to it, appends a row here — nothing above this
            panel is decorative.
          </p>
        ) : (
          reversed.map((entry, i) => (
            <AuditRow
              key={`${entry.action.id}-${entry.decision.timestamp}-${i}`}
              entry={entry}
              sequence={formatDecisionSequence(entries.length - 1 - i)}
            />
          ))
        )}
      </div>
    </div>
  );
}
