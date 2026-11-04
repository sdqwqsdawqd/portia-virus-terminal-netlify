import { changedSections, editorSections, revertSections, sectionLabels, sectionOfKey, type EditorSection } from "./editor-changes.ts";
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

export type EmployeeRequestAction = "load" | "save" | "add" | "remove";

const employeeActionNoun: Record<EmployeeRequestAction, string> = { load: "загрузку", save: "сохранение", add: "добавление", remove: "удаление" };

// WR-05: the one Russian text for a failed employee-editor request. Never an exception's own message («Failed to fetch», «Unexpected token»).
// transport: the request got no answer. Otherwise: 403 is an expired session, the server's own text wins, else the action and the code.
export function employeeRequestFailure(input: { transport: boolean; status?: number; payloadError?: string; action: EmployeeRequestAction }): string {
  if (input.transport) return networkSaveError;
  if (input.status === 403) return "Сессия редактора истекла. Войдите в редактор снова.";
  const fromServer = input.payloadError?.trim();
  if (fromServer) return fromServer;
  return `Сервер отклонил ${employeeActionNoun[input.action]} (${input.status ?? "—"}).`;
}

// The server answered 409: somebody saved a newer revision first (D-09). Thrown by the desktop save, caught by the editor.
export class SaveConflictError extends Error {
  constructor() {
    super("PORTIA content changed by another editor");
    this.name = "SaveConflictError";
  }
}

// D-10: the server refused only some sections (403 code "section-closed" with the list). Thrown by the desktop save, caught by the editor, which sends the rest again.
export class SectionClosedError extends Error {
  refusedSections: EditorSection[];
  constructor(refusedSections: EditorSection[], message: string) {
    super(message);
    this.name = "SectionClosedError";
    this.refusedSections = refusedSections;
  }
}

// The sections of a PUT /api/content refusal body, in editorSections order; null when the body is not a section-closed refusal.
export function parseRefusedSections(body: unknown): EditorSection[] | null {
  if (typeof body !== "object" || body === null) return null;
  const { code, sections } = body as { code?: unknown; sections?: unknown };
  if (code !== "section-closed" || !Array.isArray(sections)) return null;
  if (!sections.every((entry) => typeof entry === "string" && (editorSections as string[]).includes(entry))) return null;
  const found = editorSections.filter((section) => sections.includes(section));
  return found.length ? found : null;
}

export type DraftEdit = { section: EditorSection; path: string; label: string; value: string };

const fieldLabels: Record<string, string> = {
  name: "Название", code: "Код", status: "Статус", title: "Заголовок", text: "Текст", body: "Текст", external: "Внешность", physiology: "Физиология",
  health: "Здоровье", speed: "Скорость", abilities: "Способности", description: "Описание", scientist: "Учёный", lockedLevel: "Уровень доступа",
  content: "Содержимое", caption: "Подпись", label: "Метка", key: "Признак", value: "Значение", url: "Ссылка", cover: "Обложка", photo: "Фото",
  conditions: "Условия", startsAt: "Начало", endsAt: "Конец", type: "Тип", location: "Расположение", kind: "Вид", image: "Изображение", infectedImage: "Изображение заражённого",
  danger: "Опасность", spread: "Распространение", transmission: "Передача", escapeRisk: "Риск побега", mind: "Разум", appearance: "Внешний вид", behavior: "Поведение",
  searchRecommendations: "Рекомендация", items: "Рекомендация", sectionId: "Раздел сводки", broadcastSections: "Раздел сводки",
  searchRecommendationSections: "Раздел рекомендаций", subsections: "Подраздел", assistantAdvice: "Совет", assistantOffendedPhrase: "Фраза обиды", assistantOffendedPhrases: "Фраза обиды",
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

export type RebaseDecision =
  | { kind: "rebase"; baseline: PortiaContent; present: PortiaContent }
  | { kind: "conflict" }
  | { kind: "none" };

// D-11: a background update arrived while the draft has unsaved edits.
// none: the update changed no section. rebase: it changed only sections the user did not touch and that are not protected
// (the section of the active tab, where a field may be under the cursor), so it is taken into the draft and the stored copy.
// conflict: it touches a section the user edited or a protected one; the draft stays as typed and the save resolves it (409, D-09).
// No input is mutated.
export function rebaseDecision(baseline: PortiaContent, present: PortiaContent, incoming: PortiaContent, protectedSections: readonly EditorSection[]): RebaseDecision {
  const theirs = changedSections(baseline, incoming);
  if (!theirs.length) return { kind: "none" };
  const mine = changedSections(baseline, present);
  if (theirs.some((section) => mine.includes(section) || protectedSections.includes(section))) return { kind: "conflict" };
  return { kind: "rebase", baseline: incoming, present: revertSections(incoming, present, theirs) };
}
