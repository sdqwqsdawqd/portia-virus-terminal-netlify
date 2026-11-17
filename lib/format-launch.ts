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
      // Whole words count (axe label-content-name-mismatch): «выберите текстовое» would not hold the word «текст».
      accessibleName: "Выберите текст: сначала выберите текстовое поле",
      tooltip: "Сначала выберите текстовое поле",
      hint: "Работает со всеми большими текстовыми полями.",
    };
  }
  return {
    visibleLabel: "ОФОРМЛЕНИЕ",
    visibleTitle: title,
    accessibleName: `Оформление ${title}: панель оформления текста`,
    tooltip: `Оформление: ${title}`,
    hint: "Выделите текст или поставьте курсор в слово.",
  };
}

const words = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(Boolean);

/**
 * The Label in Name check axe runs (label-content-name-mismatch): the words of the visible text are a contiguous run of words in the
 * accessible name, case and punctuation aside. A word that merely starts another word does not count.
 */
export function nameContainsVisibleText(accessibleName: string, visibleText: string) {
  const name = words(accessibleName);
  const label = words(visibleText);
  if (label.length === 0) return true;
  for (let start = 0; start + label.length <= name.length; start += 1) {
    if (label.every((word, index) => name[start + index] === word)) return true;
  }
  return false;
}

export function visibleLaunchText(labels: FormatLaunchLabels) {
  return [labels.visibleLabel, labels.visibleTitle].filter(Boolean).join(" ");
}
