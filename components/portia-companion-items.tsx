"use client";

import { useSyncExternalStore } from "react";
import {
  LOCAL_PICTURE_MAX_SIDE,
  MAX_LOCAL_PICTURE_CHARS,
  companionFigures,
  companionItemsServerSnapshot,
  companionItemsSnapshot,
  companionPictureSource,
  subscribeCompanionItems,
  type CompanionItem,
} from "@/lib/companion-items";

// Owner 2026-11-18: the items of the assistant and of the spider (lib/companion-items.ts). The editor (components/portia-companion-editor.tsx) places them;
// the assistant draws them next to her picture; the spider draws them inside its own SVG (components/portia-wallpaper-spider.tsx). Pictures stay on
// this device: a local file is shrunk here and kept in localStorage, a link is drawn straight from its address. Nothing goes to the server.

export function useCompanionItems(): CompanionItem[] {
  return useSyncExternalStore(subscribeCompanionItems, companionItemsSnapshot, companionItemsServerSnapshot);
}

/** A local picture as a small PNG (transparency kept), longer side at most LOCAL_PICTURE_MAX_SIDE, with the size of the canvas; null when it cannot be read or stays too big. */
export async function shrinkLocalPicture(file: File): Promise<{ src: string; width: number; height: number } | null> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    for (const side of [LOCAL_PICTURE_MAX_SIDE, 220, 140]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
      if (url.length <= MAX_LOCAL_PICTURE_CHARS && companionPictureSource(url)) { bitmap.close(); return { src: url, width: canvas.width, height: canvas.height }; }
    }
    bitmap.close();
  } catch { /* an unreadable file is refused by the caller */ }
  return null;
}

/** One item as an svg image: the box x, y (centre), width, height, stretched to fill it, turned about its centre and, when flipped, mirrored about it. */
export function CompanionItemImage({ item, className }: { item: CompanionItem; className?: string }) {
  const { x, y, width, height } = item;
  return <image className={className} href={item.src} x={x - width / 2} y={y - height / 2} width={width} height={height} preserveAspectRatio="none"
    transform={`rotate(${item.rotate} ${x} ${y})${item.flip ? ` translate(${2 * x} 0) scale(-1 1)` : ""}`} />;
}

/** The items of the assistant, drawn in the box of her picture (the figure's own units). The layer follows every move of the picture (styles in portia.css). */
export function AssistantItems() {
  const items = useCompanionItems().filter((item) => item.target === "assistant");
  if (!items.length) return null;
  const { width, height } = companionFigures.assistant;
  return <svg className="assistant-items" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {items.map((item) => <CompanionItemImage key={item.id} item={item} />)}
  </svg>;
}

/** The items of the spider of one attachment; called inside the leg group for a paw, inside the body group for the rest. */
export function SpiderItems({ items }: { items: CompanionItem[] }) {
  return <>{items.map((item) => <CompanionItemImage key={item.id} item={item} className="wallpaper-spider-item" />)}</>;
}
