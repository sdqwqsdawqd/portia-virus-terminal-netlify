"use client";

import { useState } from "react";
import { preconnect, preload } from "react-dom";
import { classificationOptions, portiaTextKey, type PortiaContent, type RichTextDocument, type ScientistLog, type Virus } from "@/lib/portia-content";
import { classificationIconFor, PortiaIcon } from "@/components/portia-icons";

const roman = (level: number) => ({ 1: "I", 2: "II", 3: "III", 4: "IV" })[level] ?? String(level);

function classificationLevel(key: keyof Virus["classification"], value: string) {
  const options = classificationOptions[key] as readonly { value: string; level?: number }[];
  return options.find((option) => option.value === value)?.level;
}

const knownKlipyMedia: Record<string, string> = {
  "https://klipy.com/gifs/anime-tsundere-6": "https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/e0/d8/GIVgKXMP.gif",
};

function embeddedMediaUrl(value: string) {
  const trimmed = value.trim().replace(/[),.!?;:]+$/, "");
  if (!trimmed.startsWith("https://")) return null;

  if (knownKlipyMedia[trimmed]) return knownKlipyMedia[trimmed];

  try {
    const url = new URL(trimmed);
    if ((url.hostname === "giphy.com" || url.hostname === "www.giphy.com") && url.pathname.startsWith("/gifs/")) {
      const id = url.pathname.split("/").filter(Boolean).at(-1)?.split("-").at(-1);
      return id && /^[a-z0-9]+$/i.test(id) ? `https://media.giphy.com/media/${id}/giphy.gif` : null;
    }
    const isDirectImage = /\.(?:gif|png|jpe?g|webp)(?:$|[?#])/i.test(url.href);
    const isKnownMediaHost = url.hostname === "media.tenor.com"
      || url.hostname === "media.giphy.com"
      || url.hostname === "i.giphy.com"
      || /^(?:static\d*\.)?klipy\.com$/i.test(url.hostname);
    return isDirectImage || isKnownMediaHost ? url.href : null;
  } catch {
    return null;
  }
}

export function prioritizeImage(src: string) {
  if (!src.startsWith("https://")) return;
  try {
    preconnect(new URL(src).origin);
    preload(src, { as: "image", fetchPriority: "high", referrerPolicy: "no-referrer" });
  } catch { /* Normalization rejects malformed URLs before they reach this surface. */ }
}

export function VirusRecord({ virus, formattedText, onOpenLog }: { virus: Virus; formattedText: PortiaContent["formattedText"]; onOpenLog: (id: string) => void }) {
  const classification = [
    ["danger", "Общий уровень опасности", virus.classification.danger, "danger"], ["spread", "Распространение", virus.classification.spread, "spread"], ["escapeRisk", "Угроза и риск побега", virus.classification.escapeRisk, "escape"],
    ["transmission", "Способ распространения", virus.classification.transmission, "transmission"], ["mind", "Разум", virus.classification.mind, "mind"], ["appearance", "Вид / внешность", virus.classification.appearance, "appearance"], ["behavior", "Поведение", virus.classification.behavior, "behavior"],
  ] as const;
  return <div className="record-body content-fade" key={virus.id}>
    <header className="record-header"><div><span className="record-code">{virus.code}</span><h2>{virus.name}</h2></div><div className="record-status"><span />{virus.status}</div></header>
    <div className="record-document">
      <section className="record-hero"><MediaBlock src={virus.infectedImage} alt={`Субъект после заражения вирусом ${virus.name}`} label="Фото после заражения" /><div className="classification-panel"><div className="section-kicker"><span>01</span>КЛАССИФИКАЦИЯ</div><div className="classification-grid">{classification.map(([key, label, value, tone]) => { const level = classificationLevel(key, value); const badge = classificationIconFor(value); return <div className={`class-cell ${tone}${level ? ` level-${level}` : ""}`} key={label}><span>{label}</span><strong>{badge && <PortiaIcon name={badge} className="class-badge" />}{value}</strong>{level && <small>УРОВЕНЬ {level}</small>}</div>; })}</div></div></section>
      <DossierSection index="02" title="ВНЕШНИЕ ХАРАКТЕРИСТИКИ"><FormattedText className="lead-copy" text={virus.external} document={formattedText[portiaTextKey.virus(virus.id, "external")]} /></DossierSection>
      <DossierSection index="03" title="ХАРАКТЕРИСТИКИ С PPU"><div className="metric-grid"><div><span>ЗДОРОВЬЕ</span><FormattedText text={virus.ppu.health} document={formattedText[portiaTextKey.virus(virus.id, "ppu-health")]} /></div><div><span>СКОРОСТЬ</span><FormattedText text={virus.ppu.speed} document={formattedText[portiaTextKey.virus(virus.id, "ppu-speed")]} /></div><div><span>СПОСОБНОСТИ</span><FormattedText text={virus.ppu.abilities} document={formattedText[portiaTextKey.virus(virus.id, "ppu-abilities")]} /></div></div></DossierSection>
      <DossierSection index="04" title="ФИЗИОЛОГИЯ"><FormattedText className="lead-copy" text={virus.physiology} document={formattedText[portiaTextKey.virus(virus.id, "physiology")]} /></DossierSection>
      <DossierSection index="05" title="МУТАЦИИ ВИРУСА"><div className="mutation-grid">{virus.mutations.map((mutation, index) => <section className="mutation-card" key={`${mutation.name}-${index}`}><div className="mutation-index">M-{String(index + 1).padStart(2, "0")}</div><MediaBlock src={mutation.image} alt={mutation.name} label="Скриншот мутации" /><div className="mutation-copy"><h4>{mutation.name}</h4><FormattedText text={mutation.description} document={formattedText[portiaTextKey.mutation(virus.id, index)]} /></div></section>)}</div></DossierSection>
      <DossierSection index="06" title="ЗАПИСИ УЧЁНЫХ"><div className="access-summary"><span>ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА</span><strong>II</strong></div><div className="scientist-log-list">{virus.scientistLogs.map((log, index) => { const isOpen = log.lockedLevel <= 2; return <button className={`scientist-log-row ${isOpen ? "available" : "locked"}`} type="button" key={log.id} onClick={() => onOpenLog(log.id)}><span className="log-number">LOG-{String(index + 1).padStart(2, "0")}</span><span className="log-name"><strong>{log.title}</strong><small>{log.scientist}</small></span><span className="log-clearance"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />УРОВЕНЬ {roman(log.lockedLevel)}</span><span className="log-action">{isOpen ? "ОТКРЫТЬ" : "ЗАБЛОКИРОВАНО"}</span></button>; })}{virus.scientistLogs.length === 0 && <div className="scientist-log-empty">ЗАПИСИ ОТСУТСТВУЮТ</div>}</div></DossierSection>
      <footer className="record-footer"><span>PORTIA / SCIENCE REPORTS</span><span>ЗАПИСЬ {virus.code}</span></footer>
    </div>
  </div>;
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

function documentBackground(hex: string | undefined, opacity: number | undefined) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity ?? 1})`;
}

function ScientistRichText({ log }: { log: ScientistLog }) {
  const document = scientistDocument(log);
  return <FormattedText className="scientist-rich-text" text={log.content.join("\n\n")} document={document} />;
}

export function FormattedText({ text, document, className = "" }: { text?: string; document?: RichTextDocument; className?: string }) {
  const runs = document?.runs?.length ? document.runs : [{ text: text ?? "" }];
  const fullText = runs.map((run) => run.text).join("");
  const runRanges = runs.map((run, index) => {
    const start = runs.slice(0, index).reduce((total, item) => total + item.text.length, 0);
    return { run, start, end: start + run.text.length };
  });
  const nodes: React.ReactNode[] = [];
  const mediaPattern = /https:\/\/[^\s<>"']+/gi;

  const appendStyledText = (start: number, end: number, key: string) => {
    runRanges.forEach(({ run, start: runStart, end: runEnd }, runIndex) => {
      const from = Math.max(start, runStart);
      const to = Math.min(end, runEnd);
      if (from >= to) return;
      nodes.push(<span key={`${key}-${runIndex}-${from}`} style={{
        color: run.style?.color,
        fontSize: run.style?.fontSize ? `${run.style.fontSize}px` : undefined,
        fontWeight: run.style?.fontWeight,
        backgroundColor: documentBackground(run.style?.backgroundColor, run.style?.backgroundOpacity),
      }}>{fullText.slice(from, to)}</span>);
    });
  };

  let cursor = 0;
  Array.from(fullText.matchAll(mediaPattern)).forEach((match, index) => {
    const start = match.index ?? cursor;
    const matchedText = match[0];
    const mediaUrl = embeddedMediaUrl(matchedText);
    if (!mediaUrl) return;
    appendStyledText(cursor, start, `before-media-${index}`);
    nodes.push(<img
      key={`media-${index}-${start}`}
      className="embedded-rich-media"
      src={mediaUrl}
      alt="GIF"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />);
    cursor = start + matchedText.length;
  });
  appendStyledText(cursor, fullText.length, "after-media");

  return <span className={`formatted-content${className ? ` ${className}` : ""}`}>{nodes}</span>;
}

function LoadingMedia({ src, alt, label }: { src: string; alt: string; label: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  prioritizeImage(src);
  // A failed URL shows the «ОЖИДАЕТ ЗАГРУЗКИ» placeholder, never a broken image (D-09 #7).
  if (failed) return <MediaBlock src="" alt={alt} label={label} />;
  return <figure className={`subject-media${loading ? " is-loading" : ""}`}>
    <img src={src} alt={alt} loading="eager" decoding="async" fetchPriority="high" referrerPolicy="no-referrer" onLoad={() => setLoading(false)} onError={() => setFailed(true)} />
    {loading && <LoadingState label="Загрузка изображения…" />}
    <figcaption>{label}</figcaption>
  </figure>;
}

export function DossierSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <section className="dossier-section"><div className="section-kicker"><span>{index}</span>{title}</div>{children}</section>;
}

// Shown while data is on its way. It fades in only after a short wait, so cached data never flashes it.
export function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>{label}</span></div>;
}

export function MediaBlock({ src, alt, label }: { src: string; alt: string; label: string }) {
  if (src) return <LoadingMedia key={src} src={src} alt={alt} label={label} />;
  return <figure className="subject-media media-empty"><img src="/assets/portia-logo.png" alt="" aria-hidden="true" /><div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>{label}</small></div></figure>;
}
