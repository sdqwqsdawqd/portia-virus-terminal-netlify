"use client";

import { portiaTextKey, type InfoBlock, type InfoSection, type InfoSubsection, type PortiaContent } from "@/lib/portia-content";
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
