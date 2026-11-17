"use client";

import { useId, useState, useSyncExternalStore } from "react";
import {
  LOCAL_PICTURE_MAX_SIDE,
  MAX_COMPANION_ITEMS,
  MAX_LOCAL_PICTURE_CHARS,
  companionItemsServerSnapshot,
  companionItemsSnapshot,
  companionPictureSource,
  companionPlacement,
  companionSlots,
  saveCompanionItems,
  subscribeCompanionItems,
  type CompanionItem,
  type CompanionTarget,
} from "@/lib/companion-items";

// Owner 2026-11-18: the items of the assistant and of the spider (lib/companion-items.ts). Settings edit them; the assistant draws them over its
// picture; the spider draws them inside its own SVG (components/portia-wallpaper-spider.tsx). Pictures stay on this device: a local file is shrunk
// here and kept in localStorage, a link is drawn straight from its address. Nothing goes to the server.

export function useCompanionItems(): CompanionItem[] {
  return useSyncExternalStore(subscribeCompanionItems, companionItemsSnapshot, companionItemsServerSnapshot);
}

const makeItemId = () => `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** A local picture as a small PNG (transparency kept), longer side at most LOCAL_PICTURE_MAX_SIDE; null when it cannot be read or stays too big. */
async function shrinkLocalPicture(file: File): Promise<string | null> {
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
      if (url.length <= MAX_LOCAL_PICTURE_CHARS && companionPictureSource(url)) { bitmap.close(); return url; }
    }
    bitmap.close();
  } catch { /* an unreadable file is refused below */ }
  return null;
}

/** The items of the assistant, drawn in the box of its picture (percent units). The layer follows every move of the picture (styles in portia.css). */
export function AssistantItems() {
  const items = useCompanionItems().filter((item) => item.target === "assistant");
  if (!items.length) return null;
  return <svg className="assistant-items" viewBox="0 0 100 66.667" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {items.map((item) => {
      const place = companionPlacement(item);
      if (!place) return null;
      const width = place.width;
      const x = place.x;
      const y = (place.y / 100) * 66.667;
      return <image key={item.id} href={item.src} x={x - width / 2} y={y - width / 2} width={width} height={width} preserveAspectRatio="xMidYMid meet"
        transform={`rotate(${item.rotate} ${x} ${y})${item.flip ? ` translate(${2 * x} 0) scale(-1 1)` : ""}`} />;
    })}
  </svg>;
}

/** The items of the spider in one spot of its artwork; called inside the leg group for a paw, inside the body group for the rest. */
export function SpiderItems({ items }: { items: CompanionItem[] }) {
  return <>{items.map((item) => {
    const place = companionPlacement(item);
    if (!place) return null;
    const { x, y, width } = place;
    return <image key={item.id} className="wallpaper-spider-item" href={item.src} x={x - width / 2} y={y - width / 2} width={width} height={width} preserveAspectRatio="xMidYMid meet"
      transform={`rotate(${item.rotate} ${x} ${y})${item.flip ? ` translate(${2 * x} 0) scale(-1 1)` : ""}`} />;
  })}</>;
}

const targetTitles: Record<CompanionTarget, string> = { assistant: "Предметы помощника", spider: "Предметы паука" };

/** The settings group for one target: the list of items and the two ways to add one (a file of this device or a link). */
export function CompanionItemsSettings({ target }: { target: CompanionTarget }) {
  const all = useCompanionItems();
  const items = all.filter((item) => item.target === target);
  const slots = companionSlots[target];
  const [slot, setSlot] = useState(slots[0].id);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileId = useId();
  const full = items.length >= MAX_COMPANION_ITEMS;

  const save = (next: CompanionItem[]) => {
    if (!saveCompanionItems(next)) setMessage("Не сохранилось: мало места на устройстве.");
    else setMessage("");
  };
  const add = (src: string) => save([...all, { id: makeItemId(), target, slot, src, size: 100, rotate: 0, flip: false }]);
  const edit = (id: string, change: Partial<CompanionItem>) => save(all.map((item) => item.id === id ? { ...item, ...change } : item));

  const addFile = async (file: File | undefined) => {
    if (!file || busy || full) return;
    setBusy(true);
    const picture = await shrinkLocalPicture(file);
    setBusy(false);
    if (!picture) { setMessage("Файл не открылся: нужна картинка."); return; }
    add(picture);
  };
  const addLink = () => {
    const src = companionPictureSource(link);
    if (!src) { setMessage("Нужна ссылка https:// на картинку."); return; }
    add(src);
    setLink("");
  };

  return <section className="settings-section companion-settings" aria-label={targetTitles[target]}>
    <h2>{targetTitles[target]}</h2>
    <p className="setting-hint">Хранится только на этом устройстве.</p>
    {items.length > 0 && <ul className="companion-list">
      {items.map((item) => <li key={item.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt="" referrerPolicy="no-referrer" style={{ transform: `rotate(${item.rotate}deg)${item.flip ? " scaleX(-1)" : ""}` }} />
        <label><span>Место</span><select value={item.slot} onChange={(event) => edit(item.id, { slot: event.target.value })}>{slots.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <label><span>Размер {item.size}%</span><input type="range" min="40" max="250" step="5" value={item.size} onChange={(event) => edit(item.id, { size: Number(event.target.value) })} /></label>
        <label><span>Поворот {item.rotate}°</span><input type="range" min="-180" max="180" step="5" value={item.rotate} onChange={(event) => edit(item.id, { rotate: Number(event.target.value) })} /></label>
        <div className="companion-item-actions">
          <button type="button" aria-pressed={item.flip} className={item.flip ? "selected" : ""} onClick={() => edit(item.id, { flip: !item.flip })}>Отразить</button>
          <button type="button" onClick={() => save(all.filter((entry) => entry.id !== item.id))}>Убрать</button>
        </div>
      </li>)}
    </ul>}
    <div className="companion-add">
      <label><span>Куда</span><select value={slot} onChange={(event) => setSlot(event.target.value)}>{slots.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
      <label className="companion-file" htmlFor={fileId} aria-disabled={busy || full || undefined}>
        <input id={fileId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy || full} onChange={(event) => { void addFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        <span>{busy ? "ГОТОВИМ…" : "ФАЙЛ С УСТРОЙСТВА"}</span>
      </label>
      <form className="companion-link" onSubmit={(event) => { event.preventDefault(); addLink(); }}>
        <input value={link} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://… ссылка на PNG" aria-label="Ссылка на картинку" disabled={full} onChange={(event) => setLink(event.target.value)} />
        <button type="submit" disabled={full || !link.trim()}>ДОБАВИТЬ</button>
      </form>
    </div>
    {full && <p className="setting-hint">Не больше {MAX_COMPANION_ITEMS} предметов.</p>}
    {message && <p className="companion-error" role="alert">{message}</p>}
  </section>;
}
