import { useCallback, useEffect, useMemo, useState } from "react";
import { domains } from "@/domains";
import { decide } from "@/engine/decisionEngine";
import {
  applyNotThePriorityFeedback,
  resetOverridesForDomain,
  overridesForDomain,
  type WeightOverrides,
} from "@/engine/feedback";
import { loadAuditLog, saveAuditLog, clearAuditLog } from "@/engine/audit";
import type {
  AuditEntry,
  Decision,
  HumanResponseType,
  ProposedAction,
} from "@/engine/types";

const TERMINAL_RESPONSES: HumanResponseType[] = [
  "executed",
  "approved",
  "edited",
  "rejected",
  "escalated_ack",
  "deferred_ack",
  "refused_ack",
];

export function useDecisionSession() {
  const [activeDomainId, setActiveDomainId] = useState(domains[0].id);
  const [overrides, setOverrides] = useState<WeightOverrides>({});
  const [audit, setAudit] = useState<AuditEntry[]>(() => loadAuditLog());
  const [resolvedActionIds, setResolvedActionIds] = useState<Set<string>>(new Set());
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showFailureCase, setShowFailureCase] = useState(false);

  useEffect(() => {
    saveAuditLog(audit);
  }, [audit]);

  const activeDomain = useMemo(
    () => domains.find((d) => d.id === activeDomainId) ?? domains[0],
    [activeDomainId]
  );

  const domainActions = useMemo<ProposedAction[]>(
    () =>
      showFailureCase
        ? [...activeDomain.actions, activeDomain.failureCase]
        : activeDomain.actions,
    [activeDomain, showFailureCase]
  );

  const decisionsByActionId = useMemo(() => {
    const map = new Map<string, Decision>();
    for (const action of domainActions) {
      map.set(action.id, decide(action, activeDomain.thresholds, overrides));
    }
    return map;
  }, [domainActions, activeDomain, overrides]);

  const visibleActions = useMemo(
    () => domainActions.filter((a) => !resolvedActionIds.has(a.id)),
    [domainActions, resolvedActionIds]
  );

  // Keep the selection valid: if nothing is selected, or the selection was
  // just resolved out of the queue, fall back to the first visible action.
  useEffect(() => {
    if (visibleActions.length === 0) {
      if (selectedActionId !== null) setSelectedActionId(null);
      return;
    }
    const stillVisible = visibleActions.some((a) => a.id === selectedActionId);
    if (!stillVisible) {
      setSelectedActionId(visibleActions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleActions]);

  const selectedAction = useMemo(
    () => visibleActions.find((a) => a.id === selectedActionId) ?? null,
    [visibleActions, selectedActionId]
  );

  const selectedDecision = selectedAction
    ? decisionsByActionId.get(selectedAction.id) ?? null
    : null;

  const switchDomain = useCallback((domainId: string) => {
    setActiveDomainId(domainId);
    setSelectedActionId(null);
    setShowFailureCase(false);
  }, []);

  const selectAction = useCallback((actionId: string) => {
    setSelectedActionId(actionId);
  }, []);

  const toggleFailureCase = useCallback(() => {
    setShowFailureCase((v) => !v);
  }, []);

  const respond = useCallback(
    (action: ProposedAction, decision: Decision, type: HumanResponseType, note?: string) => {
      const entry: AuditEntry = {
        decision,
        action,
        humanResponse: { type, note, timestamp: new Date().toISOString() },
      };
      setAudit((prev) => [...prev, entry]);
      if (TERMINAL_RESPONSES.includes(type)) {
        setResolvedActionIds((prev) => new Set(prev).add(action.id));
      }
    },
    []
  );

  const submitNotThePriorityFeedback = useCallback(
    (action: ProposedAction, decision: Decision) => {
      const result = applyNotThePriorityFeedback(overrides, decision);
      if (!result.adjustedSignalId) return;
      setOverrides(result.overrides);
      const note = `Marked "${decision.outcome}" as the wrong call. Discounted "${result.adjustedLabel}" to ${Math.round(
        (result.newFactor ?? 1) * 100
      )}% of its prior weight for the ${action.domainLabel} domain — future actions of this type in this domain will weigh it less until it's reset.`;
      const entry: AuditEntry = {
        decision,
        action,
        humanResponse: { type: "override_feedback", note, timestamp: new Date().toISOString() },
      };
      setAudit((prev) => [...prev, entry]);
    },
    [overrides]
  );

  const resetDomainOverrides = useCallback(() => {
    setOverrides((prev) => resetOverridesForDomain(prev, activeDomain.id));
  }, [activeDomain.id]);

  const resetSession = useCallback(() => {
    clearAuditLog();
    setAudit([]);
    setResolvedActionIds(new Set());
    setOverrides({});
    setSelectedActionId(null);
    setShowFailureCase(false);
  }, []);

  const activeDomainOverrides = useMemo(
    () => overridesForDomain(overrides, activeDomain.id),
    [overrides, activeDomain.id]
  );

  return {
    domains,
    activeDomain,
    switchDomain,
    visibleActions,
    decisionsByActionId,
    selectedAction,
    selectedDecision,
    selectAction,
    showFailureCase,
    toggleFailureCase,
    respond,
    submitNotThePriorityFeedback,
    activeDomainOverrides,
    resetDomainOverrides,
    audit,
    resetSession,
    totalResolvedInDomain: activeDomain.actions.filter((a) => resolvedActionIds.has(a.id)).length,
  };
}
