/**
 * Small shared helpers used by every file in src/domains/. None of this is
 * engine logic — it's just repetitive plumbing (turning a raw record into
 * EvidenceItem[], clamping a number into [0,1]) that every domain would
 * otherwise duplicate.
 */
import type { EvidenceItem } from "@/engine/types";

export interface EvidenceSpec {
  key: string;
  label: string;
  source: string;
}

/**
 * Builds EvidenceItem[] from a raw record and a field spec list. A field
 * counts as "present" only when the raw record actually defines it — to
 * model a domain example with missing evidence, omit the key from `raw`
 * entirely, the way a real integration failing to return a field would
 * look, rather than setting it to null.
 */
export function buildEvidence(
  raw: Record<string, unknown>,
  specs: EvidenceSpec[]
): EvidenceItem[] {
  return specs.map((spec) => {
    const value = raw[spec.key];
    const present = value !== undefined && value !== null;
    return {
      key: spec.key,
      label: spec.label,
      present,
      value: present ? (value as string | number | boolean) : undefined,
      source: spec.source,
    };
  });
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function num(raw: Record<string, unknown>, key: string, fallback = 0): number {
  const v = raw[key];
  return typeof v === "number" ? v : fallback;
}

export function bool(raw: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = raw[key];
  return typeof v === "boolean" ? v : fallback;
}

export function str(raw: Record<string, unknown>, key: string, fallback = ""): string {
  const v = raw[key];
  return typeof v === "string" ? v : fallback;
}
