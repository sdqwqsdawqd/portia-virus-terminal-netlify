export type KeyInfo = { code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };
export type EditorShortcut = "save" | "undo" | "redo";

export function shortcutOf(event: KeyInfo): EditorShortcut | null {
  void event;
  return null;
}
