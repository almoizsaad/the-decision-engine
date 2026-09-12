import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useDecisionSession } from "@/hooks/useDecisionSession";
import { QueueList } from "@/components/QueueList";
import { DecisionStage } from "@/components/DecisionStage";
import { AuditTrail } from "@/components/AuditTrail";
import type { HumanResponseType } from "@/engine/types";

function App() {
  const {
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
    totalResolvedInDomain,
  } = useDecisionSession();

  const [lastLoggedNote, setLastLoggedNote] = useState<string | null>(null);

  useEffect(() => {
    if (!lastLoggedNote) return;
    const t = setTimeout(() => setLastLoggedNote(null), 5000);
    return () => clearTimeout(t);
  }, [lastLoggedNote]);

  const handleRespond = (type: HumanResponseType, note?: string) => {
    if (!selectedAction || !selectedDecision) return;
    respond(selectedAction, selectedDecision, type, note);
    setLastLoggedNote(`Logged to the audit trail: ${type.replace(/_/g, " ")}.`);
  };

  const handleNotThePriority = () => {
    if (!selectedAction || !selectedDecision) return;
    submitNotThePriorityFeedback(selectedAction, selectedDecision);
    setLastLoggedNote(
      "Feedback recorded — a weight was discounted for this domain. Re-open the queue item to see the trace marked \u201cweight adjusted.\u201d"
    );
  };

  return (
    <div className="flex h-screen flex-col bg-ink-950 text-ink-50">
      {/* Top bar */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-ink-700 bg-ink-900 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal/15">
            <span className="font-mono text-sm font-semibold text-signal">DE</span>
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold leading-none text-ink-50">
              The Decision Engine
            </h1>
            <p className="text-xs text-ink-300">
              execute · ask · defer · escalate · refuse
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1.5" aria-label="Domain">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => switchDomain(domain.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                domain.id === activeDomain.id
                  ? "bg-signal/15 text-signal"
                  : "text-ink-200 hover:bg-ink-800 hover:text-ink-50"
              )}
            >
              {domain.label}
            </button>
          ))}
        </nav>

        <div className="font-mono text-xs text-ink-300">
          {totalResolvedInDomain}/{activeDomain.actions.length} resolved in this domain
        </div>
      </header>

      <p className="shrink-0 border-b border-ink-700 bg-ink-900 px-5 py-2 text-xs text-ink-300">
        {activeDomain.description}
      </p>

      {/* Weight overrides banner */}
      {activeDomainOverrides.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-700 bg-signal/10 px-5 py-2 text-xs text-ink-100">
          <span className="font-semibold text-signal">Weights adjusted this session:</span>
          {activeDomainOverrides.map((o) => (
            <span key={o.signalId} className="rounded-sm bg-ink-800 px-1.5 py-0.5 font-mono text-[11px]">
              {o.signalId} → {Math.round(o.factor * 100)}%
            </span>
          ))}
          <button onClick={resetDomainOverrides} className="ml-auto text-ink-300 underline hover:text-ink-50">
            reset weights for this domain
          </button>
        </div>
      )}

      {/* Main two-zone stage */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="min-h-0 border-b border-ink-700 lg:border-b-0 lg:border-r">
          <QueueList
            actions={visibleActions}
            decisionsByActionId={decisionsByActionId}
            selectedActionId={selectedAction?.id ?? null}
            onSelect={selectAction}
            showFailureCase={showFailureCase}
            onToggleFailureCase={toggleFailureCase}
            resolvedCount={totalResolvedInDomain}
            totalCount={activeDomain.actions.length}
          />
        </aside>

        <main className="min-h-0">
          {selectedAction && selectedDecision ? (
            <DecisionStage
              action={selectedAction}
              decision={selectedDecision}
              onRespond={handleRespond}
              onNotThePriority={handleNotThePriority}
              lastLoggedNote={lastLoggedNote}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink-300">
              Nothing left in this queue. Switch domains, run the failure
              case, or reset the session to see decisions again.
            </div>
          )}
        </main>
      </div>

      {/* Audit trail */}
      <section className="h-64 shrink-0 border-t border-ink-700 bg-ink-900">
        <AuditTrail entries={audit} onReset={resetSession} />
      </section>
    </div>
  );
}

export default App;
