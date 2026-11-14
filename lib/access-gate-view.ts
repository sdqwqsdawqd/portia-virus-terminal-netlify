// Pure layout of the visitor gate. Type-only imports: a runtime import of ./access-gate.ts would pull node:crypto
// (through ./access-session.ts) into the client bundle.
import type { GateDecision } from "./access-gate.ts";

export type AccessGateView = { kind: "checking" } | { kind: "error" } | { kind: "decision"; decision: GateDecision };

export type AccessGateStatus = "pending" | "approved" | "rejected" | "revoked";

export type AccessGateLayout = {
  desktop: boolean;
  showCard: boolean;
  showForm: boolean;
  showReopen: boolean;
  showError: boolean;
  status: AccessGateStatus | null;
};

export function accessGateLayout(view: AccessGateView, cardOpen: boolean): AccessGateLayout {
  const decision = view.kind === "decision" ? view.decision : null;
  const desktop = decision !== null && (decision.mode === "open" || decision.allowed);
  // WR-04 (D-03, D-08): a verified editor enters through the editor login and joins Promotion through their own
  // request, so the visitor card, form and reopen button are never offered to them.
  const editor = decision !== null && decision.mode === "closed" && decision.editor;
  const state = decision?.state.state;
  const showForm = !editor && (state === "none" || state === "rejected" || state === "revoked");
  const status = state === "pending" || state === "approved" || state === "rejected" || state === "revoked" ? state : null;
  return {
    desktop,
    showCard: !editor && (!desktop || cardOpen),
    showForm,
    showReopen: desktop && !editor && !cardOpen,
    showError: view.kind === "error",
    status,
  };
}

export type AccessSubmitFailure = { kind: "device-busy" | "cooldown" | "throttled" | "default" } | { kind: "server"; text: string };

const knownFailureCodes = ["device-busy", "cooldown", "throttled"] as const;

// WR-03: what the request form may show for a failed submission. A known code wins, then the server's own bounded
// error string, otherwise the caller shows its general text. The texts themselves live in the component.
export function accessSubmitFailure(body: unknown): AccessSubmitFailure {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { kind: "default" };
  const { code, error } = body as { code?: unknown; error?: unknown };
  const known = knownFailureCodes.find((entry) => entry === code);
  if (known) return { kind: known };
  if (typeof error === "string") {
    const text = error.trim();
    if (text.length >= 1 && text.length <= 300) return { kind: "server", text };
  }
  return { kind: "default" };
}
