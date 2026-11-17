// UAT 2026-11-16 gap 1: the PORTIA start menu must close like an OS menu. RED stub: never closes.
export type StartMenuEvent = { kind: "pointerdown" | "focusin" | "blur" | "keydown"; inside?: boolean; key?: string };

export function startMenuCloseReason(event: StartMenuEvent): "outside" | "escape" | null {
  void event;
  return null;
}
