import type { DecisionOutcome } from "@/engine/types";
import { CircleCheck, MessageCircleQuestion, Clock, TriangleAlert, Ban, type LucideIcon } from "lucide-react";

export interface OutcomeVisual {
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
}

export const OUTCOME_VISUALS: Record<DecisionOutcome, OutcomeVisual> = {
  execute: {
    label: "Execute",
    shortLabel: "EXEC",
    description: "Confident and low-risk enough to act on its own.",
    icon: CircleCheck,
    textClass: "text-decision-execute",
    bgClass: "bg-decision-execute-dim",
    borderClass: "border-decision-execute/40",
    dotClass: "bg-decision-execute",
  },
  ask: {
    label: "Ask",
    shortLabel: "ASK",
    description: "Wants a human to confirm before it acts.",
    icon: MessageCircleQuestion,
    textClass: "text-decision-ask",
    bgClass: "bg-decision-ask-dim",
    borderClass: "border-decision-ask/40",
    dotClass: "bg-decision-ask",
  },
  defer: {
    label: "Defer",
    shortLabel: "DEFER",
    description: "Not enough evidence yet to responsibly render an opinion.",
    icon: Clock,
    textClass: "text-decision-defer",
    bgClass: "bg-decision-defer-dim",
    borderClass: "border-decision-defer/40",
    dotClass: "bg-decision-defer",
  },
  escalate: {
    label: "Escalate",
    shortLabel: "ESC",
    description: "Too much at stake for a confirmation click — routed to a human with authority.",
    icon: TriangleAlert,
    textClass: "text-decision-escalate",
    bgClass: "bg-decision-escalate-dim",
    borderClass: "border-decision-escalate/40",
    dotClass: "bg-decision-escalate",
  },
  refuse: {
    label: "Refuse",
    shortLabel: "REFUSE",
    description: "Won't propose this for autonomous action, regardless of confidence.",
    icon: Ban,
    textClass: "text-decision-refuse",
    bgClass: "bg-decision-refuse-dim",
    borderClass: "border-decision-refuse/40",
    dotClass: "bg-decision-refuse",
  },
};
