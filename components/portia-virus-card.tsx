"use client";

import { useState, type ReactNode } from "react";
import { classificationOptions, portiaTextKey, type PortiaContent, type RichTextDocument, type Virus } from "@/lib/portia-content";
import { classificationIconFor, PortiaIcon } from "@/components/portia-icons";
import { splitEmbeddedMedia } from "@/lib/rich-text-media";

/**
 * The virus card of the archive (header, classification, sections 01-05, footer), drawn once for two places: the public dossier
 * (`VirusRecord` in portia-desktop-dossier.tsx) and the preview of the template builder (D-55). It imports nothing from the desktop,
 * the editor, the network or storage; pictures arrive through the `media` property, so the card itself never loads one.
 */

export function classificationLevel(key: keyof Virus["classification"], value: string) {
  const options = classificationOptions[key] as readonly { value: string; level?: number }[];
  return options.find((option) => option.value === value)?.level;
}

// An inline image that fails to load is replaced by a short Russian note instead of the browser's broken-image icon (D-07).
function EmbeddedImage({ src, eager = false }: { src: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="embedded-rich-media-unavailable">Изображение недоступно</span>;
  return <img
    className="embedded-rich-media"
    src={src}
    alt="Анимированное изображение"
    loading={eager ? "eager" : "lazy"}
    decoding="async"
    referrerPolicy="no-referrer"
    onError={() => setFailed(true)}
  />;
}

function documentBackground(hex: string | undefined, opacity: number | undefined) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity ?? 1})`;
}

/**
 * `embedMedia` (default true) turns a link to a picture or GIF into the picture; with false every link stays plain text and the browser
 * loads no outside address (the template builder, T-20-87). `emptyText` (default none) is shown instead of an empty field.
 */
export function FormattedText({ text, document, className = "", trimLeadingBlankLines = false, eagerMedia = false, embedMedia = true, emptyText }: { text?: string; document?: RichTextDocument; className?: string; trimLeadingBlankLines?: boolean; eagerMedia?: boolean; embedMedia?: boolean; emptyText?: string }) {
  const runs = document?.runs?.length ? document.runs : [{ text: text ?? "" }];
  const fullText = runs.map((run) => run.text).join("");
  const contentStart = trimLeadingBlankLines ? (fullText.match(/^(?:[ \t]*\r?\n)+/)?.[0].length ?? 0) : 0;
  const runRanges = runs.map((run, index) => {
    const start = runs.slice(0, index).reduce((total, item) => total + item.text.length, 0);
    return { run, start, end: start + run.text.length };
  });
  const nodes: ReactNode[] = [];

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

  if (emptyText !== undefined && fullText.trim() === "") {
    return <span className={`formatted-content${className ? ` ${className}` : ""}`}><em className="formatted-empty">{emptyText}</em></span>;
  }

  const segments = embedMedia ? splitEmbeddedMedia(fullText) : [{ kind: "text" as const, start: 0, end: fullText.length }];
  segments.forEach((segment, index) => {
    if (segment.kind === "text") appendStyledText(Math.max(segment.start, contentStart), segment.end, `text-${index}`);
    else nodes.push(<EmbeddedImage key={`media-${index}-${segment.start}`} src={segment.url} eager={eagerMedia} />);
  });

  return <span className={`formatted-content${className ? ` ${className}` : ""}`}>{nodes}</span>;
}

export function DossierSection({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return <section className="dossier-section"><div className="section-kicker"><span>{index}</span>{title}</div>{children}</section>;
}

/** What the card asks its owner to draw for a picture place: the photo after infection or the screenshot of one mutation. */
export type VirusCardSlot =
  | { kind: "infected"; alt: string; label: string; recordId: string; priority: "hero" }
  | { kind: "mutation"; index: number; alt: string; label: string; recordId: string; priority: "lazy" };

export type VirusCardBodyProps = {
  virus: Virus;
  formattedText: PortiaContent["formattedText"];
  /** Draws one picture place. The card has no picture source of its own. */
  media: (slot: VirusCardSlot) => ReactNode;
  /** false keeps links to pictures in the text as plain text. */
  embedMedia?: boolean;
  /** Shown in place of an empty field, an empty classification value and the absence of mutations. */
  emptyText?: string;
  /** A node after section 05 and before the footer (the public card puts the scientist records there). */
  after?: ReactNode;
  /** The two lines of the footer. */
  footer: readonly [ReactNode, ReactNode];
};

export function VirusCardBody({ virus, formattedText, media, embedMedia = true, emptyText, after, footer }: VirusCardBodyProps) {
  const classification = [
    ["danger", "Общий уровень опасности", virus.classification.danger, "danger"], ["spread", "Распространение", virus.classification.spread, "spread"], ["escapeRisk", "Угроза и риск побега", virus.classification.escapeRisk, "escape"],
    ["transmission", "Способ распространения", virus.classification.transmission, "transmission"], ["mind", "Разум", virus.classification.mind, "mind"], ["appearance", "Вид / внешность", virus.classification.appearance, "appearance"], ["behavior", "Поведение", virus.classification.behavior, "behavior"],
  ] as const;
  const plain = (value: string): ReactNode => (emptyText !== undefined && value.trim() === "" ? <em className="formatted-empty">{emptyText}</em> : value);
  const text = { embedMedia, emptyText };
  return <div className="record-body content-fade">
    <header className="record-header"><div><span className="record-code">{plain(virus.code)}</span><h2>{plain(virus.name)}</h2></div><div className="record-status"><span />{plain(virus.status)}</div></header>
    <div className="record-document">
      <section className="record-hero">{media({ kind: "infected", alt: `Субъект после заражения вирусом ${virus.name}`, label: "Фото после заражения", recordId: `${virus.id}:infected`, priority: "hero" })}<div className="classification-panel"><div className="section-kicker"><span>01</span>КЛАССИФИКАЦИЯ</div><div className="classification-grid">{classification.map(([key, label, value, tone]) => { const level = classificationLevel(key, value); const badge = classificationIconFor(value); return <div className={`class-cell ${tone}${level ? ` level-${level}` : ""}`} key={label}><span>{label}</span><strong>{badge && <PortiaIcon name={badge} className="class-badge" />}{plain(value)}</strong>{level && <small>УРОВЕНЬ {level}</small>}</div>; })}</div></div></section>
      <DossierSection index="02" title="ВНЕШНИЕ ХАРАКТЕРИСТИКИ"><FormattedText className="lead-copy" text={virus.external} document={formattedText[portiaTextKey.virus(virus.id, "external")]} {...text} /></DossierSection>
      <DossierSection index="03" title="ХАРАКТЕРИСТИКИ С PPU"><div className="metric-grid"><div><span>ЗДОРОВЬЕ</span><FormattedText text={virus.ppu.health} document={formattedText[portiaTextKey.virus(virus.id, "ppu-health")]} {...text} /></div><div><span>СКОРОСТЬ</span><FormattedText text={virus.ppu.speed} document={formattedText[portiaTextKey.virus(virus.id, "ppu-speed")]} {...text} /></div><div><span>СПОСОБНОСТИ</span><FormattedText text={virus.ppu.abilities} document={formattedText[portiaTextKey.virus(virus.id, "ppu-abilities")]} {...text} /></div></div></DossierSection>
      <DossierSection index="04" title="ФИЗИОЛОГИЯ"><FormattedText className="lead-copy" text={virus.physiology} document={formattedText[portiaTextKey.virus(virus.id, "physiology")]} {...text} /></DossierSection>
      <DossierSection index="05" title="МУТАЦИИ ВИРУСА"><div className="mutation-grid">{virus.mutations.length === 0 && emptyText !== undefined && <p className="formatted-empty">{emptyText}</p>}{virus.mutations.map((mutation, index) => <section className="mutation-card" key={`${mutation.name}-${index}`}><div className="mutation-index">M-{String(index + 1).padStart(2, "0")}</div>{media({ kind: "mutation", index, alt: mutation.name, label: "Скриншот мутации", recordId: `${virus.id}:mutation:${index}`, priority: "lazy" })}<div className="mutation-copy"><h4>{plain(mutation.name)}</h4><FormattedText text={mutation.description} document={formattedText[portiaTextKey.mutation(virus.id, index)]} {...text} /></div></section>)}</div></DossierSection>
      {after}
      <footer className="record-footer"><span>{footer[0]}</span><span>{footer[1]}</span></footer>
    </div>
  </div>;
}
