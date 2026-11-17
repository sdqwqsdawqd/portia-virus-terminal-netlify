"use client";

import { type ImageFraming } from "@/lib/image-framing";
import { type PortiaContent, type RichTextDocument, type ScientistLog, type Virus } from "@/lib/portia-content";
import { PortiaIcon } from "@/components/portia-icons";
import { PortiaImage } from "@/components/portia-desktop-media";
import { levelCopy } from "@/lib/level-copy";
import { DossierSection, FormattedText, VirusCardBody } from "@/components/portia-virus-card";

// The card itself lives in portia-virus-card.tsx and is shared with the template builder (D-55); these two names stay importable from here.
export { DossierSection, FormattedText };

// viewerLevel is the level the visitor really has (shownViewerLevel: 5 for the editor). A record is closed only by the server mark `withheld`, never by comparing levels here (D-12).
export function VirusRecord({ virus, formattedText, viewerLevel, onOpenLog }: { virus: Virus; formattedText: PortiaContent["formattedText"]; viewerLevel: number; onOpenLog: (id: string) => void }) {
  const records = <DossierSection index="06" title="ЗАПИСИ УЧЁНЫХ"><div className="access-summary"><span>{levelCopy.currentLevelPlaque}</span><strong>{viewerLevel}</strong></div><div className="scientist-log-list">{virus.scientistLogs.map((log, index) => { const isOpen = !log.withheld; return <button className={`scientist-log-row ${isOpen ? "available" : "locked"}`} type="button" key={log.id} onClick={() => onOpenLog(log.id)}><span className="log-number">LOG-{String(index + 1).padStart(2, "0")}</span><span className="log-name"><strong>{log.title}</strong><small>{log.scientist}</small></span><span className="log-clearance"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />{levelCopy.logLevel(log.lockedLevel)}</span><span className="log-action">{isOpen ? "ОТКРЫТЬ" : "ЗАБЛОКИРОВАНО"}</span></button>; })}</div></DossierSection>;
  return <VirusCardBody
    key={virus.id}
    virus={virus}
    formattedText={formattedText}
    media={(slot) => <MediaBlock src={slot.kind === "infected" ? virus.infectedImage : virus.mutations[slot.index]?.image ?? ""} framing={slot.kind === "infected" ? virus.infectedImageFraming : virus.mutations[slot.index]?.imageFraming} alt={slot.alt} label={slot.label} recordId={slot.recordId} priority={slot.priority} />}
    after={virus.scientistLogs.length > 0 ? records : undefined}
    footer={["PORTIA / SCIENCE REPORTS", <>ЗАПИСЬ {virus.code}</>]}
  />;
}

export function ScientistDocument({ virus, logId, viewerLevel, onBack }: { virus: Virus; logId: string; viewerLevel: number; onBack: () => void }) {
  const log = virus.scientistLogs.find((item) => item.id === logId);
  if (!log) return null;
  const isOpen = !log.withheld;
  const level = log.lockedLevel;
  return <article className="archive-document-view doc-open"><header className="archive-document-bar"><button type="button" onClick={onBack}>ВЕРНУТЬСЯ</button><span>{levelCopy.archivePath(level)}</span></header><div className="archive-document-paper doc-print"><div className="archive-document-stamp"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />{isOpen ? "ДОПУСК РАЗРЕШЁН" : "ДОПУСК ОТКЛОНЁН"}</div><div className="archive-document-code">PORTIA://VIRUS_ARCHIVE/{virus.code}/LOGS/{log.id}</div><h1>{log.title}</h1><dl className="archive-document-meta"><div><dt>ОБЪЕКТ</dt><dd>{virus.name} / {virus.code}</dd></div><div><dt>УЧЁНЫЙ</dt><dd>{log.scientist}</dd></div><div><dt>УРОВЕНЬ</dt><dd>{level}</dd></div></dl>{isOpen ? <section className="archive-document-section"><h2>ТЕКСТ ЗАПИСИ</h2><ScientistRichText log={log} /></section> : <section className="archive-document-section restricted-document"><div className="restriction-mark">ДОСТУП ОГРАНИЧЕН</div><h2>НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОСТУПА</h2><p>{levelCopy.docDenied(viewerLevel, level)}</p><RedactedDocument id={log.id} /></section>}<footer><span>ВНУТРЕННИЙ АРХИВ PORTIA</span><span>ЗАПРЕЩЕНО РАСПРОСТРАНЯТЬ</span></footer></div></article>;
}

function scientistDocument(log: ScientistLog): RichTextDocument {
  if (log.richContent?.runs?.length) return log.richContent;
  return { runs: [{ text: log.content.join("\n\n") }] };
}

// The bars are drawn from the record id alone: a closed record never gets to measure its own text (D-12, UI-SPEC section 3).
function RedactedDocument({ id }: { id: string }) {
  const paragraphs = generatedRedaction(id);

  return <div className="redacted-document" aria-label="Засекреченный текст">
    <div className="redacted-document-meta"><span>ЗАСЕКРЕЧЕННЫЙ ФРАГМЕНТ</span></div>
    <div className="redacted-document-copy" aria-hidden="true">
      {paragraphs.map((segments, paragraphIndex) => <p key={paragraphIndex}>
        {segments.map((visualLength, segmentIndex) => {
          return <i key={`${paragraphIndex}-${segmentIndex}`} style={{ width: `${visualLength}ch` }} />;
        })}
      </p>)}
    </div>
  </div>;
}

function generatedRedaction(id: string) {
  let state = Array.from(id).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const segmentCount = 150 + Math.floor(random() * 151);
  const paragraphs: number[][] = [];
  let remaining = segmentCount;
  while (remaining > 0) {
    const paragraphSize = Math.min(remaining, 18 + Math.floor(random() * 35));
    paragraphs.push(Array.from({ length: paragraphSize }, () => 2.4 + random() * 8.8));
    remaining -= paragraphSize;
  }
  return paragraphs;
}

function ScientistRichText({ log }: { log: ScientistLog }) {
  const document = scientistDocument(log);
  return <FormattedText className="scientist-rich-text" text={log.content.join("\n\n")} document={document} />;
}

function LoadingMedia({ src, alt, label, recordId, priority, framing }: { src: string; alt: string; label: string; recordId: string; priority: "hero" | "lazy"; framing?: ImageFraming }) {
  // A failed, blocked or slow picture becomes the «Изображение недоступно» placeholder of the same size; the label stays readable (STAB-MEDIA-05).
  return <figure className="subject-media">
    <PortiaImage src={src} alt={alt} recordId={recordId} priority={priority} icon="virus" framing={framing} />
    <figcaption>{label}</figcaption>
  </figure>;
}

// Shown while data is on its way. It fades in only after a short wait, so cached data never flashes it.
export function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>{label}</span></div>;
}

// recordId names the record the picture belongs to; priority is "hero" only for the opened dossier's own image.
export function MediaBlock({ src, alt, label, recordId, priority, framing }: { src: string; alt: string; label: string; recordId: string; priority: "hero" | "lazy"; framing?: ImageFraming }) {
  if (src) return <LoadingMedia src={src} alt={alt} label={label} recordId={recordId} priority={priority} framing={framing} />;
  return <figure className="subject-media media-empty"><img src="/assets/portia-logo.png" alt="" aria-hidden="true" /><div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>{label}</small></div></figure>;
}
