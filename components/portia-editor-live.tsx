"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AccessGateScreen, type AccessGateFormState } from "@/components/portia-access-gate-screen";
import { GuideApp } from "@/components/portia-desktop-documents";
import { RowBadges, ScientistDocument, VirusRecord } from "@/components/portia-desktop-dossier";
import { BroadcastCard, BroadcastsHeader, InfoArticle, broadcastTabs } from "@/components/portia-desktop-info";
import { TrashFileRow, TrashHeader, TrashListHead, TrashViewer, type TrashEntry } from "@/components/portia-desktop-trash";
import { ClassificationField, ConfirmDialog, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";
import { FormattedTextarea, findFormatField, type FormatTarget } from "@/components/portia-editor-rich-text";
import { LevelPicker } from "@/components/portia-level-picker";
import { LiveEditContext, type LiveEditApi } from "@/components/portia-live-edit";
import { EmbeddedMediaStrip, FormattedText } from "@/components/portia-virus-card";
import { accessGateLayout } from "@/lib/access-gate-view";
import { localDateKey, type BroadcastTab } from "@/lib/broadcasts";
import type { ImageFraming } from "@/lib/image-framing";
import {
  accessPreviewStates, applyLiveAdd, applyLiveCards, applyLiveChoice, applyLiveDate, applyLiveFlag, applyLiveFraming, applyLiveImage, applyLiveLogText, applyLiveMove, applyLivePhrase, applyLiveRemove, applyLiveSettings, applyLiveText, findLiveVirus, liveAddBlocked, liveAddKinds, liveAppForTab, liveBroadcastFeed, liveDateError, liveFormatKey, liveNewId, livePhraseLines, livePhraseSlice, liveRecycleKeys, liveRemovedKeys, liveSettingsOk, liveTextKey, LIVE_PHRASE_GROUPS, LIVE_SEAM_TABS,
  type AccessPreviewId, type LiveAddKind, type LiveApp, type LivePhraseGroup, type LiveCardsTarget, type LiveChoiceTarget, type LiveContainer, type LiveDateTarget, type LiveFlagTarget, type LiveImageTarget, type LiveList, type LiveRemovable, type LiveSettingsPatch, type LiveTarget,
} from "@/lib/live-edit";
import { parseYoutubeId } from "@/lib/portia-content-normalize";
import { findGuide, findInfo, type PortiaContent, type RichTextDocument } from "@/lib/portia-content";

// LIVE-01..05 (26.1-10): the seam of the live editing mode. The editor shows the visitor's own app on the draft; here lives everything that edits it.
// The visitor's components ask components/portia-live-edit.tsx for these tools; they exist only inside the provider that LiveSurface sets.
// The seam keeps no content of its own: every change of the draft goes through the bridge the editor hands over (changeDraft, changeFormattedText),
// so «Сохранить», «Отменить» and the undo steps are the editor's own, and switching the mode off or on loses nothing (LIVE-03).
// All Russian texts of the mode are in liveCopy (D-58), each short (D-56).

export const liveCopy = {
  toggle: "ЖИВОЙ РЕЖИМ",
  untitled: "Без названия",
  addLabel: "Добавить:",
  addGroup: "Добавить элемент",
  kinds: { section: "Раздел", card: "Карточку", heading: "Заголовок", text: "Текст", table: "Таблицу", photo: "Фото", video: "Видео", callout: "Врезку", cards: "Карточки", row: "Строку", subsection: "Подраздел", news: "Новость", quest: "Квест", mutation: "Мутацию", log: "Запись учёного", file: "Файл", phrase: "Фразу" } satisfies Record<LiveAddKind, string>,
  cover: "Обложку",
  coverLabel: "Обложка",
  full: "Больше нельзя",
  targets: {
    "guide-section-title": "Название раздела",
    "guide-card-title": "Название карточки",
    "guide-heading": "Заголовок",
    "guide-callout-label": "Подпись врезки",
    "guide-photo-caption": "Подпись фото",
    "guide-table-key": "Название строки",
    "guide-table-value": "Значение строки",
    "guide-video-url": "Ссылка на видео",
    "guide-block-text": "Текст",
    "info-section-title": "Название раздела",
    "info-section-body": "Текст раздела",
    "info-subsection-title": "Название подраздела",
    "info-block-text": "Текст",
    "info-table-key": "Название строки",
    "info-table-value": "Значение строки",
    "info-video-url": "Ссылка на видео",
    "broadcast-title": "Заголовок",
    "broadcast-body": "Текст",
    "broadcast-conditions": "Условия",
    "virus-name": "Название вируса",
    "virus-code": "Код вируса",
    "virus-status": "Статус вируса",
    "virus-text": "Текст",
    "mutation-name": "Название мутации",
    "mutation-description": "Описание мутации",
    "log-title": "Название записи",
    "log-scientist": "Псевдоним учёного",
    "log-text": "Текст записи",
    "recycle-file-name": "Имя файла",
    "recycle-file-location": "Исходное расположение",
    "recycle-file-text": "Текст файла",
    "assistant-phrase": "Фраза помощника",
    "promo-rules": "Правила для кандидата",
    "promo-question-text": "Текст вопроса",
    "promo-question-option": "Текст варианта",
    "promo-task-text": "Текст задания",
  } satisfies Record<LiveTarget["kind"], string>,
  placeholders: {
    "guide-section-title": "Название раздела",
    "guide-card-title": "Название карточки",
    "guide-heading": "Заголовок",
    "guide-callout-label": "Подпись",
    "guide-photo-caption": "Подпись к фото",
    "guide-table-key": "Название",
    "guide-table-value": "Значение",
    "guide-video-url": "Ссылка на видео",
    "guide-block-text": "Нажмите, чтобы написать",
    "info-section-title": "Название раздела",
    "info-section-body": "Нажмите, чтобы написать",
    "info-subsection-title": "Название подраздела",
    "info-block-text": "Нажмите, чтобы написать",
    "info-table-key": "Название",
    "info-table-value": "Значение",
    "info-video-url": "Ссылка на видео",
    "broadcast-title": "Заголовок",
    "broadcast-body": "Нажмите, чтобы написать",
    "broadcast-conditions": "Условия квеста",
    "virus-name": "Название вируса",
    "virus-code": "Код",
    "virus-status": "Статус",
    "virus-text": "Нажмите, чтобы написать",
    "mutation-name": "Название мутации",
    "mutation-description": "Нажмите, чтобы написать",
    "log-title": "Название записи",
    "log-scientist": "Псевдоним",
    "log-text": "Нажмите, чтобы написать",
    "recycle-file-name": "Имя файла",
    "recycle-file-location": "Расположение",
    "recycle-file-text": "Нажмите, чтобы написать",
    "assistant-phrase": "Нажмите, чтобы написать",
    "promo-rules": "Нажмите, чтобы написать",
    "promo-question-text": "Текст вопроса",
    "promo-question-option": "Вариант",
    "promo-task-text": "Текст задания",
  } satisfies Record<LiveTarget["kind"], string>,
  /** «Повышение» (26.1-16): the texts of the tools of its seam; the texts of the candidate's view are the code of the site and are not here. */
  promo: {
    transition: "Переход",
    saving: "Сохраняем изменения…",
    notSaved: "Изменения не сохранены. Проверьте данные.",
    refused: "Не сохранено: проверьте текст и варианты.",
    refusedTask: "Не сохранено: текст не пустой.",
    answerError: "Проверьте варианты и ответ.",
    bankError: "Банк не создан. Попробуйте ещё раз.",
    rulesNoBank: "Сначала добавьте вопрос.",
    rulesNoMigration: "Правила недоступны: миграция ждёт владельца.",
    off: "Выключен",
    switchOff: "Выключить",
    switchOn: "Включить",
    answer: "Ответ…",
    orderSaved: "Порядок сохранён.",
    questionsEmpty: "Вопросов пока нет.",
    tasksEmpty: "Заданий пока нет.",
    addQuestion: { single: "Один ответ", multiple: "Несколько", "free-text": "Свободный" },
    addQuestionLabel: "Добавить вопрос:",
    addTask: "Задание",
    removeQuestion: "Удалить вопрос",
    removeTask: "Удалить задание",
  },
  dateStart: "Начало",
  dateEnd: "Окончание",
  dateError: "Окончание раньше начала",
  flagPublished: "Показывать посетителям",
  flagImportant: "Важно",
  draft: "Черновик",
  broadcastsEmpty: "Записей пока нет",
  infoIndex: "Разделы информации",
  infoSubsections: (count: number) => `Подразделов: ${count}`,
  infoEmpty: "Разделов пока нет",
  virusesTitle: "База вирусов",
  virusesList: "Список вирусов",
  virusesLabels: ["СУБЪЕКТ", "СТАТУС"],
  virusesRecords: "Записи вирусов",
  virusesEmpty: "Вирусов пока нет",
  virusPick: "Выберите вирус в списке",
  infectedAdd: "Изображение",
  infectedLabel: "Фото после заражения",
  choiceEmpty: "Не указан",
  trashEmpty: "Корзина пуста",
  assistantTitle: "Вивьян",
  assistantGroups: { advice: "Советы", offended: "Фразы обиды", idle: "Фразы бездействия", activity: "Фразы активности" } satisfies Record<LivePhraseGroup, string>,
  assistantHeadings: { advice: "ВИВЬЯН // СОВЕТ", offended: "ВИВЬЯН // ОБИДЕЛАСЬ", idle: "ВИВЬЯН // ВЫ ЗДЕСЬ?", activity: "ВИВЬЯН // НАБЛЮДЕНИЕ" } satisfies Record<LivePhraseGroup, string>,
  assistantEmpty: "Фраз пока нет",
  assistantAdd: { advice: "Совет", offended: "Фразу обиды", idle: "Фразу бездействия", activity: "Фразу активности" } satisfies Record<LivePhraseGroup, string>,
  timing: "Время показа",
  timingGroup: "Время показа фраз",
  timingIdle: "Фразы при долгом бездействии",
  timingActivity: "Фразы во время активности",
  timingMode: "Когда показывать фразы",
  timingFixed: "Через одинаковое время",
  timingRandom: "Через случайное время",
  timingInterval: "Интервал, секунд",
  timingMin: "Минимум, секунд",
  timingMax: "Максимум, секунд",
  timingPatience: "Терпение, секунд — через запятую",
  timingWrong: "Секунды: 1–3600, минимум не выше максимума",
  timingPatienceWrong: "Числа больше нуля, через запятую",
  richEmpty: "Нажмите, чтобы написать",
  lists: { "guide-sections": "раздел", "guide-cards": "карточка", "guide-blocks": "блок", "info-sections": "раздел", "info-subsections": "подраздел", "info-blocks": "блок", viruses: "вирус", recycle: "файл" } satisfies Record<LiveList["kind"], string>,
  removeLabel: "Удалить",
  removeTitle: "Удалить?",
  removeText: (label: string) => `Удалить вместе с содержимым: ${label}.`,
  removeConfirm: "УДАЛИТЬ",
  removeCancel: "ОТМЕНА",
  removeNames: { "guide-section": "раздел", "guide-card": "карточку", "guide-block": "блок", "guide-table-row": "строку", "info-section": "раздел", "info-subsection": "подраздел", "info-block": "блок", "info-table-row": "строку", broadcast: "запись", mutation: "мутацию", log: "запись", "recycle-file": "файл", "recycled-virus": "вирус", "assistant-phrase": "фразу" } satisfies Record<LiveRemovable["kind"], string>,
  imageAdd: "Добавить фото",
  sectionPhoto: "Фото раздела",
  imageReplace: "Заменить",
  imageRemove: "Убрать фото",
  imageHint: "Видимая часть настраивается ниже",
  done: "Готово",
  videoLabel: "Ссылка на YouTube",
  videoPlaceholder: "https://www.youtube.com/watch?v=…",
  videoOk: "Видео распознано",
  videoNeed: "Нужна ссылка на YouTube",
  cardsPick: "Выбрать карточки",
  cardsGroup: "Карточки блока",
  cardsFull: "Выбрано 24",
  /** «Доступ» (26.1-19): the preview of the visitor's gate screens. */
  access: {
    surface: "Экран посетителя",
    states: "Состояние экрана",
    stateLabels: { checking: "Проверка", form: "Форма", "form-error": "Ошибка формы", pending: "Ожидание", approved: "Одобрено", rejected: "Отклонено", revoked: "Отозвано", error: "Ошибка связи" } satisfies Record<AccessPreviewId, string>,
    note: "Тексты экранов — часть сайта",
    submitNote: "Просмотр: заявка не отправляется",
  },
} as const;

/** Everything the editor hands the live mode: the draft and the ways to change it, the format panel, the upload, and the choices the tabs keep. */
export type LiveEditorBridge = {
  draft: PortiaContent;
  changeDraft: (updater: (next: PortiaContent) => void) => void;
  changeFormattedText: (key: string, value: string, document: RichTextDocument, write: (next: PortiaContent, value: string) => void) => void;
  activateFormatter: (target: FormatTarget) => void;
  closeFormatterFor: (...keys: string[]) => void;
  uploadImage: (file: File, onUploaded: (url: string) => void) => Promise<void>;
  uploadState: "idle" | "uploading" | "error";
  uploadMessage: string;
  guideSection: string;
  setGuideSection: (id: string) => void;
  infoSection: string;
  setInfoSection: (id: string) => void;
  virusId: string;
  setVirusId: (id: string) => void;
  recycledVirusId: string;
  setRecycledVirusId: (id: string) => void;
  recycleFileId: string;
  setRecycleFileId: (id: string) => void;
  broadcastTab: BroadcastTab;
  setBroadcastTab: (tab: BroadcastTab) => void;
};

/** LIVE-01: the live mode of the open tab. `toggle` is the button for the action bar, null on a tab without a live mode. */
export function useLiveMode(tab: string, onSwitch?: () => void): { on: boolean; toggle: ReactNode } {
  const [enabled, setEnabled] = useState<string[]>([]);
  const app = liveAppForTab(tab);
  const on = app !== null && enabled.includes(tab);
  // a tab with its own seam (26.1-16: «Повышение») draws the button in its own bar; here it would be a second one among the common buttons
  const seamTab = (LIVE_SEAM_TABS as readonly string[]).includes(tab);
  const toggle = app === null || seamTab ? null : <LiveModeToggle on={on} onToggle={() => {
    onSwitch?.();
    setEnabled((current) => (current.includes(tab) ? current.filter((id) => id !== tab) : [...current, tab]));
  }} />;
  return { on, toggle };
}

export function LiveModeToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button type="button" className="secondary-control live-toggle" aria-pressed={on} onClick={onToggle}>{liveCopy.toggle}</button>;
}

/** LIVE-02: the visitor's own view of the tab's app on the draft, inside the provider of the live tools. */
export function LiveSurface({ tab, bridge }: { tab: string; bridge: LiveEditorBridge }) {
  const app = liveAppForTab(tab);
  if (app === "guide") return <GuideSurface bridge={bridge} />;
  if (app === "info") return <InfoSurface bridge={bridge} />;
  if (app === "broadcasts") return <BroadcastsSurface bridge={bridge} />;
  if (app === "viruses") return <VirusesSurface bridge={bridge} />;
  if (app === "recycle") return <RecycleSurface bridge={bridge} />;
  if (app === "assistant") return <AssistantSurface bridge={bridge} />;
  return null;
}

function GuideSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const [openCardId, setOpenCardId] = useState("");
  return <div className="live-surface" data-live-app="guide">
    <LiveEditContext.Provider value={createLiveApi("guide", bridge)}>
      <GuideApp sections={bridge.draft.guideSections} formattedText={bridge.draft.formattedText} openCardId={openCardId} onOpenCard={setOpenCardId} />
    </LiveEditContext.Provider>
  </div>;
}

const noNext = () => undefined;
const indexNumber = (index: number) => String(index + 1).padStart(2, "0");

/** «Информация» as the visitor sees it: the table of contents on the left, the article on the right (InfoArticle, the visitor's own component, inside the provider). */
function InfoSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const [picked, setPicked] = useState(bridge.infoSection);
  const sections = bridge.draft.infoSections;
  // What is shown: the picked article, else the section the editor has open, else the first section; a vanished id (a removed section) falls through.
  const entry = findInfo(sections, picked) ?? findInfo(sections, bridge.infoSection) ?? (sections[0] ? { section: sections[0], subsection: null } : null);
  const select = (id: string, sectionId: string) => { setPicked(id); bridge.setInfoSection(sectionId); };
  // A section or subsection the bar adds is put on show at once, and the editor's own selection follows.
  const live = createLiveApi("info", bridge, { onAdded: (kind, id, container) => {
    if (kind === "section") select(id, id);
    else if (kind === "subsection" && container.kind === "info-index") select(id, container.sectionId);
  } });
  return <div className="live-surface" data-live-app="info">
    <LiveEditContext.Provider value={live}>
      <div className="info-library">
        <nav className="info-index" aria-label={liveCopy.infoIndex} id="info-sections-list">
          {sections.map((section, index) => {
            const open = section.id === entry?.section.id;
            const count = section.subsections.length;
            // A section is a row of the order list, and so is each of its subsections; the keyboard button stands inside the row, the × beside the button.
            const order = live.order({ kind: "info-sections" }, index, section.title);
            return <div key={section.id} className="live-index-row" {...order.rowProps}>
              {order.handle}
              <button type="button" className={`${open && !entry?.subsection ? "active" : ""}${count ? " has-subsections" : ""}`} data-info-id={section.id} aria-expanded={count ? open : undefined} onClick={() => select(section.id, section.id)}>
                <small>{indexNumber(index)}</small><span>{section.title || liveCopy.untitled}</span>{count ? <em className="info-sub-marker" aria-label={liveCopy.infoSubsections(count)}>{open ? "▾" : "▸"} {count}</em> : null}
              </button>
              {live.remove({ kind: "info-section", sectionId: section.id }, section.title)}
              {open && count ? <div className="info-subsections">{section.subsections.map((sub, subIndex) => {
                const subOrder = live.order({ kind: "info-subsections", sectionId: section.id }, subIndex, sub.title);
                return <div key={sub.id} className="live-index-row" {...subOrder.rowProps}>
                  {subOrder.handle}
                  <button type="button" className={sub.id === entry?.subsection?.id ? "active" : ""} data-info-id={sub.id} title={sub.title || liveCopy.untitled} onClick={() => select(sub.id, section.id)}>
                    <small>{indexNumber(index)}.{subIndex + 1}</small><span>{sub.title || liveCopy.untitled}</span>
                  </button>
                  {live.remove({ kind: "info-subsection", sectionId: section.id, subsectionId: sub.id }, sub.title)}
                </div>;
              })}</div> : null}
            </div>;
          })}
          {live.addBar({ kind: "info-index", sectionId: entry?.section.id ?? "" })}
        </nav>
        <article className="info-document">
          {entry ? <InfoArticle key={entry.subsection?.id ?? entry.section.id} section={entry.section} subsection={entry.subsection} formattedText={bridge.draft.formattedText} phone={false} next={null} onNext={noNext} /> : <p className="guide-section-empty">{liveCopy.infoEmpty}</p>}
        </article>
      </div>
    </LiveEditContext.Provider>
  </div>;
}

/** «Сводка» as the visitor sees it: the header, the tabs «Новости» / «Квесты» and the feed of cards (BroadcastCard) in the visitor's order by dates, here with the entries not yet shown to visitors too. */
function BroadcastsSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const [today] = useState(() => localDateKey(new Date()));
  const tab = bridge.broadcastTab;
  // An entry the bar adds comes with its tab, so it is on show at once.
  const live = createLiveApi("broadcasts", bridge, { onAdded: (kind) => bridge.setBroadcastTab(kind === "news" ? "news" : "quests") });
  const items = liveBroadcastFeed(bridge.draft.broadcasts, tab, today);
  return <div className="live-surface" data-live-app="broadcasts">
    <LiveEditContext.Provider value={live}>
      <div className="broadcasts-app">
        <BroadcastsHeader />
        <div className="editor-tabs broadcast-tabs">
          {broadcastTabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => bridge.setBroadcastTab(id)}>{label} {liveBroadcastFeed(bridge.draft.broadcasts, id, today).length}</button>)}
        </div>
        <div className="broadcast-grid">
          {items.map((item) => <BroadcastCard key={item.id} item={item} today={today} formattedText={bridge.draft.formattedText} />)}
          {!items.length && <div className="broadcast-empty empty-state"><span>{liveCopy.broadcastsEmpty}</span></div>}
        </div>
        {live.addBar({ kind: "broadcasts" })}
      </div>
    </LiveEditContext.Provider>
  </div>;
}

// The editor sees every level (shownViewerLevel gives 5 to the editor); a record is closed only by the server mark, which a draft never carries.
const editorLevel = 5;

/**
 * «База вирусов» as the visitor sees it: the list of the archive on the left (the visitor's rows, held to reorder), the card of the chosen virus on the right
 * (VirusRecord, the visitor's own card, inside the provider). A scientist's record opens as the visitor's document, in the same place.
 */
function VirusesSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const viruses = bridge.draft.viruses;
  const [picked, setPicked] = useState(bridge.virusId);
  const [openLog, setOpenLog] = useState<string | null>(null);
  // What is shown: the picked virus, else the one the editor has open, else the first; a vanished id (a removed virus) falls through.
  const virus = viruses.find((item) => item.id === picked) ?? viruses.find((item) => item.id === bridge.virusId) ?? viruses[0] ?? null;
  const select = (id: string) => { setPicked(id); setOpenLog(null); bridge.setVirusId(id); };
  const live = createLiveApi("viruses", bridge);
  return <div className="live-surface" data-live-app="viruses">
    <LiveEditContext.Provider value={live}>
      <div className="archive-grid">
        <aside className="archive-browser" aria-label={liveCopy.virusesList}>
          <div className="browser-heading"><div><h1>{liveCopy.virusesTitle}</h1></div><span className="record-count">{String(viruses.length).padStart(2, "0")}</span></div>
          <div className="browser-labels" aria-hidden="true"><span>{liveCopy.virusesLabels[0]}</span><span>{liveCopy.virusesLabels[1]}</span></div>
          <div className="virus-list" role="listbox" aria-label={liveCopy.virusesRecords}>
            {viruses.map((item, index) => {
              const order = live.order({ kind: "viruses" }, index, item.name);
              return <div key={item.id} className="live-index-row" {...order.rowProps}>
                {order.handle}
                <button type="button" role="option" aria-selected={item.id === virus?.id} className={`virus-row${item.id === virus?.id ? " active" : ""}`} onClick={() => select(item.id)}>
                  <span className="row-index">{indexNumber(index)}</span>
                  <span className="row-main"><strong>{item.name || liveCopy.untitled}</strong><small>{item.code}</small><RowBadges virus={item} /></span>
                  <span className="row-status">{item.status}</span>
                </button>
              </div>;
            })}
            {!viruses.length && <div className="list-empty">{liveCopy.virusesEmpty}</div>}
          </div>
        </aside>
        <article className="record-view">
          {!virus
            ? <div className="record-empty empty-state"><strong>{liveCopy.virusPick}</strong></div>
            : openLog
              ? <ScientistDocument key={openLog} virus={virus} logId={openLog} viewerLevel={editorLevel} onBack={() => setOpenLog(null)} />
              : <VirusRecord virus={virus} formattedText={bridge.draft.formattedText} viewerLevel={editorLevel} onOpenLog={setOpenLog} />}
        </article>
      </div>
    </LiveEditContext.Provider>
  </div>;
}

/**
 * «Корзина» as the visitor sees it: the heading, the columns of the list, the rows (files and viruses together, held to reorder) and the viewer of the chosen one laid over the list
 * (TrashViewer, the visitor's own, inside the provider). A file is edited in its viewer; a virus of the bin shows the same live card as the archive.
 */
function RecycleSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const draft = bridge.draft;
  const keys = liveRecycleKeys(draft);
  // The key of the open row ("file:<id>" / "virus:<id>"); nothing is open at first, as in the visitor's window. A removed row closes its viewer.
  const [picked, setPicked] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const entryOf = (key: string): TrashEntry | null => {
    const id = key.slice(key.indexOf(":") + 1);
    if (key.startsWith("virus:")) { const virus = (draft.recycledViruses ?? []).find((item) => item.id === id); return virus ? { type: "virus", virus } : null; }
    const file = draft.recycleFiles.find((item) => item.id === id);
    return file ? { type: "file", file } : null;
  };
  const open = picked && keys.includes(picked) ? entryOf(picked) : null;
  const select = (key: string | null) => {
    setPicked(key);
    setOpenLog(null);
    if (key?.startsWith("virus:")) { bridge.setRecycledVirusId(key.slice(6)); bridge.setRecycleFileId(""); }
    else if (key?.startsWith("file:")) { bridge.setRecycleFileId(key.slice(5)); bridge.setRecycledVirusId(""); }
  };
  // A file the bar adds is opened at once, like the editor's own «+ ДОБАВИТЬ ФАЙЛ» selects it.
  const live = createLiveApi("recycle", bridge, { onAdded: (kind, id) => { if (kind === "file") select(`file:${id}`); } });
  return <div className="live-surface" data-live-app="recycle">
    <LiveEditContext.Provider value={live}>
      <div className={`trash-app${open ? " is-viewing" : ""}`}>
        <TrashHeader />
        <div className="trash-layout">
          <div className="trash-files">
            <TrashListHead />
            {keys.map((key, index) => {
              const entry = entryOf(key);
              if (!entry) return null;
              const order = live.order({ kind: "recycle" }, index, entry.type === "virus" ? entry.virus.name : entry.file.name);
              return <div key={key} className="live-index-row" {...order.rowProps}>
                {order.handle}
                <TrashFileRow entry={entry} active={key === picked} onOpen={() => select(key)} />
              </div>;
            })}
            {!keys.length && <div className="editor-empty empty-state"><strong>{liveCopy.trashEmpty}</strong></div>}
          </div>
          {open && <TrashViewer key={picked} entry={open} formattedText={draft.formattedText} viruses={[...draft.viruses, ...(draft.recycledViruses ?? [])]} linkChoices={draft.viruses} viewerLevel={editorLevel} onClose={() => select(null)} openLog={openLog} onOpenLog={setOpenLog} onCloseLog={() => setOpenLog(null)} />}
        </div>
        {live.addBar({ kind: "recycle" })}
      </div>
    </LiveEditContext.Provider>
  </div>;
}

/**
 * «Вивьян» as the visitor sees her: every phrase is her bubble (the visitor's own classes and the visitor's FormattedText, so a GIF of a phrase plays), grouped by the
 * moment she says it. A phrase is edited in place of its bubble; the formatting of a group is one document, which the model cuts per phrase (lib/live-edit.ts).
 */
function AssistantSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const live = createLiveApi("assistant", bridge);
  return <div className="live-surface" data-live-app="assistant">
    <LiveEditContext.Provider value={live}>
      <div className="assistant-live">
        <div className="assistant-live-head"><h1>{liveCopy.assistantTitle}</h1><LiveTiming bridge={bridge} /></div>
        {LIVE_PHRASE_GROUPS.map((group) => {
          const lines = livePhraseLines(bridge.draft, group);
          return <section key={group} className="assistant-live-group" data-group={group} aria-label={liveCopy.assistantGroups[group]}>
            <h2>{liveCopy.assistantGroups[group]}</h2>
            <div className="assistant-live-list">
              {lines.map((line, index) => <div key={index} className="assistant-live-row">
                <div className="assistant-bubble assistant-live-bubble">
                  <span>{liveCopy.assistantHeadings[group]}</span>
                  {live.rich({ kind: "assistant-phrase", group, index }, { text: line, document: livePhraseSlice(bridge.draft, group, index), className: "assistant-formatted-text" })}
                </div>
                {/* the last phrase of «обида», «бездействие» and «активность» stays: the save would bring a default phrase back */}
                {(group === "advice" || lines.length > 1) && live.remove({ kind: "assistant-phrase", group, index }, line.length > 40 ? `${line.slice(0, 40)}…` : line)}
              </div>)}
              {!lines.length && <div className="assistant-live-empty empty-state"><span>{liveCopy.assistantEmpty}</span></div>}
            </div>
            {live.addBar({ kind: "assistant-group", group })}
          </section>;
        })}
      </div>
    </LiveEditContext.Provider>
  </div>;
}

/** A whole number of seconds in a compact field. What is typed stays in the field while it is out of the limits (then the short error stands beside it); a right value goes to the draft at once; leaving the field shows the draft's own value. */
function LiveSecondsField({ bridge, label, value, patchOf }: { bridge: LiveEditorBridge; label: string; value: number; patchOf: (seconds: number) => LiveSettingsPatch }) {
  const [typed, setTyped] = useState<string | null>(null);
  const errorId = useId();
  const wrong = typed !== null && (typed.trim() === "" || !liveSettingsOk(bridge.draft, patchOf(Number(typed))));
  return <label className="editor-field live-number">
    <span>{label}</span>
    <input
      type="number"
      min={1}
      max={3600}
      step={1}
      value={typed ?? String(value)}
      aria-invalid={wrong || undefined}
      aria-describedby={wrong ? errorId : undefined}
      onChange={(event) => {
        const raw = event.target.value;
        setTyped(raw);
        if (raw.trim() !== "") bridge.changeDraft((next) => { applyLiveSettings(next, patchOf(Number(raw))); });
      }}
      onBlur={() => setTyped(null)}
    />
    {wrong && <small id={errorId} role="alert">{liveCopy.timingWrong}</small>}
  </label>;
}

/** The seconds of patience, as the editor's field takes them: numbers above zero separated by commas. */
function LivePatienceField({ bridge }: { bridge: LiveEditorBridge }) {
  const [typed, setTyped] = useState<string | null>(null);
  const errorId = useId();
  const draft = bridge.draft;
  const parse = (raw: string) => raw.split(/[,;\s]+/).filter(Boolean).map(Number);
  const wrong = typed !== null && !liveSettingsOk(draft, { patienceVariants: parse(typed) });
  return <label className="editor-field live-number">
    <span>{liveCopy.timingPatience}</span>
    <input
      value={typed ?? (draft.assistantPatienceVariants ?? [draft.assistantPatienceSeconds]).join(", ")}
      inputMode="decimal"
      aria-invalid={wrong || undefined}
      aria-describedby={wrong ? errorId : undefined}
      onChange={(event) => {
        const raw = event.target.value;
        setTyped(raw);
        const variants = parse(raw);
        bridge.changeDraft((next) => { applyLiveSettings(next, { patienceVariants: variants }); });
      }}
      onBlur={() => setTyped(null)}
    />
    {wrong && <small id={errorId} role="alert">{liveCopy.timingPatienceWrong}</small>}
  </label>;
}

/** «Время показа»: a compact popover with the switches of the automatic phrases, the way they are timed and the patience; every value goes through applyLiveSettings, so the limits are the form's. */
function LiveTiming({ bridge }: { bridge: LiveEditorBridge }) {
  const [open, setOpen] = useState(false);
  const draft = bridge.draft;
  const write = (patch: LiveSettingsPatch) => bridge.changeDraft((next) => { applyLiveSettings(next, patch); });
  return <div className="live-tools assistant-live-timing">
    <button type="button" className="secondary-control live-button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{liveCopy.timing}</button>
    {open && <LivePopover onClose={() => setOpen(false)}>
      <div className="live-timing" role="group" aria-label={liveCopy.timingGroup}>
        <label className="live-flag"><input type="checkbox" checked={draft.assistantIdleEnabled} onChange={(event) => write({ idleEnabled: event.target.checked })} /><span>{liveCopy.timingIdle}</span></label>
        <label className="live-flag"><input type="checkbox" checked={draft.assistantActivityEnabled} onChange={(event) => write({ activityEnabled: event.target.checked })} /><span>{liveCopy.timingActivity}</span></label>
        <LivePatienceField bridge={bridge} />
        <label className="editor-field">
          <span>{liveCopy.timingMode}</span>
          <select value={draft.assistantAutoTimingMode} onChange={(event) => write({ autoTimingMode: event.target.value as LiveSettingsPatch["autoTimingMode"] })}>
            <option value="fixed">{liveCopy.timingFixed}</option>
            <option value="random">{liveCopy.timingRandom}</option>
          </select>
        </label>
        {draft.assistantAutoTimingMode === "fixed"
          ? <LiveSecondsField bridge={bridge} label={liveCopy.timingInterval} value={draft.assistantAutoIntervalSeconds} patchOf={(seconds) => ({ autoIntervalSeconds: seconds })} />
          : <div className="live-timing-pair">
            <LiveSecondsField bridge={bridge} label={liveCopy.timingMin} value={draft.assistantAutoMinSeconds} patchOf={(seconds) => ({ autoMinSeconds: seconds })} />
            <LiveSecondsField bridge={bridge} label={liveCopy.timingMax} value={draft.assistantAutoMaxSeconds} patchOf={(seconds) => ({ autoMaxSeconds: seconds })} />
          </div>}
      </div>
    </LivePopover>}
  </div>;
}

/** The tools of the live mode of `app`, over the editor's bridge. */
/** `onAdded` hears of every element the bar adds (its kind, its id, the container), so a surface can put the new section or subsection on show. */
export type LiveHooks = { onAdded?: (kind: LiveAddKind, id: string, container: LiveContainer) => void };

export function createLiveApi(app: LiveApp, bridge: LiveEditorBridge, hooks: LiveHooks = {}): LiveEditApi {
  return {
    app,
    text: (target, value, options) => options?.multiline ? <LiveTextarea bridge={bridge} target={target} value={value} /> : <LiveText bridge={bridge} target={target} value={value} className={options?.className} />,
    rich: (target, props) => <LiveRich bridge={bridge} target={target} text={props.text} document={props.document} className={props.className} />,
    image: (target, props) => <LiveImage bridge={bridge} target={target} value={props.value} framing={props.framing}>{props.children}</LiveImage>,
    video: (target, videoId) => <LiveVideo bridge={bridge} target={target} videoId={videoId} />,
    cards: (target, cardIds) => <LiveCardsPicker bridge={bridge} target={target} cardIds={cardIds} />,
    addBar: (container) => <LiveAddBar bridge={bridge} container={container} onAdded={hooks.onAdded} />,
    order: (list, index, title) => ({
      rowProps: { "data-sort-index": index },
      handle: <OrderDragHandle index={index} label={title || liveCopy.lists[list.kind]} onMove={(from, to) => bridge.changeDraft((next) => { applyLiveMove(next, list, from, to); })} />,
    }),
    date: (target, value) => <LiveDate bridge={bridge} target={target} value={value} />,
    flag: (target, checked) => <LiveFlag bridge={bridge} target={target} checked={checked} />,
    choice: (target, value, options) => <LiveChoice bridge={bridge} target={target} value={value} label={options.label} options={options.options} />,
    remove: (item, title) => <LiveRemove bridge={bridge} item={item} title={title} />,
  };
}

// T-26.1-22: only textContent is read, a paste is plain text, and what reaches the draft is a string, never markup. The server normalises it again.
function insertPlainText(text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = window.document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// A browser without "plaintext-only" (older Firefox) gets plain contentEditable; only textContent is read and a paste is plain either way.
let plaintextOnly: boolean | null = null;
function editableMode(): "plaintext-only" | "true" {
  if (plaintextOnly === null) {
    const probe = window.document.createElement("span");
    probe.contentEditable = "plaintext-only";
    plaintextOnly = probe.contentEditable === "plaintext-only";
  }
  return plaintextOnly ? "plaintext-only" : "true";
}

/** A plain text in place: the visitor's own element (its class), made editable. Enter does not break the line. */
export function LiveText({ bridge, target, value, className }: { bridge: LiveEditorBridge; target: LiveTarget; value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // The element holds its own text while it is typed in; the draft's value is written back only when it differs (an undo, a cut to the limit).
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || element.textContent === value) return;
    element.textContent = value;
    if (window.document.activeElement === element) {
      const range = window.document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  });
  const commit = (raw: string) => bridge.changeDraft((next) => { applyLiveText(next, target, raw.replace(/[\r\n]+/g, " ")); });
  return <span
    ref={ref}
    className={`live-editable${className ? ` ${className}` : ""}`}
    contentEditable={editableMode()}
    suppressContentEditableWarning
    role="textbox"
    aria-label={liveCopy.targets[target.kind]}
    data-placeholder={liveCopy.placeholders[target.kind]}
    spellCheck
    onInput={(event) => commit(event.currentTarget.textContent ?? "")}
    onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
    onPaste={(event) => {
      event.preventDefault();
      insertPlainText(event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " "));
      commit(event.currentTarget.textContent ?? "");
    }}
  />;
}

/**
 * 26.1-16: a text in place that is written once, when the place is left: for data that is not in the draft (the banks of «Повышения»), where each keystroke cannot be a command.
 * What is typed stays on the screen while the command runs; Escape puts the saved text back and writes nothing; a paste is plain text (T-26.1-22); a single line ends with Enter.
 * `onCommit` gets the text as typed and answers when the command is done; a text that equals the saved one (but for the ends) sends no command.
 */
export function LiveCommitText({ value, onCommit, label, placeholder, className, multiline = false, maxLength }: { value: string; onCommit: (raw: string) => Promise<unknown> | void; label: string; placeholder?: string; className?: string; multiline?: boolean; maxLength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // a place that is not being typed in shows the saved text, but never while its own command runs (the typed text would flash back)
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || running || window.document.activeElement === element || element.textContent === value) return;
    element.textContent = value;
  });
  const commit = (raw: string) => {
    if (raw.trim() === value.trim()) { setTyped(null); return; }
    setRunning(true);
    void Promise.resolve(onCommit(raw)).catch(() => undefined).finally(() => { setTyped(null); setRunning(false); });
  };
  if (multiline) {
    const shown = typed ?? value;
    return <textarea
      className={`live-editable live-textarea${className ? ` ${className}` : ""}`}
      value={shown}
      rows={Math.max(3, shown.split("\n").length)}
      maxLength={maxLength}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => setTyped(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setTyped(null); event.currentTarget.blur(); } }}
      onBlur={() => { if (typed !== null) commit(typed); }}
    />;
  }
  return <span
    ref={ref}
    className={`live-editable${className ? ` ${className}` : ""}`}
    contentEditable={editableMode()}
    suppressContentEditableWarning
    role="textbox"
    aria-label={label}
    data-placeholder={placeholder}
    spellCheck
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.currentTarget.textContent = value; event.currentTarget.blur(); return; }
      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
    }}
    onPaste={(event) => { event.preventDefault(); insertPlainText(event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ")); }}
    onBlur={(event) => commit((event.currentTarget.textContent ?? "").replace(/[\r\n]+/g, " "))}
  />;
}

/** A plain text of several lines in place (the conditions of a quest): a plain textarea, so what reaches the draft is a string as typed. */
export function LiveTextarea({ bridge, target, value }: { bridge: LiveEditorBridge; target: LiveTarget; value: string }) {
  return <textarea
    className="live-editable live-textarea"
    value={value}
    rows={Math.max(2, value.split("\n").length)}
    aria-label={liveCopy.targets[target.kind]}
    placeholder={liveCopy.placeholders[target.kind]}
    onChange={(event) => { const raw = event.target.value; bridge.changeDraft((next) => { applyLiveText(next, target, raw); }); }}
  />;
}

/** A day of a quest. A day that would put the end before the start is kept here, not in the draft, and the short error stands beside it (T-26.1-25); leaving the field shows the draft's own day again. */
export function LiveDate({ bridge, target, value }: { bridge: LiveEditorBridge; target: LiveDateTarget; value: string }) {
  const [typed, setTyped] = useState<string | null>(null);
  const errorId = useId();
  const wrong = typed !== null && liveDateError(bridge.draft, target, typed);
  return <label className="live-date live-tools">
    <span>{target.kind === "broadcast-starts" ? liveCopy.dateStart : liveCopy.dateEnd}</span>
    <input
      type="date"
      value={typed ?? value}
      aria-invalid={wrong || undefined}
      aria-describedby={wrong ? errorId : undefined}
      onChange={(event) => {
        const day = event.target.value;
        if (liveDateError(bridge.draft, target, day)) { setTyped(day); return; }
        setTyped(null);
        bridge.changeDraft((next) => { applyLiveDate(next, target, day); });
      }}
      onBlur={() => setTyped(null)}
    />
    {wrong && <small id={errorId} role="alert">{liveCopy.dateError}</small>}
  </label>;
}

/** A switch of an entry. «Показывать посетителям» says «Черновик» while it is off. */
export function LiveFlag({ bridge, target, checked }: { bridge: LiveEditorBridge; target: LiveFlagTarget; checked: boolean }) {
  const published = target.kind === "broadcast-published";
  return <label className="live-flag live-tools">
    <input type="checkbox" checked={checked} onChange={(event) => { const on = event.target.checked; bridge.changeDraft((next) => { applyLiveFlag(next, target, on); }); }} />
    <span>{published ? liveCopy.flagPublished : liveCopy.flagImportant}</span>
    {published && !checked && <em className="live-draft-badge">{liveCopy.draft}</em>}
  </label>;
}

/** The display area of the editor's field for a place: it names the look (light paper or dark) the text has for the visitor. */
function richAreaOf(target: LiveTarget): "lead" | "metric" | "mutation" | "scientist" | "caption" | "trash" | "broadcast" | "info" | "assistant" {
  if (target.kind === "assistant-phrase") return "assistant";
  if (target.kind === "broadcast-body") return "broadcast";
  if (target.kind === "virus-text") return target.field.startsWith("ppu-") ? "metric" : "lead";
  if (target.kind === "mutation-description") return "mutation";
  if (target.kind === "log-text") return "scientist";
  if (target.kind === "recycle-file-text") return target.caption ? "caption" : "trash";
  return "info";
}

/**
 * LIVE-05: a formatted text at rest is the visitor's own FormattedText (its GIFs play); pressed, it is the editor's field with the format panel,
 * and under the field the strip of the same GIFs, so a GIF keeps playing while its link is typed. Leaving the field goes back to rest.
 */
export function LiveRich({ bridge, target, text, document, className }: { bridge: LiveEditorBridge; target: LiveTarget; text: string; document?: RichTextDocument; className?: string }) {
  const [editing, setEditing] = useState(false);
  const key = liveTextKey(target);
  // A phrase of the assistant is a line of the document of its group: its own format key keeps the format panel from mixing it with its neighbours.
  const formatKey = liveFormatKey(target);
  const phrase = target.kind === "assistant-phrase";
  useEffect(() => { if (editing) findFormatField(formatKey)?.focus(); }, [editing, formatKey]);
  if (!editing) {
    return <div
      className="live-rich live-editable"
      role="button"
      tabIndex={0}
      aria-label={liveCopy.targets[target.kind]}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditing(true); } }}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setEditing(true); }}
    ><FormattedText className={className} text={text} document={document} emptyText={liveCopy.richEmpty} eagerMedia /></div>;
  }
  return <div
    className="live-rich-edit"
    // One line, one phrase: Enter ends the edit instead of breaking the line (a pasted line break still makes a new phrase, see applyLivePhrase).
    onKeyDownCapture={phrase ? (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      setEditing(false);
    } : undefined}
    onBlur={(event) => {
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      // The format panel and the field's own parts keep the field open.
      if (next && (event.currentTarget.contains(next) || next.closest(".floating-text-format"))) return;
      setEditing(false);
    }}
  >
    <FormattedTextarea
      area={richAreaOf(target)}
      label={liveCopy.targets[target.kind]}
      tall
      value={text}
      document={document}
      formatKey={formatKey}
      onActivate={bridge.activateFormatter}
      // The text of a scientist record lives in the record (content and richContent), a phrase of the assistant in the document of its group, the other formatted texts in draft.formattedText under their key.
      onChange={(value, nextDocument) => target.kind === "log-text"
        ? bridge.changeDraft((next) => { applyLiveLogText(next, target, value, nextDocument); })
        : target.kind === "assistant-phrase"
          ? bridge.changeDraft((next) => { applyLivePhrase(next, target, value, nextDocument); })
          : bridge.changeFormattedText(key, value, nextDocument, (next, written) => { applyLiveText(next, target, written); })}
    />
    <EmbeddedMediaStrip text={text} eager />
  </div>;
}

/** A small popover over a place: closes with Escape, with «Готово» and with a press outside. */
function LivePopover({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.parentElement?.contains(event.target)) onClose(); };
    window.document.addEventListener("pointerdown", outside);
    return () => window.document.removeEventListener("pointerdown", outside);
  }, [onClose]);
  return <div ref={ref} className="live-popover" role="group" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    {children}
    <button type="button" className="secondary-control live-popover-done" onClick={onClose}>{liveCopy.done}</button>
  </div>;
}

const frameBoxOf = { "guide-section-photo": "band", "guide-card-cover": "tile", "guide-photo-url": "free", "info-photo-url": "natural", "virus-infected": "natural", "mutation-image": "natural", "recycle-file-image": "natural" } as const;
const placementOf = { "guide-section-photo": "guide", "guide-card-cover": "guide", "guide-photo-url": "guide", "info-photo-url": "guide", "virus-infected": "dossier", "mutation-image": "mutation", "recycle-file-image": "recycle" } as const;

/** The picture place of the visitor's page (`children`, drawn by the visitor's own PortiaImage, GIFs play) and the way to change its address and visible part. */
export function LiveImage({ bridge, target, value, framing, children, label, fieldLabel, compact = false }: { bridge: LiveEditorBridge; target: LiveImageTarget; value: string; framing?: ImageFraming; children?: ReactNode; label?: string; fieldLabel?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const write = (url: string) => bridge.changeDraft((next) => { applyLiveImage(next, target, url); });
  const tools = <div className={`live-tools live-image-tools${compact ? " is-compact" : ""}`}>
    <button type="button" className="secondary-control live-button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{label ?? (target.kind === "guide-section-photo" ? liveCopy.sectionPhoto : value ? liveCopy.imageReplace : liveCopy.imageAdd)}</button>
    {open && <LivePopover onClose={() => setOpen(false)}>
      <ImageEditorField
        label={fieldLabel ?? (value ? liveCopy.imageReplace : liveCopy.imageAdd)}
        value={value}
        placement={placementOf[target.kind]}
        maxHint={liveCopy.imageHint}
        removeLabel={liveCopy.imageRemove}
        uploadState={bridge.uploadState}
        uploadMessage={bridge.uploadMessage}
        framing={framing}
        framingBox={frameBoxOf[target.kind]}
        onFramingChange={(frame) => bridge.changeDraft((next) => { applyLiveFraming(next, target, frame); })}
        onChange={write}
        onUpload={(file) => { void bridge.uploadImage(file, write); }}
      />
    </LivePopover>}
  </div>;
  if (children === undefined) return tools;
  return <div className="live-image">{children}{tools}</div>;
}

/**
 * A value chosen from a list, in place: a compact button with the chosen value; a press opens the editor's own field for it in a popover
 * (the classification field with its levels, the drop-down of the routes of transmission, the level picker of a scientist record).
 */
export function LiveChoice({ bridge, target, value, label, options }: { bridge: LiveEditorBridge; target: LiveChoiceTarget; value: string; label: string; options?: readonly { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const write = (next: string) => bridge.changeDraft((draft) => { applyLiveChoice(draft, target, next); });
  const shown = options?.find((option) => option.value === value)?.label ?? (value || liveCopy.choiceEmpty);
  return <span className="live-tools live-choice">
    <button type="button" className="live-choice-button" aria-haspopup="true" aria-expanded={open} aria-label={`${label}: ${shown}`} onClick={() => setOpen((current) => !current)}>{shown}</button>
    {open && <LivePopover onClose={() => setOpen(false)}>
      {target.kind === "virus-class"
        ? <ClassificationField label={label} classificationKey={target.axis} value={value} onChange={write} />
        : target.kind === "log-level"
          ? <LevelPicker name={`level-log-${target.logId}`} value={Number(value)} onChange={(level) => write(String(level))} />
          : <label className="editor-field"><span>{label}</span><select value={value} onChange={(event) => write(event.target.value)}>{options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
    </LivePopover>}
  </span>;
}

/** The YouTube link of a video block: what is typed stays visible while it is not a link yet. */
export function LiveVideo({ bridge, target, videoId }: { bridge: LiveEditorBridge; target: LiveTarget; videoId: string }) {
  const [typed, setTyped] = useState("");
  const shown = typed && parseYoutubeId(typed) === videoId ? typed : videoId ? `https://www.youtube.com/watch?v=${videoId}` : typed;
  return <label className="live-video live-tools">
    <span>{liveCopy.videoLabel}</span>
    <input value={shown} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={liveCopy.videoPlaceholder} onChange={(event) => {
      setTyped(event.target.value);
      bridge.changeDraft((next) => { applyLiveText(next, target, event.target.value); });
    }} />
    <small>{videoId ? liveCopy.videoOk : shown ? liveCopy.videoNeed : ""}</small>
  </label>;
}

/** The cards of a block «Карточки»: one list of every card by section, ticked in the chosen order. */
export function LiveCardsPicker({ bridge, target, cardIds }: { bridge: LiveEditorBridge; target: LiveCardsTarget; cardIds: string[] }) {
  const [open, setOpen] = useState(false);
  const set = (next: string[]) => bridge.changeDraft((draft) => { applyLiveCards(draft, target, next); });
  const full = cardIds.length >= 24;
  return <div className="live-tools live-cards-tools">
    <button type="button" className="secondary-control live-button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{liveCopy.cardsPick}</button>
    {open && <LivePopover onClose={() => setOpen(false)}>
      <fieldset className="live-cards-list">
        <legend>{liveCopy.cardsGroup}</legend>
        {bridge.draft.guideSections.map((section) => <div key={section.id} className="live-cards-group">
          <strong>{section.title || liveCopy.untitled}</strong>
          {section.cards.filter((card) => card.id !== target.cardId).map((card) => {
            const checked = cardIds.includes(card.id);
            return <label key={card.id}>
              <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => set(checked ? cardIds.filter((id) => id !== card.id) : [...cardIds, card.id])} />
              <span>{card.title || liveCopy.untitled}</span>
            </label>;
          })}
        </div>)}
        {full && <small>{liveCopy.cardsFull}</small>}
      </fieldset>
    </LivePopover>}
  </div>;
}

/** The compact bar «Добавить: …» of a place; a card page also holds the way to its cover. */
export function LiveAddBar({ bridge, container, onAdded }: { bridge: LiveEditorBridge; container: LiveContainer; onAdded?: LiveHooks["onAdded"] }) {
  const card = container.kind === "guide-card" ? findGuide(bridge.draft.guideSections, container.cardId)?.card : null;
  const virus = container.kind === "virus" ? findLiveVirus(bridge.draft, container.virusId) : null;
  return <div className="live-add-bar live-tools" role="toolbar" aria-label={liveCopy.addGroup}>
    <span className="live-add-label">{liveCopy.addLabel}</span>
    {liveAddKinds(container).map((kind) => {
      const blocked = liveAddBlocked(bridge.draft, container, kind);
      return <button key={kind} type="button" className="secondary-control live-button" disabled={blocked} title={blocked ? liveCopy.full : undefined} onClick={() => {
        if (blocked) return;
        const id = liveNewId(container, kind);
        bridge.changeDraft((next) => { applyLiveAdd(next, container, kind, id); });
        onAdded?.(kind, id, container);
      }}>{container.kind === "assistant-group" ? liveCopy.assistantAdd[container.group] : liveCopy.kinds[kind]}</button>;
    })}
    {container.kind === "virus" && virus && <LiveImage bridge={bridge} target={{ kind: "virus-infected", virusId: virus.id }} value={virus.infectedImage} framing={virus.infectedImageFraming} label={liveCopy.infectedAdd} fieldLabel={liveCopy.infectedLabel} compact />}
    {container.kind === "guide-card" && card && <LiveImage bridge={bridge} target={{ kind: "guide-card-cover", cardId: card.id }} value={card.cover} framing={card.coverFraming} label={liveCopy.cover} fieldLabel={liveCopy.coverLabel} compact />}
  </div>;
}

/** The small remove button; the question comes first, and the formatting panel lets go of what is removed. */
export function LiveRemove({ bridge, item, title }: { bridge: LiveEditorBridge; item: LiveRemovable; title: string }) {
  const [asked, setAsked] = useState(false);
  const name = title ? `${liveCopy.removeNames[item.kind]} «${title}»` : liveCopy.removeNames[item.kind];
  return <span className="live-tools live-remove-wrap">
    <button type="button" className="live-remove" aria-label={`${liveCopy.removeLabel}: ${name}`} onClick={() => setAsked(true)}><span aria-hidden="true">×</span></button>
    {asked && <ConfirmDialog
      title={liveCopy.removeTitle}
      text={liveCopy.removeText(name)}
      onCancel={() => setAsked(false)}
      actions={[
        { label: liveCopy.removeConfirm, tone: "danger", onClick: () => {
          bridge.closeFormatterFor(...liveRemovedKeys(bridge.draft, item));
          bridge.changeDraft((next) => { applyLiveRemove(next, item); });
          setAsked(false);
        } },
        { label: liveCopy.removeCancel, tone: "secondary", autoFocus: true, onClick: () => setAsked(false) },
      ]}
    />}
  </span>;
}

// ---- «Доступ» (26.1-19; owner 2026-11-21, item 13, checkpoint answered: option A) ----

// The one under review in the sense of access is a visitor who files a request. Their screens are code of the site, not data of the draft, so the preview shows them
// and edits nothing. It makes no request and touches no storage of the device: the screen is handed fixed samples and handlers that only keep what is typed here.
// The decision of the checkpoint (owner 2026-11-21, 26.1-OWNER-REQUEST item 25): option A - a preview in every state, texts not edited; editing them would need a new field readable without access.
/**
 * The tab «Доступ» of the editor: the button «ЖИВОЙ РЕЖИМ» above the accounts of the editors (`manager`, kept mounted so nothing typed there is lost) and, with the mode on,
 * the screens of the visitor's gate in place of it, one tab per state (lib/live-edit.ts, accessPreviewStates). The texts of the screens are code of the site: shown, not edited.
 */
export function AccessLiveTab({ manager }: { manager: ReactNode }) {
  const [on, setOn] = useState(false);
  const [current, setCurrent] = useState<AccessPreviewId>("form");
  const [nickname, setNickname] = useState("");
  const [origin, setOrigin] = useState<AccessGateFormState["origin"]>(null);
  const state = accessPreviewStates.find((item) => item.id === current) ?? accessPreviewStates[0];
  // arrows move between the tabs of the states (the pattern of a tab list); the tab picked gets the focus
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const at = accessPreviewStates.findIndex((item) => item.id === state.id);
    const next = accessPreviewStates[(at + step + accessPreviewStates.length) % accessPreviewStates.length];
    setCurrent(next.id);
    event.currentTarget.querySelector<HTMLElement>(`[data-state="${next.id}"]`)?.focus();
  };
  return <>
    <div className="etab-actions access-live-bar"><LiveModeToggle on={on} onToggle={() => setOn((value) => !value)} /></div>
    <div hidden={on}>{manager}</div>
    {on && <div className="live-surface access-live" data-live-app="access" role="group" aria-label={liveCopy.access.surface}>
      <div className="access-live-states" role="tablist" aria-label={liveCopy.access.states} onKeyDown={move}>
        {accessPreviewStates.map((item) => <button key={item.id} type="button" role="tab" className="access-live-state" data-state={item.id} aria-selected={item.id === state.id} tabIndex={item.id === state.id ? 0 : -1} onClick={() => setCurrent(item.id)}>{liveCopy.access.stateLabels[item.id]}</button>)}
      </div>
      <p className="access-live-note">{liveCopy.access.note}</p>
      <div className="access-gate-live" role="tabpanel">
        <AccessGateScreen
          layout={accessGateLayout(state.view, true)}
          checking={state.view.kind === "checking"}
          form={{ nickname, origin, submitting: false, formError: "", fieldErrors: state.fieldErrors }}
          onNickname={setNickname}
          onOrigin={setOrigin}
          onSubmit={(event) => event.preventDefault()}
          onRetry={() => undefined}
          preview={{ note: liveCopy.access.submitNote }}
        />
      </div>
    </div>}
  </>;
}
