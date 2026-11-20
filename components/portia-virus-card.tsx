"use client";

import { useState, type ReactNode } from "react";
import { classificationOptions, portiaTextKey, type PortiaContent, type RichTextDocument, type Virus } from "@/lib/portia-content";
import { classificationIconFor, PortiaIcon } from "@/components/portia-icons";
import { useLiveEdit, type LiveEditApi, type LiveVirusField } from "@/components/portia-live-edit";
import { splitEmbeddedMedia } from "@/lib/rich-text-media";
import { parseTransmissionRoutes, transmissionDescription } from "@/lib/transmission-routes";

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

/**
 * LIVE-05 (26.1-10): only the pictures and GIFs a text links to, drawn by the same EmbeddedImage as FormattedText, with no text.
 * The live editor shows it under the field being edited, so a GIF keeps playing while its link is typed. Nothing when the text links to no picture.
 */
export function EmbeddedMediaStrip({ text, eager = false }: { text: string; eager?: boolean }) {
  const media = splitEmbeddedMedia(text).flatMap((segment) => (segment.kind === "media" ? [segment] : []));
  if (!media.length) return null;
  return <div className="embedded-media-strip">{media.map((segment) => <EmbeddedImage key={`media-${segment.start}`} src={segment.url} eager={eager} />)}</div>;
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

// OWN-03 (owner 2026-11-20): a virus has several routes of transmission. Each is a line with its own icon; a press opens the owner's text for it.
// Closed by default, so the captured card of the template file has no open description. A value the table does not know is plain text without an icon.
function TransmissionCell({ value }: { value: string }) {
  const routes = parseTransmissionRoutes(value);
  const [open, setOpen] = useState<string | null>(null);
  if (routes.length === 0) return <strong><em className="formatted-empty">Не указан</em></strong>;
  const description = open !== null && routes.includes(open) ? transmissionDescription(open) : undefined;
  return <>
    <strong className="route-list">
      {routes.map((name) => {
        const icon = classificationIconFor(name);
        return <button type="button" className="route-item" key={name} aria-expanded={open === name && description !== undefined} onClick={() => setOpen(open === name ? null : name)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(null); }}>
          {icon && <PortiaIcon name={icon} className="class-badge" />}{name}
        </button>;
      })}
    </strong>
    {description !== undefined && <p className="route-description">{description}</p>}
  </>;
}

/**
 * LIVE-04 (26.1-12): the live tools of a virus card - the live mode of the archive, or of the recycle bin for a virus that lies in it.
 * Null for a visitor and for the template (no provider), and the card then draws exactly its old markup.
 */
export function useLiveVirus(): LiveEditApi | null {
  const archive = useLiveEdit("viruses");
  const bin = useLiveEdit("recycle");
  return archive ?? bin;
}

export function VirusCardBody({ virus, formattedText, media, embedMedia = true, emptyText, after, footer }: VirusCardBodyProps) {
  const live = useLiveVirus();
  // LIVE-05: at rest the live text is the visitor's FormattedText (a GIF plays), pressed it is the editor's field with the strip of its GIFs.
  const liveRich = (live: LiveEditApi, field: LiveVirusField, text: string, className?: string) => live.rich({ kind: "virus-text", virusId: virus.id, field }, { text, document: formattedText[portiaTextKey.virus(virus.id, field)], className });
  const classification = [
    ["danger", "Общий уровень опасности", virus.classification.danger, "danger"], ["spread", "Распространение", virus.classification.spread, "spread"], ["escapeRisk", "Угроза и риск побега", virus.classification.escapeRisk, "escape"],
    ["transmission", "Способ распространения", virus.classification.transmission, "transmission"], ["mind", "Разум", virus.classification.mind, "mind"], ["appearance", "Вид / внешность", virus.classification.appearance, "appearance"], ["behavior", "Поведение", virus.classification.behavior, "behavior"],
  ] as const;
  const plain = (value: string): ReactNode => (emptyText !== undefined && value.trim() === "" ? <em className="formatted-empty">{emptyText}</em> : value);
  const text = { embedMedia, emptyText };
  const infectedPicture = media({ kind: "infected", alt: `Субъект после заражения вирусом ${virus.name}`, label: "Фото после заражения", recordId: `${virus.id}:infected`, priority: "hero" });
  return <div className="record-body content-fade">
    <header className="record-header"><div><span className="record-code">{live ? live.text({ kind: "virus-code", virusId: virus.id }, virus.code) : plain(virus.code)}</span><h2>{live ? live.text({ kind: "virus-name", virusId: virus.id }, virus.name) : plain(virus.name)}</h2></div><div className="record-status"><span />{live ? live.text({ kind: "virus-status", virusId: virus.id }, virus.status) : plain(virus.status)}</div></header>
    <div className="record-document">
      <section className="record-hero">{live ? live.image({ kind: "virus-infected", virusId: virus.id }, { value: virus.infectedImage, framing: virus.infectedImageFraming, children: infectedPicture }) : infectedPicture}<div className="classification-panel"><div className="section-kicker"><span>01</span>КЛАССИФИКАЦИЯ</div><div className="classification-grid">{classification.map(([key, label, value, tone]) => { const level = classificationLevel(key, value); const badge = classificationIconFor(value); if (key === "transmission") return <div className={`class-cell ${tone}`} key={label}><span>{label}</span>{live ? <strong>{live.choice({ kind: "virus-class", virusId: virus.id, axis: "transmission" }, value, { label })}</strong> : <TransmissionCell value={value} />}</div>; return <div className={`class-cell ${tone}${level ? ` level-${level}` : ""}`} key={label}><span>{label}</span><strong>{badge && <PortiaIcon name={badge} className="class-badge" />}{live ? live.choice({ kind: "virus-class", virusId: virus.id, axis: key }, value, { label }) : plain(value)}</strong>{level && <small>УРОВЕНЬ {level}</small>}</div>; })}</div></div></section>
      <DossierSection index="02" title="ВНЕШНИЕ ХАРАКТЕРИСТИКИ">{live ? liveRich(live, "external", virus.external, "lead-copy") : <FormattedText className="lead-copy" text={virus.external} document={formattedText[portiaTextKey.virus(virus.id, "external")]} {...text} />}</DossierSection>
      <DossierSection index="03" title="ХАРАКТЕРИСТИКИ С PPU"><div className="metric-grid"><div><span>ЗДОРОВЬЕ</span>{live ? liveRich(live, "ppu-health", virus.ppu.health) : <FormattedText text={virus.ppu.health} document={formattedText[portiaTextKey.virus(virus.id, "ppu-health")]} {...text} />}</div><div><span>СКОРОСТЬ</span>{live ? liveRich(live, "ppu-speed", virus.ppu.speed) : <FormattedText text={virus.ppu.speed} document={formattedText[portiaTextKey.virus(virus.id, "ppu-speed")]} {...text} />}</div><div><span>СПОСОБНОСТИ</span>{live ? liveRich(live, "ppu-abilities", virus.ppu.abilities) : <FormattedText text={virus.ppu.abilities} document={formattedText[portiaTextKey.virus(virus.id, "ppu-abilities")]} {...text} />}</div></div></DossierSection>
      <DossierSection index="04" title="ФИЗИОЛОГИЯ">{live ? liveRich(live, "physiology", virus.physiology, "lead-copy") : <FormattedText className="lead-copy" text={virus.physiology} document={formattedText[portiaTextKey.virus(virus.id, "physiology")]} {...text} />}</DossierSection>
      <DossierSection index="05" title="МУТАЦИИ ВИРУСА"><div className="mutation-grid">{virus.mutations.length === 0 && emptyText !== undefined && <p className="formatted-empty">{emptyText}</p>}{virus.mutations.map((mutation, index) => {
        const picture = media({ kind: "mutation", index, alt: mutation.name, label: "Скриншот мутации", recordId: `${virus.id}:mutation:${index}`, priority: "lazy" });
        // A name typed in place must not remount the card (the key of a visitor's card holds the name), so the live card is keyed by its position.
        return <section className="mutation-card" key={live ? index : `${mutation.name}-${index}`}><div className="mutation-index">M-{String(index + 1).padStart(2, "0")}</div>{live ? live.image({ kind: "mutation-image", virusId: virus.id, index }, { value: mutation.image, framing: mutation.imageFraming, children: picture }) : picture}<div className="mutation-copy"><h4>{live ? live.text({ kind: "mutation-name", virusId: virus.id, index }, mutation.name) : plain(mutation.name)}</h4>{live ? live.rich({ kind: "mutation-description", virusId: virus.id, index }, { text: mutation.description, document: formattedText[portiaTextKey.mutation(virus.id, index)] }) : <FormattedText text={mutation.description} document={formattedText[portiaTextKey.mutation(virus.id, index)]} {...text} />}</div>{live && live.remove({ kind: "mutation", virusId: virus.id, index }, mutation.name)}</section>;
      })}</div></DossierSection>
      {after}
      {live && live.addBar({ kind: "virus", virusId: virus.id })}
      <footer className="record-footer"><span>{footer[0]}</span><span>{footer[1]}</span></footer>
    </div>
  </div>;
}
