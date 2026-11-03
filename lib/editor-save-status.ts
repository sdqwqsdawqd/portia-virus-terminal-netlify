import { editorSections, sectionLabels, sectionOfKey, type EditorSection } from "./editor-changes.ts";
import type { PortiaContent } from "./portia-content.ts";

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

// UI E3: the request got no answer (offline, timeout); the draft stays in the fields.
export const networkSaveError = "Нет связи с сервером. Попробуйте ещё раз.";

// The server answered 409: somebody saved a newer revision first (D-09). Thrown by the desktop save, caught by the editor.
export class SaveConflictError extends Error {
  constructor() {
    super("PORTIA content changed by another editor");
    this.name = "SaveConflictError";
  }
}

export type DraftEdit = { section: EditorSection; path: string; label: string; value: string };

const fieldLabels: Record<string, string> = {
  name: "Название", code: "Код", status: "Статус", title: "Заголовок", text: "Текст", body: "Текст", external: "Внешность", physiology: "Физиология",
  health: "Здоровье", speed: "Скорость", abilities: "Способности", description: "Описание", scientist: "Учёный", lockedLevel: "Уровень доступа",
  content: "Содержимое", caption: "Подпись", label: "Метка", key: "Признак", value: "Значение", url: "Ссылка", cover: "Обложка", photo: "Фото",
  conditions: "Условия", startsAt: "Начало", endsAt: "Конец", type: "Тип", location: "Расположение", kind: "Вид", image: "Изображение", infectedImage: "Изображение заражённого",
  danger: "Опасность", spread: "Распространение", transmission: "Передача", escapeRisk: "Риск побега", mind: "Разум", appearance: "Внешний вид", behavior: "Поведение",
  searchRecommendations: "Рекомендация", assistantAdvice: "Совет", assistantOffendedPhrase: "Фраза обиды", assistantOffendedPhrases: "Фраза обиды",
  assistantIdlePhrases: "Фраза бездействия", assistantActivityPhrases: "Фраза активности", assistantPatienceSeconds: "Терпение, секунд",
};

const skippedKeys = new Set(["id", "richContent", "recycleOrder"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// D-09: what the user changed, as plain values to keep beside the server's version. Items of a list are paired by id (by position when they have none), so a reorder alone is not an edit; deleted items and emptied fields have no value to keep.
export function draftEdits(baseline: PortiaContent, present: PortiaContent): DraftEdit[] {
  const found = new Map<EditorSection, DraftEdit[]>();

  const walk = (before: unknown, after: unknown, section: EditorSection, path: string[], record: string, field: string) => {
    if (typeof after === "string" || typeof after === "number" || typeof after === "boolean") {
      const value = String(after);
      if (value === "" || before === after) return;
      const where = record ? `${sectionLabels[section]}: ${record}` : sectionLabels[section];
      const list = found.get(section) ?? [];
      list.push({ section, path: path.join("."), label: `${where} — ${field}`, value });
      found.set(section, list);
      return;
    }
    if (Array.isArray(after)) {
      const earlier = Array.isArray(before) ? before : [];
      after.forEach((item, index) => {
        const id = isRecord(item) && typeof item.id === "string" ? item.id : null;
        const match = id !== null ? earlier.find((candidate) => isRecord(candidate) && candidate.id === id) : earlier[index];
        walk(match, item, section, [...path, id ?? String(index)], record, `${field} ${index + 1}`);
      });
      return;
    }
    if (isRecord(after)) {
      const earlier = isRecord(before) ? before : {};
      const named = typeof after.name === "string" && after.name ? after.name : typeof after.title === "string" && after.title ? after.title : record;
      for (const key of Object.keys(after)) {
        if (skippedKeys.has(key)) continue;
        walk(earlier[key], after[key], section, [...path, key], named, fieldLabels[key] ?? key);
      }
    }
  };

  const before = baseline as unknown as Record<string, unknown>;
  const after = present as unknown as Record<string, unknown>;
  for (const key of Object.keys(after)) {
    const section = sectionOfKey(key);
    if (!section || skippedKeys.has(key)) continue;
    walk(before[key], after[key], section, [key], "", fieldLabels[key] ?? key);
  }
  return editorSections.flatMap((section) => found.get(section) ?? []);
}
