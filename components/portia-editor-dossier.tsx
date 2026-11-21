"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { dossierTabs, type DossierTab } from "@/lib/editor-changes";
import { makeId } from "@/lib/editor-items";
import { classificationOptions, scientistLogPlainText, type Virus } from "@/lib/portia-content";
import { LevelPicker } from "@/components/portia-level-picker";
import { levelCopy } from "@/lib/level-copy";
import { ImageFramingEditor, type ImageFramingBox } from "@/components/portia-image-framing";
import type { ImageFraming } from "@/lib/image-framing";
import { isLocalMediaPath } from "@/lib/media-url";
import { MAX_SCIENTIST_LOGS } from "@/lib/content-limits";
import { passesTarget, type Box } from "@/lib/sort-order";
import { HOLD_MS, hasPlaceToGo, holdStep, holdTargetAllowed, idleHold, type HoldState, type HoldTarget } from "@/lib/hold-gesture";
import { classificationIconFor, PortiaIcon } from "@/components/portia-icons";
import { CardTabs, cardTabsCopy, useCardTabSelection } from "@/components/portia-editor-card-tabs";
import { TRANSMISSION_CHOICES, formatTransmissionRoutes, parseTransmissionRoutes, toggleTransmissionRoute, transmissionDescription } from "@/lib/transmission-routes";
import { ROUTE_PANEL_WIDTH, routeAnchorVisible, routePanelPlacement, type RoutePanelPlace } from "@/lib/route-dropdown-position";

type ImagePlacement = "dossier" | "mutation" | "recycle" | "guide" | "employee";

function mediaUrlFromText(value: string) {
  const trimmed = value.trim();
  const markdown = trimmed.match(/^!\[[^\]]*\]\((https:\/\/[^\s)]+)\)$/i);
  const plain = trimmed.match(/https:\/\/[^\s<>"']+/i);
  const extracted = (markdown?.[1] ?? plain?.[0] ?? (isLocalMediaPath(trimmed) ? trimmed : "")).replace(/[),.;]+$/, "");
  if (!extracted) return trimmed;

  try {
    const url = new URL(extracted, window.location.origin);
    if ((url.hostname === "giphy.com" || url.hostname === "www.giphy.com") && url.pathname.startsWith("/gifs/")) {
      const id = url.pathname.split("/").filter(Boolean).at(-1)?.split("-").at(-1);
      if (id && /^[a-z0-9]+$/i.test(id)) return `https://media.giphy.com/media/${id}/giphy.gif`;
    }
  } catch {}

  return extracted;
}

// A card moved to another section remounts its handle, and the new handle takes the drag over so one drag stays one gesture and one undo step.
let dragHandoff: { itemId: string; dragId: string; x: number; y: number } | null = null;

// After a lifted element is let go the browser still fires the click of the press: it is swallowed once, so a held tab or card head does not also open or fold.
function swallowNextClick() {
  const swallow = (event: Event) => { event.stopPropagation(); event.preventDefault(); done(); };
  const timer = window.setTimeout(() => done(), 100);
  function done() {
    window.clearTimeout(timer);
    window.removeEventListener("click", swallow, { capture: true });
  }
  window.addEventListener("click", swallow, { capture: true });
}

// What was pressed, as the hold model wants to know it: a field, a link, text being edited, an action button or a nested row never starts a hold.
function holdTargetOf(target: EventTarget | null, row: HTMLElement): HoldTarget {
  const element = target instanceof Element ? target : null;
  if (!element) return { tag: "", editable: false, insideActions: false, nestedRow: false };
  const nested = element.closest("[data-sort-index]");
  return {
    tag: element.closest("input, textarea, select, a")?.tagName ?? element.tagName,
    editable: element instanceof HTMLElement && element.isContentEditable,
    insideActions: element.closest(".nested-editor-actions, .info-table-row > button, .live-tools") !== null,
    nestedRow: nested !== null && nested !== row,
  };
}

// owner 2026-11-20 (OWN-09): the row itself is held to drag; the button is the keyboard and screen reader way.
// The button is invisible until the keyboard focuses it. The press is heard on the zone of the row (a card's head, otherwise the whole row);
// a mouse or a pen lifts the row as soon as it drifts past the threshold (26.1-15: pressing and dragging at once), a finger after HOLD_MS without a drift,
// and a still mouse hold of HOLD_MS lifts too; the lifted row (data-lifted) follows the pointer as before. The button still carries data-dragging and
// data-drag-id for the whole drag, so editKeyFor folds one drag into one undo step.
export function OrderDragHandle({ index, onMove, label, itemId, onMoveAcross }: { index: number; onMove: (from: number, to: number) => void; label: string; itemId?: string; onMoveAcross?: (groupId: string, toIndex: number) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const indexRef = useRef(index);
  const onMoveRef = useRef(onMove);
  const onMoveAcrossRef = useRef(onMoveAcross);
  const itemIdRef = useRef(itemId);
  const holdTimer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const hold = useRef<HoldState>(idleHold);
  const press = useRef<{ zone: HTMLElement; row: HTMLElement; pointerId: number } | null>(null);
  const captured = useRef<{ zone: HTMLElement; pointerId: number } | null>(null);
  const endLift = useRef<(() => void) | null>(null);
  useEffect(() => { indexRef.current = index; onMoveRef.current = onMove; onMoveAcrossRef.current = onMoveAcross; itemIdRef.current = itemId; });
  const placed = useRef<{ index: number; left: number; top: number } | null>(null);
  // Has the row anywhere to go (26.1-15)? Under a strip of tabs only the selected section, subsection or card stands in the page: a list of one, nobody to swap with.
  // Such a row is marked data-sort-alone (no open hand) and does not start a hold, so its head still folds and unfolds on a click.
  function movable() {
    const row = button.current?.closest<HTMLElement>("[data-sort-index]");
    const parent = row?.parentElement;
    if (!row || !parent) return false;
    const columns = parent.hasAttribute("data-sort-column") ? parent.parentElement : null;
    const rows = columns ? columns.querySelectorAll(":scope > [data-sort-column] > [data-sort-index]") : parent.querySelectorAll(":scope > [data-sort-index]");
    const kind = parent.dataset.sortGroup;
    const crossesLists = Boolean(onMoveAcrossRef.current && itemIdRef.current && kind);
    return hasPlaceToGo({
      rows: rows.length,
      crossesLists,
      sameKindLists: crossesLists ? document.querySelectorAll(`[data-sort-group="${kind}"]`).length : 0,
      otherDropGroups: crossesLists ? Array.from(document.querySelectorAll<HTMLElement>("[data-drop-group]")).filter((card) => card.dataset.dropGroup !== parent.dataset.groupId).length : 0,
    });
  }
  // Per-handle FLIP: every row whose index changed slides itself (along both axes, rows can sit in columns), so the dragged row and its displaced neighbours all animate.
  useLayoutEffect(() => {
    const row = button.current?.closest<HTMLElement>("[data-sort-index]");
    if (row) { if (movable()) delete row.dataset.sortAlone; else row.dataset.sortAlone = "true"; }
    if (!row || row.offsetParent === null) { placed.current = null; return; }
    const { offsetLeft: left, offsetTop: top } = row;
    const previous = placed.current;
    placed.current = { index, left, top };
    if (!previous || previous.index === index || (previous.left === left && previous.top === top)) return;
    // Mirrors the CSS motion switch, which cannot clamp Web Animations started from script.
    const motion = document.documentElement.dataset.motion;
    if (motion === "reduced" || motion === "off") return;
    const easing = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
    row.animate([{ transform: `translate(${previous.left - left}px, ${previous.top - top}px)` }, { transform: "none" }], { duration: 160, easing });
  });

  const stop = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    holdTimer.current = null;
    frame.current = null;
    active.current = false;
    hold.current = idleHold;
    press.current = null;
    if (button.current) {
      delete button.current.dataset.dragging;
      delete button.current.dataset.dragId;
      const row = button.current.closest<HTMLElement>("[data-sort-index]");
      if (row) delete row.dataset.lifted;
    }
    endLift.current?.();
    endLift.current = null;
    const held = captured.current;
    captured.current = null;
    if (held?.zone.hasPointerCapture(held.pointerId)) held.zone.releasePointerCapture(held.pointerId);
  };
  // The element is up: marked lifted, the page neither scrolls nor selects text under the finger, and the list follows the pointer.
  const beginLift = (row: HTMLElement | null, dragId: string) => {
    active.current = true;
    if (row) row.dataset.lifted = "true";
    if (button.current) {
      button.current.dataset.dragging = "true";
      button.current.dataset.dragId = dragId;
    }
    const refuse = (event: Event) => { if (event.cancelable) event.preventDefault(); };
    window.getSelection()?.removeAllRanges();
    window.addEventListener("touchmove", refuse, { passive: false });
    document.addEventListener("selectstart", refuse);
    document.addEventListener("dragstart", refuse);
    document.addEventListener("contextmenu", refuse);
    endLift.current = () => {
      window.removeEventListener("touchmove", refuse);
      document.removeEventListener("selectstart", refuse);
      document.removeEventListener("dragstart", refuse);
      document.removeEventListener("contextmenu", refuse);
    };
    frame.current = requestAnimationFrame(autoscroll);
  };
  const liftPressed = () => {
    const pressed = press.current;
    if (!pressed || active.current) return;
    // A lift by a move must not leave the 400 ms timer behind: it would fire a second lift.
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    beginLift(pressed.row, makeId("drag"));
    try {
      pressed.zone.setPointerCapture(pressed.pointerId);
      captured.current = { zone: pressed.zone, pointerId: pressed.pointerId };
    } catch {}
  };
  // Only lists of the same data-sort-group kind take a card (a card never becomes a block or a section, D-11); the new place is the row, the empty hint or the section head under the pointer.
  const moveAcross = (own: HTMLElement | null | undefined, hits: Element[], x: number, y: number) => {
    const kind = own?.dataset.sortGroup;
    const across = onMoveAcrossRef.current;
    const itemId = itemIdRef.current;
    if (!own || !kind || !across || !itemId) return;
    const list = `[data-sort-group="${kind}"]`;
    for (const element of hits) {
      let groupId: string | undefined;
      let toIndex = 0;
      const row = element.closest<HTMLElement>(`${list} > [data-sort-index]`);
      const empty = element.closest<HTMLElement>(list);
      const head = element.closest<HTMLElement>("[data-drop-group] > .nested-editor-head");
      if (row && row.parentElement !== own) {
        const { top, height } = row.getBoundingClientRect();
        groupId = row.parentElement?.dataset.groupId;
        toIndex = Number(row.dataset.sortIndex) + (y > top + height / 2 ? 1 : 0);
      } else if (!row && empty && empty !== own && !empty.querySelector(":scope > [data-sort-index]")) {
        groupId = empty.dataset.groupId;
      } else if (head && head.parentElement?.dataset.dropGroup !== own.dataset.groupId) {
        groupId = head.parentElement?.dataset.dropGroup;
        toIndex = Number.MAX_SAFE_INTEGER;
      }
      if (!groupId) continue;
      dragHandoff = { itemId, dragId: button.current?.dataset.dragId ?? makeId("drag"), x, y };
      across(groupId, toIndex);
      return;
    }
  };
  // A row swaps only once the pointer crosses the target's middle in reading order (sideways in a row of columns, downwards otherwise), so rows of unequal height do not flip back and forth.
  const moveTo = (x: number, y: number) => {
    // Nested «Информация» lists must not swap across levels: only rows sharing the dragged row's parent are targets.
    // D-42: section cards stand in [data-sort-column] columns of one [data-sort-columns] container; there every row of those columns is a target, and nothing nested (subsections, blocks, cards) ever is.
    const ownRow = button.current?.closest<HTMLElement>("[data-sort-index]");
    const parent = ownRow?.parentElement;
    const columns = parent?.hasAttribute("data-sort-column") ? parent.parentElement : null;
    const hits = document.elementsFromPoint(x, y);
    const row = hits
      .map((element) => element.closest<HTMLElement>("[data-sort-index]"))
      .find((candidate) => candidate && (columns
        ? candidate.parentElement?.hasAttribute("data-sort-column") && candidate.parentElement.parentElement === columns
        : candidate.parentElement === parent));
    if (!row) { moveAcross(parent, hits, x, y); return; }
    const target = Number(row.dataset.sortIndex);
    if (!row || !Number.isInteger(target) || target === indexRef.current) return;
    const boxOf = ({ left, top, width, height }: DOMRect): Box => ({ left, top, width, height });
    if (!ownRow || !passesTarget(boxOf(ownRow.getBoundingClientRect()), boxOf(row.getBoundingClientRect()), { x, y }, target > indexRef.current)) return;
    // Another column remounts the card and its handle; the new handle takes the drag over, so it stays one gesture and one undo step.
    const itemId = itemIdRef.current;
    if (itemId && row.parentElement !== parent) dragHandoff = { itemId, dragId: button.current?.dataset.dragId ?? makeId("drag"), x, y };
    onMoveRef.current(indexRef.current, target);
    indexRef.current = target;
  };

  // Near the edge of whatever scrolls (the editor, or the page on phones) the list keeps moving under a still finger.
  const autoscroll = () => {
    const editor = button.current?.closest<HTMLElement>(".content-editor") ?? null;
    const scrolls = editor !== null && editor.scrollHeight > editor.clientHeight && /auto|scroll/.test(getComputedStyle(editor).overflowY);
    const scroller: { scrollBy: (x: number, y: number) => void } = scrolls ? editor : window;
    // 56px: sticky system bar; 44px: taskbar (window mode only).
    const { top, bottom } = scrolls ? editor.getBoundingClientRect() : { top: 56, bottom: window.innerHeight - 44 };
    const { x, y } = pointer.current;
    const direction = y < top + 48 ? -1 : y > bottom - 48 ? 1 : 0;
    if (direction) {
      scroller.scrollBy(0, direction * 8);
      moveTo(x, y);
    }
    frame.current = requestAnimationFrame(autoscroll);
  };

  // A stuck drag marker would fold every later edit into one undo step, so the drag also ends on unmount, on lost
  // window focus, and on a release anywhere: once pointer capture is lost the handle may never see its pointerup.
  // Tracking lives on window too, because a downward swap re-inserts the dragged row and drops pointer capture (03-REVIEW IN-05).
  useEffect(() => {
    const row = button.current?.closest<HTMLElement>("[data-sort-index]") ?? null;
    const zone = row?.querySelector<HTMLElement>(":scope > .nested-editor-head") ?? row;
    if (!row || !zone) return;
    const onPress = (event: PointerEvent) => {
      // A second finger or a right-click must not start a hold or orphan the first one's timer and frame loop.
      if (!event.isPrimary || event.button !== 0 || !holdTargetAllowed(holdTargetOf(event.target, row)) || !movable()) return;
      stop();
      pointer.current = { x: event.clientX, y: event.clientY };
      press.current = { zone, row, pointerId: event.pointerId };
      hold.current = holdStep(idleHold, { type: "down", x: event.clientX, y: event.clientY, at: event.timeStamp, pointerType: event.pointerType });
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        hold.current = holdStep(hold.current, { type: "tick", at: hold.current.at + HOLD_MS });
        if (hold.current.phase === "lifted") liftPressed();
      }, HOLD_MS);
    };
    const onBlur = () => { dragHandoff = null; stop(); };
    const onRelease = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      dragHandoff = null;
      if (holdStep(hold.current, { type: event.type === "pointercancel" ? "cancel" : "up" }).suppressClick) swallowNextClick();
      stop();
    };
    // Gated by the phase of the hold, not by the lift timer: the timer is cleared at the lift, and the drag must go on after it.
    const onTrack = (event: PointerEvent) => {
      if (!event.isPrimary || hold.current.phase === "idle") return;
      pointer.current = { x: event.clientX, y: event.clientY };
      hold.current = holdStep(hold.current, { type: "move", x: event.clientX, y: event.clientY, at: event.timeStamp, pressed: event.buttons !== 0 });
      // The button was let go outside the page and no release was heard: end the press rather than drag with no button down.
      if (hold.current.phase === "idle") { stop(); return; }
      // A finger that drifted too far before the time was up was scrolling, not holding.
      if (hold.current.phase === "cancelled") { stop(); return; }
      if (hold.current.phase === "lifted") liftPressed();
      if (active.current) moveTo(event.clientX, event.clientY);
    };
    // Not cleared here: Strict Mode runs this effect twice; a release or blur clears it.
    if (dragHandoff && dragHandoff.itemId === itemIdRef.current && button.current) {
      hold.current = { phase: "lifted", x: dragHandoff.x, y: dragHandoff.y, at: 0, pointerType: "mouse", suppressClick: false };
      pointer.current = { x: dragHandoff.x, y: dragHandoff.y };
      beginLift(row, dragHandoff.dragId);
    }
    // WR-05 (26.1 review): Chromium and WebKit decide at touchstart whether a touch sequence can be cancelled, from the touchmove listeners that exist THEN
    // (and touch-action is read at that moment too, so it cannot be switched on once the element is lifted). The listener added at the lift comes too late,
    // so the zone carries a standing non-passive one that refuses the scroll only while the element is held. A press that is not held scrolls as before.
    // Not verified on a physical phone: devices stay BLOCKED until a phase proves them.
    const refuseScrollWhileLifted = (event: TouchEvent) => { if (hold.current.phase === "lifted" && event.cancelable) event.preventDefault(); };
    zone.addEventListener("touchmove", refuseScrollWhileLifted, { passive: false });
    zone.addEventListener("pointerdown", onPress);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointermove", onTrack);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      zone.removeEventListener("touchmove", refuseScrollWhileLifted);
      zone.removeEventListener("pointerdown", onPress);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onTrack);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      stop();
    };
  }, []);

  return <button
    ref={button}
    className="order-drag-handle"
    type="button"
    aria-label={`Изменить порядок: ${label}`}
    aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
    onKeyDown={(event) => {
      // Left and right say the same as up and down: tabs and table columns are read sideways.
      const step = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : 0;
      if (!step) return;
      event.preventDefault();
      onMove(index, index + step);
    }}
  ><span aria-hidden="true">≡</span></button>;
}

export function ArchivedVirusEditor({ virus, uploadState, uploadMessage, onUpload, onChange, onRemoveMutation, onRestore, onDelete, dossierChanged, restoreBlocked }: {
  restoreBlocked: boolean;
  virus: Virus;
  uploadState: "idle" | "uploading" | "error";
  uploadMessage?: string;
  onUpload: (file: File, onUploaded: (url: string) => void) => void;
  onChange: (updater: (virus: Virus) => void) => void;
  onRemoveMutation: (index: number) => void;
  onRestore: () => void;
  onDelete: () => void;
  dossierChanged: DossierTab[];
}) {
  const [dossierTab, setDossierTab] = useState<DossierTab>("main");
  const cardTabs = useCardTabSelection();
  return <div className="editor-form virus-editor-form etab-detail">
    <p className="editor-guidance">Полная запись вируса в Корзине.</p>
    <DossierTabs active={dossierTab} changed={dossierChanged} onSelect={setDossierTab} />
    {dossierTab === "main" && <EditorGroup title="Основные данные">
      <Field label="Название"><input value={virus.name} onChange={(event) => onChange((item) => { item.name = event.target.value; })} /></Field>
      <LevelPicker name={`level-virus-${virus.id}`} value={virus.level} onChange={(level) => onChange((item) => { item.level = level; })} />
      <Field label="Код"><input value={virus.code} onChange={(event) => onChange((item) => { item.code = event.target.value; })} /></Field>
      <Field label="Статус"><input value={virus.status} onChange={(event) => onChange((item) => { item.status = event.target.value; })} /></Field>
      <ImageEditorField label="Фото или GIF после заражения" value={virus.infectedImage} placement="dossier" maxHint="На странице: максимум 540 × 620 px" uploadState={uploadState} uploadMessage={uploadMessage} framing={virus.infectedImageFraming} framingBox="natural" onFramingChange={(frame) => onChange((item) => { if (frame) item.infectedImageFraming = frame; else delete item.infectedImageFraming; })} onChange={(value) => onChange((item) => { item.infectedImage = value; })} onUpload={(file) => onUpload(file, (url) => onChange((item) => { item.infectedImage = url; }))} />
    </EditorGroup>}
    {dossierTab === "text" && <EditorGroup title="Описание" stack>
      <Field label="Внешние характеристики" wide><textarea value={virus.external} onChange={(event) => onChange((item) => { item.external = event.target.value; })} /></Field>
      <Field label="Физиологические характеристики" wide><textarea value={virus.physiology} onChange={(event) => onChange((item) => { item.physiology = event.target.value; })} /></Field>
    </EditorGroup>}
    {dossierTab === "text" && <EditorGroup title="Характеристики PPU" stack>
      {(["health", "speed", "abilities"] as const).map((key) => <Field key={key} label={{ health: "Здоровье", speed: "Скорость", abilities: "Способности" }[key]} wide><textarea value={virus.ppu[key]} onChange={(event) => onChange((item) => { item.ppu[key] = event.target.value; })} /></Field>)}
    </EditorGroup>}
    {dossierTab === "main" && <EditorGroup title="Классификация">
      {([
        ["danger", "Общий уровень опасности"], ["spread", "Распространение"], ["transmission", "Способ распространения"],
        ["escapeRisk", "Угроза и риск побега"], ["mind", "Разум"], ["appearance", "Вид / внешность"], ["behavior", "Поведение"],
      ] as [keyof Virus["classification"], string][]).map(([key, label]) => <ClassificationField key={key} label={label} classificationKey={key} value={virus.classification[key]} onChange={(value) => onChange((item) => { item.classification[key] = value; })} />)}
    </EditorGroup>}
    {dossierTab === "mutations" && <EditorGroup title="Мутации" stack>
      <CardTabs label={cardTabsCopy.mutations} items={virus.mutations.map((mutation, index) => ({ id: String(index), title: mutation.name }))} activeId={cardTabs.active(`${virus.id}:mutations`, Object.keys(virus.mutations))} onSelect={(id) => cardTabs.select(`${virus.id}:mutations`, id)}
        add={{ onAdd: () => onChange((item) => { item.mutations.push({ name: "НОВАЯ МУТАЦИЯ", description: "", image: "" }); }), disabled: false, label: cardTabsCopy.addMutation }} />
      {virus.mutations.map((mutation, index) => String(index) === cardTabs.active(`${virus.id}:mutations`, Object.keys(virus.mutations)) && <div className="nested-editor-card" key={`${virus.id}-mutation-${index}`}>
        <div className="nested-editor-head"><strong>МУТАЦИЯ {String(index + 1).padStart(2, "0")}</strong><button type="button" disabled={uploadState === "uploading"} onClick={() => onRemoveMutation(index)}>Удалить</button></div>
        <Field label="Название"><input value={mutation.name} onChange={(event) => onChange((item) => { item.mutations[index].name = event.target.value; })} /></Field>
        <Field label="Описание" wide><textarea value={mutation.description} onChange={(event) => onChange((item) => { item.mutations[index].description = event.target.value; })} /></Field>
        <ImageEditorField label="Изображение или GIF мутации" value={mutation.image} placement="mutation" maxHint="На странице: максимум 420 × 360 px" uploadState={uploadState} uploadMessage={uploadMessage} framing={mutation.imageFraming} framingBox="natural" onFramingChange={(frame) => onChange((item) => { const target = item.mutations[index]; if (!target) return; if (frame) target.imageFraming = frame; else delete target.imageFraming; })} onChange={(value) => onChange((item) => { item.mutations[index].image = value; })} onUpload={(file) => onUpload(file, (url) => onChange((item) => { const target = item.mutations[index]; if (target) target.image = url; }))} />
      </div>)}
    </EditorGroup>}
    {dossierTab === "logs" && <EditorGroup title="Записи учёных" stack>
      {virus.scientistLogs.length === 0 && <p className="editor-guidance">{levelCopy.logsEmptyEditor}</p>}
      <CardTabs label={cardTabsCopy.logs} items={virus.scientistLogs.map((log) => ({ id: log.id, title: log.title }))} activeId={cardTabs.active(`${virus.id}:logs`, virus.scientistLogs.map((log) => log.id))} onSelect={(id) => cardTabs.select(`${virus.id}:logs`, id)}
        add={{ onAdd: () => onChange((item) => { item.scientistLogs.push({ id: makeId("log"), title: `ЗАПИСЬ ${String(item.scientistLogs.length + 1).padStart(2, "0")}`, scientist: "ИМЯ УЧЁНОГО", lockedLevel: 1, content: [""] }); }), disabled: virus.scientistLogs.length >= MAX_SCIENTIST_LOGS, label: cardTabsCopy.addLog, note: `${virus.scientistLogs.length} / ${MAX_SCIENTIST_LOGS}` }} />
      {virus.scientistLogs.map((log, index) => log.id === cardTabs.active(`${virus.id}:logs`, virus.scientistLogs.map((item) => item.id)) && <div className="nested-editor-card" key={log.id}>
        <div className="nested-editor-head"><strong>ЗАПИСЬ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => onChange((item) => { item.scientistLogs.splice(index, 1); })}>Удалить</button></div>
        <Field label="Название"><input value={log.title} onChange={(event) => onChange((item) => { item.scientistLogs[index].title = event.target.value; })} /></Field>
        <Field label="Псевдоним учёного"><input value={log.scientist} onChange={(event) => onChange((item) => { item.scientistLogs[index].scientist = event.target.value; })} /></Field>
        <LevelPicker name={`level-log-${log.id}`} value={log.lockedLevel} onChange={(level) => onChange((item) => { item.scientistLogs[index].lockedLevel = level; })} />
        <Field label="Текст записи" wide><textarea value={scientistLogPlainText(log)} onChange={(event) => onChange((item) => { item.scientistLogs[index].content = event.target.value.split(/\n\s*\n/); item.scientistLogs[index].richContent = { runs: [{ text: event.target.value }] }; })} /></Field>
      </div>)}
    </EditorGroup>}
    <div className="archive-virus-actions"><button className="secondary-control" type="button" disabled={restoreBlocked} title={restoreBlocked ? "Раздел «База вирусов» для вас закрыт" : undefined} onClick={onRestore}>ВОССТАНОВИТЬ В БАЗУ</button><button className="danger-control" type="button" onClick={onDelete}>УДАЛИТЬ НАВСЕГДА</button></div>
  </div>;
}

// `tabs` is optional: without it every dossier tab is shown, as the site editor does. The template builder passes the tabs without the scientist records.
export function DossierTabs({ active, changed, onSelect, tabs }: { active: DossierTab; changed: DossierTab[]; onSelect: (id: DossierTab) => void; tabs?: readonly DossierTab[] }) {
  return <nav className="editor-tabs dossier-tabs" aria-label="Разделы досье">
    {dossierTabs.filter(([id]) => !tabs || tabs.includes(id)).map(([id, label]) => {
      const unsaved = changed.includes(id);
      return <button key={id} type="button" className={active === id ? "active" : ""} aria-label={unsaved ? `${label}, есть несохранённые правки` : undefined} onClick={() => onSelect(id)}>
        {label}{unsaved && <i className="tab-dot" aria-hidden="true" />}
      </button>;
    })}
  </nav>;
}

// Owner 2026-11-21, item 32: the panel of the routes is a layer over the page. A modal dialog is the top layer, so a field inside one keeps its panel
// inside that dialog; everywhere else the panel goes to document.body, above the windows of the desktop.
function routePanelHost(button: HTMLElement | null): Element {
  return button?.closest("dialog") ?? document.body;
}

// The visible screen, with the phone keyboard accounted for.
function routeViewport() {
  return { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
}

// One write of the panel's place: an upward panel hangs by its bottom edge, so a longer description grows away from the button.
function writeRoutePanelPlace(node: HTMLElement, place: RoutePanelPlace) {
  node.style.top = place.bottom === null ? `${place.top}px` : "auto";
  node.style.bottom = place.bottom === null ? "auto" : `${place.bottom}px`;
  node.style.left = `${place.left}px`;
  node.style.width = `${place.width}px`;
  node.style.maxHeight = `${place.maxHeight}px`;
  node.dataset.side = place.side;
}

// The ancestors that clip the button (the scrolling form, the window): when the button leaves one of them, the panel has nothing to hang on and closes.
function scrollingAncestors(node: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (let at = node.parentElement; at && at !== document.body && at !== document.documentElement; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.display !== "contents" && /auto|scroll|hidden|clip|overlay/.test(`${style.overflowX} ${style.overflowY}`)) found.push(at);
  }
  return found;
}

// The focusable element that follows the button in the page, the panel's own checkboxes left out.
function nextTabStop(button: HTMLElement, panel: HTMLElement, host: Element | null): HTMLElement | null {
  const scope = host instanceof HTMLDialogElement ? host : document;
  const stops = [...scope.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")]
    .filter((node) => node.tabIndex >= 0 && !(node as HTMLButtonElement).disabled && !panel.contains(node) && node.getClientRects().length > 0);
  const at = stops.indexOf(button);
  return at < 0 ? null : stops[at + 1] ?? null;
}

// OWN-03 (owner 2026-11-20; clarification 12, 26.1-15): the routes of transmission are several, so the field is a compact drop-down: one line with the chosen routes,
// and on a press a panel of checkboxes. The value stays the one canonical string of lib/transmission-routes.ts; the choices, their exclusive «Неизвестно» and
// the string itself are that module's, not ours.
export function TransmissionRoutesField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const panelId = useId();
  const footId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Owner 2026-11-21, item 32: the panel is a layer over the page, drawn into document.body (or the open dialog the field stands in), never a child of
  // the scrolling form, so opening it changes neither the layout nor the scroll bars of the window. The host is chosen on the press that opens it.
  const [host, setHost] = useState<Element | null>(null);
  // The foot of the panel says the route under the pointer or in focus (item 18). Item 32: the pointed route is a ref and the text is written into the
  // foot directly, so moving the pointer over the rows renders nothing; React draws the foot empty and never touches its text.
  const foot = useRef<HTMLParagraphElement>(null);
  const pointed = useRef<string | null>(null);
  const hintFor = (name: string | null) => transmissionDescription(name ?? "") ?? "Наведите на путь";
  const describe = (name: string | null) => {
    pointed.current = name;
    if (foot.current) foot.current.textContent = hintFor(name ?? parseTransmissionRoutes(value)[0] ?? null);
  };
  const selected = parseTransmissionRoutes(value);
  const known = new Set(TRANSMISSION_CHOICES.map((choice) => choice.name));
  const extras = selected.filter((item) => !known.has(item));
  // The button and the panel are one drop-down for the press and the focus, though the panel lives elsewhere in the page.
  const inside = (node: Node | null) => !!node && (!!root.current?.contains(node) || !!panel.current?.contains(node));
  // On opening and after every change of the value the foot is filled before the paint: the pointed route, or else the first chosen one.
  useLayoutEffect(() => {
    if (open && foot.current) foot.current.textContent = transmissionDescription(pointed.current ?? parseTransmissionRoutes(value)[0] ?? "") ?? "Наведите на путь";
  }, [open, value]);
  // Owner items 18 and 32: placed before the paint by the button's rectangle (position: fixed), down or up, never past the edge of the screen.
  // Then it follows the button: any scroll (of any ancestor, heard in the capture phase) or resize asks for ONE animation frame; the frame reads the
  // button once and writes the panel's style once, with no render. A button scrolled out of its form closes the panel. The listeners leave with it.
  useLayoutEffect(() => {
    const node = panel.current;
    const button = toggle.current;
    if (!open || !node || !button) return;
    const natural = node.offsetHeight;
    const clips = scrollingAncestors(button);
    writeRoutePanelPlace(node, routePanelPlacement(button.getBoundingClientRect(), { width: ROUTE_PANEL_WIDTH, height: natural }, routeViewport()));
    let frame = 0;
    const onFrame = () => {
      frame = 0;
      const anchor = button.getBoundingClientRect();
      if (!routeAnchorVisible(anchor, clips.map((clip) => clip.getBoundingClientRect()))) { setOpen(false); return; }
      writeRoutePanelPlace(node, routePanelPlacement(anchor, { width: ROUTE_PANEL_WIDTH, height: natural }, routeViewport()));
    };
    const schedule = (event: Event) => {
      if (event.target instanceof Node && node.contains(event.target)) return;
      if (frame === 0) frame = requestAnimationFrame(onFrame);
    };
    const options = { capture: true, passive: true } as const;
    window.addEventListener("scroll", schedule, options);
    window.addEventListener("resize", schedule, options);
    window.visualViewport?.addEventListener("resize", schedule, options);
    return () => {
      window.removeEventListener("scroll", schedule, options);
      window.removeEventListener("resize", schedule, options);
      window.visualViewport?.removeEventListener("resize", schedule, options);
      cancelAnimationFrame(frame);
    };
  }, [open]);
  // A press anywhere outside closes the panel; a press inside it (on the button or in the panel) never does.
  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);
  // The panel stands at the end of its host, so Tab is carried by hand: from the button into the first checkbox, from the first back to the button,
  // and from the last on to whatever follows the button in the page, closing the panel on the way out.
  const carryTab = (event: ReactKeyboardEvent) => {
    const box = panel.current;
    const button = toggle.current;
    if (!box || !button) return;
    const stops = [...box.querySelectorAll<HTMLElement>("input, button")];
    if (stops.length === 0) return;
    if (event.target === button && !event.shiftKey) { event.preventDefault(); stops[0].focus(); }
    else if (event.target === stops[0] && event.shiftKey) { event.preventDefault(); button.focus(); }
    else if (event.target === stops[stops.length - 1] && !event.shiftKey) { event.preventDefault(); setOpen(false); (nextTabStop(button, box, host) ?? button).focus(); }
  };
  return <div className="route-dropdown classification-editor-field" ref={root}
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); toggle.current?.focus(); } else if (event.key === "Tab" && open) carryTab(event); }}
    onBlur={(event) => { if (open && event.relatedTarget && !inside(event.relatedTarget as Node)) setOpen(false); }}>
    <span className="route-dropdown-label" id={labelId}>{label}</span>
    <div className="route-dropdown-anchor">
      <button type="button" className="route-dropdown-toggle" ref={toggle} aria-haspopup="true" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-labelledby={`${labelId} ${valueId}`} onClick={() => { pointed.current = null; setHost(routePanelHost(toggle.current)); setOpen((was) => !was); }}>
        <span className="route-dropdown-value" id={valueId}>
          {selected.length === 0 ? <em>Не указан</em> : selected.map((name) => {
            const icon = classificationIconFor(name);
            return <span className="route-dropdown-chosen" key={name}>{icon && <PortiaIcon name={icon} className="route-icon" />}{name}</span>;
          })}
        </span>
        <span className="route-dropdown-chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && host && createPortal(<div className="route-dropdown-panel" id={panelId} role="group" aria-labelledby={labelId} ref={panel} onMouseLeave={() => describe(null)}>
        <div className="route-dropdown-list">
          {TRANSMISSION_CHOICES.map((choice) => {
            const icon = classificationIconFor(choice.name);
            return <label key={choice.name} className="route-option" onMouseEnter={() => describe(choice.name)}>
              <input type="checkbox" checked={selected.includes(choice.name)} aria-describedby={footId} onFocus={() => describe(choice.name)} onChange={() => onChange(toggleTransmissionRoute(value, choice.name))} />
              {icon && <PortiaIcon name={icon} className="route-icon" />}
              <span className="route-option-text"><strong>{choice.name}</strong></span>
            </label>;
          })}
          {extras.map((extra) => <div key={extra} className="route-option route-extra">
            <span className="route-option-text"><strong>{extra}</strong></span>
            <button type="button" className="secondary-control" onClick={() => onChange(formatTransmissionRoutes(selected.filter((item) => item !== extra)))}>Убрать</button>
          </div>)}
        </div>
        <p className="route-dropdown-foot" id={footId} ref={foot} />
      </div>, host)}
    </div>
  </div>;
}

export function ClassificationField({ label, classificationKey, value, onChange }: {
  label: string;
  classificationKey: keyof Virus["classification"];
  value: string;
  onChange: (value: string) => void;
}) {
  if (classificationKey === "transmission") return <TransmissionRoutesField label={label} value={value} onChange={onChange} />;
  const options = classificationOptions[classificationKey] as readonly { value: string; level?: number }[];
  const selected = options.find((option) => option.value === value);
  const level = selected?.level;

  return <label className="editor-field classification-editor-field">
    <span>{label}</span>
    <div className={`classification-select-wrap${level ? ` level-${level}` : ""}`}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const optionLevel = option.level;
          return <option key={option.value} value={option.value}>{optionLevel ? `${optionLevel} уровень — ` : ""}{option.value}</option>;
        })}
      </select>
      {level ? <strong>УРОВЕНЬ {level}</strong> : <strong className="neutral">МЕТОД</strong>}
    </div>
  </label>;
}

type ConfirmAction = { label: string; tone: "primary" | "secondary" | "danger"; onClick: () => void; autoFocus?: boolean; disabled?: boolean };

// A native modal dialog lives in the top layer: above the transformed editor window, the taskbar and the boot screen,
// with focus trapped and the page inert. Never use window.confirm for new prompts: embedded browsers answer it "no" unseen.
export function ConfirmDialog({ title, text, actions, onCancel }: { title: string; text: string; actions: ConfirmAction[]; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // showModal focuses the first button; the safe action has to win instead.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="portia-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onClose={() => onCancel()}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div>
        <h2 id={titleId}>{title}</h2>
        <p id={textId}>{text}</p>
        <div className="portia-dialog-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className={`${action.tone}-control`} autoFocus={action.autoFocus} data-autofocus={action.autoFocus || undefined} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>
          ))}
        </div>
      </div>
    </dialog>
  );
}

export function EditorGroup({ title, children, stack = false }: { title: string; children: React.ReactNode; stack?: boolean }) {
  return <section className={`editor-group${stack ? " stack" : ""}`}><h2>{title}</h2><div className="editor-field-grid">{children}</div></section>;
}

export function Field({ label, children, wide = false, error, errorId }: { label: string; children: React.ReactNode; wide?: boolean; error?: string; errorId?: string }) {
  // The error line is hidden from the label's name so it is not read twice; the input's aria-describedby still reads it.
  return <label className={`editor-field${wide ? " wide" : ""}${error ? " is-invalid" : ""}`}><span>{label}</span>{children}{error && <small id={errorId} className="editor-field-error" aria-hidden="true">{error}</small>}</label>;
}

export function ImageEditorField({ label, value, placement, maxHint, removeLabel, showPreview = true, uploadState = "idle", uploadMessage = "", framing, framingBox, onFramingChange, onChange, onUpload }: {
  label: string;
  value: string;
  placement: ImagePlacement;
  maxHint: string;
  // When set and the field holds an image, a button with this text clears it.
  removeLabel?: string;
    showPreview?: boolean;
  uploadState?: "idle" | "uploading" | "error";
  // Server or network refusal text, shown under the field; the value itself is never touched on refusal.
  uploadMessage?: string;
  // D-63: the visible part of the picture. The block «Видимая часть» shows under the preview when the picture opened and a handler is given.
  // A new, cleared or uploaded address drops the frame: it belonged to the old picture.
  framing?: ImageFraming;
  framingBox?: ImageFramingBox;
  onFramingChange?: (framing: ImageFraming | undefined) => void;
  onChange: (value: string) => void;
  onUpload?: (file: File) => void;
}) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState("");
  const previewFailed = Boolean(value) && failedPreviewUrl === value;

  // Shown only where a file was picked, so a refusal is not repeated under every image field on the page.
  const [picked, setPicked] = useState(false);
  const uploading = uploadState === "uploading";

  // A typed, pasted or cleared address that differs from the current one takes the frame of the old picture with it.
  const changeAddress = (next: string) => {
    if (next !== value && framing && onFramingChange) onFramingChange(undefined);
    onChange(next);
  };
  // An upload brings a new address through the parent: the value the file was picked on is remembered, and the first different value drops the frame.
  const addressAtPick = useRef<string | null>(null);
  useEffect(() => {
    if (addressAtPick.current === null || addressAtPick.current === value) return;
    addressAtPick.current = null;
    if (framing && onFramingChange) onFramingChange(undefined);
  }, [value, framing, onFramingChange]);
  useEffect(() => { if (uploadState === "error") addressAtPick.current = null; }, [uploadState]);

  const receiveFile = (file: File | undefined) => {
    if (uploading) return;
    if (file) setPicked(true);
    if (file && onUpload) addressAtPick.current = value;
    if (file && onUpload) onUpload(file);
  };
  const refusal = picked && uploadState === "error" ? uploadMessage : "";

  return <div className={`editor-field wide image-editor-field image-placement-${placement}`}>
    <span>{label}</span>
    <input value={value} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="Прямая HTTPS-ссылка на изображение или .gif" onChange={(event) => changeAddress(event.target.value)} onBlur={(event) => changeAddress(mediaUrlFromText(event.currentTarget.value))} onPaste={(event) => { const text = event.clipboardData.getData("text"); const url = mediaUrlFromText(text); if (url && url !== text) { event.preventDefault(); changeAddress(url); } }} />
    <small className="editor-media-hint">{maxHint}. Для Tenor нужна ссылка с <b>media.tenor.com</b>.</small>
    {onUpload && <label className="editor-dropzone" aria-disabled={uploading || undefined} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); receiveFile(event.dataTransfer.files?.[0]); }}>
      <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { receiveFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <strong>{uploading ? "ЗАГРУЖАЕМ…" : "ВЫБРАТЬ ФАЙЛ С КОМПЬЮТЕРА"}</strong>
      <small>Перетащите · PNG, JPG, WEBP, GIF · до 4 МБ</small>
    </label>}
    {refusal && <span className="editor-media-error" role="alert">{refusal}</span>}
      {value && showPreview && !previewFailed && <figure className={`editor-image-preview ${placement}`}><img src={value} alt={`Предпросмотр: ${label}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedPreviewUrl(value)} /></figure>}
    {value && !previewFailed && framingBox && onFramingChange && <ImageFramingEditor src={value} framing={framing} box={framingBox} label={label} onChange={onFramingChange} />}
    {value && removeLabel && <button type="button" className="secondary-control" onClick={() => changeAddress("")}>{removeLabel}</button>}
    {value && previewFailed && <span className="editor-media-error">Не удалось открыть. Нужна прямая HTTPS-ссылка на файл.</span>}
  </div>;
}

// Two table columns swap, so a column header is held and dropped on the other header (or moved with ArrowLeft/ArrowRight) instead of sorting live.
// owner 2026-11-20 (OWN-09): no ≡ handle; the header cell itself is held 400 ms like a row, the button is the keyboard and screen reader way.
export function ColumnSwapHandle({ label, onSwap }: { label: string; onSwap: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const onSwapRef = useRef(onSwap);
  useEffect(() => { onSwapRef.current = onSwap; });
  useEffect(() => {
    const cell = button.current?.closest<HTMLElement>("[data-column]") ?? null;
    const head = cell?.closest<HTMLElement>(".info-table-head") ?? null;
    if (!cell || !head) return;
    // The cell stands inside a block card that is itself a sortable row; that card is its owner, not a nested row.
    const owner = cell.closest<HTMLElement>("[data-sort-index]") ?? cell;
    let state: HoldState = idleHold;
    let timer: number | null = null;
    let pressedId = -1;
    let captured = false;
    let endLift: (() => void) | null = null;
    const otherCell = (x: number, y: number) => {
      const found = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-column]") ?? null;
      return found && found !== cell && found.closest(".info-table-head") === head ? found : null;
    };
    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      state = idleHold;
      if (button.current) delete button.current.dataset.dragging;
      delete cell.dataset.lifted;
      head.querySelectorAll("[data-drop-target]").forEach((item) => item.removeAttribute("data-drop-target"));
      endLift?.();
      endLift = null;
      if (captured && cell.hasPointerCapture(pressedId)) cell.releasePointerCapture(pressedId);
      captured = false;
    };
    const lift = () => {
      if (!button.current || cell.dataset.lifted) return;
      // A lift by a move must not leave the 400 ms timer behind.
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      cell.dataset.lifted = "true";
      // "column", not "true": editKeyFor folds only row drags into one step, and a column swap is a single change on drop.
      button.current.dataset.dragging = "column";
      try { cell.setPointerCapture(pressedId); captured = true; } catch {}
      const refuse = (event: Event) => { if (event.cancelable) event.preventDefault(); };
      window.getSelection()?.removeAllRanges();
      window.addEventListener("touchmove", refuse, { passive: false });
      document.addEventListener("selectstart", refuse);
      document.addEventListener("dragstart", refuse);
      document.addEventListener("contextmenu", refuse);
      endLift = () => {
        window.removeEventListener("touchmove", refuse);
        document.removeEventListener("selectstart", refuse);
        document.removeEventListener("dragstart", refuse);
        document.removeEventListener("contextmenu", refuse);
      };
    };
    const onPress = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || !holdTargetAllowed(holdTargetOf(event.target, owner))) return;
      clear();
      pressedId = event.pointerId;
      state = holdStep(idleHold, { type: "down", x: event.clientX, y: event.clientY, at: event.timeStamp, pointerType: event.pointerType });
      timer = window.setTimeout(() => {
        timer = null;
        state = holdStep(state, { type: "tick", at: state.at + HOLD_MS });
        if (state.phase === "lifted") lift();
      }, HOLD_MS);
    };
    // Gated by the phase of the hold, not by the lift timer: the timer is cleared at the lift, and the drag must go on after it.
    const onTrack = (event: PointerEvent) => {
      if (!event.isPrimary || state.phase === "idle") return;
      state = holdStep(state, { type: "move", x: event.clientX, y: event.clientY, at: event.timeStamp, pressed: event.buttons !== 0 });
      if (state.phase === "idle" || state.phase === "cancelled") { clear(); return; }
      if (state.phase === "lifted") lift();
      if (state.phase !== "lifted") return;
      const over = otherCell(event.clientX, event.clientY);
      head.querySelectorAll("[data-column]").forEach((item) => item.toggleAttribute("data-drop-target", item === over));
    };
    const onRelease = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const dropped = state.phase === "lifted" && event.type === "pointerup" ? otherCell(event.clientX, event.clientY) : null;
      const swallow = holdStep(state, { type: event.type === "pointercancel" ? "cancel" : "up" }).suppressClick;
      clear();
      if (swallow) swallowNextClick();
      if (dropped) onSwapRef.current();
    };
    cell.addEventListener("pointerdown", onPress);
    window.addEventListener("blur", clear);
    window.addEventListener("pointermove", onTrack);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      cell.removeEventListener("pointerdown", onPress);
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointermove", onTrack);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      clear();
    };
  }, []);
  return <button
    ref={button}
    className="order-drag-handle column-swap-handle"
    type="button"
    aria-label={`Переставить столбец «${label}»`}
    aria-keyshortcuts="ArrowLeft ArrowRight"
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      onSwap();
    }}
  ><span aria-hidden="true">≡</span></button>;
}
