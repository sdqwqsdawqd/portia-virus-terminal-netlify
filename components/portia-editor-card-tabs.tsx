"use client";

import { useEffect, useId, useReducer, useRef, type ReactNode } from "react";
import { resolveCardTab, type CardTabGroup } from "@/lib/card-tab-selection";
import { OrderDragHandle } from "@/components/portia-editor-dossier";

// OWN-10 (owner 2026-11-20): the cards of a section, and other long lists of cards, are a strip of tabs from left to right, like the sections of «Справочник»;
// under the strip stands only the selected card. The texts live here, not in components/portia-editor.tsx (D-58).
export const cardTabsCopy = {
  cards: "Карточки раздела",
  subsections: "Подразделы",
  mutations: "Мутации",
  logs: "Записи учёных",
  untitled: "Без названия",
  item: "карточка",
  addCard: "+ ДОБАВИТЬ КАРТОЧКУ",
} as const;

/**
 * Which card of each group is selected. A group is any list of tabs (`sectionId`, `${virusId}:mutations`); the rule is lib/card-tab-selection.ts.
 * `active` is read during rendering and is safe to call many times with the same ids: a repeat changes nothing.
 */
export function useCardTabSelection() {
  const groups = useRef(new Map<string, CardTabGroup>());
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  return {
    active(groupId: string, ids: readonly string[]): string {
      const found = resolveCardTab(groups.current.get(groupId), ids);
      groups.current.set(groupId, found.group);
      return found.active;
    },
    select(groupId: string, id: string) {
      groups.current.set(groupId, { selected: id, known: groups.current.get(groupId)?.known ?? [] });
      rerender();
    },
  };
}

export type CardTabItem = { id: string; title: string };

// The strip repeats the section tabs of the editor (SectionTabs): the selected tab is `aria-current`, it is scrolled into view, and with `onMove` a tab is held to drag
// (the hold of 26.1-08) and has the order button for the keyboard. Without `onMove` the tabs only switch (mutations: their texts are bound to the number).
// 26.1-20 (owner 2026-11-21): with `add` the strip ends with the button that adds a card and the note of its limit; they stand after the scrolling tabs, so many tabs never push them out of sight.
export function CardTabs({ label, items, activeId, onSelect, onMove, add }: {
  label: string;
  items: readonly CardTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onMove?: (from: number, to: number) => void;
  add?: { onAdd: () => void; disabled: boolean; note?: ReactNode };
}) {
  const navRef = useRef<HTMLElement>(null);
  const noteId = useId();
  // The selected tab stays in view of the strip. Only the strip scrolls sideways: the page never jumps (so no scrollIntoView, which moves the page too); instant unless the house motion switch is on.
  useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement;
    if (!nav || !tab) return;
    const strip = nav.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    const behavior = document.documentElement.dataset.motion === "full" ? "smooth" : "auto";
    if (box.left < strip.left) nav.scrollBy({ left: box.left - strip.left - 8, behavior });
    else if (box.right > strip.right) nav.scrollBy({ left: box.right - strip.right + 8, behavior });
  }, [activeId]);
  if (items.length === 0 && !add) return null;
  return <div className="editor-card-tabs">
    {items.length > 0 && <nav aria-label={label} ref={navRef}>
      {items.map((item, index) => <span key={item.id} className="editor-card-tab" data-sort-index={onMove ? index : undefined}>
        {onMove && <OrderDragHandle index={index} label={item.title || cardTabsCopy.item} onMove={onMove} />}
        <button type="button" aria-current={item.id === activeId ? "true" : undefined} onClick={() => onSelect(item.id)}>{item.title || cardTabsCopy.untitled}</button>
      </span>)}
    </nav>}
    {add && <div className="editor-card-tab-add-bar">
      <button type="button" className="editor-card-tab-add" disabled={add.disabled} aria-describedby={add.note ? noteId : undefined} onClick={add.onAdd}>{cardTabsCopy.addCard}</button>
      {add.note && <span className="editor-card-tab-add-note" id={noteId}>{add.note}</span>}
    </div>}
  </div>;
}
