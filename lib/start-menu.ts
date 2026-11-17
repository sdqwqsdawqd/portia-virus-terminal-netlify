// UAT 2026-11-16 gap 1: the PORTIA start menu closes like an OS menu: a press or focus outside it, the browser window losing focus, and Escape.
// Pure rule, no DOM: the desktop turns each DOM event into a StartMenuEvent. `inside` means the target is in the menu panel or on the PORTIA button,
// so a press on the button itself only toggles the menu (its own click handler) instead of closing and reopening it.
export type StartMenuEvent = { kind: "pointerdown" | "focusin" | "blur" | "keydown"; inside?: boolean; key?: string };

export function startMenuCloseReason(event: StartMenuEvent): "outside" | "escape" | null {
  switch (event.kind) {
    case "pointerdown":
    case "focusin":
      return event.inside ? null : "outside";
    case "blur":
      return "outside";
    case "keydown":
      return event.key === "Escape" ? "escape" : null;
    default:
      return null;
  }
}
