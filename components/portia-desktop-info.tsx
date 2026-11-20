"use client";

import { portiaTextKey, type InfoSection, type InfoSubsection, type PortiaContent } from "@/lib/portia-content";
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
    return <div className="content-fade"><span className="eyebrow">{section.title}</span><h1 tabIndex={phone ? -1 : undefined}>{subsection.title || "БЕЗ НАЗВАНИЯ"}</h1><div className="info-blocks">{subsection.blocks.map((block) => block.type === "text"
      ? <FormattedText key={block.id} className="info-document-copy" text={block.text} document={formattedText[portiaTextKey.infoBlock(block.id)]} />
      : block.type === "table"
        ? <dl key={block.id} className="info-ledger info-classification">{block.rows.filter((row) => row.key || row.value).map((row, rowIndex) => <div key={rowIndex}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl>
        : block.type === "video" && block.videoId
          // nocookie embed, id validated by normalizePortiaContent (D-09); default referrer policy, YouTube refuses embeds without a Referer.
          ? <YoutubeFigure key={block.id} videoId={block.videoId} title={subsection.title} />
          : block.type === "photo" && block.url
            ? <figure key={block.id} className="info-block-photo"><PortiaImage src={block.url} alt={`Иллюстрация: ${subsection.title}`} recordId={block.id} priority="lazy" icon="info" framing={block.framing} /></figure>
            : null)}</div>{nextButton}</div>;
  }
  return <div className="content-fade">
    <h1 tabIndex={phone ? -1 : undefined}>{live ? live.text({ kind: "info-section-title", sectionId: section.id }, section.title) : section.title}</h1>
    {live
      ? live.rich({ kind: "info-section-body", sectionId: section.id }, { text: section.body, document: formattedText[portiaTextKey.info(section.id)], className: "info-document-copy" })
      : <FormattedText className="info-document-copy" text={section.body} document={formattedText[portiaTextKey.info(section.id)]} />}
    {nextButton}
  </div>;
}
