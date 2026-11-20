"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ConfirmDialog, EditorGroup, Field, ImageEditorField } from "@/components/portia-editor-dossier";
import { EditorActionBar } from "@/components/portia-editor-tab-shell";
import { createEmployeeDraftStore, detailsOf, dirtyEmployeeIds, draftFor, employeeRowName, saveQueue, type EmployeeDraft, type EmployeeDraftStore } from "@/lib/employee-drafts";
import { employeeRequestFailure, saveStatusText } from "@/lib/editor-save-status";
import { tabRegistry } from "@/lib/editor-tabs";
import { acceptsEditorList, changedDetails, changedFields, employeeRatings, profileOf, type EmployeeProfile, type ManualDetails, type PortiaEmployee } from "@/lib/portia-employees";

// Seam of the editor (D-21): «Сотрудники». The component moved here from components/portia-editor.tsx so the owner's
// change (OWN-07, 2026-11-20) is one registry entry there instead of an edit inside a 400-line function.
// The unsaved drafts are one per employee, keyed by id, and live in a store that PortiaEditor creates: leaving the tab and
// coming back keeps them, and the question «Сохранить изменения?» is asked once, when the window closes.

// On a phone the list and the record swap places; bring the new half to the top (read after the next render).
function revealOnPhone(ref: React.RefObject<HTMLElement | null>) {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  window.requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start" }));
}

/** The drafts of the employees, created once per editor. Reload or leaving the page with any unsaved employee draft shows the browser's own warning (D-12). */
export function useEmployeeDraftStore(): EmployeeDraftStore {
  const [store] = useState(createEmployeeDraftStore);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    let attached = false;
    const sync = () => {
      const wanted = store.hasDirty();
      if (wanted && !attached) window.addEventListener("beforeunload", warn);
      else if (!wanted && attached) window.removeEventListener("beforeunload", warn);
      attached = wanted;
    };
    sync();
    const off = store.subscribe(sync);
    return () => {
      off();
      window.removeEventListener("beforeunload", warn);
      // WR-07 (26.1 review): the drafts are dropped when the editor really goes away, not when «НЕ СОХРАНЯТЬ» is pressed: a later «Отмена» of the
      // outer «Закрыть редактор?» keeps the editor, and the drafts with it.
      store.reset();
    };
  }, [store]);
  return store;
}

const emptyDetails: ManualDetails = { title: "", rank: "", callsign: "" };

export function EmployeeProfilesEditor({ onSaved, onRemoved, uploadState, uploadMessage, onUpload, onDirtyChange, leaving, onLeave, drafts: store }: {
  onSaved: (employee: PortiaEmployee) => void;
  onRemoved: (id: string) => void;
  uploadState: "idle" | "uploading" | "error";
  uploadMessage?: string;
  onUpload: (file: File, onUploaded: (url: string) => void) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** The editor wants to close the window; every unsaved draft has to be answered first. */
  leaving: boolean;
  onLeave: (ok: boolean) => void;
  /** One draft per employee id; it outlives this component. */
  drafts: EmployeeDraftStore;
}) {
  const [employees, setEmployees] = useState<PortiaEmployee[]>([]);
  // The newest list, read after an awaited save, when the render that started it is old.
  const employeesRef = useRef<PortiaEmployee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ratingsPending, setRatingsPending] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // Loading the list and saving a card are separate: a load error replaces the tab, a save error stays on the save line.
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recordOpen, setRecordOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  // The add form has its own state: the drafts and their unsaved-edits guard stay untouched.
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ nickname: "", title: "", rank: "", callsign: "" });
  const [addState, setAddState] = useState<"idle" | "adding">("idle");
  const [addError, setAddError] = useState("");
  const [deleteAsked, setDeleteAsked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailsPending, setDetailsPending] = useState(false);
  // Every employee's unsaved edits: found by id, never by what is open (D-05).
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const selected = employees.find((employee) => employee.id === selectedId) ?? employees[0] ?? null;
  const current = selected ? draftFor(snapshot.drafts, selected) : null;
  const draft = current?.profile ?? null;
  const details = current?.details ?? emptyDetails;
  const dirtyIds = dirtyEmployeeIds(snapshot.drafts, employees);
  const dirtyCount = dirtyIds.length;
  const dirty = Boolean(selected && dirtyIds.includes(selected.id));
  // An upload that finishes after another employee was opened lands on the draft of the employee it started for.
  const selectedIdRef = useRef("");
  useEffect(() => { selectedIdRef.current = selected?.id ?? ""; });
  // Read after an awaited save: a cancelled question must not continue into the close (D-02).
  const askingRef = useRef(leaving);
  useEffect(() => { askingRef.current = leaving; });
  // The «СОХРАНЕНО» timer lives in a ref so a later save and an unmount can cancel it (D-06).
  const savedTimer = useRef<number | null>(null);
  useEffect(() => () => { if (savedTimer.current !== null) window.clearTimeout(savedTimer.current); }, []);
  // An employee clicked during a save, acted on once the answer is in (D-05).
  const queuedEmployeeIdRef = useRef<string | null>(null);
  // WR-05: the running save requests, one per employee id; a second Ctrl+S or click during one joins it instead of sending again.
  const saveInflight = useRef<Map<string, Promise<boolean>>>(new Map());
  const addInflight = useRef(false);

  // Only a loaded list can say what is dirty; the flag of an earlier visit stays until then. Unmounting does not clear it: the drafts live on.
  useEffect(() => { if (loadState === "ready") onDirtyChange(dirtyCount > 0); }, [loadState, dirtyCount, onDirtyChange]);
  // The store compares drafts with the last loaded list, also while this tab is not on screen.
  useEffect(() => { if (loadState === "ready") store.setKnown(employees); }, [loadState, employees, store]);
  // A close asked while nothing is left to save goes through; a list that did not load cannot show the question, so the close is declined.
  useEffect(() => {
    if (!leaving) return;
    if (loadState === "ready" && dirtyCount === 0) onLeave(true);
    else if (loadState === "error") onLeave(false);
  }, [leaving, loadState, dirtyCount, onLeave]);

  const commitEmployees = (next: PortiaEmployee[]) => {
    employeesRef.current = next;
    setEmployees(next);
  };

  useEffect(() => {
    let active = true;
    const fail = (text: string) => {
      if (!active) return;
      setLoadError(text);
      setLoadState("error");
    };
    void (async () => {
      try {
        // The editor-only path is never CDN-cached; the public one can serve an old copy even to a no-store request (D-10).
        let response: Response;
        try {
          response = await fetch("/api/employees/editor", { credentials: "same-origin", cache: "no-store" });
        } catch {
          fail(employeeRequestFailure({ transport: true, action: "load" }));
          return;
        }
        const payload = await response.json().catch(() => ({})) as { employees?: PortiaEmployee[]; profilesRead?: boolean; error?: string };
        if (!response.ok) {
          fail(employeeRequestFailure({ transport: false, status: response.status, payloadError: payload.error, action: "load" }));
          return;
        }
        if (!active) return;
        // Blank profiles must not become drafts: saving one would erase the stored biography and photo (D-09).
        if (!acceptsEditorList(payload)) {
          fail("Профили сотрудников не загрузились, сохранять сейчас нельзя. Повторите через минуту.");
          return;
        }
        const next = payload.employees;
        const first = next[0];
        employeesRef.current = next;
        setEmployees(next);
        setSelectedId(first?.id ?? "");
        setLoadState("ready");
      } catch {
        fail("Не удалось загрузить сотрудников.");
      }
    })();
    return () => { active = false; };
  }, [loadAttempt]);
  // In place, without a page reload: other tabs' unsaved edits live in the parent and stay.
  const retryLoad = () => { setLoadState("loading"); setLoadAttempt((attempt) => attempt + 1); };

  // The typed values go into the draft of the open employee; the other drafts are not touched.
  const editProfile = (change: (profile: EmployeeProfile) => EmployeeProfile) => {
    if (selected) store.update(selected, (entry) => ({ ...entry, profile: change(entry.profile) }));
  };
  const editDetails = (change: (value: ManualDetails) => ManualDetails) => {
    if (selected) store.update(selected, (entry) => ({ ...entry, details: change(entry.details) }));
  };

  // Synchronous, no await: the save answer reads askingRef right after it (A4). An open question decides itself. A failed save forgets the click.
  const resolveQueued = (saved: boolean) => {
    const queued = queuedEmployeeIdRef.current;
    queuedEmployeeIdRef.current = null;
    if (!saved || queued === null || askingRef.current) return;
    const next = employeesRef.current.find((employee) => employee.id === queued);
    if (next) openEmployee(next);
  };

  // A second Ctrl+S or click while the PATCH runs gets the same answer and sends nothing (WR-05). Without an id: the open employee.
  const save = (id: string = selected?.id ?? "", named = false): Promise<boolean> => {
    const running = saveInflight.current.get(id);
    if (running) return running;
    const run = (async () => {
      try {
        return await sendSave(id, named);
      } finally {
        saveInflight.current.delete(id);
      }
    })();
    saveInflight.current.set(id, run);
    return run;
  };

  // Resolves true only when the profile is saved and nothing was typed meanwhile; a failure leaves the error text (with the nickname when `named`).
  const sendSave = async (id: string, named: boolean): Promise<boolean> => {
    const employee = employeesRef.current.find((item) => item.id === id);
    if (!employee) return false;
    const sent: EmployeeDraft = store.draftFor(employee);
    // Only what the editor changed goes out; an empty body would still create a bare row for a never-saved sheet employee (D-11).
    const changes = changedFields(profileOf(employee), sent.profile);
    const detailChanges = employee.source === "manual" ? changedDetails(detailsOf(employee), sent.details) : {};
    if (!Object.keys(changes).length && !Object.keys(detailChanges).length) return true;
    // An earlier «СОХРАНЕНО» timer must not flip this save back to idle (03.1-WR-06).
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = null;
    setState("saving");
    setRatingsPending(false);
    setDetailsPending(false);
    setErrorMessage("");
    const failed = (text: string) => {
      setErrorMessage(named ? `${employee.nickname}: ${text}` : text);
      setState("error");
      resolveQueued(false);
      return false;
    };
    let response: Response;
    try {
      response = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: employee.id, nickname: employee.nickname, changes, ...(Object.keys(detailChanges).length ? { details: detailChanges } : {}) }),
      });
    } catch {
      return failed(employeeRequestFailure({ transport: true, action: "save" }));
    }
    const payload = await response.json().catch(() => ({})) as { employee?: Partial<PortiaEmployee> & { id: string }; ratingsPending?: boolean; detailsPending?: boolean; error?: string };
    if (!response.ok || !payload.employee) {
      return failed(employeeRequestFailure({ transport: false, status: response.status, payloadError: payload.error, action: "save" }));
    }
    try {
      // The answer is the stored profile only; the card keeps its avatar, nickname, source and sheet title (D-07).
      const merged: PortiaEmployee = { ...employee, ...payload.employee };
      commitEmployees(employeesRef.current.map((item) => item.id === merged.id ? merged : item));
      onSaved(merged);
      // The answer settles only the fields not typed since sending, and only on the employee it was sent for (D-04, D-05).
      // When the database refused the details, the typed values stay as an unsaved edit.
      store.settle(sent, merged, { detailsPending: Boolean(payload.detailsPending) });
      if (selectedIdRef.current === id) {
        setRatingsPending(Boolean(payload.ratingsPending));
        setDetailsPending(Boolean(payload.detailsPending));
      }
      setState("saved");
      savedTimer.current = window.setTimeout(() => setState("idle"), 4000);
      // A draft typed during the save stays dirty and unsaved; no automatic second save (D-04). No await from here to the return (A4).
      resolveQueued(true);
      return !store.isDirty(id);
    } catch {
      return failed("Не удалось сохранить профиль.");
    }
  };

  // Every employee with unsaved edits, one after another, the open one first; the first refusal stops the run and its employee is shown with the error.
  const saveAll = async (): Promise<boolean> => {
    for (const id of saveQueue(store.dirtyIds(), selectedIdRef.current)) {
      if (!(await save(id, true))) {
        setSelectedId(id);
        setRecordOpen(true);
        return false;
      }
    }
    return true;
  };

  // A person outside the sheet, by Roblox nickname; an open selection and its draft stay as they are.
  const addEmployee = async () => {
    // A second submit during the POST sends nothing (WR-05).
    if (addInflight.current) return;
    addInflight.current = true;
    setAddState("adding");
    setAddError("");
    try {
      let response: Response;
      try {
        response = await fetch("/api/employees", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(addDraft),
        });
      } catch {
        setAddError(employeeRequestFailure({ transport: true, action: "add" }));
        return;
      }
      const payload = await response.json().catch(() => ({})) as { employee?: PortiaEmployee; error?: string };
      if (!response.ok || !payload.employee) {
        setAddError(employeeRequestFailure({ transport: false, status: response.status, payloadError: payload.error, action: "add" }));
        return;
      }
      commitEmployees([...employeesRef.current, payload.employee]);
      onSaved(payload.employee);
      setAddDraft({ nickname: "", title: "", rank: "", callsign: "" });
      setAddOpen(false);
      // The list was empty (or the last person was removed): nothing is open yet, so open the new person.
      if (!selected) openEmployee(payload.employee);
    } catch {
      setAddError("Не удалось добавить сотрудника.");
    } finally {
      addInflight.current = false;
      setAddState("idle");
    }
  };

  if (loadState === "loading") return <div className="editor-empty">Загрузка сотрудников…</div>;
  if (loadState === "error") return <div className="editor-empty" role="alert"><p>{loadError}</p>{loadError.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}<button type="button" className="secondary-control" onClick={retryLoad}>ПОВТОРИТЬ</button></div>;

  const openEmployee = (employee: PortiaEmployee) => {
    setSelectedId(employee.id);
    setRatingsPending(false);
    setDetailsPending(false);
    setState("idle");
    setRecordOpen(true);
    revealOnPhone(layoutRef);
  };
  // Another employee opens at once: the draft of the one left stays in the store and comes back when they are opened again (OWN-07).
  const chooseEmployee = (employee: PortiaEmployee) => {
    // A sent PATCH cannot be cancelled: remember the click and act after the answer, which is matched by id (D-05). Clicking the open employee forgets it.
    if (state === "saving" && selected) {
      if (employee.id === selected.id) { queuedEmployeeIdRef.current = null; setRecordOpen(true); revealOnPhone(layoutRef); }
      else queuedEmployeeIdRef.current = employee.id;
      return;
    }
    // The same employee with edits: only show the record, the edits stay.
    if (employee.id === selected?.id && dirty) { setRecordOpen(true); revealOnPhone(layoutRef); return; }
    openEmployee(employee);
  };
  // After the answer to the close question: the window goes on closing, or stays.
  // The drafts are not dropped here (WR-07): when the content has unsaved edits too, the editor asks «Закрыть редактор?» next, and its «Отмена» must find the drafts.
  // They go with the editor, see useEmployeeDraftStore.
  const continueLeave = () => {
    onLeave(true);
  };
  const cancelLeave = () => {
    if (leaving) onLeave(false);
  };

  // Only reached for a manual employee (the button renders for no one else); the server refuses a sheet employee too.
  const removeSelected = async () => {
    if (!selected) return;
    setDeleting(true);
    setErrorMessage("");
    const failed = (text: string) => {
      setErrorMessage(text);
      setState("error");
      setDeleteAsked(false);
      setDeleting(false);
    };
    let response: Response;
    try {
      response = await fetch("/api/employees", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
    } catch {
      failed(employeeRequestFailure({ transport: true, action: "remove" }));
      return;
    }
    const payload = await response.json().catch(() => ({})) as { id?: string; error?: string; code?: string };
    if (!response.ok) {
      // A sheet employee is refused with 403 and its own text; that is not an expired session.
      const sheetRefusal = response.status === 403 && payload.code === "sheet-employee";
      failed(employeeRequestFailure({ transport: false, status: sheetRefusal ? undefined : response.status, payloadError: payload.error, action: "remove" }));
      return;
    }
    try {
      const index = employees.findIndex((employee) => employee.id === selected.id);
      const next = employees[index + 1] ?? employees[index - 1];
      commitEmployees(employees.filter((employee) => employee.id !== selected.id));
      store.drop(selected.id);
      onRemoved(selected.id);
      setDeleteAsked(false);
      if (next) openEmployee(next);
      else setRecordOpen(false);
    } catch {
      failed("Не удалось удалить сотрудника.");
      return;
    }
    setDeleting(false);
  };

  // «СОХРАНЕНО» never shows over a draft that is dirty again.
  const saveStatus = state === "saved" && dirty ? "idle" : state;
  const preview = selected && draft ? draft.photoUrl || selected.robloxAvatarUrl : "";
  const dirtyNames = dirtyIds.map((id) => employees.find((employee) => employee.id === id)?.nickname ?? id).join(", ");
  return <>
    <EditorActionBar
      label={tabRegistry.find((entry) => entry.id === "employees")?.label ?? ""}
      statusText={selected && draft ? (saveStatus === "saving" ? saveStatusText("saving") : saveStatus === "saved" ? saveStatusText("saved") : state === "error" ? errorMessage : "ТОЛЬКО ДЛЯ РЕДАКТОРОВ") : ""}
      tone={saveStatus}
      actions={selected && draft ? <>{state === "error" && errorMessage.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}{dirtyCount > 1 && <button className="secondary-control" type="button" disabled={state === "saving"} onClick={() => void saveAll()}>{`СОХРАНИТЬ ВСЕ · ${dirtyCount}`}</button>}<button className="primary-control" type="button" disabled={state === "saving"} onClick={() => void save()}>СОХРАНИТЬ ПРОФИЛЬ</button></> : undefined}
    />
    <div className="virus-editor-layout employee-editor-layout etab-body" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>
    <button type="button" className="secondary-control editor-back-to-list" onClick={() => { setRecordOpen(false); revealOnPhone(layoutRef); }}>← К списку</button>
    <aside className="editor-record-list etab-list">
      {employees.map((employee) => {
        // The dot is the same mark as on the tab strip; its name for a screen reader holds the visible text of the row first (WCAG 2.5.3).
        const unsaved = dirtyIds.includes(employee.id);
        return <button key={employee.id} type="button" className={employee.id === selected?.id ? "active" : ""} aria-current={employee.id === selected?.id ? "true" : undefined} aria-label={unsaved ? employeeRowName(employee, true) : undefined} onClick={() => chooseEmployee(employee)}><strong>{employee.nickname}{unsaved && <i className="tab-dot" aria-hidden="true" />}</strong>{employee.source === "manual" && <small className="manual-mark">ВНЕ ТАБЛИЦЫ</small>}<small>{[employee.callsign, employee.title, employee.rank].filter(Boolean).join(" · ")}</small></button>;
      })}
      <button className="add-record" type="button" aria-expanded={addOpen} onClick={() => setAddOpen((open) => !open)}>+ ВНЕ ТАБЛИЦЫ</button>
      {addOpen && <form className="employee-add-form" onSubmit={(event) => { event.preventDefault(); void addEmployee(); }}>
        <Field label="Ник Roblox"><input value={addDraft.nickname} required maxLength={20} autoCapitalize="none" spellCheck={false} onChange={(event) => setAddDraft((current) => ({ ...current, nickname: event.target.value }))} /></Field>
        <Field label="Звание"><input value={addDraft.title} maxLength={64} onChange={(event) => setAddDraft((current) => ({ ...current, title: event.target.value }))} /></Field>
        <Field label="Ранг"><input value={addDraft.rank} maxLength={64} onChange={(event) => setAddDraft((current) => ({ ...current, rank: event.target.value }))} /></Field>
        <Field label="Позывной"><input value={addDraft.callsign} maxLength={64} onChange={(event) => setAddDraft((current) => ({ ...current, callsign: event.target.value }))} /></Field>
        {addError && <p className="employee-add-error" role="alert">{addError}</p>}
        <button className="primary-control" type="submit" disabled={addState === "adding" || !addDraft.nickname.trim()}>{addState === "adding" ? "ДОБАВЛЕНИЕ…" : "ДОБАВИТЬ"}</button>
      </form>}
    </aside>
    <div className="editor-form employee-profile-editor etab-detail">
      {selected && draft ? <>
      <p className="editor-guidance">Поля из Google Таблицы обновляются автоматически. Здесь редакторы могут менять фотографию, оценки и биографию. Людей вне таблицы добавляют по нику Roblox; их звание, ранг и позывной можно менять здесь.</p>
      <div className="employee-editor-summary">
        <figure>{preview ? <img src={preview} alt={`Аватар ${selected.nickname}`} referrerPolicy="no-referrer" /> : <img src="/assets/portia-logo.png" alt="" />}</figure>
        <div><span className="eyebrow">{selected.title || "БЕЗ ЗВАНИЯ"}</span><h2>{selected.nickname}</h2><p>{[selected.callsign || "без позывного", selected.rank || "ранг не указан"].join(" · ")}</p></div>
      </div>
      <EditorGroup title="Профиль сотрудника">
        {selected.source === "manual" && <>
          <Field label="Звание"><input value={details.title} maxLength={64} onChange={(event) => editDetails((value) => ({ ...value, title: event.target.value }))} /></Field>
          <Field label="Ранг"><input value={details.rank} maxLength={64} onChange={(event) => editDetails((value) => ({ ...value, rank: event.target.value }))} /></Field>
          <Field label="Позывной"><input value={details.callsign} maxLength={64} onChange={(event) => editDetails((value) => ({ ...value, callsign: event.target.value }))} /></Field>
        </>}
        {employeeRatings.map(({ key, label }) => <Field key={key} label={`${label} — от 1 до 10`}><select value={draft[key] ?? ""} onChange={(event) => editProfile((profile) => ({ ...profile, [key]: event.target.value === "" ? null : Number(event.target.value) }))}><option value="">—</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>)}
        <ImageEditorField label="Фото сотрудника" value={draft.photoUrl} placement="employee" maxHint="Пусто — используется аватар Roblox" uploadState={uploadState} uploadMessage={uploadMessage} onChange={(value) => editProfile((profile) => ({ ...profile, photoUrl: value }))} onUpload={(file) => {
          const startedFor = selected.id;
          onUpload(file, (url) => {
            // The picture goes to the draft of the employee it was chosen for, also when another one is open by now.
            const target = employeesRef.current.find((item) => item.id === startedFor);
            if (target) store.update(target, (entry) => ({ ...entry, profile: { ...entry.profile, photoUrl: url } }));
          });
        }} />
        <Field label="Биография" wide><textarea className="tall-textarea" value={draft.biography} onChange={(event) => editProfile((profile) => ({ ...profile, biography: event.target.value }))} /></Field>
      </EditorGroup>
      {ratingsPending && <p className="editor-guidance" role="status">Сохранено без новых оценок ({employeeRatings.map((rating) => rating.label).join(", ")}): база данных ещё не обновлена.</p>}
      {detailsPending && <p className="editor-guidance" role="status">Профиль сохранён, но звание, ранг и позывной — нет: база данных ещё не обновлена.</p>}
      {selected.source === "manual" && <button type="button" className="danger-control employee-remove" disabled={state === "saving" || deleting} onClick={() => setDeleteAsked(true)}>УДАЛИТЬ СОТРУДНИКА</button>}
      </> : <div className="editor-empty">Сотрудников пока нет. Добавьте человека вне таблицы кнопкой «+ ВНЕ ТАБЛИЦЫ».</div>}
    </div>
    {deleteAsked && selected?.source === "manual" && (
      <ConfirmDialog
        title="Удалить сотрудника?"
        text={`${selected.nickname} будет убран из списка. Фото, оценки и биография останутся в базе и вернутся, если добавить этот ник снова.`}
        actions={[
          { label: "УДАЛИТЬ", tone: "danger", disabled: deleting, onClick: () => void removeSelected() },
          { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setDeleteAsked(false) },
        ]}
        onCancel={() => setDeleteAsked(false)}
      />
    )}
    {leaving && dirtyCount > 0 && (
      <ConfirmDialog
        title="Сохранить изменения?"
        text={`Не сохранено: ${dirtyNames}.`}
        actions={[
          {
            label: "СОХРАНИТЬ ВСЕ",
            tone: "primary",
            disabled: state === "saving",
            onClick: () => {
              void saveAll().then((saved) => {
                if (!askingRef.current) return;
                if (saved) onLeave(true);
                else cancelLeave();
              });
            },
          },
          { label: "НЕ СОХРАНЯТЬ", tone: "danger", disabled: state === "saving", onClick: continueLeave },
          { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: cancelLeave },
        ]}
        onCancel={cancelLeave}
      />
    )}
  </div>
  </>;
}
