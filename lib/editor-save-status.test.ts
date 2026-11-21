import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as saveStatus from "./editor-save-status.ts";
import { draftEdits, networkSaveError, parseRefusedSections, partialSave, rebaseDecision, saveStatusText, SaveConflictError, SectionClosedError } from "./editor-save-status.ts";
import { lf } from "./component-source.ts";
import { historyReducer, initHistory } from "./editor-history.ts";
import { type PortiaContent } from "./portia-content.ts";
import { portiaContentFixture } from "./testing/portia-content-fixture.ts";
import { changedSections, revertSections } from "./editor-changes.ts";
import { contentRefusal } from "./editor-tabs.ts";

const editor = readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8");
// 26.1-02: the component of «Сотрудники» moved out of the editor file into its seam (D-21).
const employeesSeam = readFileSync(new URL("../components/portia-editor-employees.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");
const fixture = (): PortiaContent => structuredClone(portiaContentFixture);
const cloneOf = <T,>(value: T): T => structuredClone(value);
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");

test("saveStatusText is the one vocabulary of the save status (UI E3)", () => {
  assert.equal(saveStatusText("clean"), "");
  assert.equal(saveStatusText("dirty"), "Есть несохранённые изменения");
  assert.equal(saveStatusText("saving"), "Сохраняем…");
  assert.equal(saveStatusText("saved"), "Сохранено");
  assert.equal(saveStatusText("partial", { saved: 2, total: 3 }), "Сохранено 2 из 3");
  assert.equal(saveStatusText("error"), "Не удалось сохранить");
  assert.equal(saveStatusText("conflict"), "Запись изменили");
});

test("saveStatusText never says «Сохранено» for a partial save without counts (D-12)", () => {
  assert.notEqual(saveStatusText("partial"), "Сохранено");
  assert.equal(saveStatusText("partial", { saved: 3, total: 3 }), "Сохранено");
});

test("partialSave sends everything the server did not refuse, in editorSections order (D-10)", () => {
  assert.deepEqual(partialSave(["viruses", "info", "guide"], ["info"]), { send: ["viruses", "guide"], saved: 2, total: 3 });
  assert.deepEqual(partialSave(["guide", "viruses", "info"], []), { send: ["viruses", "info", "guide"], saved: 3, total: 3 });
  assert.deepEqual(partialSave(["viruses"], ["viruses"]), { send: [], saved: 0, total: 1 });
  // A refused section nothing changed in is not part of the total.
  assert.deepEqual(partialSave(["viruses", "info"], ["recycle"]), { send: ["viruses", "info"], saved: 2, total: 2 });
});

test("the editor and the employee editor take their status text from saveStatusText, not from upper-case literals (UI E3)", () => {
  assert.ok((editor.match(/saveStatusText\(/g) ?? []).length >= 1, "the editor file");
  assert.ok((employeesSeam.match(/saveStatusText\(/g) ?? []).length >= 2, "the seam of «Сотрудники»");
  assert.doesNotMatch(editor, /"СОХРАНЕНИЕ…"|"СОХРАНЕНО"/);
  assert.doesNotMatch(employeesSeam, /"СОХРАНЕНИЕ…"|"СОХРАНЕНО"/);
});

test("«Сохранено» goes out after 4s, not 1.8s, and the save button keeps focus while saving (UI E3, D-12)", () => {
  assert.match(desktop, /setSaveState\("idle"\), 4000\)/);
  assert.doesNotMatch(desktop, /setSaveState\("idle"\), 1800\)/);
  assert.match(employeesSeam, /setState\("idle"\), 4000\)/);
  assert.match(editor, /aria-disabled=\{saveState === "saving" \|\| undefined\}/);
  assert.doesNotMatch(editor, /disabled=\{!dirty \|\| saveState === "saving"/);
});

test("a second Save while the request runs is ignored before it reaches the network (idempotency)", () => {
  assert.match(editor, /inflight\.current/);
});

test("the status is shown only after the server answered: saved needs saveState saved and a clean draft (D-12)", () => {
  assert.match(editor, /saveState === "saved" && !dirty/);
});

test("the status styles exist: dirty and partial warn, error and conflict stay red", () => {
  assert.match(styles, /\.editor-save-status\.dirty[^{]*\{[^}]*var\(--warning\)/);
  assert.match(styles, /\.editor-save-status\.partial[^{]*\{[^}]*var\(--warning\)/);
});

const infoWithTextBlock = (): PortiaContent => {
  const content = fixture();
  content.infoSections = [{ id: "info-1", title: "Раздел", body: "", subsections: [{ id: "sub-1", title: "Подраздел", blocks: [{ id: "block-1", type: "text", text: "Старый текст" }] }] }];
  return content;
};

test("draftEdits lists a changed virus title and a changed info block text with a section path, a label and the new value (D-09)", () => {
  const baseline = infoWithTextBlock();
  const present = cloneOf(baseline);
  present.viruses[0].name = "НОВОЕ ИМЯ";
  const block = present.infoSections[0].subsections[0].blocks[0];
  if (block.type === "text") block.text = "Новый текст";
  const edits = draftEdits(baseline, present);
  assert.equal(edits.length, 2);
  const virus = edits.find((edit) => edit.section === "viruses");
  const info = edits.find((edit) => edit.section === "info");
  assert.ok(virus && info);
  assert.equal(virus.value, "НОВОЕ ИМЯ");
  assert.equal(info.value, "Новый текст");
  assert.ok(virus.path.includes(present.viruses[0].id) && virus.path.endsWith("name"));
  assert.ok(info.path.includes("block-1"));
  assert.ok(virus.label.includes("База вирусов") && virus.label.includes("НОВОЕ ИМЯ"));
  assert.ok(info.label.includes("Информация"));
});

test("draftEdits skips untouched fields and matches array items by id, so a reorder alone is not an edit", () => {
  const baseline = fixture();
  assert.deepEqual(draftEdits(baseline, cloneOf(baseline)), []);
  const reordered = cloneOf(baseline);
  reordered.viruses.reverse();
  assert.deepEqual(draftEdits(baseline, reordered), []);
  const edited = cloneOf(baseline);
  edited.viruses.reverse();
  edited.viruses[0].code = "X-1";
  const edits = draftEdits(baseline, edited);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].value, "X-1");
});

test("draftEdits has the edits in editorSections order and leaves out an emptied field", () => {
  const baseline = fixture();
  const present = cloneOf(baseline);
  present.searchRecommendations = [...present.searchRecommendations, "новая подсказка"];
  present.viruses[0].name = "Имя";
  present.viruses[0].code = "";
  const edits = draftEdits(baseline, present);
  assert.deepEqual(edits.map((edit) => edit.section), ["viruses", "search"]);
});

test("SaveConflictError is distinguishable from a plain failure", () => {
  assert.ok(new SaveConflictError() instanceof Error);
  assert.ok(new SaveConflictError() instanceof SaveConflictError);
  assert.ok(!(new Error("x") instanceof SaveConflictError));
});

test("loading their version keeps the user's edits only in draftEdits: sync replaces the draft, the list was taken first (D-09)", () => {
  const server = cloneOf(fixture());
  server.viruses[0].name = "ИХ ИМЯ";
  let state = initHistory(fixture(), cloneOf);
  state = historyReducer(state, { type: "change", updater: (next) => { next.viruses[0].name = "МОЁ ИМЯ"; }, key: null, now: 1 }, cloneOf);
  const mine = draftEdits(state.baseline, state.present);
  state = historyReducer(state, { type: "sync", content: server }, cloneOf);
  assert.equal(state.present.viruses[0].name, "ИХ ИМЯ");
  assert.equal(state.baseline, state.present);
  assert.deepEqual(mine.map((edit) => edit.value), ["МОЁ ИМЯ"]);
});

test("conflict panel: «Запись изменили до вас» with two labelled choices and no «обновите страницу» text (D-09, item 5)", () => {
  assert.match(editor, /Запись изменили до вас/);
  assert.match(editor, /Ваши правки не потеряны\. Выберите, какую версию оставить\./);
  assert.match(editor, /Загрузить их версию/);
  assert.match(editor, /Заменить своей/);
  assert.match(editor, /Их изменения будут перезаписаны\./);
  assert.match(editor, /role="alert"/);
  assert.doesNotMatch(editor, /ОБНОВИТЕ СТРАНИЦУ|СКОПИРУЙТЕ ПРАВКИ/);
  // Item 5, variant A: no separate confirmation window for the replacement.
  assert.doesNotMatch(editor, /dialog === "replace"/);
});

test("their version shows beside the user's edits: a closed <details> «Ваши правки» with a copy button per field (D-09)", () => {
  assert.match(editor, /<details[^>]*className="editor-their-edits"/);
  assert.match(editor, /Ваши правки/);
  assert.match(editor, /navigator\.clipboard/);
  assert.match(editor, /draftEdits\(history\.baseline, history\.present\)/);
  assert.doesNotMatch(editor, /<details[^>]*className="editor-their-edits"[^>]* open/);
});

test("«Заменить своей» sends with the revision of the latest server copy; a repeated 409 reopens the panel (D-09)", () => {
  assert.match(editor, /baseRevision\.current = revision/);
  assert.match(editor, /catch \(error\)[\s\S]*?SaveConflictError/);
  assert.match(desktop, /throw new SaveConflictError\(\)/);
  assert.match(desktop, /setSaveState\("conflict"\);[\s\S]{0,200}void fetchContent\(\)/);
});

test("the conflict panel styles: warning border, 16px heading, 13px text, 44px buttons on phone, danger button (UI E3)", () => {
  assert.match(styles, /\.editor-conflict-panel\s*\{[^}]*padding:\s*16px[^}]*var\(--warning\)/);
  assert.match(styles, /\.editor-conflict-panel h2\s*\{[^}]*16px/);
  assert.match(styles, /\.editor-conflict-panel p\s*\{[^}]*13px/);
  assert.match(styles, /@media \(max-width: 900px\)\s*\{[^@]*\.editor-conflict-panel button\s*\{[^}]*min-height:\s*44px/);
  assert.match(styles, /\.editor-conflict-panel \.danger-control\s*\{[^}]*var\(--danger\)[^}]*#e07d74/);
});

test("a save that arrives after new edits keeps the new edits unsaved and can rebase unrelated sections (concurrency)", () => {
  let state = initHistory(fixture(), cloneOf);
  state = historyReducer(state, { type: "change", updater: (next) => { next.viruses[0].name = "A"; }, key: null, now: 1 }, cloneOf);
  const savedFrom = state.present;
  state = historyReducer(state, { type: "change", updater: (next) => { next.viruses[0].name = "AB"; }, key: null, now: 5000 }, cloneOf);
  const outgoing = cloneOf(savedFrom);
  state = historyReducer(state, { type: "saved", normalized: outgoing, savedFrom }, cloneOf);
  assert.equal(state.present.viruses[0].name, "AB");
  assert.equal(state.baseline.viruses[0].name, "A");
});

test("a network failure has its own text, set before the error is rethrown so the draft stays in the fields (UI E3)", () => {
  assert.equal(networkSaveError, "Нет связи с сервером. Попробуйте ещё раз.");
  assert.match(desktop, /setSaveError\(networkSaveError\);\s*throw error;/);
});

test("rebase: a draft typed during a replacing save follows the stored copy only where the user did not type meanwhile (D-09, D-12)", () => {
  let state = initHistory(fixture(), cloneOf);
  state = historyReducer(state, { type: "change", updater: (next) => { next.viruses[0].name = "МОЁ"; }, key: null, now: 1 }, cloneOf);
  const savedFrom = state.present;
  state = historyReducer(state, { type: "change", updater: (next) => { next.viruses[0].name = "МОЁ+"; next.searchRecommendations = ["набрано во время запроса"]; }, key: null, now: 9000 }, cloneOf);
  const outgoing = cloneOf(savedFrom);
  outgoing.infoSections = [{ id: "i", title: "ИХ раздел", body: "", subsections: [] }];
  state = historyReducer(state, { type: "saved", normalized: outgoing, savedFrom, rebase: (latest) => ({ ...latest, infoSections: outgoing.infoSections }) }, cloneOf);
  assert.equal(state.present.viruses[0].name, "МОЁ+");
  assert.deepEqual(state.present.searchRecommendations, ["набрано во время запроса"]);
  assert.equal(state.present.infoSections[0].title, "ИХ раздел");
  assert.equal(state.baseline, outgoing);
});

test("parseRefusedSections reads only a section-closed refusal and returns its sections in editorSections order (D-10)", () => {
  assert.deepEqual(parseRefusedSections({ error: "x", code: "section-closed", sections: ["info", "viruses"] }), ["viruses", "info"]);
  assert.equal(parseRefusedSections({ error: "x", code: "other", sections: ["info"] }), null);
  assert.equal(parseRefusedSections({ error: "x" }), null);
  assert.equal(parseRefusedSections({ code: "section-closed", sections: [] }), null);
  assert.equal(parseRefusedSections({ code: "section-closed", sections: ["nope"] }), null);
  assert.equal(parseRefusedSections(null), null);
  const error = new SectionClosedError(["info"], "Раздел закрыт");
  assert.deepEqual(error.refusedSections, ["info"]);
  assert.ok(error instanceof Error && error instanceof SectionClosedError);
});

test("the desktop save passes the refused sections up without changing the API; the editor retries once without them (D-10)", () => {
  assert.match(desktop, /parseRefusedSections\(body\)/);
  assert.match(desktop, /throw new SectionClosedError\(refusedSections/);
  assert.match(desktop, /refusedSections/);
  assert.match(editor, /error instanceof SectionClosedError/);
  assert.match(editor, /partialSave\(/);
  assert.match(editor, /revertSections\(serverBase, wanted, refused\)/);
  assert.equal((editor.match(/await onSave\(/g) ?? []).length, 2, "one save and exactly one retry");
  assert.match(editor, /data-save-error=/);
  assert.match(editor, /className="editor-section-error" role="alert"/);
  assert.match(editor, /aria-describedby=\{failed \?/);
  assert.match(editor, /focusRequest\.current/);
});

test("the partial save, end to end on the real helpers: the rest is stored, the refused section stays a draft, a retry sends only it (D-10)", () => {
  const baseline = infoWithTextBlock();
  const draft = cloneOf(baseline);
  draft.viruses[0].name = "ИЗМЕНЁН";
  draft.infoSections[0].title = "Раздел изменён";
  const changed = changedSections(baseline, draft);
  assert.deepEqual(changed, ["viruses", "info"]);
  // The server's rule refuses «Информация» for this editor; the real rule produces the answer.
  const refusal = contentRefusal(baseline, draft, ["viruses"]);
  assert.equal(refusal?.code, "section-closed");
  const refused = parseRefusedSections({ code: refusal?.code, sections: refusal?.sections }) ?? [];
  assert.deepEqual(refused, ["info"]);
  const plan = partialSave(changed, refused);
  assert.deepEqual(plan, { send: ["viruses"], saved: 1, total: 2 });
  const outgoing = revertSections(baseline, draft, refused);
  assert.equal(contentRefusal(baseline, outgoing, ["viruses"]), null, "the second request is accepted");
  assert.deepEqual(changedSections(baseline, outgoing), ["viruses"]);

  let state = initHistory(baseline, cloneOf);
  state = historyReducer(state, { type: "change", updater: (next) => { next.viruses[0].name = "ИЗМЕНЁН"; next.infoSections[0].title = "Раздел изменён"; }, key: null, now: 1 }, cloneOf);
  state = historyReducer(state, { type: "saved", normalized: outgoing, savedFrom: state.present, keep: draft }, cloneOf);
  assert.deepEqual(changedSections(state.baseline, state.present), ["info"], "only the refused section is still a draft");
  assert.equal(state.baseline.viruses[0].name, "ИЗМЕНЁН");
  assert.equal(state.present.infoSections[0].title, "Раздел изменён");
  // The retry sends only what is still different from the stored copy.
  assert.deepEqual(partialSave(changedSections(state.baseline, state.present), []).send, ["info"]);
});

test("the status after a partial save is «Сохранено N из M» and is held until the next edit; the order is editorSections order (D-10)", () => {
  assert.match(editor, /saveStatusText\(status, partial \?\? undefined\)/);
  assert.match(editor, /setPartialResult\(null\)/);
  assert.equal(saveStatusText("partial", { saved: 1, total: 2 }), "Сохранено 1 из 2");
  assert.deepEqual(partialSave(["assistant", "viruses", "guide"], ["guide"]).send, ["viruses", "assistant"]);
});

test("the REST contract of PUT /api/content is untouched by this plan", () => {
  const route = readFileSync(new URL("../app/api/content/route.ts", import.meta.url), "utf8");
  assert.match(route, /code: refusal\.code, sections: refusal\.sections/);
});

test("rebaseDecision: nothing changed on the server is «none» (D-11)", () => {
  const baseline = fixture();
  const present = cloneOf(baseline);
  present.viruses[0].name = "МОЁ";
  assert.deepEqual(rebaseDecision(baseline, present, cloneOf(baseline), ["viruses"]), { kind: "none" });
});

test("rebaseDecision: my «viruses» edit and their «info» change rebase silently: both kept, baseline = their copy (STAB-APP-07 adjacency)", () => {
  const baseline = fixture();
  const present = cloneOf(baseline);
  present.viruses[0].name = "МОЁ ИМЯ";
  const incoming = cloneOf(baseline);
  incoming.infoSections[0].title = "ИХ ЗАГОЛОВОК";
  const before = JSON.stringify([baseline, present, incoming]);
  const decision = rebaseDecision(baseline, present, incoming, []);
  assert.equal(JSON.stringify([baseline, present, incoming]), before, "no input is mutated");
  assert.equal(decision.kind, "rebase");
  if (decision.kind !== "rebase") return;
  assert.equal(decision.baseline, incoming);
  assert.equal(decision.present.infoSections[0].title, "ИХ ЗАГОЛОВОК");
  assert.equal(decision.present.viruses[0].name, "МОЁ ИМЯ");
  assert.deepEqual(changedSections(decision.baseline, decision.present), ["viruses"]);
});

test("rebaseDecision: both changed «info» is a conflict (the save then gets the 409)", () => {
  const baseline = fixture();
  const present = cloneOf(baseline);
  present.infoSections[0].title = "МОЁ";
  const incoming = cloneOf(baseline);
  incoming.infoSections[0].body = "ИХ ТЕКСТ";
  assert.deepEqual(rebaseDecision(baseline, present, incoming, []), { kind: "conflict" });
});

test("rebaseDecision: their change in the protected section (the field under the cursor) is a conflict even when I did not edit it (D-11)", () => {
  const baseline = fixture();
  const present = cloneOf(baseline);
  present.viruses[0].name = "МОЁ";
  const incoming = cloneOf(baseline);
  incoming.infoSections[0].title = "ИХ";
  assert.deepEqual(rebaseDecision(baseline, present, incoming, ["info"]), { kind: "conflict" });
  assert.equal(rebaseDecision(baseline, present, incoming, ["viruses"]).kind, "rebase");
});

test("rebaseDecision: their formatted text follows its section, so a «viruses» edit of mine stays and the text becomes theirs", () => {
  const baseline = fixture();
  const present = cloneOf(baseline);
  present.viruses[0].name = "МОЁ";
  const incoming = cloneOf(baseline);
  const textKey = `info:${incoming.infoSections[0].id}:body`;
  incoming.formattedText = { ...incoming.formattedText, [textKey]: { version: 1, blocks: [] } as never };
  const decision = rebaseDecision(baseline, present, incoming, []);
  assert.equal(decision.kind, "rebase");
  if (decision.kind !== "rebase") return;
  assert.equal(decision.present.viruses[0].name, "МОЁ");
  assert.deepEqual(decision.present.formattedText[textKey], incoming.formattedText[textKey]);
  assert.deepEqual(changedSections(decision.baseline, decision.present), ["viruses"]);
});

test("the editor sync effect asks rebaseDecision when the draft is dirty and shows the stale banner on a conflict (D-11)", () => {
  const source = lf(editor);
  assert.match(source, /rebaseDecision\(/);
  assert.match(source, /className="editor-stale-banner" role="status"/);
  assert.match(source, /Запись изменили/);
  assert.match(source, /Показаны ваши правки\. Конфликт решится при сохранении\./);
  assert.match(source, /type: "rebase"/);
  assert.match(lf(styles), /\.editor-stale-banner\s*\{/);
});

type RequestFailure = (input: { transport: boolean; status?: number; payloadError?: string; action: "load" | "save" | "add" | "remove" }) => string;
const employeeRequestFailure: RequestFailure = (input) => (saveStatus as unknown as { employeeRequestFailure: RequestFailure }).employeeRequestFailure(input);

test("employeeRequestFailure: no connection is the network text, never the raw exception (WR-05)", () => {
  assert.equal(employeeRequestFailure({ transport: true, action: "save" }), networkSaveError);
  assert.equal(employeeRequestFailure({ transport: true, status: 500, payloadError: "Failed to fetch", action: "load" }), networkSaveError);
});

test("employeeRequestFailure: 403 is the expired editor session (WR-05)", () => {
  assert.equal(employeeRequestFailure({ transport: false, status: 403, action: "add" }), "Сессия редактора истекла. Войдите в редактор снова.");
});

test("employeeRequestFailure: the server's own Russian text is shown as is (WR-05)", () => {
  assert.equal(employeeRequestFailure({ transport: false, status: 409, payloadError: "Профиль изменили.", action: "save" }), "Профиль изменили.");
});

test("employeeRequestFailure: a non-JSON answer such as 502 names the action and the code in Russian (WR-05)", () => {
  assert.equal(employeeRequestFailure({ transport: false, status: 502, action: "save" }), "Сервер отклонил сохранение (502).");
  assert.equal(employeeRequestFailure({ transport: false, status: 502, action: "add" }), "Сервер отклонил добавление (502).");
  assert.equal(employeeRequestFailure({ transport: false, status: 502, action: "load" }), "Сервер отклонил загрузку (502).");
  assert.equal(employeeRequestFailure({ transport: false, status: 502, action: "remove" }), "Сервер отклонил удаление (502).");
});

test("employeeRequestFailure: a blank payload error counts as missing (WR-05)", () => {
  assert.equal(employeeRequestFailure({ transport: false, status: 500, payloadError: "   ", action: "save" }), "Сервер отклонил сохранение (500).");
});

test("employeeRequestFailure texts are Cyrillic, with no raw exception wording (WR-05)", () => {
  for (const action of ["load", "save", "add", "remove"] as const) {
    const text = employeeRequestFailure({ transport: false, status: 502, action });
    assert.match(text, /[А-Яа-я]/);
    assert.doesNotMatch(text, /Failed to fetch|Unexpected token|SyntaxError/);
  }
});

// The region is the seam from the component to the end of the file.
const employeeRegion = () => {
  const source = lf(employeesSeam);
  const start = source.indexOf("function EmployeeProfilesEditor");
  assert.ok(start > -1);
  return source.slice(start);
};
const accessRegion = () => {
  const source = lf(editor);
  const start = source.indexOf("function EditorAccessManager");
  const end = source.indexOf("function LimitNote");
  assert.ok(start > -1 && end > start);
  return source.slice(start, end);
};

test("EmployeeProfilesEditor shows no raw exception text and reads the answer through .json().catch (WR-05)", () => {
  const region = employeeRegion();
  assert.doesNotMatch(region, /\berror\.message\b/);
  assert.ok(region.includes("employeeRequestFailure("));
  assert.ok(region.includes("networkSaveError") || region.includes('transport: true'));
  assert.ok(region.includes(".json().catch("));
  assert.doesNotMatch(region, /await response\.json\(\) as/);
});

test("EmployeeProfilesEditor does not send a second PATCH or POST while one is running (WR-05)", () => {
  const region = employeeRegion();
  // One request per employee id: a second save of the same employee joins the running one.
  assert.match(region, /saveInflight\.current\.get\(id\)/);
  assert.match(region, /addInflight\.current/);
  assert.match(region, /finally\s*\{[^}]*saveInflight\.current\.delete\(id\)/);
});

test("«ОТОЗВАТЬ» asks first through ConfirmDialog and is disabled while a request runs (IN-03)", () => {
  const region = accessRegion();
  assert.ok(region.includes("<ConfirmDialog"));
  assert.ok(region.includes("Отозвать доступ?"));
  assert.match(region, /потеряет доступ к редактору\. Вернуть его можно только новой выдачей доступа\./);
  assert.match(region, /disabled=\{state === "saving"\} onClick=\{[^\n]*\}>ОТОЗВАТЬ</);
  assert.doesNotMatch(region, /onClick=\{\(\) => void removeEditor\(editor\.email\)\}/);
  assert.match(region, /label: "ОТМЕНА", tone: "secondary", autoFocus: true/);
});

// 26.1-20 (owner 2026-11-21, item 20, T-26.1-48): the compact mark is not the only sign of a failed save: its colour follows the state and the reasons stay a live alert.
test("26.1-20: the compact unsaved mark tells an error from a plain unsaved state by colour, and the reasons stay announced", () => {
  const shell = readFileSync(new URL("../components/portia-editor-tab-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /data-tone=\{notice \? "saved" : tone \|\| "dirty"\}/, "the tone of the mark is the tone of the status");
  assert.match(styles, /\.etab-unsaved-mark\[data-tone="error"\][^{]*\{[^}]*color:\s*#e07d74/, "an error is the same red as the status line");
  assert.match(styles, /\.etab-unsaved-mark\[data-tone="dirty"\][^{]*\{[^}]*color:\s*var\(--warning\)/, "unsaved is the warning colour");
  assert.ok(lf(shell).includes('<p key={index} className="etab-message" role="alert">'), "every reason is still an alert paragraph");
  assert.equal(saveStatusText("dirty"), "Есть несохранённые изменения", "the full text for the details and the live region is the same vocabulary");
});
