import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignalTraceEntry } from "@/engine/types";

interface SignalTraceProps {
  confidenceTrace: SignalTraceEntry[];
  riskTrace: SignalTraceEntry[];
  overriddenIds: string[];
}

function TraceRow({ entry, overridden }: { entry: SignalTraceEntry; overridden: boolean }) {
  const { signal, contribution } = entry;
  return (
    <div className="border-b border-ink-700 py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-50">
          {signal.label}
          {overridden && (
            <span className="ml-1.5 rounded-sm bg-signal/15 px-1 py-0.5 font-mono text-[10px] text-signal">
              weight adjusted
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-ink-300">
          w {signal.weight.toFixed(2)} × s {signal.strength.toFixed(2)} = {contribution.toFixed(2)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-300">{signal.rationale}</p>
    </div>
  );
}

export function SignalTrace({ confidenceTrace, riskTrace, overriddenIds }: SignalTraceProps) {
  const [open, setOpen] = useState(false);
  const overriddenSet = new Set(overriddenIds);

  return (
    <div className="rounded-md border border-ink-700">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="font-sans text-xs font-semibold text-ink-200">
          Signal-by-signal reasoning ({confidenceTrace.length + riskTrace.length} signals)
        </span>
        <ChevronDown className={cn("h-4 w-4 text-ink-300 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-ink-700 px-3 pb-3">
          <h5 className="mt-3 mb-1 font-mono text-[10px] uppercase text-ink-300">
            Confidence signals
          </h5>
          {confidenceTrace.length === 0 ? (
            <p className="py-2 text-xs text-ink-400">No confidence signals fired.</p>
          ) : (
            confidenceTrace.map((entry) => (
              <TraceRow key={entry.signal.id} entry={entry} overridden={overriddenSet.has(entry.signal.id)} />
            ))
          )}
          <h5 className="mt-3 mb-1 font-mono text-[10px] uppercase text-ink-300">
            Risk signals
          </h5>
          {riskTrace.map((entry) => (
            <TraceRow key={entry.signal.id} entry={entry} overridden={overriddenSet.has(entry.signal.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
