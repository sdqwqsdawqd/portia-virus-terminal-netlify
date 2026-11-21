"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  MAX_COMPANION_ITEMS,
  companionAttachLabels,
  companionFigures,
  companionPictureSource,
  moveCompanionItem,
  newCompanionItem,
  resizeCompanionItem,
  saveCompanionItems,
  scaleCompanionItem,
  type CompanionAttach,
  type CompanionHandle,
  type CompanionItem,
  type CompanionTarget,
} from "@/lib/companion-items";
import { CompanionItemImage, shrinkLocalPicture, useCompanionItems } from "@/components/portia-companion-items";
import { SpiderFigure } from "@/components/portia-wallpaper-spider";

// Owner 2026-11-18 (round 2): the items of the assistant and of the spider are placed in a mini-editor opened from the settings: the figure on a stage,
// a picture dragged onto it and stretched by handles (width and height apart), turned, mirrored, and for the spider hung on a paw or the body.
// The editor works on a draft; «ГОТОВО» saves it on this device, «ОТМЕНА» and Esc throw it away. Nothing is uploaded and no request is made:
// a link is only measured by loading it into an image element.

const targetTitles: Record<CompanionTarget, string> = { assistant: "Предметы помощника", spider: "Предметы паука" };
const targetButtons: Record<CompanionTarget, string> = { assistant: "ПОМОЩНИК", spider: "ПАУК" };
const handles: readonly CompanionHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_PX = 10;

/** The row of the settings group «Предметы» (the desktop draws the heading with SettingsCategory, owner 2026-11-21 item 28): a button per target; each opens the editor of that target. */
export function CompanionItemsSettings() {
  const items = useCompanionItems();
  const [open, setOpen] = useState<CompanionTarget | null>(null);
  const openers = useRef<Partial<Record<CompanionTarget, HTMLButtonElement | null>>>({});
  const close = () => {
    const target = open;
    setOpen(null);
    // The dialog is gone from the page: the opener takes the focus back.
    if (target) requestAnimationFrame(() => openers.current[target]?.focus());
  };
  return <>
    {(Object.keys(targetButtons) as CompanionTarget[]).map((target) => <button key={target} type="button" ref={(node) => { openers.current[target] = node; }} onClick={() => setOpen(target)}>
      <span>{targetButtons[target]} · {items.filter((item) => item.target === target).length}</span>
    </button>)}
    <p className="setting-hint">Только на этом устройстве.</p>
    {open && <CompanionItemsEditor target={open} onClose={close} />}
  </>;
}

/** Tab and Shift+Tab go round the stops of the dialog: past the last one the focus returns to the first, and the other way round. */
function keepFocusInside(event: React.KeyboardEvent<HTMLDialogElement>) {
  const dialog = event.currentTarget;
  const stops = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'));
  const first = stops[0], last = stops[stops.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const inside = !!active && dialog.contains(active);
  if (event.shiftKey ? !inside || active === first : !inside || active === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

/** The proportions of a picture behind a link, read by loading it into an image element (never a request of our own); undefined when it does not load. */
const probeAspect = (src: string) => new Promise<number | undefined>((resolve) => {
  const image = new Image();
  image.referrerPolicy = "no-referrer";
  image.onload = () => resolve(image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined);
  image.onerror = () => resolve(undefined);
  image.src = src;
});

type Gesture = { pointerId: number; stop: () => void };

function CompanionItemsEditor({ target, onClose }: { target: CompanionTarget; onClose: () => void }) {
  const stored = useCompanionItems();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const titleId = useId();
  const fileId = useId();
  const figure = companionFigures[target];
  // The draft holds every item of the device; only this target's are shown and changed.
  const [draft, setDraft] = useState<CompanionItem[]>(stored);
  const mine = draft.filter((item) => item.target === target);
  const [selectedId, setSelectedId] = useState<string | null>(mine[0]?.id ?? null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Figure units per screen pixel, so the handles keep their size on screen at any width of the stage.
  const [unit, setUnit] = useState(figure.width / 600);
  const selected = mine.find((item) => item.id === selectedId) ?? null;
  const full = mine.length >= MAX_COMPANION_ITEMS;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    boxRef.current?.focus();
  }, []);
  useEffect(() => () => gesture.current?.stop(), []);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const read = () => {
      const scale = svg.getScreenCTM()?.a;
      if (scale && scale > 0) setUnit(1 / scale);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const update = (id: string, change: (item: CompanionItem) => CompanionItem) => setDraft((list) => list.map((item) => (item.id === id ? change(item) : item)));
  const toFigure = (clientX: number, clientY: number) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  // One drag at a time. The item is recomputed from its start state with the total delta, so the pointer never drifts away from the grip.
  const startDrag = (event: React.PointerEvent, item: CompanionItem, apply: (start: CompanionItem, dx: number, dy: number) => CompanionItem) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const origin = toFigure(event.clientX, event.clientY);
    if (!origin) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current?.stop();
    boxRef.current?.focus();
    const pointerId = event.pointerId;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const point = toFigure(moveEvent.clientX, moveEvent.clientY);
      if (point) update(item.id, () => apply(item, point.x - origin.x, point.y - origin.y));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      gesture.current = null;
    };
    const end = (endEvent: PointerEvent) => { if (endEvent.pointerId === pointerId) stop(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    gesture.current = { pointerId, stop };
  };

  const onStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      remove(selected.id);
      return;
    }
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[] | undefined>)[event.key];
    if (!direction) return;
    // The arrows belong to the item here, not to the dialog or the desktop behind it.
    event.preventDefault();
    event.stopPropagation();
    const step = figure.width * (event.shiftKey ? 0.05 : 0.01);
    update(selected.id, (item) => (event.altKey ? scaleCompanionItem(item, direction[0] * step, direction[1] * step) : moveCompanionItem(item, direction[0] * step, direction[1] * step)));
  };

  const add = (src: string, aspect?: number) => {
    const next = newCompanionItem(target, src, aspect);
    setDraft((list) => [...list, next]);
    setSelectedId(next.id);
    setMessage("");
  };
  const remove = (id: string) => {
    setDraft((list) => list.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? mine.find((item) => item.id !== id)?.id ?? null : current));
  };
  const addFile = async (file: File | undefined) => {
    if (!file || busy || full) return;
    setBusy(true);
    const picture = await shrinkLocalPicture(file);
    setBusy(false);
    if (!picture) { setMessage("Файл не открылся: нужна картинка."); return; }
    add(picture.src, picture.width / picture.height);
  };
  const addLink = async () => {
    const src = companionPictureSource(link);
    if (!src) { setMessage("Нужна ссылка https:// на картинку."); return; }
    if (busy || full) return;
    setBusy(true);
    const aspect = await probeAspect(src);
    setBusy(false);
    add(src, aspect);
    setLink("");
  };
  const done = () => {
    if (!saveCompanionItems(draft)) { setMessage("Не сохранилось: мало места на устройстве."); return; }
    onClose();
  };

  const pxSize = HANDLE_PX * unit;
  const handleAt = (item: CompanionItem, handle: CompanionHandle) => ({
    x: (handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0) * (item.width / 2),
    y: (handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0) * (item.height / 2),
  });
  const turned = (item: CompanionItem) => `rotate(${item.rotate} ${item.x} ${item.y})`;

  return <dialog
    ref={dialogRef}
    className="portia-dialog companion-editor-dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    // Esc (and the back gesture of a phone) is «ОТМЕНА»: handled here, so that the shortcuts of the desktop behind the dialog do not hear it.
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      else if (event.key === "Tab") keepFocusInside(event);
    }}
  >
    <div>
      <h2 id={titleId}>{targetTitles[target]}</h2>
      <div className="companion-editor-body">
        <div ref={boxRef} className="companion-stage-box" tabIndex={0} role="group" aria-label="Поле предметов" onKeyDown={onStageKeyDown}>
          <svg ref={svgRef} className="companion-stage" viewBox={`0 0 ${figure.width} ${figure.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"
            onPointerDown={() => { setSelectedId(null); boxRef.current?.focus(); }}>
            {target === "assistant"
              ? <>
                <image className="companion-stage-figure is-assistant" href={figure.picture} x={0} y={0} width={figure.width} height={figure.height} preserveAspectRatio="none" />
                {mine.map((item) => <CompanionItemImage key={item.id} item={item} />)}
              </>
              : <SpiderFigure items={mine} />}
            {mine.map((item) => <rect key={item.id} className="companion-hit" x={item.x - item.width / 2} y={item.y - item.height / 2} width={item.width} height={item.height} transform={turned(item)}
              onPointerDown={(event) => { setSelectedId(item.id); startDrag(event, item, (start, dx, dy) => moveCompanionItem(start, dx, dy)); }} />)}
            {selected && <g transform={turned(selected)}>
              <rect className="companion-outline" x={selected.x - selected.width / 2} y={selected.y - selected.height / 2} width={selected.width} height={selected.height} />
              {handles.map((handle) => {
                const spot = handleAt(selected, handle);
                return <rect key={handle} className={`companion-handle is-${handle}`} x={selected.x + spot.x - pxSize / 2} y={selected.y + spot.y - pxSize / 2} width={pxSize} height={pxSize}
                  onPointerDown={(event) => startDrag(event, selected, (start, dx, dy) => resizeCompanionItem(start, handle, dx, dy))} />;
              })}
            </g>}
          </svg>
        </div>
        <div className="companion-tools">
          <p className="setting-hint">Стрелки — сдвиг, Alt+стрелки — размер</p>
          <label className="companion-file" htmlFor={fileId} aria-disabled={busy || full || undefined}>
            <input id={fileId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy || full} onChange={(event) => { void addFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <span>{busy ? "ГОТОВИМ…" : "ФАЙЛ С УСТРОЙСТВА"}</span>
          </label>
          <form className="companion-link" onSubmit={(event) => { event.preventDefault(); void addLink(); }}>
            <input value={link} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://… ссылка на PNG" aria-label="Ссылка на картинку" disabled={full} onChange={(event) => setLink(event.target.value)} />
            <button type="submit" disabled={full || busy || !link.trim()}>ДОБАВИТЬ</button>
          </form>
          {full && <p className="setting-hint">Не больше {MAX_COMPANION_ITEMS} предметов.</p>}
          {mine.length > 0 && <ul className="companion-strip" aria-label="Предметы">
            {mine.map((item, index) => <li key={item.id}>
              <button type="button" aria-pressed={item.id === selectedId} aria-label={`Предмет ${index + 1}`} className={item.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt="" referrerPolicy="no-referrer" draggable={false} />
              </button>
            </li>)}
          </ul>}
          {selected && <div className="companion-selected">
            <div className="companion-item-actions">
              <button type="button" aria-pressed={selected.flip} className={selected.flip ? "selected" : ""} onClick={() => update(selected.id, (item) => ({ ...item, flip: !item.flip }))}>Отразить</button>
              <button type="button" onClick={() => remove(selected.id)}>Убрать</button>
            </div>
            <label><span>Поворот {selected.rotate}°</span><input type="range" min="-180" max="180" step="5" value={selected.rotate} onChange={(event) => update(selected.id, (item) => ({ ...item, rotate: Number(event.target.value) }))} /></label>
            {target === "spider" && <div className="companion-attach" role="group" aria-label="Крепление">
              <span>Крепление</span>
              <div>
                {(Object.keys(companionAttachLabels) as CompanionAttach[]).map((attach) => <button key={attach} type="button" aria-pressed={selected.attach === attach} className={selected.attach === attach ? "selected" : ""}
                  onClick={() => update(selected.id, (item) => ({ ...item, attach }))}>{companionAttachLabels[attach]}</button>)}
              </div>
            </div>}
          </div>}
          {message && <p className="companion-error" role="alert">{message}</p>}
        </div>
      </div>
      <div className="portia-dialog-actions">
        <button type="button" className="secondary-control" onClick={onClose}>ОТМЕНА</button>
        <button type="button" className="primary-control" onClick={done}>ГОТОВО</button>
      </div>
    </div>
  </dialog>;
}
