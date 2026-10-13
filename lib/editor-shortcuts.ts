export type KeyInfo = { code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };
export type EditorShortcut = "save" | "undo" | "redo";

// Matches the physical key (code), not event.key: on a Russian layout the S key reports «ы».
// Alt is excluded because AltGr is reported as Ctrl+Alt on Windows.
export function shortcutOf(event: KeyInfo): EditorShortcut | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.code === "KeyS") return event.shiftKey ? null : "save";
  if (event.code === "KeyZ") return event.shiftKey ? "redo" : "undo";
  if (event.code === "KeyY") return event.shiftKey ? null : "redo";
  return null;
}
