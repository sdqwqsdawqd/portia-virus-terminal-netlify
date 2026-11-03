import { editorSections, type EditorSection } from "./editor-changes.ts";

// UI E3: one vocabulary for the save status of the content editor and the employee editor.
export type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "partial" | "error" | "conflict";

export function saveStatusText(status: SaveStatus, counts?: { saved: number; total: number }): string {
  switch (status) {
    case "clean": return "";
    case "dirty": return "Есть несохранённые изменения";
    case "saving": return "Сохраняем…";
    case "saved": return "Сохранено";
    // N of M below M is a partial save; without counts it is not claimed as a success (D-12).
    case "partial":
      if (!counts) return "Сохранено частично";
      return counts.saved >= counts.total ? "Сохранено" : `Сохранено ${counts.saved} из ${counts.total}`;
    case "error": return "Не удалось сохранить";
    case "conflict": return "Запись изменили";
  }
}

// D-10: the sections to send again after the server refused some, and the N of M for the status. Order is editorSections order.
export function partialSave(changed: readonly EditorSection[], refused: readonly EditorSection[]): { send: EditorSection[]; saved: number; total: number } {
  const total = editorSections.filter((section) => changed.includes(section));
  const send = total.filter((section) => !refused.includes(section));
  return { send, saved: send.length, total: total.length };
}
