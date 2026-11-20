"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LiveApp, LiveCardsTarget, LiveContainer, LiveDateTarget, LiveFlagTarget, LiveImageTarget, LiveList, LiveRemovable, LiveTarget } from "@/lib/live-edit";
import type { ImageFraming } from "@/lib/image-framing";
import type { RichTextDocument } from "@/lib/portia-content";

// LIVE-04 (26.1-10): the one door between the visitor's components and the tools of the editor's live mode.
// A component of the visitor's app asks useLiveEdit(app); without a provider it gets null and draws exactly its old markup.
// Only the editor seam (components/portia-editor-live.tsx) provides the context, so none of the tools below is in the visitor's bundle:
// this file holds types and a hook, nothing that edits.

/** What `order` hands a row: the attribute that makes it a row of the order lists, and the keyboard button that goes inside the row. */
export type LiveOrder = { rowProps: { "data-sort-index": number }; handle: ReactNode };

/** The drawing functions of the live mode. Each returns what the visitor's component puts in the place of its plain markup; texts and labels are the seam's, never the component's. */
export type LiveEditApi = {
  app: LiveApp;
  /** A plain text in place; `className` is the visitor's own class for the place, so the look stays the visitor's. */
  text: (target: LiveTarget, value: string, options?: { className?: string; multiline?: boolean }) => ReactNode;
  /** A formatted text: the visitor's drawing at rest, the editor's field with the strip of its GIFs while edited. */
  rich: (target: LiveTarget, props: { text: string; document?: RichTextDocument; className?: string }) => ReactNode;
  /** A picture place: `children` is the visitor's drawing of the picture (null when there is none), the seam adds the way to change it. */
  image: (target: LiveImageTarget, props: { value: string; framing?: ImageFraming; children?: ReactNode }) => ReactNode;
  /** The YouTube link of a video block. */
  video: (target: LiveTarget, videoId: string) => ReactNode;
  /** The choice of cards of a block «Карточки». */
  cards: (target: LiveCardsTarget, cardIds: string[]) => ReactNode;
  /** The compact bar «Добавить: …» of a place. */
  addBar: (container: LiveContainer) => ReactNode;
  /** The order of a list: spread `rowProps` on the row and put `handle` inside it. `title` is the row's own name (may be empty). */
  order: (list: LiveList, index: number, title: string) => LiveOrder;
  /** A day of a quest (its start or end); a day that would put the end before the start is not written and says so beside the field. */
  date: (target: LiveDateTarget, value: string) => ReactNode;
  /** A switch of an entry of «Сводки»: shown to visitors, important. */
  flag: (target: LiveFlagTarget, checked: boolean) => ReactNode;
  /** The small remove button with its question. */
  remove: (item: LiveRemovable, title: string) => ReactNode;
};

export const LiveEditContext = createContext<LiveEditApi | null>(null);

/** The live tools of `app`, or null: outside the editor's live mode, or inside the live mode of another app. */
export function useLiveEdit(app: LiveApp): LiveEditApi | null {
  const api = useContext(LiveEditContext);
  return api && api.app === app ? api : null;
}
