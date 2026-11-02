// Pure state contract of the desktop apps (D-05..D-08): which view an app shows, why a load failed, and what the stale banner says. No server imports.
export type AppFailure = "offline" | "unavailable" | "unexpected";
export type AppViewState = "loading" | "empty" | "populated" | "stale" | "fatal" | "denied";

// One failure class per cause, so one error code always reads as one reason.
export const failureCopy: Record<AppFailure, { heading: string; body: string }> = {
  offline: { heading: "Нет связи с сервером", body: "Проверьте подключение и повторите." },
  unavailable: { heading: "Сервис временно недоступен", body: "Данные не потеряны. Повторите через минуту." },
  unexpected: { heading: "Не удалось загрузить данные", body: "Повторите. Если не помогает, сообщите редактору." },
};

// A timeout is an outage, a reject without any answer is no network, a 4xx is an answer the page did not expect.
export function failureFromResponse(status: number | null, timedOut: boolean): AppFailure {
  if (timedOut) return "unavailable";
  if (status === null) return "offline";
  return status >= 500 ? "unavailable" : "unexpected";
}

// A cross-origin iframe never reports an error, so «Таблица» and «Устав» give it this long to fire onLoad before the fatal panel (STAB-APP-06).
export const iframeFailureCopy = { heading: "Не удалось загрузить", body: "Повторите или откройте во внешней вкладке." };
export const iframeLoadTimeoutMs = 15_000;

// Empty states (D-08): a successful load with 0 records. No button, calm tone.
export const emptyCopy: Record<"archive" | "employees" | "news" | "quests" | "info" | "guide" | "trash", { heading: string; body: string }> = {
  archive: { heading: "В базе пока нет записей", body: "Новые записи появятся здесь после публикации." },
  employees: { heading: "Список сотрудников пуст", body: "Сотрудники появятся здесь, когда таблица будет заполнена." },
  news: { heading: "Новостей пока нет", body: "Опубликованные материалы появятся здесь." },
  quests: { heading: "Заданий пока нет", body: "Опубликованные материалы появятся здесь." },
  info: { heading: "В «Информации» пока нет статей", body: "Разделы появятся здесь после публикации." },
  guide: { heading: "В «Справочнике» пока нет карточек", body: "Карточки появятся здесь после публикации." },
  trash: { heading: "Корзина пуста", body: "Удалённые записи появятся здесь." },
};

const clockFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Only the fixed phrase and a time: no status code or error message reaches the page (T-19-02). A cache date that does not parse (T-19-01) drops the time instead of printing "Invalid Date".
export function staleBannerText(lastGoodAt: string, now: Date): string {
  const at = new Date(lastGoodAt);
  if (!lastGoodAt || Number.isNaN(at.getTime())) return "Не удалось обновить — показаны сохранённые данные";
  const when = sameDay(at, now) ? clockFormat.format(at) : `${dayFormat.format(at)}, ${clockFormat.format(at)}`;
  return `Не удалось обновить — показаны данные на ${when}`;
}

// denied > loading > fatal > stale > empty > populated. `hasData` means data that really came from the cache or the server: the built-in defaults never count.
export function appViewState(input: { denied: boolean; ready: boolean; hasData: boolean; count: number; failure: AppFailure | null }): AppViewState {
  if (input.denied) return "denied";
  if (!input.ready || (!input.hasData && input.failure === null)) return "loading";
  if (input.failure !== null) return input.hasData && input.count > 0 ? "stale" : "fatal";
  return input.count > 0 ? "populated" : "empty";
}

export type ContentSync = { lastGoodAt: string | null; failure: AppFailure | null; retrying: boolean };

// The same failure again keeps the very same object, so a repeated bad poll neither redraws the banner nor moves the time. While already failing, only the reason may change.
// lastGoodAt "" means data is on screen (device cache) but its time is unknown; a failure never discards a time the state already knows.
export function contentSyncFailed(sync: ContentSync, failure: AppFailure, lastGoodAt: string | null): ContentSync {
  if (sync.failure === failure) return sync;
  return { ...sync, failure, lastGoodAt: sync.failure === null ? lastGoodAt ?? sync.lastGoodAt : sync.lastGoodAt };
}

// A quiet success (nothing failing, a time already known) returns the same object, so every poll does not redraw the desktop.
export function contentSyncSucceeded(sync: ContentSync, at: string): ContentSync {
  if (sync.failure === null && sync.lastGoodAt !== null) return sync;
  return { ...sync, failure: null, lastGoodAt: at };
}
