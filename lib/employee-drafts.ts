import { changedDetails, profileChanged, profileOf, settleDraft, type EmployeeProfile, type ManualDetails, type PortiaEmployee } from "./portia-employees.ts";

// OWN-07 (owner 2026-11-20): the editor keeps one unsaved draft per employee, keyed by the employee id, so several
// biographies can be edited in a row and the question «Сохранить изменения?» is asked once, when the window closes.
// Everything here is pure; the store at the bottom only holds the map and tells its listeners.

export type EmployeeDraft = { profile: EmployeeProfile; details: ManualDetails };
export type EmployeeDrafts = Readonly<Record<string, EmployeeDraft>>;

const hasDraft = (drafts: EmployeeDrafts, id: string) => Object.hasOwn(drafts, id);

/** Title, rank and callsign of an employee; only a manual employee can change them in the editor. */
export const detailsOf = (employee: PortiaEmployee): ManualDetails => ({ title: employee.title, rank: employee.rank, callsign: employee.callsign });

/** What the employee looks like when nothing was typed: the stored profile and details. */
export const baseDraftOf = (employee: PortiaEmployee): EmployeeDraft => ({ profile: profileOf(employee), details: detailsOf(employee) });

/** The draft of the employee: the one typed so far, or the stored values. Only own keys count, so an id such as «constructor» finds nothing. */
export function draftFor(drafts: EmployeeDrafts, employee: PortiaEmployee): EmployeeDraft {
  return hasDraft(drafts, employee.id) ? drafts[employee.id] : baseDraftOf(employee);
}

/** One draft in, the others untouched. */
export function putDraft(drafts: EmployeeDrafts, id: string, draft: EmployeeDraft): EmployeeDrafts {
  return { ...drafts, [id]: draft };
}

/** One draft out, the others untouched; an id with no draft returns the same map. */
export function dropDraft(drafts: EmployeeDrafts, id: string): EmployeeDrafts {
  if (!hasDraft(drafts, id)) return drafts;
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== id));
}

/** Whether the draft differs from what is stored; details count only for a manual employee, a sheet employee takes them from the sheet. */
export function isDraftDirty(employee: PortiaEmployee, draft: EmployeeDraft): boolean {
  if (profileChanged(profileOf(employee), draft.profile)) return true;
  return employee.source === "manual" && Object.keys(changedDetails(detailsOf(employee), draft.details)).length > 0;
}

/** Ids of the employees with unsaved edits, in the order of the list. */
export function dirtyEmployeeIds(drafts: EmployeeDrafts, employees: readonly PortiaEmployee[]): string[] {
  return employees.filter((employee) => hasDraft(drafts, employee.id) && isDraftDirty(employee, drafts[employee.id])).map((employee) => employee.id);
}

/**
 * The answer of a save may only replace what was not typed since sending (D-04), and only for the employee it was sent for (D-05):
 * the draft is found by id, never by what is open. A draft that equals the stored profile afterwards is dropped.
 * `detailsPending`: the database refused the details, so the typed ones stay as an unsaved edit.
 */
export function settleAfterSave(drafts: EmployeeDrafts, id: string, sent: EmployeeDraft, stored: PortiaEmployee, options: { detailsPending?: boolean } = {}): EmployeeDrafts {
  if (!hasDraft(drafts, id)) return drafts;
  const current = drafts[id];
  const settled: EmployeeDraft = {
    profile: settleDraft(sent.profile, current.profile, profileOf(stored)),
    details: options.detailsPending ? current.details : settleDraft(sent.details, current.details, detailsOf(stored)),
  };
  return isDraftDirty(stored, settled) ? putDraft(drafts, id, settled) : dropDraft(drafts, id);
}

/** The order of «save all»: the open employee first, the others as the list has them. */
export function saveQueue(dirtyIds: readonly string[], selectedId: string): string[] {
  return dirtyIds.includes(selectedId) ? [selectedId, ...dirtyIds.filter((id) => id !== selectedId)] : [...dirtyIds];
}

/** The accessible name of a list row: the visible text of the row, then the mark of unsaved edits (WCAG 2.5.3: the name holds the visible text). */
export function employeeRowName(employee: PortiaEmployee, dirty: boolean): string {
  const details = [employee.callsign, employee.title, employee.rank].filter(Boolean).join(" · ");
  const visible = [employee.nickname, employee.source === "manual" ? "ВНЕ ТАБЛИЦЫ" : "", details].filter(Boolean).join(" ");
  return dirty ? `${visible}, есть несохранённые правки` : visible;
}

export type EmployeeDraftSnapshot = { drafts: EmployeeDrafts; known: readonly PortiaEmployee[] };

/**
 * The drafts live outside the tab component, so leaving the tab and coming back keeps them. `known` is the last list the tab loaded
 * (and the saved copies): it is what a draft is compared with when the tab is not on screen. `getSnapshot` changes on every
 * change, which is what useSyncExternalStore needs.
 */
export function createEmployeeDraftStore() {
  let snapshot: EmployeeDraftSnapshot = { drafts: {}, known: [] };
  const listeners = new Set<() => void>();
  const publish = (next: EmployeeDraftSnapshot) => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  const dirtyIds = () => dirtyEmployeeIds(snapshot.drafts, snapshot.known);
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    draftFor: (employee: PortiaEmployee) => draftFor(snapshot.drafts, employee),
    /** A typed change; a draft that is equal to the stored values again is dropped. */
    update: (employee: PortiaEmployee, change: (draft: EmployeeDraft) => EmployeeDraft) => {
      const next = change(draftFor(snapshot.drafts, employee));
      publish({ ...snapshot, drafts: isDraftDirty(employee, next) ? putDraft(snapshot.drafts, employee.id, next) : dropDraft(snapshot.drafts, employee.id) });
    },
    /** The server's answer for `stored.id`: the saved copy becomes the baseline and the draft keeps only what was typed since sending. */
    settle: (sent: EmployeeDraft, stored: PortiaEmployee, options: { detailsPending?: boolean } = {}) => {
      publish({
        drafts: settleAfterSave(snapshot.drafts, stored.id, sent, stored, options),
        known: snapshot.known.map((employee) => (employee.id === stored.id ? stored : employee)),
      });
    },
    drop: (id: string) => publish({ ...snapshot, drafts: dropDraft(snapshot.drafts, id) }),
    reset: () => publish({ ...snapshot, drafts: {} }),
    /** A freshly loaded list: drafts of people no longer in it and drafts equal to the new stored values are dropped. */
    setKnown: (employees: readonly PortiaEmployee[]) => {
      const kept = Object.fromEntries(employees.flatMap((employee) => (hasDraft(snapshot.drafts, employee.id) && isDraftDirty(employee, snapshot.drafts[employee.id]) ? [[employee.id, snapshot.drafts[employee.id]] as const] : [])));
      publish({ drafts: kept, known: employees });
    },
    dirtyIds,
    isDirty: (id: string) => dirtyIds().includes(id),
    hasDirty: () => dirtyIds().length > 0,
  };
}

export type EmployeeDraftStore = ReturnType<typeof createEmployeeDraftStore>;
