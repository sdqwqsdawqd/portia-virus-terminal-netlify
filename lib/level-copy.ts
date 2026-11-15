// Phase 24: every Russian string of the access-level surfaces (UI-SPEC Copywriting Contract), in one place. Long strings
// live here and not in components: lib/phase20-hints-inventory.test.ts keeps long Cyrillic text out of components/*.tsx.
// The SEC-07 document texts are deliberately not here (they belong to the document windows, plan 24-05).
import type { LeveledAppId } from "./portia-content.ts";

const redactedWord = "ЗАСЕКРЕЧЕНО";
const redactedNeed = (level: number) => `нужен допуск ${level}`;

export const levelCopy = {
  redactedWord,
  redactedNeed,
  // U+00B7 with a space on each side.
  redacted: (level: number) => `${redactedWord} · ${redactedNeed(level)}`,
  archiveNoOpen: { heading: "Доступных записей нет", body: "Все записи базы требуют более высокого допуска." },
  sectionsNoOpen: { heading: "Доступных разделов нет", body: "Все разделы требуют более высокого допуска." },
  currentLevelPlaque: "ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА",
  archiveMeta: (level: number | null) => (level === null ? "ДОПУСК" : `ДОПУСК ${level}`),
  bootCheck: (level: number | null) => (level === null ? "ПРОВЕРКА ДОПУСКА… OK" : `ПРОВЕРКА ДОПУСКА… УРОВЕНЬ ${level}`),
  logLevel: (level: number) => `УРОВЕНЬ ${level}`,
  archivePath: (level: number) => `PORTIA / АРХИВ / УРОВЕНЬ ${level}`,
  docDenied: (current: number, required: number) => `Текущий уровень: ${current}. Для чтения этого документа требуется уровень ${required}.`,
  pickerLegend: "Нужен допуск",
  pickerOption: (level: number) => `Допуск ${level}`,
  parentHint: (level: number) => `Не ниже раздела: ${level}`,
  parentTitle: (level: number) => `не ниже раздела: ${level}`,
  raisedSubsections: (level: number, count: number) => `Уровень подразделов поднят до ${level}: изменено ${count}.`,
  raisedCards: (level: number, count: number) => `Уровень карточек поднят до ${level}: изменено ${count}.`,
  savedRaised: (count: number) => `Сохранено. Поднято уровней: ${count}.`,
  logsEmptyEditor: "Записей учёных нет. Карточку можно сохранить без них.",
  editorIncomplete: {
    heading: "Содержимое загружено не полностью.",
    body: "Сохранение отключено, чтобы не стереть скрытые записи. Обновите страницу.",
  },
  putRefused: "Сохранение отклонено: в данных есть закрытые записи. Обновите страницу и повторите.",
  appsGroup: "Приложения",
  appLabels: { charter: "Устав" } satisfies Record<LeveledAppId, string>,
} as const;
