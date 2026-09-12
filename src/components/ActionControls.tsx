import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Decision, HumanResponseType, ProposedAction } from "@/engine/types";

interface ActionControlsProps {
  action: ProposedAction;
  decision: Decision;
  onRespond: (type: HumanResponseType, note?: string) => void;
  onNotThePriority: () => void;
}

export function ActionControls({ action, decision, onRespond, onNotThePriority }: ActionControlsProps) {
  const [editNote, setEditNote] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const isModeration = action.domain === "content-moderation";

  return (
    <div className="space-y-3">
      {decision.outcome === "execute" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRespond("executed")} className="bg-decision-execute text-ink-950 hover:bg-decision-execute/90">
            Run automatically
          </Button>
          <Button variant="outline" onClick={() => onRespond("rejected", "Manually held despite an execute recommendation.")}>
            Hold it anyway
          </Button>
        </div>
      )}

      {decision.outcome === "ask" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onRespond("approved")} className="bg-decision-ask text-ink-950 hover:bg-decision-ask/90">
              Approve & run
            </Button>
            <Button variant="outline" onClick={() => setShowEdit((v) => !v)}>
              {showEdit ? "Cancel edit" : "Edit, then approve"}
            </Button>
            <Button variant="ghost" onClick={() => onRespond("rejected")}>
              Reject
            </Button>
          </div>
          {showEdit && (
            <div className="flex gap-2">
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="What did you change before approving?"
                className="flex-1 rounded-md border border-ink-500 bg-ink-800 px-3 py-1.5 text-sm text-ink-50 placeholder:text-ink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
              />
              <Button
                onClick={() => {
                  onRespond("edited", editNote || "Edited before approval.");
                  setShowEdit(false);
                  setEditNote("");
                }}
              >
                Confirm edit & run
              </Button>
            </div>
          )}
        </div>
      )}

      {decision.outcome === "defer" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRespond("deferred_ack")} className="bg-decision-defer text-ink-950 hover:bg-decision-defer/90">
            Log as deferred, wait for more evidence
          </Button>
          <Button variant="outline" onClick={() => onRespond("escalated_ack", "Escalated instead of waiting for missing evidence.")}>
            Escalate instead
          </Button>
        </div>
      )}

      {decision.outcome === "escalate" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRespond("escalated_ack")} className="bg-decision-escalate text-ink-950 hover:bg-decision-escalate/90">
            Escalate to a human decision-maker
          </Button>
        </div>
      )}

      {decision.outcome === "refuse" && (
        <div className="space-y-2">
          <p className="text-xs text-ink-300">
            {isModeration
              ? "The engine won't auto-remove this post on its own authority — that's not the same as clearing it. It stays with a human moderator either way."
              : "The engine will not propose this action for autonomous approval, at any confidence level, while this signal is present."}
          </p>
          <Button variant="outline" onClick={() => onRespond("refused_ack")}>
            Acknowledge refusal — log for review
          </Button>
        </div>
      )}

      <div className="border-t border-ink-700 pt-3">
        <button
          onClick={onNotThePriority}
          className="text-xs text-ink-300 underline decoration-dotted underline-offset-4 hover:text-ink-50"
        >
          This wasn't the right call — discount the signal that drove it
        </button>
      </div>
    </div>
  );
}
