import { Check, CircleSlash } from "lucide-react";
import type { EvidenceItem } from "@/engine/types";

interface EvidencePanelProps {
  evidence: EvidenceItem[];
  missingKeys: string[];
  allSpecs: EvidenceItem[]; // full evidence list including absent ones, for labels/sources
}

export function EvidencePanel({ evidence, missingKeys, allSpecs }: EvidencePanelProps) {
  const missingItems = allSpecs.filter((e) => missingKeys.includes(e.key));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h4 className="mb-2 font-sans text-xs font-semibold text-ink-200">
          Evidence used ({evidence.length})
        </h4>
        <ul className="space-y-1.5">
          {evidence.map((item) => (
            <li key={item.key} className="flex items-start gap-2 text-xs">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-decision-execute" />
              <div>
                <span className="text-ink-50">{item.label}</span>
                <span className="ml-1.5 font-mono text-ink-300">
                  {typeof item.value === "boolean" ? (item.value ? "true" : "false") : String(item.value)}
                </span>
                <div className="font-mono text-[10px] text-ink-400">{item.source}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-2 font-sans text-xs font-semibold text-ink-200">
          Missing information ({missingItems.length})
        </h4>
        {missingItems.length === 0 ? (
          <p className="text-xs text-ink-300">Nothing required is missing.</p>
        ) : (
          <ul className="space-y-1.5">
            {missingItems.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-xs">
                <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-decision-defer" />
                <div>
                  <span className="text-ink-50">{item.label}</span>
                  <div className="font-mono text-[10px] text-ink-400">expected from {item.source}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
