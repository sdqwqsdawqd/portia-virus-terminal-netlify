// Pure layout of the visitor gate. Type-only imports: a runtime import of ./access-gate.ts would pull node:crypto
// (through ./access-session.ts) into the client bundle.
import type { GateDecision } from "./access-gate.ts";

export type AccessGateView = { kind: "checking" } | { kind: "error" } | { kind: "decision"; decision: GateDecision };

export type AccessGateStatus = "pending" | "approved" | "rejected" | "revoked";

export type AccessGateLayout = {
  desktop: boolean;
  showCard: boolean;
  showForm: boolean;
  showError: boolean;
  status: AccessGateStatus | null;
};

export function accessGateLayout(view: AccessGateView, cardOpen: boolean): AccessGateLayout {
  const decision = view.kind === "decision" ? view.decision : null;
  const desktop = decision !== null && (decision.mode === "open" || decision.allowed);
  const state = decision?.state.state;
  const showForm = state === "none" || state === "rejected" || state === "revoked";
  const status = state === "pending" || state === "approved" || state === "rejected" || state === "revoked" ? state : null;
  return { desktop, showCard: !desktop || cardOpen, showForm, showError: view.kind === "error", status };
}
