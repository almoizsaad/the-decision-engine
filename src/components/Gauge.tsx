import { cn } from "@/lib/utils";

interface GaugeProps {
  label: string;
  value: number; // 0-100
  colorClass: string; // tailwind bg-* class for the fill
  helpText?: string;
}

export function Gauge({ label, value, colorClass, helpText }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-xs font-medium text-ink-200">{label}</span>
        <span className="font-mono text-lg font-semibold text-ink-50">{Math.round(clamped)}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-700"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", colorClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {helpText && <p className="mt-1 text-xs text-ink-300">{helpText}</p>}
    </div>
  );
}
