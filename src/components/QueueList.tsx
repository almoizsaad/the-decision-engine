import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { OUTCOME_VISUALS } from "@/lib/decisionVisuals";
import type { Decision, ProposedAction } from "@/engine/types";

interface QueueListProps {
  actions: ProposedAction[];
  decisionsByActionId: Map<string, Decision>;
  selectedActionId: string | null;
  onSelect: (actionId: string) => void;
  showFailureCase: boolean;
  onToggleFailureCase: () => void;
  resolvedCount: number;
  totalCount: number;
}

export function QueueList({
  actions,
  decisionsByActionId,
  selectedActionId,
  onSelect,
  showFailureCase,
  onToggleFailureCase,
  resolvedCount,
  totalCount,
}: QueueListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h2 className="font-sans text-xs font-semibold tracking-wide text-ink-200">
          Queue
        </h2>
        <span className="font-mono text-xs text-ink-300">
          {resolvedCount}/{totalCount} resolved
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {actions.length === 0 ? (
          <div className="mx-2 mt-6 rounded-md border border-dashed border-ink-500 p-4 text-sm text-ink-300">
            Queue is clear. Every proposed action in this domain has been
            executed, approved, rejected, deferred, or escalated.
          </div>
        ) : (
          <ul className="space-y-1 pb-3">
            {actions.map((action) => {
              const decision = decisionsByActionId.get(action.id);
              const visual = decision ? OUTCOME_VISUALS[decision.outcome] : null;
              const isSelected = action.id === selectedActionId;
              const isFailureCase = action.id.endsWith(":failure");
              return (
                <li key={action.id}>
                  <button
                    onClick={() => onSelect(action.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-signal/50 bg-ink-700"
                        : "border-transparent hover:border-ink-500 hover:bg-ink-800",
                      isFailureCase && "border-dashed border-decision-escalate/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {visual && (
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", visual.dotClass)}
                          aria-hidden
                        />
                      )}
                      <span className="truncate text-sm font-medium text-ink-50">
                        {action.title}
                      </span>
                      {isFailureCase && (
                        <FlaskConical className="ml-auto h-3.5 w-3.5 shrink-0 text-decision-escalate" aria-label="Deliberate failure case" />
                      )}
                    </div>
                    {decision && (
                      <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-ink-300">
                        <span className={visual?.textClass}>{visual?.label}</span>
                        <span>conf {decision.confidence}</span>
                        <span>risk {decision.risk}</span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-ink-700 p-3">
        <button
          onClick={onToggleFailureCase}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
            showFailureCase
              ? "border-decision-escalate/50 bg-decision-escalate-dim text-decision-escalate"
              : "border-ink-500 text-ink-200 hover:border-ink-400 hover:text-ink-50"
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {showFailureCase ? "Hide the failure case" : "Run the failure case"}
        </button>
      </div>
    </div>
  );
}
