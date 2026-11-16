// The accessible name of the toggle button of a collapsible editor card (.nested-editor-toggle).
export function cardToggleName(open: boolean, label: string, title?: string): string {
  return `${open ? "Свернуть" : "Развернуть"} раздел «${title || label}»`;
}
