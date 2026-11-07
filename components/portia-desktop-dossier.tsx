"use client";

import { type PortiaContent, type RichTextDocument, type ScientistLog, type Virus } from "@/lib/portia-content";
import { PortiaIcon } from "@/components/portia-icons";
import { PortiaImage } from "@/components/portia-desktop-media";
import { DossierSection, FormattedText, VirusCardBody } from "@/components/portia-virus-card";

// The card itself lives in portia-virus-card.tsx and is shared with the template builder (D-55); these two names stay importable from here.
export { DossierSection, FormattedText };

const roman = (level: number) => ({ 1: "I", 2: "II", 3: "III", 4: "IV" })[level] ?? String(level);

export function VirusRecord({ virus, formattedText, onOpenLog }: { virus: Virus; formattedText: PortiaContent["formattedText"]; onOpenLog: (id: string) => void }) {
  const records = <DossierSection index="06" title="ЗАПИСИ УЧЁНЫХ"><div className="access-summary"><span>ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА</span><strong>II</strong></div><div className="scientist-log-list">{virus.scientistLogs.map((log, index) => { const isOpen = log.lockedLevel <= 2; return <button className={`scientist-log-row ${isOpen ? "available" : "locked"}`} type="button" key={log.id} onClick={() => onOpenLog(log.id)}><span className="log-number">LOG-{String(index + 1).padStart(2, "0")}</span><span className="log-name"><strong>{log.title}</strong><small>{log.scientist}</small></span><span className="log-clearance"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />УРОВЕНЬ {roman(log.lockedLevel)}</span><span className="log-action">{isOpen ? "ОТКРЫТЬ" : "ЗАБЛОКИРОВАНО"}</span></button>; })}{virus.scientistLogs.length === 0 && <div className="scientist-log-empty">ЗАПИСИ ОТСУТСТВУЮТ</div>}</div></DossierSection>;
  return <VirusCardBody
    key={virus.id}
    virus={virus}
    formattedText={formattedText}
    media={(slot) => <MediaBlock src={slot.kind === "infected" ? virus.infectedImage : virus.mutations[slot.index]?.image ?? ""} alt={slot.alt} label={slot.label} recordId={slot.recordId} priority={slot.priority} />}
    after={records}
    footer={["PORTIA / SCIENCE REPORTS", <>ЗАПИСЬ {virus.code}</>]}
  />;
}

export function ScientistDocument({ virus, logId, onBack }: { virus: Virus; logId: string; onBack: () => void }) {
  const log = virus.scientistLogs.find((item) => item.id === logId);
  if (!log) return null;
  const isOpen = log.lockedLevel <= 2;
  const level = log.lockedLevel;
  return <article className="archive-document-view doc-open"><header className="archive-document-bar"><button type="button" onClick={onBack}>ВЕРНУТЬСЯ</button><span>PORTIA / АРХИВ / УРОВЕНЬ {roman(level)}</span></header><div className="archive-document-paper doc-print"><div className="archive-document-stamp"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />{isOpen ? "ДОПУСК РАЗРЕШЁН" : "ДОПУСК ОТКЛОНЁН"}</div><div className="archive-document-code">PORTIA://VIRUS_ARCHIVE/{virus.code}/LOGS/{log.id}</div><h1>{log.title}</h1><dl className="archive-document-meta"><div><dt>ОБЪЕКТ</dt><dd>{virus.name} / {virus.code}</dd></div><div><dt>УЧЁНЫЙ</dt><dd>{log.scientist}</dd></div><div><dt>УРОВЕНЬ</dt><dd>{roman(level)}</dd></div></dl>{isOpen ? <section className="archive-document-section"><h2>ТЕКСТ ЗАПИСИ</h2><ScientistRichText log={log} /></section> : <section className="archive-document-section restricted-document"><div className="restriction-mark">ДОСТУП ОГРАНИЧЕН</div><h2>НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОСТУПА</h2><p>Текущий уровень: II. Для чтения этого документа требуется уровень {roman(level)}.</p><RedactedDocument log={log} /></section>}<footer><span>ВНУТРЕННИЙ АРХИВ PORTIA</span><span>ЗАПРЕЩЕНО РАСПРОСТРАНЯТЬ</span></footer></div></article>;
}

function scientistDocument(log: ScientistLog): RichTextDocument {
  if (log.richContent?.runs?.length) return log.richContent;
  return { runs: [{ text: log.content.join("\n\n") }] };
}

function RedactedDocument({ log }: { log: ScientistLog }) {
  const plainText = scientistDocument(log).runs.map((run) => run.text).join("");
  const actualParagraphs = plainText.split(/\n+/).map((paragraph) => paragraph.trim().split(/\s+/).filter(Boolean)).filter((words) => words.length > 0);
  const paragraphs = actualParagraphs.length > 0
    ? actualParagraphs.map((words) => words.map((word) => Math.max(2.4, Math.min(12, Array.from(word).length * .72 + .8))))
    : generatedRedaction(log.id);

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

function LoadingMedia({ src, alt, label, recordId, priority }: { src: string; alt: string; label: string; recordId: string; priority: "hero" | "lazy" }) {
  // A failed, blocked or slow picture becomes the «Изображение недоступно» placeholder of the same size; the label stays readable (STAB-MEDIA-05).
  return <figure className="subject-media">
    <PortiaImage src={src} alt={alt} recordId={recordId} priority={priority} icon="virus" />
    <figcaption>{label}</figcaption>
  </figure>;
}

// Shown while data is on its way. It fades in only after a short wait, so cached data never flashes it.
export function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>{label}</span></div>;
}

// recordId names the record the picture belongs to; priority is "hero" only for the opened dossier's own image.
export function MediaBlock({ src, alt, label, recordId, priority }: { src: string; alt: string; label: string; recordId: string; priority: "hero" | "lazy" }) {
  if (src) return <LoadingMedia src={src} alt={alt} label={label} recordId={recordId} priority={priority} />;
  return <figure className="subject-media media-empty"><img src="/assets/portia-logo.png" alt="" aria-hidden="true" /><div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>{label}</small></div></figure>;
}
