"use client";

import { useEffect, useMemo, useState } from "react";
import type { Broadcast, PortiaContent, Virus } from "@/lib/portia-content";

type EditorTab = "viruses" | "info" | "broadcasts" | "search" | "assistant";

type Props = {
  content: PortiaContent;
  saveState: "idle" | "saving" | "saved" | "error";
  onSave: (content: PortiaContent) => Promise<void>;
};

const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = (content: PortiaContent) => JSON.parse(JSON.stringify(content)) as PortiaContent;

const blankVirus = (): Virus => ({
  id: makeId("virus"),
  code: "VIR-",
  name: "НОВЫЙ ВИРУС",
  status: "НАБЛЮДЕНИЕ",
  infectedImage: "",
  external: "",
  ppu: { health: "", speed: "", abilities: "" },
  physiology: "",
  mutations: [],
  classification: {
    danger: "Гефест",
    spread: "Номос",
    transmission: "Контактно-бытовой",
    escapeRisk: "Предупреждение",
    mind: "Альбедо",
    appearance: "Нюктея",
    behavior: "Фобус",
  },
  scientistLogs: [
    { id: makeId("log"), title: "ЗАПИСЬ 01", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""] },
    { id: makeId("log"), title: "ЗАПИСЬ 02", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 4, content: [""] },
  ],
});

export function PortiaEditor({ content, saveState, onSave }: Props) {
  const [draft, setDraft] = useState(() => clone(content));
  const [tab, setTab] = useState<EditorTab>("viruses");
  const [selectedVirusId, setSelectedVirusId] = useState(content.viruses[0]?.id ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    const syncTimer = window.setTimeout(() => {
      setDraft(clone(content));
      setSelectedVirusId((current) => (content.viruses.some((virus) => virus.id === current) ? current : content.viruses[0]?.id ?? ""));
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [content, dirty]);

  const selectedVirusIndex = useMemo(
    () => draft.viruses.findIndex((virus) => virus.id === selectedVirusId),
    [draft.viruses, selectedVirusId],
  );
  const selectedVirus = selectedVirusIndex >= 0 ? draft.viruses[selectedVirusIndex] : null;

  const changeDraft = (updater: (next: PortiaContent) => void) => {
    setDraft((current) => {
      const next = clone(current);
      updater(next);
      return next;
    });
    setDirty(true);
  };

  const updateVirus = (updater: (virus: Virus) => void) => {
    if (selectedVirusIndex < 0) return;
    changeDraft((next) => updater(next.viruses[selectedVirusIndex]));
  };

  const save = async () => {
    try {
      const normalized = clone(draft);
      normalized.searchRecommendations = normalized.searchRecommendations.map((value) => value.trim()).filter(Boolean);
      normalized.assistantAdvice = normalized.assistantAdvice.map((value) => value.trim()).filter(Boolean);
      await onSave(normalized);
      setDraft(normalized);
      setDirty(false);
    } catch {
      // Keep the local draft marked as changed so a temporary network error
      // can never discard the owner's work.
    }
  };

  return (
    <div className="content-editor">
      <header className="editor-header">
        <div>
          <span className="eyebrow">УПРАВЛЕНИЕ СОДЕРЖИМЫМ</span>
          <h1>Редактор PORTIA</h1>
          <p>Изменения сохраняются в общей базе и автоматически появляются у посетителей.</p>
        </div>
        <div className="editor-save-zone">
          <span className={`editor-save-status ${saveState}`}>{saveState === "saving" ? "СОХРАНЕНИЕ…" : saveState === "saved" ? "СОХРАНЕНО" : saveState === "error" ? "ОШИБКА" : dirty ? "ЕСТЬ ИЗМЕНЕНИЯ" : "БЕЗ ИЗМЕНЕНИЙ"}</span>
          <button className="primary-control" type="button" onClick={save} disabled={!dirty || saveState === "saving"}>СОХРАНИТЬ ВСЁ</button>
        </div>
      </header>

      <nav className="editor-tabs" aria-label="Разделы редактора">
        {([
          ["viruses", "База вирусов"],
          ["info", "Информация"],
          ["broadcasts", "Сообщения"],
          ["search", "Рекомендации"],
          ["assistant", "Помощник"],
        ] as [EditorTab, string][]).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === "viruses" && (
        <div className="virus-editor-layout">
          <aside className="editor-record-list">
            {draft.viruses.map((virus) => (
              <button key={virus.id} type="button" className={virus.id === selectedVirusId ? "active" : ""} onClick={() => setSelectedVirusId(virus.id)}>
                <strong>{virus.name || "БЕЗ НАЗВАНИЯ"}</strong><small>{virus.code || "БЕЗ КОДА"}</small>
              </button>
            ))}
            <button className="add-record" type="button" onClick={() => {
              const virus = blankVirus();
              changeDraft((next) => next.viruses.push(virus));
              setSelectedVirusId(virus.id);
            }}>+ ДОБАВИТЬ ВИРУС</button>
          </aside>

          {selectedVirus ? (
            <div className="editor-form virus-editor-form">
              <EditorGroup title="Основные данные">
                <Field label="Название"><input value={selectedVirus.name} onChange={(event) => updateVirus((virus) => { virus.name = event.target.value; })} /></Field>
                <Field label="Код"><input value={selectedVirus.code} onChange={(event) => updateVirus((virus) => { virus.code = event.target.value; })} /></Field>
                <Field label="Статус"><input value={selectedVirus.status} onChange={(event) => updateVirus((virus) => { virus.status = event.target.value; })} /></Field>
                <Field label="Ссылка на фото после заражения"><input value={selectedVirus.infectedImage} placeholder="https://…" onChange={(event) => updateVirus((virus) => { virus.infectedImage = event.target.value; })} /></Field>
              </EditorGroup>

              <EditorGroup title="Описание">
                <Field label="Внешние характеристики" wide><textarea value={selectedVirus.external} onChange={(event) => updateVirus((virus) => { virus.external = event.target.value; })} /></Field>
                <Field label="Физиологические характеристики" wide><textarea value={selectedVirus.physiology} onChange={(event) => updateVirus((virus) => { virus.physiology = event.target.value; })} /></Field>
              </EditorGroup>

              <EditorGroup title="Характеристики PPU">
                {(["health", "speed", "abilities"] as const).map((key) => (
                  <Field key={key} label={{ health: "Здоровье", speed: "Скорость", abilities: "Способности" }[key]} wide>
                    <textarea value={selectedVirus.ppu[key]} onChange={(event) => updateVirus((virus) => { virus.ppu[key] = event.target.value; })} />
                  </Field>
                ))}
              </EditorGroup>

              <EditorGroup title="Классификация">
                {([
                  ["danger", "Общий уровень опасности"], ["spread", "Распространение"], ["transmission", "Способ распространения"],
                  ["escapeRisk", "Угроза и риск побега"], ["mind", "Разум"], ["appearance", "Вид / внешность"], ["behavior", "Поведение"],
                ] as [keyof Virus["classification"], string][]).map(([key, label]) => (
                  <Field key={key} label={label}><input value={selectedVirus.classification[key]} onChange={(event) => updateVirus((virus) => { virus.classification[key] = event.target.value; })} /></Field>
                ))}
              </EditorGroup>

              <EditorGroup title="Мутации" stack>
                {selectedVirus.mutations.map((mutation, index) => (
                  <div className="nested-editor-card" key={index}>
                    <div className="nested-editor-head"><strong>МУТАЦИЯ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => updateVirus((virus) => { virus.mutations.splice(index, 1); })}>Удалить</button></div>
                    <Field label="Название"><input value={mutation.name} onChange={(event) => updateVirus((virus) => { virus.mutations[index].name = event.target.value; })} /></Field>
                    <Field label="Описание" wide><textarea value={mutation.description} onChange={(event) => updateVirus((virus) => { virus.mutations[index].description = event.target.value; })} /></Field>
                    <Field label="Ссылка на изображение"><input value={mutation.image} placeholder="https://…" onChange={(event) => updateVirus((virus) => { virus.mutations[index].image = event.target.value; })} /></Field>
                  </div>
                ))}
                <button className="secondary-control" type="button" onClick={() => updateVirus((virus) => virus.mutations.push({ name: "НОВАЯ МУТАЦИЯ", description: "", image: "" }))}>+ ДОБАВИТЬ МУТАЦИЮ</button>
              </EditorGroup>

              <EditorGroup title="Записи учёных" stack>
                {selectedVirus.scientistLogs.map((log, index) => (
                  <div className="nested-editor-card" key={log.id}>
                    <div className="nested-editor-head"><strong>ЗАПИСЬ {String(index + 1).padStart(2, "0")}</strong><button type="button" disabled={selectedVirus.scientistLogs.length <= 2} onClick={() => updateVirus((virus) => { virus.scientistLogs.splice(index, 1); })}>Удалить</button></div>
                    <Field label="Название"><input value={log.title} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].title = event.target.value; })} /></Field>
                    <Field label="Псевдоним учёного"><input value={log.scientist} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].scientist = event.target.value; })} /></Field>
                    <Field label="Уровень заблокированных записей"><select value={log.lockedLevel} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].lockedLevel = Number(event.target.value); })}><option value={3}>III</option><option value={4}>IV</option></select></Field>
                    <Field label="Текст записи" wide><textarea value={log.content.join("\n\n")} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].content = event.target.value.split(/\n\s*\n/); })} /></Field>
                  </div>
                ))}
                <button className="secondary-control" type="button" disabled={selectedVirus.scientistLogs.length >= 5} onClick={() => updateVirus((virus) => virus.scientistLogs.push({ id: makeId("log"), title: `ЗАПИСЬ ${String(virus.scientistLogs.length + 1).padStart(2, "0")}`, scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""] }))}>+ ДОБАВИТЬ ЗАПИСЬ</button>
              </EditorGroup>

              <button className="danger-control" type="button" disabled={draft.viruses.length <= 1} onClick={() => {
                const nextId = draft.viruses.find((virus) => virus.id !== selectedVirus.id)?.id ?? "";
                changeDraft((next) => { next.viruses = next.viruses.filter((virus) => virus.id !== selectedVirus.id); });
                setSelectedVirusId(nextId);
              }}>УДАЛИТЬ ЭТОТ ВИРУС</button>
            </div>
          ) : <div className="editor-empty">Добавьте первую запись вируса.</div>}
        </div>
      )}

      {tab === "info" && (
        <div className="editor-form flat-editor-form">
          <p className="editor-guidance">Каждый блок становится отдельным разделом приложения «Информация».</p>
          {draft.infoSections.map((section, index) => (
            <div className="nested-editor-card" key={section.id}>
              <div className="nested-editor-head"><strong>РАЗДЕЛ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => changeDraft((next) => { next.infoSections.splice(index, 1); })}>Удалить</button></div>
              <Field label="Заголовок"><input value={section.title} onChange={(event) => changeDraft((next) => { next.infoSections[index].title = event.target.value; })} /></Field>
              <Field label="Текст" wide><textarea className="tall-textarea" value={section.body} onChange={(event) => changeDraft((next) => { next.infoSections[index].body = event.target.value; })} /></Field>
            </div>
          ))}
          <button className="secondary-control" type="button" onClick={() => changeDraft((next) => next.infoSections.push({ id: makeId("info"), title: "НОВЫЙ РАЗДЕЛ", body: "" }))}>+ ДОБАВИТЬ РАЗДЕЛ</button>
        </div>
      )}

      {tab === "broadcasts" && (
        <div className="editor-form flat-editor-form">
          <p className="editor-guidance">Публикуйте еженедельные квесты, задачи и новости. Отключённые сообщения сохраняются как черновики.</p>
          {draft.broadcasts.length === 0 && <div className="editor-empty">Сообщений пока нет. Создайте первое сообщение.</div>}
          {draft.broadcasts.map((broadcast, index) => (
            <div className="nested-editor-card" key={broadcast.id}>
              <div className="nested-editor-head"><strong>СООБЩЕНИЕ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => changeDraft((next) => { next.broadcasts.splice(index, 1); })}>Удалить</button></div>
              <Field label="Тип"><select value={broadcast.type} onChange={(event) => changeDraft((next) => { next.broadcasts[index].type = event.target.value as Broadcast["type"]; })}><option value="quest">Еженедельный квест</option><option value="task">Задача</option><option value="news">Новость</option></select></Field>
              <Field label="Заголовок"><input value={broadcast.title} onChange={(event) => changeDraft((next) => { next.broadcasts[index].title = event.target.value; })} /></Field>
              <Field label="Текст" wide><textarea className="tall-textarea" value={broadcast.body} onChange={(event) => changeDraft((next) => { next.broadcasts[index].body = event.target.value; })} /></Field>
              <label className="publish-toggle"><input type="checkbox" checked={broadcast.published} onChange={(event) => changeDraft((next) => { next.broadcasts[index].published = event.target.checked; })} /><span>Показывать посетителям</span></label>
            </div>
          ))}
          <button className="secondary-control" type="button" onClick={() => changeDraft((next) => next.broadcasts.unshift({ id: makeId("broadcast"), type: "news", title: "", body: "", published: false }))}>+ НОВОЕ СООБЩЕНИЕ</button>
        </div>
      )}

      {tab === "search" && (
        <div className="editor-form flat-editor-form compact-editor">
          <p className="editor-guidance">Каждая строка станет ненавязчивой рекомендацией под строкой глобального поиска.</p>
          <Field label="Рекомендации" wide>
            <textarea className="tall-textarea" value={draft.searchRecommendations.join("\n")} onChange={(event) => changeDraft((next) => { next.searchRecommendations = event.target.value.split("\n"); })} />
          </Field>
        </div>
      )}

      {tab === "assistant" && (
        <div className="editor-form flat-editor-form compact-editor">
          <p className="editor-guidance">Каждая строка станет отдельным советом помощника. При каждом нажатии он покажет следующий совет.</p>
          <Field label="Советы помощника" wide>
            <textarea className="tall-textarea" value={draft.assistantAdvice.join("\n")} onChange={(event) => changeDraft((next) => { next.assistantAdvice = event.target.value.split("\n"); })} />
          </Field>
        </div>
      )}
    </div>
  );
}

function EditorGroup({ title, children, stack = false }: { title: string; children: React.ReactNode; stack?: boolean }) {
  return <section className={`editor-group${stack ? " stack" : ""}`}><h2>{title}</h2><div className="editor-field-grid">{children}</div></section>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`editor-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>;
}
