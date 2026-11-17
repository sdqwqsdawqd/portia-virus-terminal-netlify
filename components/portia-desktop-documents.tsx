"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { findGuide, portiaTextKey, type GuideBlock, type GuideSection, type PortiaContent, type RedactedSlot } from "@/lib/portia-content";
import { mergePlaceholders } from "@/lib/level-placeholders";
import { levelCopy } from "@/lib/level-copy";
import { RedactedPlaceholder } from "@/components/portia-redacted";
import { PortiaIllustration } from "@/components/portia-icons";
import { emptyCopy, iframeLoadTimeoutMs } from "@/lib/app-state";
import { FormattedText } from "@/components/portia-desktop-dossier";
import { PortiaImage, useVisibleTimeout } from "@/components/portia-desktop-media";
import { AppFatalPanel, AppSkeleton } from "@/components/portia-desktop-states";

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

// Owner 2026-11-18: v3 stores the sections the visitor OPENED. v2 stored the folded ones, so every section created later (and every section after
// the list was trimmed) came up open by itself. Whatever is not in this list is folded.
const guideExpandedStorageKey = "portia-guide-expanded-v3";

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
  const scroller = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLElement>(null);
  // Folded sections live on this device only (D-08): first visit starts with compact section headers only.
  const [expanded, setExpanded] = useState<string[]>([]);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
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
      const stored = window.localStorage.getItem(guideExpandedStorageKey);
      const saved: unknown = stored === null ? null : JSON.parse(stored);
      if (Array.isArray(saved)) ids = saved.filter((id): id is string => typeof id === "string");
    } catch {}
    const restoreTimer = window.setTimeout(() => {
      if (ids) setExpanded(ids);
      setExpandedLoaded(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!expandedLoaded) return;
    try { window.localStorage.setItem(guideExpandedStorageKey, JSON.stringify(expanded.filter((id) => sections.some((section) => section.id === id)))); } catch {}
  }, [expanded, expandedLoaded, sections]);

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

  return <div className="guide-app" ref={scroller} tabIndex={-1}>
    {banner}
    {found && card ? <>
      <div className="guide-back-bar"><button type="button" aria-label={parentCards.length ? "Назад к предыдущей карточке" : "Назад к списку карточек"} onClick={goBack}><span aria-hidden="true">←</span><span className="guide-back-label">Назад</span></button></div>
      <article className="guide-page" tabIndex={-1} ref={page}>
        <span className="eyebrow">{found.section.title || "Без названия"}</span>
        {/* The title carries the mark: a long page centred as a whole would hide its top. */}
        <h1 className={hitId === card.id ? "search-hit" : undefined} {...(hitId === card.id ? { "data-search-hit": "true", "aria-current": "true" as const } : {})}>{card.title || "Без названия"}</h1>
        {!card.blocks.length && <p className="guide-section-empty">В карточке пока нет содержимого</p>}
        <div className="guide-blocks">{card.blocks.map((block) => <GuideBlockView key={block.id} block={block} formattedText={formattedText} cardTitle={card.title} sections={sections} onOpenCard={openNested} />)}</div>
      </article>
    </> : lostLevel !== null ? <>
      <div className="guide-back-bar"><button type="button" aria-label="Назад к списку карточек" onClick={() => { backIntent.current = true; onOpenCard(""); }}><span aria-hidden="true">←</span><span className="guide-back-label">Назад</span></button></div>
      <RedactedPlaceholder variant="block" level={lostLevel} />
    </> : !sectionRows.length ? <div className="guide-empty empty-state"><PortiaIllustration name="microscopeGuide" /><strong>{emptyCopy.guide.heading}</strong><span>{emptyCopy.guide.body}</span></div>
    : <>
    {!sections.length && <div className="guide-empty empty-state"><PortiaIllustration name="microscopeGuide" /><strong>{levelCopy.sectionsNoOpen.heading}</strong><span>{levelCopy.sectionsNoOpen.body}</span></div>}
    {sectionRows.map((row) => {
      // D-10: a closed section is one bar in its place: no button, no photo, no chevron, no grid.
      if (row.kind === "redacted") return <section className="guide-section" key={row.slot}><RedactedPlaceholder variant="bar" level={row.requiredLevel} /></section>;
      const section = row.item;
      const folded = !expanded.includes(section.id);
      const gridId = `guide-grid-${section.id}`;
      const cardRows = mergePlaceholders(section.cards, placeholders?.cards[section.id]);
      return <section className="guide-section" key={section.id}>
        <button type="button" className={`guide-section-head${section.photo ? " has-photo" : ""}`} aria-expanded={!folded} aria-controls={gridId} onClick={() => setExpanded((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])}>
          {section.photo && <PortiaImage src={section.photo} alt="" recordId={`${section.id}:band`} priority="lazy" icon="guide" className="guide-section-band is-fill is-quiet" framing={section.photoFraming} />}
          <span className="guide-section-title">{section.title || "Без названия"}</span>
          <span className="guide-section-chevron" aria-hidden="true" />
        </button>
        <div className="guide-grid" id={gridId} hidden={folded}>
          {!cardRows.length && <p className="guide-section-empty">В разделе пока нет карточек</p>}
          {cardRows.map((cardRow) => {
            if (cardRow.kind === "redacted") return <RedactedPlaceholder key={cardRow.slot} variant="tile" level={cardRow.requiredLevel} />;
            const item = cardRow.item;
            return <button key={item.id} type="button" className={`guide-tile${item.cover ? "" : " guide-tile-thin"}${hitId === item.id ? " search-hit" : ""}`} data-card-id={item.id} {...(hitId === item.id ? { "data-search-hit": "true", "aria-current": "true" as const } : {})} onClick={() => openTile(item.id)}>
            {item.cover && <span className="guide-tile-cover"><PortiaImage src={item.cover} alt="" recordId={`${item.id}:cover`} priority="lazy" icon="guide" className="is-fill is-compact" framing={item.coverFraming} /></span>}
            <span className="guide-tile-title">{item.title || "Без названия"}</span>
          </button>;
          })}
        </div>
      </section>;
    })}
    </>}
  </div>;
}

function GuideBlockView({ block, formattedText, cardTitle, sections, onOpenCard }: { block: GuideBlock; formattedText: PortiaContent["formattedText"]; cardTitle: string; sections: GuideSection[]; onOpenCard: (id: string) => void }) {
  if (block.type === "cards") {
    // Only cards this visitor has: a closed or deleted card is left out, and an empty block draws nothing.
    const cards = block.cardIds.map((id) => findGuide(sections, id)?.card).filter((item): item is NonNullable<typeof item> => !!item);
    return cards.length ? <div className="guide-grid guide-nested-cards">{cards.map((item) => <button key={item.id} type="button" className={`guide-tile${item.cover ? "" : " guide-tile-thin"}`} data-card-id={item.id} onClick={() => onOpenCard(item.id)}>
      {item.cover && <span className="guide-tile-cover"><PortiaImage src={item.cover} alt="" recordId={`${item.id}:cover`} priority="lazy" icon="guide" className="is-fill is-compact" framing={item.coverFraming} /></span>}
      <span className="guide-tile-title">{item.title || "Без названия"}</span>
    </button>)}</div> : null;
  }
  if (block.type === "heading") return block.text.trim() ? <h2 className="guide-heading">{block.text}</h2> : null;
  if (block.type === "text") return <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.guideBlock(block.id)]} />;
  if (block.type === "table") return <div className="guide-table"><dl className="info-ledger info-classification">{block.rows.filter((row) => row.key || row.value).map((row) => <div key={row.id}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl></div>;
  if (block.type === "photo") return block.url ? <GuidePhoto block={block} /> : null;
  if (block.type === "video") return block.videoId ? <YoutubeFigure videoId={block.videoId} title={cardTitle || "Без названия"} /> : null;
  return <aside className="guide-callout">
    {block.label.trim() && <span className="guide-callout-label">{block.label}</span>}
    <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.guideBlock(block.id)]} />
  </aside>;
}

// A page photo is full width, not a link and has no zoom; a failed image is said so in words by the placeholder, never a broken icon (A11Y-03).
// Owner 2026-11-18: a photo without a chosen position stands on the left (it used to centre itself), and its size is capped in the style sheet, so a maximized
// window no longer blows it up to the whole width. A block framed in «Видимая часть» shows exactly that frame; an older block keeps its height and focus numbers.
function GuidePhoto({ block }: { block: Extract<GuideBlock, { type: "photo" }> }) {
  const alignment = block.align ?? "left";
  const framed = !!block.framing;
  return <figure className={`info-block-photo guide-photo guide-photo-${alignment}${framed ? " is-framed" : ""}`} style={{ width: `${block.width ?? 100}%`, ...(block.framing?.ratio ? { maxWidth: `min(100%, 820px, calc(min(70svh, 620px) * ${block.framing.ratio / 1000}))` } : {}) }}>
    {framed ? <PortiaImage src={block.url} alt={block.caption} recordId={block.id} priority="lazy" icon="guide" framing={block.framing} />
      : <PortiaImage src={block.url} alt={block.caption} recordId={block.id} priority="lazy" icon="guide" style={{ height: block.height ? `${block.height}px` : undefined, objectFit: block.height ? "cover" : "contain", objectPosition: `${block.focusX ?? 50}% ${block.focusY ?? 50}%` }} />}
    {block.caption.trim() && <figcaption>{block.caption}</figcaption>}
  </figure>;
}

// The one YouTube figure for «Информация» and «Справочник»: nocookie embed, id validated by normalizePortiaContent (D-09); default referrer policy, YouTube refuses embeds without a Referer.
export function YoutubeFigure({ videoId, title }: { videoId: string; title: string }) {
  return <figure className="info-block-video"><iframe title={`Видео YouTube: ${title}`} loading="lazy" sandbox={embedSandbox} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" src={`https://www.youtube-nocookie.com/embed/${videoId}`} /><figcaption><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></figcaption></figure>;
}
