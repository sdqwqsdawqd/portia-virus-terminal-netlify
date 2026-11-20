"use client";

import { portiaTextKey, type Broadcast, type InfoBlock, type InfoSection, type InfoSubsection, type PortiaContent } from "@/lib/portia-content";
import { formatQuestDay, questState } from "@/lib/broadcasts";
import { broadcastType } from "@/lib/search-index";
import type { InfoNextTarget } from "@/lib/info-phone-nav";
import { FormattedText } from "@/components/portia-desktop-dossier";
import { YoutubeFigure } from "@/components/portia-desktop-documents";
import { PortiaImage } from "@/components/portia-desktop-media";
import { useLiveEdit } from "@/components/portia-live-edit";

// The visitor's view of «Информация» (the article) as one component, shared by the desktop window and the editor's live mode (LIVE-02, 26.1-11).
// The desktop draws it with no context and gets the markup it always had; the editor's live mode draws the same component inside the provider of the live tools,
// and the places that can be edited in place (LIVE-04) ask `useLiveEdit("info")`. The table of contents, the closed-level blocks and the phone bar stay with the window.

/** The article of a section (no subsection) or of a subsection. The caller keys it by the id it shows, so a new article fades in. */
export function InfoArticle({ section, subsection, formattedText, phone, next, onNext }: {
  section: InfoSection;
  subsection: InfoSubsection | null;
  formattedText: PortiaContent["formattedText"];
  /** The phone layout: the title takes focus programmatically when «Далее» moves the page. */
  phone: boolean;
  next: InfoNextTarget | null;
  onNext: (target: InfoNextTarget) => void;
}) {
  const live = useLiveEdit("info");
  const nextButton = next && <div className="info-next"><button type="button" onClick={() => onNext(next)}>Далее: {next.title}</button></div>;
  if (subsection) {
    return <div className="content-fade">
      <span className="eyebrow">{section.title}</span>
      <h1 tabIndex={phone ? -1 : undefined}>{live ? live.text({ kind: "info-subsection-title", subsectionId: subsection.id }, subsection.title) : subsection.title || "БЕЗ НАЗВАНИЯ"}</h1>
      <div className="info-blocks">{subsection.blocks.map((block, blockIndex) => {
        const view = <InfoBlockView key={block.id} block={block} subsection={subsection} formattedText={formattedText} />;
        if (!live) return view;
        // LIVE-02: a block is a row of the order list; its keyboard button and its remove stand inside it.
        const order = live.order({ kind: "info-blocks", subsectionId: subsection.id }, blockIndex, "");
        return <div className="live-block" key={block.id} {...order.rowProps}>{order.handle}{view}{live.remove({ kind: "info-block", subsectionId: subsection.id, blockId: block.id }, "")}</div>;
      })}</div>
      {live && live.addBar({ kind: "info-subsection", subsectionId: subsection.id })}
      {nextButton}
    </div>;
  }
  return <div className="content-fade">
    <h1 tabIndex={phone ? -1 : undefined}>{live ? live.text({ kind: "info-section-title", sectionId: section.id }, section.title) : section.title}</h1>
    {live
      ? live.rich({ kind: "info-section-body", sectionId: section.id }, { text: section.body, document: formattedText[portiaTextKey.info(section.id)], className: "info-document-copy" })
      : <FormattedText className="info-document-copy" text={section.body} document={formattedText[portiaTextKey.info(section.id)]} />}
    {nextButton}
  </div>;
}

// One block of a subsection. A visitor sees the empty ones left out (a table row with nothing in it, a video without a link, a photo without an address); the live mode shows every place so it can be filled.
function InfoBlockView({ block, subsection, formattedText }: { block: InfoBlock; subsection: InfoSubsection; formattedText: PortiaContent["formattedText"] }) {
  const live = useLiveEdit("info");
  if (block.type === "text") {
    return live
      ? live.rich({ kind: "info-block-text", subsectionId: subsection.id, blockId: block.id }, { text: block.text, document: formattedText[portiaTextKey.infoBlock(block.id)], className: "info-document-copy" })
      : <FormattedText className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.infoBlock(block.id)]} />;
  }
  if (block.type === "table") {
    if (live) {
      return <div className="live-table"><dl className="info-ledger info-classification">{block.rows.map((row) => <div key={row.id}>
        <dt>{live.text({ kind: "info-table-key", subsectionId: subsection.id, blockId: block.id, rowId: row.id }, row.key)}</dt>
        <dd>{live.text({ kind: "info-table-value", subsectionId: subsection.id, blockId: block.id, rowId: row.id }, row.value)}{live.remove({ kind: "info-table-row", subsectionId: subsection.id, blockId: block.id, rowId: row.id }, row.key)}</dd>
      </div>)}</dl>{live.addBar({ kind: "info-table", subsectionId: subsection.id, blockId: block.id })}</div>;
    }
    return <dl className="info-ledger info-classification">{block.rows.filter((row) => row.key || row.value).map((row, rowIndex) => <div key={rowIndex}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl>;
  }
  if (block.type === "video") {
    // nocookie embed, id validated by normalizePortiaContent (D-09); default referrer policy, YouTube refuses embeds without a Referer.
    const figure = block.videoId ? <YoutubeFigure videoId={block.videoId} title={subsection.title} /> : null;
    return live ? <>{live.video({ kind: "info-video-url", subsectionId: subsection.id, blockId: block.id }, block.videoId)}{figure}</> : figure;
  }
  // The picture is the visitor's PortiaImage in both views, so a GIF plays in the live mode as it does for a visitor (LIVE-05); the live mode only adds the way to change it.
  const picture = block.url ? <PortiaImage src={block.url} alt={`Иллюстрация: ${subsection.title}`} recordId={block.id} priority="lazy" icon="info" framing={block.framing} /> : null;
  if (live) return <figure className="info-block-photo">{live.image({ kind: "info-photo-url", subsectionId: subsection.id, blockId: block.id }, { value: block.url, framing: block.framing, children: picture })}</figure>;
  return picture ? <figure className="info-block-photo">{picture}</figure> : null;
}

/** The header of «Сводки», the same for the window and the live mode. */
export function BroadcastsHeader() {
  return <header><h1>Объявления</h1><p>Еженедельные квесты, задачи и новости.</p></header>;
}

/** The two tabs of the feed: the id the window keeps and the visitor's word for it. */
export const broadcastTabs = [["news", "Новости"], ["quests", "Квесты"]] as const;

/**
 * One card of the feed of «Сводки»: the type and the state of a quest, the title, the dates and conditions of a quest, the text.
 * The window draws it as it always did; the editor's live mode draws it inside the provider and puts the places of the entry in place (LIVE-02):
 * the title, the dates, the conditions and the text are edited in the card, «Показывать посетителям» and «Важно» are switches in it, and a card not yet shown to visitors says so.
 */
export function BroadcastCard({ item, today, formattedText, hit = false }: {
  item: Broadcast;
  /** The visitor's local day (YYYY-MM-DD): the state of a quest comes from it. */
  today: string;
  formattedText: PortiaContent["formattedText"];
  /** The card a search result named: marked, as the window marks a hit. */
  hit?: boolean;
}) {
  const live = useLiveEdit("broadcasts");
  const state = item.type === "quest" ? questState(item, today) : null;
  // D-19: a quest or task never shows ВАЖНО, whatever the stored data says.
  const important = item.type === "news" && item.important;
  const badge = state === "active" ? "АКТИВЕН" : state === "upcoming" ? `СКОРО · с ${formatQuestDay(item.startsAt).slice(0, 5)}` : "ЗАВЕРШЁН";
  return <article className={`broadcast-card ${item.type}${important ? " important" : ""}${state ? ` state-${state}` : ""}${hit ? " search-hit" : ""}${live && !item.published ? " live-draft" : ""}`} {...(hit ? { "data-search-hit": "true", "aria-current": "true" as const } : {})}>
    <span>{broadcastType(item.type)}{important ? " · ВАЖНО" : ""}</span>
    {state && <em className="quest-badge">{badge}</em>}
    <h2>{live ? live.text({ kind: "broadcast-title", broadcastId: item.id }, item.title) : item.title || "БЕЗ НАЗВАНИЯ"}</h2>
    {live
      ? item.type === "quest" && <div className="broadcast-dates">{live.date({ kind: "broadcast-starts", broadcastId: item.id }, item.startsAt)}{live.date({ kind: "broadcast-ends", broadcastId: item.id }, item.endsAt)}</div>
      : item.type === "quest" && (item.startsAt || item.endsAt) && <div className="broadcast-dates">{item.startsAt && <span>Начало: {formatQuestDay(item.startsAt)}</span>}{item.endsAt && <span>Окончание: {formatQuestDay(item.endsAt)}</span>}</div>}
    {live
      ? item.type === "quest" && <div className="broadcast-conditions"><b>УСЛОВИЯ</b>{live.text({ kind: "broadcast-conditions", broadcastId: item.id }, item.conditions, { multiline: true })}</div>
      : item.type === "quest" && item.conditions && <div className="broadcast-conditions"><b>УСЛОВИЯ</b><p>{item.conditions}</p></div>}
    {live
      ? live.rich({ kind: "broadcast-body", broadcastId: item.id }, { text: item.body, document: formattedText[portiaTextKey.broadcast(item.id)], className: "broadcast-card-copy" })
      : <FormattedText className="broadcast-card-copy" text={item.body} document={formattedText[portiaTextKey.broadcast(item.id)]} />}
    {live && <div className="live-card-tools">
      {live.flag({ kind: "broadcast-published", broadcastId: item.id }, item.published)}
      {item.type === "news" && live.flag({ kind: "broadcast-important", broadcastId: item.id }, item.important)}
      {live.remove({ kind: "broadcast", broadcastId: item.id }, item.title)}
    </div>}
  </article>;
}
