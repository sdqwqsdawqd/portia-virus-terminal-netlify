// The one text-format launch button names itself two ways: the visible label on the button, and the accessible name read aloud.
// WCAG 2.5.3 (Label in Name): the accessible name must contain the visible text, so voice control that says what is on the button works.

export type FormatLaunchLabels = {
  /** What the button shows, strong label first and the field title after it (CSS may clip it on a phone; the DOM text stays). */
  visibleLabel: string;
  visibleTitle: string;
  /** aria-label: contains the whole visible text. */
  accessibleName: string;
  /** Tooltip. */
  tooltip: string;
  /** Visually hidden hint under the button. */
  hint: string;
};

export function formatLaunchLabels(title: string | null): FormatLaunchLabels {
  if (title === null) {
    return {
      visibleLabel: "ВЫБЕРИТЕ ТЕКСТ",
      visibleTitle: "",
      // «выберите текстовое поле» holds the visible «выберите текст».
      accessibleName: "Выберите текстовое поле для оформления",
      tooltip: "Сначала выберите текстовое поле",
      hint: "Одна кнопка форматирования работает со всеми большими текстовыми полями.",
    };
  }
  return {
    visibleLabel: "ОФОРМЛЕНИЕ",
    visibleTitle: title,
    accessibleName: `Оформление ${title}: панель оформления текста`,
    tooltip: `Оформление: ${title}`,
    hint: "Выделите текст в активном поле или поставьте курсор в слово, чтобы оформить его.",
  };
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** The Label in Name check axe runs: the visible text, case and spacing aside, is part of the accessible name. */
export function nameContainsVisibleText(accessibleName: string, visibleText: string) {
  return normalize(accessibleName).includes(normalize(visibleText));
}

export function visibleLaunchText(labels: FormatLaunchLabels) {
  return [labels.visibleLabel, labels.visibleTitle].filter(Boolean).join(" ");
}
