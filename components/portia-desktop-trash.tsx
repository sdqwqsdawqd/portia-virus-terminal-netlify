"use client";

import { portiaTextKey, type PortiaContent, type RecycleFile, type Virus } from "@/lib/portia-content";
import { recycleFileBody, recycleFileType } from "@/lib/search-index";
import { FormattedText, ScientistDocument, VirusRecord } from "@/components/portia-desktop-dossier";
import { PortiaImage } from "@/components/portia-desktop-media";
import { useLiveEdit } from "@/components/portia-live-edit";

// The visitor's view of «Корзина» (the heading, the columns, a row, the viewer of a file or of a virus) as components, shared by the desktop window and the editor's live mode (LIVE-02, 26.1-12).
// The desktop draws them with no context and gets the markup it always had; the editor's live mode draws the same components inside the provider of the live tools,
// and the places that can be edited in place (LIVE-04) ask `useLiveEdit("recycle")`. The rows' list, the closed-level placeholders and the selection stay with the window.

/** The heading of the window, the same for the window and the live mode. */
export function TrashHeader() {
  return <header><h1>Корзина</h1><p>Бесполезный хлам — кому вообще придет в голову его перебирать?</p></header>;
}

/** The names of the columns of the list. */
export function TrashListHead() {
  return <div className="trash-list-head" aria-hidden="true"><span>ИМЯ</span><span>ИСХОДНОЕ РАСПОЛОЖЕНИЕ</span><span>ТИП</span></div>;
}

/** A row of the list: a file, or a virus that lies in the bin. */
export type TrashEntry = { type: "virus"; virus: Virus } | { type: "file"; file: RecycleFile };

/** One row of the list. `hitClass` and `hitProps` are the marks of a search result the window puts on its rows. */
export function TrashFileRow({ entry, active, onOpen, hitClass = "", hitProps }: { entry: TrashEntry; active: boolean; onOpen: () => void; hitClass?: string; hitProps?: { "data-search-hit"?: string; "aria-current"?: "true" } }) {
  const className = `trash-file-row${active ? " active" : ""}${hitClass}`;
  if (entry.type === "virus") {
    return <button className={className} {...hitProps} type="button" onClick={onOpen}><span className="trash-file-name"><i className="trash-file-icon virus">V</i><strong>{entry.virus.name}</strong></span><span>C:\PORTIA\VIRUS_ARCHIVE</span><span>Вирус в корзине</span></button>;
  }
  const { file } = entry;
  return <button className={className} {...hitProps} type="button" onClick={onOpen}><span className="trash-file-name"><i className={`trash-file-icon ${file.kind}`}>{file.kind === "virus" ? "V" : file.kind === "image" ? "IMG" : "TXT"}</i><strong>{file.name}</strong></span><span>{file.location}</span><span>{recycleFileType(file.kind)}</span></button>;
}

const recycleKinds: RecycleFile["kind"][] = ["virus", "text", "image"];

/**
 * The viewer of a file or of a virus of the bin, laid over the list. The caller keys it by the entry it shows, so a new one fades in.
 * `viruses` are the viruses of the archive and of the bin (the text of a «file of a virus» is built from the linked one). `openLog` and `onOpenLog` are the record of a scientist
 * the live mode opens inside the viewer; the window leaves them out.
 */
export function TrashViewer({ entry, formattedText, viruses, viewerLevel, onClose, openLog = null, onOpenLog, onCloseLog }: {
  entry: TrashEntry;
  formattedText: PortiaContent["formattedText"];
  viruses: readonly Virus[];
  viewerLevel: number;
  onClose: () => void;
  openLog?: string | null;
  onOpenLog?: (id: string) => void;
  onCloseLog?: () => void;
}) {
  const live = useLiveEdit("recycle");
  const closeButton = <button type="button" onClick={onClose} aria-label="Закрыть файл">×</button>;
  if (entry.type === "virus") {
    const { virus } = entry;
    return <div className="trash-viewer virus doc-open">
      <div className="trash-viewer-head"><div><span>ВИРУС В КОРЗИНЕ</span><strong>{virus.name} / {virus.code}</strong></div>{live && live.remove({ kind: "recycled-virus", virusId: virus.id }, virus.name)}{closeButton}</div>
      <div className="trash-viewer-body trash-virus-document doc-print">
        {live && openLog
          ? <ScientistDocument key={openLog} virus={virus} logId={openLog} viewerLevel={viewerLevel} onBack={() => onCloseLog?.()} />
          : <VirusRecord virus={virus} formattedText={formattedText} viewerLevel={viewerLevel} onOpenLog={(id) => onOpenLog?.(id)} />}
      </div>
    </div>;
  }
  const { file } = entry;
  const document = formattedText[portiaTextKey.recycle(file.id)];
  const linked = file.kind === "virus" ? recycleFileBody({ ...file, content: "" }, viruses) : "";
  return <div className={`trash-viewer ${file.kind} doc-open`}>
    <div className="trash-viewer-head"><div><span>ТОЛЬКО ДЛЯ ЧТЕНИЯ</span><strong>{live ? live.text({ kind: "recycle-file-name", fileId: file.id }, file.name) : file.name}</strong></div>{live && live.remove({ kind: "recycle-file", fileId: file.id }, file.name)}{closeButton}</div>
    <div className="trash-viewer-body doc-print">
      {file.kind === "image" ? (
        <figure className="trash-image-document">
          {live
            ? live.image({ kind: "recycle-file-image", fileId: file.id }, { value: file.image, framing: file.imageFraming, children: <PortiaImage src={file.image} alt={file.name} recordId={file.id} priority="lazy" icon="trash" framing={file.imageFraming} /> })
            : <PortiaImage src={file.image} alt={file.name} recordId={file.id} priority="lazy" icon="trash" framing={file.imageFraming} />}
          {live
            ? <figcaption>{live.rich({ kind: "recycle-file-text", fileId: file.id, caption: true }, { text: file.content, document })}</figcaption>
            : file.content && <figcaption><FormattedText text={file.content} document={document} /></figcaption>}
        </figure>
      ) : (
        <article className="trash-text-document">
          <div className="trash-document-meta">{live
            ? <>{live.choice({ kind: "recycle-file-kind", fileId: file.id }, file.kind, { label: "Тип файла", options: recycleKinds.map((kind) => ({ value: kind, label: recycleFileType(kind) })) })} / {live.text({ kind: "recycle-file-location", fileId: file.id }, file.location)}</>
            : <>{recycleFileType(file.kind)} / {file.location}</>}</div>
          {live && file.kind === "virus" && <div className="live-trash-link">{live.choice({ kind: "recycle-file-virus", fileId: file.id }, file.virusId, { label: "Связанный вирус", options: [{ value: "", label: "Без связи" }, ...viruses.map((virus) => ({ value: virus.id, label: `${virus.name} / ${virus.code}` }))] })}</div>}
          {file.kind === "virus"
            ? <>
              {linked && <pre>{linked}</pre>}
              {live
                ? live.rich({ kind: "recycle-file-text", fileId: file.id }, { text: file.content, document, className: "trash-formatted-text" })
                : file.content && <FormattedText className="trash-formatted-text" text={file.content} document={document} />}
              {!live && !linked && !file.content && <span>Файл не содержит текста.</span>}
            </>
            : live
              ? live.rich({ kind: "recycle-file-text", fileId: file.id }, { text: file.content, document, className: "trash-formatted-text" })
              : <FormattedText className="trash-formatted-text" text={file.content || "Файл не содержит текста."} document={document} />}
        </article>
      )}
    </div>
  </div>;
}
