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
  approvedNotice: boolean;
};

export function accessGateLayout(view: AccessGateView, cardOpen: boolean): AccessGateLayout {
  const decision = view.kind === "decision" ? view.decision : null;
  const desktop = decision !== null && (decision.mode === "open" || decision.allowed);
  // WR-04 (D-03, D-08): a verified editor enters through the editor login and joins Promotion through their own
  // request, so the visitor card, form and reopen button are never offered to them.
  const editor = decision !== null && decision.mode === "closed" && decision.editor;
  const state = decision?.state.state;
  const showForm = !editor && (state === "none" || state === "rejected" || state === "revoked");
  // G-PORTIA-23-3-r2 (owner, 2026-11-15): an approved visitor on the open desktop needs no card (there is no form, and the
  // editor login is in the desktop settings); a single notice confirms the approval instead.
  const approvedOnDesktop = desktop && !editor && state === "approved";
  const status = state === "pending" || state === "approved" || state === "rejected" || state === "revoked" ? state : null;
  return {
    desktop,
    showCard: !editor && !approvedOnDesktop && (!desktop || cardOpen),
    showForm,
    showReopen: desktop && !editor && !approvedOnDesktop && !cardOpen,
    showError: view.kind === "error",
    status,
    approvedNotice: approvedOnDesktop,
  };
}

export const ACCESS_APPROVED_NOTICE_KEY = "portia-access-approved-notice-v1";

export type ApprovedNoticeStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

// Like the quest notice (portia-desktop.tsx): storage that cannot be read or written means "no notice", never "a notice on
// every load". Only "1" is stored, no nickname and no token.
export function claimApprovedNotice(storage: () => ApprovedNoticeStorage): boolean {
  try {
    const store = storage();
    if (store.getItem(ACCESS_APPROVED_NOTICE_KEY) === "1") return false;
    store.setItem(ACCESS_APPROVED_NOTICE_KEY, "1");
    return true;
  } catch {
    return false;
  }
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
