"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { findGuide, portiaTextKey, type GuideBlock, type GuideSection, type PortiaContent } from "@/lib/portia-content";
import { PortiaIllustration } from "@/components/portia-icons";
import { emptyCopy } from "@/lib/app-state";
import { FormattedText, LoadingState } from "@/components/portia-desktop-dossier";

// D-19: one permission set for every third-party frame. Scripts and same-origin let the viewers run, popups escape the sandbox so links open as normal tabs;
// no top-navigation flag, so a frame can never move the PORTIA tab. If a device needs more, add only that one flag.
const embedSandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

const zoomSteps = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
// D-21: Ctrl zooms everywhere and Cmd on a Mac; the Windows key never does (trackpad pinch arrives as ctrlKey).
const zoomModifier = (event: { ctrlKey: boolean; metaKey: boolean }) => event.ctrlKey || (event.metaKey && /^(Mac|iPhone|iPad|iPod)/.test(navigator.platform));

export function EmbeddedDocument({ src, external, title }: { src: string; external: string; title: string }) {
  const [zoom, setZoom] = useState(1);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [frameLoading, setFrameLoading] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
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

  return <div className="document-app" ref={frameRef}>
    <div className="document-app-viewport">
      <iframe src={src} title={title} loading="lazy" sandbox={embedSandbox} referrerPolicy="no-referrer" onLoad={() => setFrameLoading(false)} style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})` }} />
      {frameLoading && <LoadingState label="Загрузка документа…" />}
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

// v2 starts every section folded; v1 stored the former open-by-default behaviour.
const guideCollapsedStorageKey = "portia-guide-collapsed-v2";

// «Справочник»: the grid and the card page are one derived view of openCardId; a card that vanished simply means the grid (D-00d).
export function GuideApp({ sections, formattedText, openCardId, onOpenCard, banner }: {
  sections: GuideSection[];
  formattedText: PortiaContent["formattedText"];
  openCardId: string;
  onOpenCard: (id: string) => void;
  banner?: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLElement>(null);
  // Folded sections live on this device only (D-08): first visit starts with compact section headers only.
  const [collapsed, setCollapsed] = useState<string[]>(() => sections.map((section) => section.id));
  const [collapsedLoaded, setCollapsedLoaded] = useState(false);
  const returnTo = useRef<{ cardId: string; scrollTop: number; sections: string } | null>(null);
  const backIntent = useRef(false);
  const lastShown = useRef("");
  const found = findGuide(sections, openCardId);
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
      const stored = window.localStorage.getItem(guideCollapsedStorageKey);
      const saved: unknown = stored === null ? null : JSON.parse(stored);
      if (Array.isArray(saved)) ids = saved.filter((id): id is string => typeof id === "string");
    } catch {}
    const restoreTimer = window.setTimeout(() => {
      if (ids) setCollapsed(ids);
      setCollapsedLoaded(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!collapsedLoaded) return;
    try { window.localStorage.setItem(guideCollapsedStorageKey, JSON.stringify(collapsed.filter((id) => sections.some((section) => section.id === id)))); } catch {}
  }, [collapsed, collapsedLoaded, sections]);

  const openTile = (cardId: string) => {
    returnTo.current = { cardId, scrollTop: scroller.current?.scrollTop ?? 0, sections: JSON.stringify(sections) };
    onOpenCard(cardId);
  };

  return <div className="guide-app" ref={scroller} tabIndex={-1}>
    {banner}
    {found && card ? <>
      <div className="guide-back-bar"><button type="button" aria-label="Назад к списку карточек" onClick={() => { backIntent.current = true; onOpenCard(""); }}><span aria-hidden="true">←</span><span className="guide-back-label">Назад</span></button></div>
      <article className="guide-page" tabIndex={-1} ref={page}>
        <span className="eyebrow">{found.section.title || "Без названия"}</span>
        <h1>{card.title || "Без названия"}</h1>
        {!card.blocks.length && <p className="guide-section-empty">В карточке пока нет содержимого</p>}
        <div className="guide-blocks">{card.blocks.map((block) => <GuideBlockView key={block.id} block={block} formattedText={formattedText} cardTitle={card.title} />)}</div>
      </article>
    </> : !sections.length ? <div className="guide-empty empty-state"><PortiaIllustration name="microscope" /><strong>{emptyCopy.guide.heading}</strong><span>{emptyCopy.guide.body}</span></div>
    : sections.map((section) => {
      const folded = collapsed.includes(section.id);
      const gridId = `guide-grid-${section.id}`;
      return <section className="guide-section" key={section.id}>
        <button type="button" className={`guide-section-head${section.photo ? " has-photo" : ""}`} aria-expanded={!folded} aria-controls={gridId} onClick={() => setCollapsed((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])}>
          {section.photo && <img className="guide-section-band" src={section.photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
          <span className="guide-section-title">{section.title || "Без названия"}</span>
          <span className="guide-section-chevron" aria-hidden="true" />
        </button>
        <div className="guide-grid" id={gridId} hidden={folded}>
          {!section.cards.length && <p className="guide-section-empty">В разделе пока нет карточек</p>}
          {section.cards.map((item) => <button key={item.id} type="button" className={`guide-tile${item.cover ? "" : " guide-tile-thin"}`} data-card-id={item.id} onClick={() => openTile(item.id)}>
            {item.cover && <span className="guide-tile-cover"><img src={item.cover} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} /></span>}
            <span className="guide-tile-title">{item.title || "Без названия"}</span>
          </button>)}
        </div>
      </section>;
    })}
  </div>;
}

function GuideBlockView({ block, formattedText, cardTitle }: { block: GuideBlock; formattedText: PortiaContent["formattedText"]; cardTitle: string }) {
  if (block.type === "heading") return block.text.trim() ? <h2 className="guide-heading">{block.text}</h2> : null;
  if (block.type === "text") return <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.guideBlock(block.id)]} />;
  if (block.type === "table") return <div className="guide-table"><dl className="info-ledger info-classification">{block.rows.filter((row) => row.key || row.value).map((row) => <div key={row.id}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl></div>;
  if (block.type === "photo") return block.url ? <GuidePhoto key={block.url} url={block.url} caption={block.caption} /> : null;
  if (block.type === "video") return block.videoId ? <YoutubeFigure videoId={block.videoId} title={cardTitle || "Без названия"} /> : null;
  return <aside className="guide-callout">
    {block.label.trim() && <span className="guide-callout-label">{block.label}</span>}
    <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.guideBlock(block.id)]} />
  </aside>;
}

// A page photo is full width, not a link and has no zoom; a failed image is said so in words, never a broken icon (A11Y-03).
function GuidePhoto({ url, caption }: { url: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  return <figure className="info-block-photo guide-photo">
    {failed
      ? <p className="guide-photo-error">Фото не загрузилось</p>
      : <img src={url} alt={caption} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    {caption.trim() && <figcaption>{caption}</figcaption>}
  </figure>;
}

// The one YouTube figure for «Информация» and «Справочник»: nocookie embed, id validated by normalizePortiaContent (D-09); default referrer policy, YouTube refuses embeds without a Referer.
export function YoutubeFigure({ videoId, title }: { videoId: string; title: string }) {
  return <figure className="info-block-video"><iframe title={`Видео YouTube: ${title}`} loading="lazy" sandbox={embedSandbox} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" src={`https://www.youtube-nocookie.com/embed/${videoId}`} /><figcaption><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></figcaption></figure>;
}
