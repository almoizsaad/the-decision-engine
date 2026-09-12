/**
 * Audit trail storage.
 *
 * Every decision the engine renders — and every human response to it — is
 * appended here. This is deliberately append-only from the UI's point of
 * view (see hooks/useDecisionSession.ts: there is no function in this
 * file that edits or removes a past entry, only clearAuditLog(), which is
 * exposed solely as a demo "reset session" control and is called out as
 * such in the UI). Persistence is localStorage because this is a static
 * frontend with no backend — see NOTES.md for what a production audit
 * trail would need instead (append-only server-side storage, a real
 * timestamp authority, and access controls on who can read it).
 */
import type { AuditEntry } from "./types";

const STORAGE_KEY = "decision-engine.audit.v1";

export function loadAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAuditLog(entries: AuditEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can fail (quota, private browsing) — the session still
    // works in-memory for the current tab, it just won't survive a reload.
  }
}

/** The human-readable "DEC-00007" label shown in the UI. Derived from the
 * entry's position in the audit trail (1-indexed), not stored on the
 * Decision itself — see decisionEngine.ts for why decide() stays pure. */
export function formatDecisionSequence(indexZeroBased: number): string {
  return `DEC-${String(indexZeroBased + 1).padStart(5, "0")}`;
}

export function clearAuditLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
