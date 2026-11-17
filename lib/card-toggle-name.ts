// The accessible name of the toggle button of a collapsible editor card (.nested-editor-toggle).
// UI-10, WCAG 2.5.3: имя содержит видимый текст в том же порядке.
// The visible text is «{label} {title}» (the chevron is aria-hidden), so the name quotes both; a card without a title says «Без названия».
const EXPAND = "Развернуть";
const COLLAPSE = "Свернуть";
const SECTION = "раздел";
const UNTITLED = "Без названия";

export function cardToggleName(open: boolean, label: string, title?: string): string {
  const shownTitle = title?.trim() || UNTITLED;
  return `${open ? COLLAPSE : EXPAND} ${SECTION} «${label.trim()} ${shownTitle}»`;
}
