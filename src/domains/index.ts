import type { DomainDefinition } from "@/engine/types";
import { ticketTriageDomain } from "./ticketTriage";
import { refundApprovalDomain } from "./refundApproval";
import { deployGateDomain } from "./deployGate";
import { contentModerationDomain } from "./contentModeration";

export const domains: DomainDefinition[] = [
  ticketTriageDomain,
  refundApprovalDomain,
  deployGateDomain,
  contentModerationDomain,
];

export {
  ticketTriageDomain,
  refundApprovalDomain,
  deployGateDomain,
  contentModerationDomain,
};
