import test from "node:test";
import assert from "node:assert/strict";
import { availableRecordsInWindow, availableRecordsLimit, buildSearchIndex, matchSearch, normalizeSearch, searchKeyAction, type SearchIndexInput, type SearchKeyContext } from "./search-index.ts";
import { globalSearchKeyAction } from "./search-index.ts";

const virus = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, code: `V-${id}`, name, status: "Изучен", external: "Серый", physiology: "Без особенностей",
  classification: { danger: "Гефест" }, mutations: [{ name: "Мутация", description: "Описание" }], ...extra,
});

const empty: SearchIndexInput = { apps: [], viruses: [], employees: [], infoSections: [], guideSections: [], broadcasts: [], recycleFiles: [], recycledViruses: [] };

test("normalizeSearch lowercases in Russian rules and folds ё into е, in query and text alike", () => {
  assert.equal(normalizeSearch("ЁЖИК"), normalizeSearch("ежик"));
  assert.equal(normalizeSearch("ЁЖ"), "еж");
  const items = buildSearchIndex({ ...empty, viruses: [virus("a", "Ёж")] });
  for (const query of ["ЁЖ", "ёж", "еж", "ЕЖ"]) assert.equal(matchSearch(items, query).length, 1, query);
});

test("private fields are not in the index: only the allowlisted fields of each source are searchable (D-13, T-19-24)", () => {
  const items = buildSearchIndex({
    ...empty,
    viruses: [virus("a", "Публичный", { draftNote: "SECRET-1", editorNotes: "SECRET-V", answerKey: "SECRET-K", mutations: [{ name: "Мутация", description: "д", reviewer: "SECRET-M" }] })] as never,
    employees: [{ id: "e", nickname: "Ник", callsign: "Поз", title: "Зв", rank: "Р", biography: "Био", reviewerNote: "SECRET-3", promotionQueue: "SECRET-Q" }] as never,
    infoSections: [{ id: "i", title: "Раздел", body: "Текст", draft: "SECRET-I", subsections: [{ id: "i1", title: "Под", blocks: [{ id: "b", type: "text", text: "Блок", editorOnly: "SECRET-B" }], reviewer: "SECRET-S" }] }] as never,
    guideSections: [{ id: "g", title: "Сек", privateNote: "SECRET-G", cards: [{ id: "c", title: "Карта", answer: "SECRET-A", blocks: [{ id: "x", type: "text", text: "Блок", keys: "SECRET-X" }] }] }] as never,
    broadcasts: [
      { id: "b1", type: "news", title: "Опубликовано", body: "Видно", published: true, draftBody: "SECRET-D" },
      { id: "b2", type: "news", title: "Черновик", body: "SECRET-2", published: false },
    ] as never,
    recycleFiles: [{ id: "f", name: "Файл", kind: "text", content: "Текст", virusId: "", image: "", location: "SECRET-L" }] as never,
    recycledViruses: [virus("r", "Удалён", { draftNote: "SECRET-R" })] as never,
  });
  assert.deepEqual(matchSearch(items, "secret"), []);
  assert.equal(matchSearch(items, "Опубликовано").length, 1);
  assert.equal(matchSearch(items, "Черновик").length, 0, "an unpublished broadcast is not indexed by title either");
  assert.ok(!items.some((entry) => entry.type === "broadcast" && entry.id === "b2"));
  // The allowlisted fields are still found.
  for (const word of ["Гефест", "Мутация", "Био", "Блок", "Текст", "Видно"]) assert.ok(matchSearch(items, word).length > 0, word);
});

test("the key is type:id, so records of different types with one id stay apart", () => {
  const items = buildSearchIndex({
    ...empty,
    infoSections: [{ id: "same", title: "Инфо", body: "общий", subsections: [] }],
    guideSections: [{ id: "gs", title: "Справ", cards: [{ id: "same", title: "Карта", blocks: [{ id: "t", type: "text", text: "общий" }] }] }],
  });
  const keys = matchSearch(items, "общий").map((entry) => entry.key);
  assert.deepEqual(keys, ["info:same", "guide:same"]);
  assert.equal(new Set(keys).size, 2);
});

test("a repeated key keeps the first record", () => {
  const items = buildSearchIndex({ ...empty, viruses: [virus("a", "Первый"), virus("a", "Второй")] });
  assert.deepEqual(items.map((entry) => entry.title), ["Первый"]);
});

test("order is apps, viruses, employees, info, guide, broadcasts, recycle and stable on a repeat", () => {
  const input: SearchIndexInput = {
    apps: [{ id: "archive", label: "База вирусов", path: "P://A" }],
    viruses: [virus("v", "Вирус")],
    employees: [{ id: "e", nickname: "Ник", callsign: "", title: "", rank: "", biography: "" }],
    infoSections: [{ id: "i", title: "Инфо", body: "", subsections: [] }],
    guideSections: [{ id: "g", title: "Сек", cards: [{ id: "c", title: "Карта", blocks: [] }] }],
    broadcasts: [{ id: "b", type: "news", title: "Новость", body: "", published: true }],
    recycleFiles: [{ id: "f", name: "Файл", kind: "text", content: "", virusId: "" }],
    recycledViruses: [virus("r", "Удалён")],
  };
  const items = buildSearchIndex(input);
  assert.deepEqual(items.map((entry) => entry.key), ["app:archive", "virus:v", "employee:e", "info:i", "guide:c", "broadcast:b", "file:f", "file:virus:r"]);
  assert.deepEqual(matchSearch(items, ""), matchSearch(items, ""));
  assert.deepEqual(matchSearch(items, "").map((entry) => entry.key), items.map((entry) => entry.key));
  assert.deepEqual(matchSearch(buildSearchIndex(input), "а"), matchSearch(items, "а"));
});

test("an empty query lists the first 8 in source order; a query lists every match", () => {
  const items = buildSearchIndex({ ...empty, viruses: Array.from({ length: 12 }, (_, i) => virus(String(i), `Вирус ${i}`)) });
  assert.equal(matchSearch(items, "").length, 8);
  assert.equal(matchSearch(items, "   ").length, 8);
  assert.equal(matchSearch(items, "вирус").length, 12);
  assert.equal(matchSearch(items, "", 3).length, 3);
});

test("UAT 2026-11-16 gap 3: a maximized search window lists every available record, a normal window the first 8", () => {
  assert.equal(availableRecordsInWindow, 8);
  assert.equal(availableRecordsLimit(false), 8);
  assert.equal(availableRecordsLimit(true), Number.POSITIVE_INFINITY);
  const items = buildSearchIndex({ ...empty, viruses: Array.from({ length: 40 }, (_, i) => virus(String(i), `Вирус ${i}`)) });
  assert.deepEqual(matchSearch(items, "", availableRecordsLimit(true)).map((entry) => entry.key), items.map((entry) => entry.key));
  assert.deepEqual(matchSearch(items, "", availableRecordsLimit(false)).map((entry) => entry.key), items.slice(0, 8).map((entry) => entry.key));
  assert.equal(matchSearch(items, "вирус 3", availableRecordsLimit(false)).length, matchSearch(items, "вирус 3", availableRecordsLimit(true)).length, "a query lists every match at any limit");
  assert.ok(matchSearch(items, "", availableRecordsLimit(true)).every((entry) => items.includes(entry)), "only items of the passed index");
});

test("the preview of a card starts at the first block that holds the query", () => {
  const items = buildSearchIndex({ ...empty, guideSections: [{ id: "g", title: "Сек", cards: [{ id: "c", title: "Карта", blocks: [{ id: "1", type: "text", text: "начало" }, { id: "2", type: "text", text: "нужное слово" }] }] }] });
  assert.ok(matchSearch(items, "нужное")[0].body.startsWith("нужное слово"));
});

test("the recycle bin keeps its current behaviour: files and deleted viruses are listed by name (owner verdict 9)", () => {
  const items = buildSearchIndex({ ...empty, recycleFiles: [{ id: "f", name: "Старый файл", kind: "text", content: "тело", virusId: "" }], recycledViruses: [virus("r", "Удалённый")] });
  assert.deepEqual(matchSearch(items, "старый").map((entry) => entry.key), ["file:f"]);
  assert.deepEqual(matchSearch(items, "удалённый").map((entry) => entry.key), ["file:virus:r"]);
});

test("the apps are listed exactly as given: the caller filters by access, «Устав» is found by its name only (owner verdict 8)", () => {
  const items = buildSearchIndex({ ...empty, apps: [{ id: "charter", label: "Устав", path: "PORTIA://CHARTER" }] });
  assert.deepEqual(matchSearch(items, "устав").map((entry) => entry.key), ["app:charter"]);
  assert.deepEqual(matchSearch(buildSearchIndex(empty), "устав"), []);
  // Owner, 20-33: an app shows its PORTIA:// path, never the repeated internal id.
  assert.equal(items[0].body, "PORTIA://CHARTER");
  assert.ok(!/(^|\s)charter(\s|$)/.test(items[0].body));
});

const ctx = (patch: Partial<SearchKeyContext>): SearchKeyContext => ({ key: "", inInput: true, query: "", index: -1, count: 3, ...patch });

test("Ctrl/Cmd+K focuses the field, on any layout and from anywhere", () => {
  assert.equal(searchKeyAction(ctx({ key: "k", ctrlKey: true })), "focus-input");
  assert.equal(searchKeyAction(ctx({ key: "K", metaKey: true })), "focus-input");
  assert.equal(searchKeyAction(ctx({ key: "л", code: "KeyK", ctrlKey: true, inInput: false, index: 1 })), "focus-input");
  assert.equal(searchKeyAction(ctx({ key: "k" })), null, "K alone types a letter");
  assert.equal(searchKeyAction(ctx({ key: "k", ctrlKey: true, altKey: true })), null, "AltGr is reported as Ctrl+Alt");
});

test("arrows move between the field and the results; Up from the first result returns to the field", () => {
  assert.equal(searchKeyAction(ctx({ key: "ArrowDown" })), "next");
  assert.equal(searchKeyAction(ctx({ key: "ArrowUp" })), "prev", "from the field Up goes to the last result");
  assert.equal(searchKeyAction(ctx({ key: "ArrowDown", inInput: false, index: 0 })), "next");
  assert.equal(searchKeyAction(ctx({ key: "ArrowDown", inInput: false, index: 2 })), null, "no wrap past the last result");
  assert.equal(searchKeyAction(ctx({ key: "ArrowUp", inInput: false, index: 0 })), "focus-input");
  assert.equal(searchKeyAction(ctx({ key: "ArrowUp", inInput: false, index: 2 })), "prev");
  assert.equal(searchKeyAction(ctx({ key: "ArrowDown", count: 0 })), null);
  assert.equal(searchKeyAction(ctx({ key: "ArrowUp", count: 0 })), null);
});

test("Enter opens the focused result, or the only result from the field", () => {
  assert.equal(searchKeyAction(ctx({ key: "Enter", inInput: false, index: 1 })), "open");
  assert.equal(searchKeyAction(ctx({ key: "Enter", count: 1 })), "open");
  assert.equal(searchKeyAction(ctx({ key: "Enter", count: 3 })), null);
  assert.equal(searchKeyAction(ctx({ key: "Enter", count: 0 })), null);
});

test("Escape clears a typed query and closes only on an empty field", () => {
  assert.equal(searchKeyAction(ctx({ key: "Escape", query: "вирус" })), "clear");
  assert.equal(searchKeyAction(ctx({ key: "Escape", query: "" })), "close");
  assert.equal(searchKeyAction(ctx({ key: "Escape", query: "x", inInput: false, index: 0 })), "clear");
});

test("other keys, and Tab, are never taken over", () => {
  for (const key of ["Tab", "a", "ArrowLeft", "Home", "Shift"]) assert.equal(searchKeyAction(ctx({ key })), null, key);
});

test("scope enter-only (a refusal of the keyboard verdict, and the phone) takes over Enter alone", () => {
  assert.equal(searchKeyAction(ctx({ key: "Enter", inInput: false, index: 0, scope: "enter-only" })), "open");
  for (const key of ["ArrowDown", "ArrowUp", "Escape"]) assert.equal(searchKeyAction(ctx({ key, scope: "enter-only" })), null, key);
  assert.equal(searchKeyAction(ctx({ key: "k", ctrlKey: true, scope: "enter-only" })), null);
});

const keyEvent = (patch: Partial<{ key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }>) => ({ key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, ...patch });

test("D-44 the global handler opens the search on Ctrl/Cmd+K only, on any layout", () => {
  assert.equal(globalSearchKeyAction(keyEvent({ key: "k", code: "KeyK", ctrlKey: true })), "focus-input");
  assert.equal(globalSearchKeyAction(keyEvent({ key: "K", code: "KeyK", metaKey: true })), "focus-input");
  assert.equal(globalSearchKeyAction(keyEvent({ key: "л", code: "KeyK", ctrlKey: true })), "focus-input");
});

test("D-44 Ctrl+Alt+K (AltGr) does not open the search", () => {
  assert.equal(globalSearchKeyAction(keyEvent({ key: "k", code: "KeyK", ctrlKey: true, altKey: true })), null);
});

test("D-44 the arrow keys never open the search from outside its window (typing in a field keeps the focus)", () => {
  for (const key of ["ArrowUp", "ArrowDown", "Enter", "Escape", "a", "л"]) assert.equal(globalSearchKeyAction(keyEvent({ key })), null, key);
  assert.equal(globalSearchKeyAction(keyEvent({ key: "ArrowUp", shiftKey: true })), null);
});

test("D-37 normalizeSearch drops the combining acute accent, in query and text alike", () => {
  assert.equal(normalizeSearch("Люци\u0301диум"), "люцидиум");
  assert.equal(normalizeSearch("Люцидиум"), "люцидиум");
  assert.equal(normalizeSearch("ЁЖ"), "еж");
});

test("D-37 a record with a stressed word is found with or without the accent, and a plain record by an accented query", () => {
  const items = buildSearchIndex({ ...empty, viruses: [virus("a", "Инферна\u0301р — класс"), virus("b", "Инфернар")] });
  assert.deepEqual(matchSearch(items, "инфернар").map((entry) => entry.key), ["virus:a", "virus:b"]);
  assert.deepEqual(matchSearch(items, "Инферна\u0301р").map((entry) => entry.key), ["virus:a", "virus:b"]);
});

test("D-37 only U+0301 is removed: й and и + breve stay as they are", () => {
  assert.equal(normalizeSearch("\u0439"), "\u0439");
  assert.equal(normalizeSearch("\u0438\u0306"), "\u0438\u0306");
});
