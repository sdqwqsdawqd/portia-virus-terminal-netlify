"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { findGuide, portiaTextKey, type GuideBlock, type GuideSection, type PortiaContent, type RedactedSlot } from "@/lib/portia-content";
import { mergePlaceholders } from "@/lib/level-placeholders";
import { levelCopy } from "@/lib/level-copy";
import { guideTileTitleFit } from "@/lib/guide-tile";
import { RedactedPlaceholder } from "@/components/portia-redacted";
import { PortiaIcon, PortiaIllustration } from "@/components/portia-icons";
import { emptyCopy, iframeLoadTimeoutMs } from "@/lib/app-state";
import type { ImageFraming } from "@/lib/image-framing";
import { FormattedText } from "@/components/portia-desktop-dossier";
import { PortiaImage, useVisibleTimeout } from "@/components/portia-desktop-media";
import { AppFatalPanel, AppSkeleton } from "@/components/portia-desktop-states";
import { useLiveEdit, type LiveOrder } from "@/components/portia-live-edit";

// D-19: one permission set for every third-party frame. Scripts and same-origin let the viewers run, popups escape the sandbox so links open as normal tabs;
// no top-navigation flag, so a frame can never move the PORTIA tab. If a device needs more, add only that one flag.
const embedSandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

const zoomSteps = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
// D-21: Ctrl zooms everywhere and Cmd on a Mac; the Windows key never does (trackpad pinch arrives as ctrlKey).
const zoomModifier = (event: { ctrlKey: boolean; metaKey: boolean }) => event.ctrlKey || (event.metaKey && /^(Mac|iPhone|iPad|iPod)/.test(navigator.platform));

export function EmbeddedDocument({ src, external, title }: { src: string; external: string; title: string }) {
  const [zoom, setZoom] = useState(1);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [frameState, setFrameState] = useState<"loading" | "loaded" | "failed">("loading");
  const [frameKey, setFrameKey] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleTimeout(viewportRef, frameState, iframeLoadTimeoutMs, () => setFrameState((current) => current === "loading" ? "failed" : current));
  const step = useCallback((direction: 1 | -1) => setZoom((current) => {
    const index = zoomSteps.findIndex((value) => value >= current - 0.001);
    return zoomSteps[Math.min(zoomSteps.length - 1, Math.max(0, index + direction))];
  }), []);

  // Wheel events over the embedded page never reach PORTIA, so while Ctrl is held a clear
  // layer covers the document and takes the wheel for our own zoom.
  useEffect(() => {
    const key = (event: KeyboardEvent) => setCtrlHeld(zoomModifier(event));
    const release = () => setCtrlHeld(false);
    const hide = () => { if (document.visibilityState === "hidden") setCtrlHeld(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // Non-passive so Ctrl+wheel zooms the document instead of the whole browser tab.
    const wheel = (event: WheelEvent) => {
      if (!zoomModifier(event)) return;
      event.preventDefault();
      step(event.deltaY < 0 ? 1 : -1);
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, [step]);

  return <div className="document-app" ref={frameRef} data-frame-state={frameState} data-frame-armed={String(visible && frameState === "loading")}>
    <div className="document-app-viewport" ref={viewportRef}>
      <iframe key={frameKey} src={src} title={title} loading="lazy" sandbox={embedSandbox} referrerPolicy="no-referrer" onLoad={() => setFrameState("loaded")} style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})` }} />
      {frameState === "loading" && <AppSkeleton shape="document" />}
      {/* Retry remounts the frame (new key) and goes back to the skeleton; the external link stays as the way out. */}
      {frameState === "failed" && <AppFatalPanel failure="iframe" illustration="microscopeGuide" extra={<a className="app-state-action" href={external} target="_blank" rel="noreferrer">Открыть отдельно</a>} retrying={false} onRetry={() => { setFrameKey((key) => key + 1); setFrameState("loading"); }} />}
      {/* A lost keyup (Ctrl+key shortcut that moved focus, a context menu) clears on the first move or press instead of leaving the document blocked (01-WR-03). */}
      {ctrlHeld && <div className="document-app-zoom-layer" aria-hidden="true" onPointerMove={(event) => { if (!zoomModifier(event)) setCtrlHeld(false); }} onPointerDown={(event) => { if (!zoomModifier(event)) setCtrlHeld(false); }} />}
    </div>
    <div className="document-app-bar">
      <div className="document-app-zoom" role="group" aria-label="Масштаб документа">
        <button type="button" onClick={() => step(-1)} aria-label="Уменьшить">−</button>
        <button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => step(1)} aria-label="Увеличить">+</button>
      </div>
      <a className="document-app-external" href={external} target="_blank" rel="noreferrer">Открыть отдельно</a>
    </div>
  </div>;
}

// Owner 2026-11-22: every section opens by itself (the tab system left plenty of room); v4 stores only the sections the visitor FOLDED, so a new
// section comes up open. (v3 stored the opened ones and started everything folded, owner 2026-11-18.)
const guideFoldedStorageKey = "portia-guide-folded-v4";

// «Справочник»: the grid and the card page are one derived view of openCardId; a card that vanished simply means the grid (D-00d).
export function GuideApp({ sections, formattedText, openCardId, onOpenCard, hitId = "", banner, placeholders, lostLevel = null }: {
  sections: GuideSection[];
  formattedText: PortiaContent["formattedText"];
  openCardId: string;
  onOpenCard: (id: string) => void;
  /** The card a search result named (D-14): marked on its page, or on its tile while the grid shows. */
  hitId?: string;
  banner?: ReactNode;
  /** Phase 24 (D-08): the places of closed sections and cards, from the server marker; absent for an editor. */
  placeholders?: { sections: RedactedSlot[]; cards: Record<string, RedactedSlot[]> };
  /** Phase 24 (D-20): set while the open card became closed; the page then shows the block of that level. */
  lostLevel?: number | null;
}) {
  // LIVE-04 (26.1-10): the editor's live mode puts its tools in a context; a visitor's page has none and keeps the markup below as it was.
  const live = useLiveEdit("guide");
  const scroller = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLElement>(null);
  // Folded sections live on this device only (D-08): a first visit shows every section open.
  const [foldedIds, setFoldedIds] = useState<string[]>([]);
  const [foldedLoaded, setFoldedLoaded] = useState(false);
  // The live mode shows every section open and folds only for this session, so a section made a moment ago is not hidden under its own head.
  const [liveFolded, setLiveFolded] = useState<string[]>([]);
  const returnTo = useRef<{ cardId: string; scrollTop: number; sections: string } | null>(null);
  // Owner 2026-11-18: cards opened from the block «Карточки» of another card; «Назад» goes back up this chain before it returns to the grid.
  const [parentCards, setParentCards] = useState<string[]>([]);
  const backIntent = useRef(false);
  const lastShown = useRef("");
  const found = findGuide(sections, openCardId);
  const sectionRows = mergePlaceholders(sections, placeholders?.sections);
  const card = found?.card ?? null;
  const shownId = card?.id ?? "";

  useLayoutEffect(() => {
    const root = scroller.current;
    const previous = lastShown.current;
    if (!root || previous === shownId) return;
    lastShown.current = shownId;
    if (shownId) {
      root.scrollTop = 0;
      page.current?.focus({ preventScroll: true });
      return;
    }
    const back = backIntent.current;
    backIntent.current = false;
    const saved = returnTo.current;
    root.scrollTop = back && saved && saved.cardId === previous && saved.sections === JSON.stringify(sections) ? saved.scrollTop : 0;
    returnTo.current = null; // a card opened from search later must not inherit this position
    if (back) (root.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(previous)}"]`) ?? root).focus({ preventScroll: true });
  }, [shownId, sections]);

  useEffect(() => {
    let ids: string[] | null = null;
    try {
      const stored = window.localStorage.getItem(guideFoldedStorageKey);
      const saved: unknown = stored === null ? null : JSON.parse(stored);
      if (Array.isArray(saved)) ids = saved.filter((id): id is string => typeof id === "string");
    } catch {}
    const restoreTimer = window.setTimeout(() => {
      if (ids) setFoldedIds(ids);
      setFoldedLoaded(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!foldedLoaded) return;
    try { window.localStorage.setItem(guideFoldedStorageKey, JSON.stringify(foldedIds.filter((id) => sections.some((section) => section.id === id)))); } catch {}
  }, [foldedIds, foldedLoaded, sections]);

  const openNested = (cardId: string) => {
    if (shownId) setParentCards((current) => [...current, shownId]);
    onOpenCard(cardId);
  };
  const goBack = () => {
    const parent = parentCards[parentCards.length - 1];
    if (parent && findGuide(sections, parent)?.card) { setParentCards(parentCards.slice(0, -1)); onOpenCard(parent); return; }
    setParentCards([]);
    backIntent.current = true;
    onOpenCard("");
  };

  const openTile = (cardId: string) => {
    setParentCards([]);
    returnTo.current = { cardId, scrollTop: scroller.current?.scrollTop ?? 0, sections: JSON.stringify(sections) };
    onOpenCard(cardId);
  };

  // Owner 2026-11-18 (round 3): no sections column, also in a maximized window. Owner 2026-11-20: the open card and the nested cards fill the window.
  return <div className="guide-app" ref={scroller} tabIndex={-1}>
    {banner}
    {found && card ? <>
      <div className="guide-back-bar"><button type="button" aria-label={parentCards.length ? "Назад к предыдущей карточке" : "Назад к списку карточек"} onClick={goBack}><span aria-hidden="true">←</span><span className="guide-back-label">Назад</span></button></div>
      <article className="guide-page" tabIndex={-1} ref={page}>
        <span className="eyebrow">{found.section.title || "Без названия"}</span>
        {/* The title carries the mark: a long page centred as a whole would hide its top. */}
        <h1 className={hitId === card.id ? "search-hit" : undefined} {...(hitId === card.id ? { "data-search-hit": "true", "aria-current": "true" as const } : {})}>{live ? live.text({ kind: "guide-card-title", cardId: card.id }, card.title) : card.title || "Без названия"}</h1>
        {!card.blocks.length && <p className="guide-section-empty">В карточке пока нет содержимого</p>}
        <div className="guide-blocks">{card.blocks.map((block, blockIndex) => {
          const view = <GuideBlockView key={block.id} block={block} cardId={card.id} formattedText={formattedText} cardTitle={card.title} sections={sections} onOpenCard={openNested} />;
          if (!live) return view;
          const order = live.order({ kind: "guide-blocks", cardId: card.id }, blockIndex, blockName(block));
          return <div className="live-block" key={block.id} {...order.rowProps}>{order.handle}{view}{live.remove({ kind: "guide-block", cardId: card.id, blockId: block.id }, blockName(block))}</div>;
        })}</div>
        {live && live.addBar({ kind: "guide-card", cardId: card.id })}
      </article>
    </> : lostLevel !== null ? <>
      <div className="guide-back-bar"><button type="button" aria-label="Назад к списку карточек" onClick={() => { backIntent.current = true; onOpenCard(""); }}><span aria-hidden="true">←</span><span className="guide-back-label">Назад</span></button></div>
      <RedactedPlaceholder variant="block" level={lostLevel} />
    </> : !sectionRows.length ? <><div className="guide-empty empty-state"><PortiaIllustration name="microscopeGuide" /><strong>{emptyCopy.guide.heading}</strong><span>{emptyCopy.guide.body}</span></div>{live && live.addBar({ kind: "guide-root" })}</>
    : <>
    {!sections.length && <div className="guide-empty empty-state"><PortiaIllustration name="microscopeGuide" /><strong>{levelCopy.sectionsNoOpen.heading}</strong><span>{levelCopy.sectionsNoOpen.body}</span></div>}
    {sectionRows.map((row, rowIndex) => {
      // D-10: a closed section is one bar in its place: no button, no photo, no chevron, no grid.
      if (row.kind === "redacted") return <section className="guide-section" key={row.slot}><RedactedPlaceholder variant="bar" level={row.requiredLevel} /></section>;
      const section = row.item;
      const folded = foldedIds.includes(section.id);
      const shut = live ? liveFolded.includes(section.id) : folded;
      const gridId = `guide-grid-${section.id}`;
      const cardRows = mergePlaceholders(section.cards, placeholders?.cards[section.id]);
      // LIVE-02: a section is a row of the order list; its keyboard button stands inside it.
      const order = live ? live.order({ kind: "guide-sections" }, rowIndex, section.title) : null;
      return <section className="guide-section" key={section.id} {...order?.rowProps}>
        {order?.handle}
        {live ? <div className={`guide-section-head${section.photo ? " has-photo" : ""}`}>
          {section.photo && <PortiaImage src={section.photo} alt="" recordId={`${section.id}:band`} priority="lazy" icon="guide" className="guide-section-band is-fill is-quiet" framing={section.photoFraming} />}
          <span className="guide-section-title" id={`${gridId}-title`}>{live.text({ kind: "guide-section-title", sectionId: section.id }, section.title)}</span>
          <button type="button" className="live-fold" aria-expanded={!shut} aria-controls={gridId} aria-labelledby={`${gridId}-title`} onClick={() => setLiveFolded((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])}><span className="guide-section-chevron" aria-hidden="true" /></button>
          {live.remove({ kind: "guide-section", sectionId: section.id }, section.title)}
        </div> : <button type="button" className={`guide-section-head${section.photo ? " has-photo" : ""}`} aria-expanded={!folded} aria-controls={gridId} onClick={() => setFoldedIds((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])}>
          {section.photo && <PortiaImage src={section.photo} alt="" recordId={`${section.id}:band`} priority="lazy" icon="guide" className="guide-section-band is-fill is-quiet" framing={section.photoFraming} />}
          <span className="guide-section-title">{section.title || "Без названия"}</span>
          <span className="guide-section-chevron" aria-hidden="true" />
        </button>}
        {live && <div className="live-section-tools">{live.image({ kind: "guide-section-photo", sectionId: section.id }, { value: section.photo, framing: section.photoFraming })}</div>}
        <div className="guide-grid" id={gridId} hidden={shut}>
          {!cardRows.length && <p className="guide-section-empty">В разделе пока нет карточек</p>}
          {cardRows.map((cardRow, cardIndex) => {
            if (cardRow.kind === "redacted") return <RedactedPlaceholder key={cardRow.slot} variant="tile" level={cardRow.requiredLevel} />;
            const tileOrder = live ? live.order({ kind: "guide-cards", sectionId: section.id }, cardIndex, cardRow.item.title) : null;
            return <GuideTile key={cardRow.item.id} item={cardRow.item} hit={hitId === cardRow.item.id} onOpen={openTile} live={live && tileOrder ? { order: tileOrder, remove: live.remove({ kind: "guide-card", cardId: cardRow.item.id }, cardRow.item.title) } : undefined} />;
          })}
        </div>
        {live && live.addBar({ kind: "guide-section", sectionId: section.id })}
      </section>;
    })}
    {live && live.addBar({ kind: "guide-root" })}
    </>}
  </div>;
}

// Owner 2026-11-18 (round 2): one tile for the section grid and for the block «Карточки». A tile is always 4:3, so a cover keeps the position and zoom
// the editor saved but never the free proportions of its frame (an old frame with its own ratio cropped some covers differently from the rest).
const tileFraming = (framing: ImageFraming | undefined): ImageFraming | undefined => (framing && framing.ratio !== undefined ? { x: framing.x, y: framing.y, zoom: framing.zoom } : framing);

function GuideTile({ item, hit, onOpen, live }: { item: GuideSection["cards"][number]; hit: boolean; onOpen: (id: string) => void; /** LIVE-02: the tile is a row of the order list and has a remove button; absent for a visitor. */ live?: { order: LiveOrder; remove: ReactNode } }) {
  // Owner 2026-11-21, item 23: every tile is one size. A tile with no cover draws the same 16:10 area with the guide icon, the title field is a fixed three lines
  // (the font shrinks first, lib/guide-tile.ts), and the full title is the tile's `title` (React sets it as text, never as markup).
  const tile = <button type="button" className={`guide-tile${hit ? " search-hit" : ""}`} title={item.title || "Без названия"} data-card-id={item.id} data-title-fit={guideTileTitleFit(item.title || "Без названия")} {...(hit ? { "data-search-hit": "true", "aria-current": "true" as const } : {})} onClick={() => onOpen(item.id)}>
    {item.cover
      ? <span className="guide-tile-cover"><PortiaImage src={item.cover} alt="" recordId={`${item.id}:cover`} priority="lazy" icon="guide" className="is-fill is-compact" framing={tileFraming(item.coverFraming)} /></span>
      : <span className="guide-tile-cover is-empty" aria-hidden="true"><PortiaIcon name="guide" className="guide-tile-icon" /></span>}
    <span className="guide-tile-title">{item.title || "Без названия"}</span>
  </button>;
  return live ? <div className="live-tile" {...live.order.rowProps}>{live.order.handle}{tile}{live.remove}</div> : tile;
}

// A short name of a block for the live mode's labels: the text the visitor would see first, if the block has one; never a Russian word.
const blockName = (block: GuideBlock) => (block.type === "heading" ? block.text : block.type === "callout" ? block.label : "").slice(0, 40);

function GuideBlockView({ block, cardId, formattedText, cardTitle, sections, onOpenCard }: { block: GuideBlock; cardId: string; formattedText: PortiaContent["formattedText"]; cardTitle: string; sections: GuideSection[]; onOpenCard: (id: string) => void }) {
  const live = useLiveEdit("guide");
  const richKey = { kind: "guide-block-text", cardId, blockId: block.id } as const;
  if (block.type === "cards") {
    // Only cards this visitor has: a closed or deleted card is left out, and an empty block draws nothing.
    const cards = block.cardIds.map((id) => findGuide(sections, id)?.card).filter((item): item is NonNullable<typeof item> => !!item);
    const grid = cards.length ? <div className="guide-grid guide-nested-cards">{cards.map((item) => <GuideTile key={item.id} item={item} hit={false} onOpen={onOpenCard} />)}</div> : null;
    return live ? <>{grid}{live.cards({ kind: "guide-cards-block", cardId, blockId: block.id }, block.cardIds)}</> : grid;
  }
  if (block.type === "heading") return live ? <h2 className="guide-heading">{live.text({ kind: "guide-heading", cardId, blockId: block.id }, block.text)}</h2> : block.text.trim() ? <h2 className="guide-heading">{block.text}</h2> : null;
  if (block.type === "text") return live ? live.rich(richKey, { text: block.text, document: formattedText[portiaTextKey.guideBlock(block.id)], className: "info-document-copy" }) : <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.guideBlock(block.id)]} />;
  if (block.type === "table") {
    if (live) return <div className="guide-table"><dl className="info-ledger info-classification">{block.rows.map((row) => <div key={row.id}>
      <dt>{live.text({ kind: "guide-table-key", cardId, blockId: block.id, rowId: row.id }, row.key)}</dt>
      <dd>{live.text({ kind: "guide-table-value", cardId, blockId: block.id, rowId: row.id }, row.value)}{live.remove({ kind: "guide-table-row", cardId, blockId: block.id, rowId: row.id }, row.key)}</dd>
    </div>)}</dl>{live.addBar({ kind: "guide-table", cardId, blockId: block.id })}</div>;
    return <div className="guide-table"><dl className="info-ledger info-classification">{block.rows.filter((row) => row.key || row.value).map((row) => <div key={row.id}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl></div>;
  }
  if (block.type === "photo") return block.url || live ? <GuidePhoto block={block} cardId={cardId} /> : null;
  if (block.type === "video") return live ? <>{live.video({ kind: "guide-video-url", cardId, blockId: block.id }, block.videoId)}{block.videoId ? <YoutubeFigure videoId={block.videoId} title={cardTitle || "Без названия"} /> : null}</> : block.videoId ? <YoutubeFigure videoId={block.videoId} title={cardTitle || "Без названия"} /> : null;
  return <aside className="guide-callout">
    {live ? <span className="guide-callout-label">{live.text({ kind: "guide-callout-label", cardId, blockId: block.id }, block.label)}</span> : block.label.trim() && <span className="guide-callout-label">{block.label}</span>}
    {live ? live.rich(richKey, { text: block.text, document: formattedText[portiaTextKey.guideBlock(block.id)], className: "info-document-copy" }) : <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.guideBlock(block.id)]} />}
  </aside>;
}

// A page photo is full width, not a link and has no zoom; a failed image is said so in words by the placeholder, never a broken icon (A11Y-03).
// Owner 2026-11-18: a photo without a chosen position stands on the left (it used to centre itself), and its height is capped in the style sheet (min(45svh, 400px), owner 2026-11-20), so a maximized
// window no longer blows it up. A block framed in «Видимая часть» shows exactly that frame; an older block keeps its height and focus numbers.
function GuidePhoto({ block, cardId }: { block: Extract<GuideBlock, { type: "photo" }>; cardId: string }) {
  const live = useLiveEdit("guide");
  const alignment = block.align ?? "left";
  const framed = !!block.framing;
  const picture = framed ? <PortiaImage src={block.url} alt={block.caption} recordId={block.id} priority="lazy" icon="guide" framing={block.framing} />
    : <PortiaImage src={block.url} alt={block.caption} recordId={block.id} priority="lazy" icon="guide" style={{ height: block.height ? `${block.height}px` : undefined, objectFit: block.height ? "cover" : "contain", objectPosition: `${block.focusX ?? 50}% ${block.focusY ?? 50}%` }} />;
  return <figure className={`info-block-photo guide-photo guide-photo-${alignment}${framed ? " is-framed" : ""}`} style={{ width: `${block.width ?? 100}%`, ...(block.framing?.ratio ? { maxWidth: `min(100%, calc(min(45svh, 400px) * ${block.framing.ratio / 1000}))` } : {}) }}>
    {live ? live.image({ kind: "guide-photo-url", cardId, blockId: block.id }, { value: block.url, framing: block.framing, children: block.url ? picture : null }) : picture}
    {live ? <figcaption>{live.text({ kind: "guide-photo-caption", cardId, blockId: block.id }, block.caption)}</figcaption> : block.caption.trim() && <figcaption>{block.caption}</figcaption>}
  </figure>;
}

// The one YouTube figure for «Информация» and «Справочник»: nocookie embed, id validated by normalizePortiaContent (D-09); default referrer policy, YouTube refuses embeds without a Referer.
export function YoutubeFigure({ videoId, title }: { videoId: string; title: string }) {
  return <figure className="info-block-video"><iframe title={`Видео YouTube: ${title}`} loading="lazy" sandbox={embedSandbox} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" src={`https://www.youtube-nocookie.com/embed/${videoId}`} /><figcaption><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></figcaption></figure>;
}
