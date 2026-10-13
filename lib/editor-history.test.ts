import test from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_LIMIT,
  TYPING_PAUSE_MS,
  TYPING_SPAN_MS,
  historyReducer,
  initHistory,
  type EditorHistory,
  type HistoryAction,
} from "./editor-history.ts";

type Doc = { text: string; n: number };

const clone = (value: Doc) => structuredClone(value);
const reduce = (state: EditorHistory<Doc>, action: HistoryAction<Doc>) => historyReducer(state, action, clone);
const start = () => initHistory<Doc>({ text: "a", n: 0 }, clone);
const edit = (text: string, key: string | null, now: number): HistoryAction<Doc> => ({
  type: "change",
  updater: (next) => { next.text = text; },
  key,
  now,
});

test("initHistory makes present and baseline one clone of the content", () => {
  const content = { text: "a", n: 0 };
  const state = initHistory(content, clone);
  assert.equal(state.present, state.baseline);
  assert.notEqual(state.present, content);
  assert.deepEqual(state.present, content);
  assert.equal(state.source, content);
  assert.deepEqual(state.past, []);
  assert.deepEqual(state.future, []);
});

test("a change pushes the old present onto past and never mutates it", () => {
  const first = start();
  const next = reduce(first, edit("b", null, 1000));
  assert.equal(next.present.text, "b");
  assert.equal(first.present.text, "a");
  assert.equal(next.past.length, 1);
  assert.equal(next.past[0], first.present);
  assert.equal(next.baseline, first.baseline);
  assert.deepEqual(next.future, []);
});

test("a change that leaves the content identical returns the same state", () => {
  const first = start();
  assert.equal(reduce(first, edit("a", null, 1000)), first);
});

test("two edits of one field 300 ms apart are one undo step", () => {
  const state = [edit("b", "field:1", 1000), edit("bc", "field:1", 1300)].reduce(reduce, start());
  assert.equal(state.past.length, 1);
  assert.equal(state.present.text, "bc");
});

test("a pause longer than TYPING_PAUSE_MS starts a new step", () => {
  const state = [edit("b", "field:1", 1000), edit("bc", "field:1", 1000 + TYPING_PAUSE_MS + 100)].reduce(reduce, start());
  assert.equal(state.past.length, 2);
});

test("continuous typing longer than TYPING_SPAN_MS is cut into several steps", () => {
  let state = start();
  for (let now = 1000; now <= 1000 + 2000; now += 300) state = reduce(state, edit(`t${now}`, "field:1", now));
  assert.ok(TYPING_SPAN_MS < 2000);
  assert.ok(state.past.length >= 2);
});

test("a null key never coalesces", () => {
  const state = [edit("b", null, 1000), edit("c", null, 1000)].reduce(reduce, start());
  assert.equal(state.past.length, 2);
});

test("a different key never coalesces", () => {
  const state = [edit("b", "field:1", 1000), edit("c", "field:2", 1100)].reduce(reduce, start());
  assert.equal(state.past.length, 2);
});

test("a drag key coalesces regardless of time", () => {
  const state = [edit("b", "drag:1", 1000), edit("c", "drag:1", 900000)].reduce(reduce, start());
  assert.equal(state.past.length, 1);
  assert.equal(state.present.text, "c");
});

test("past is capped at HISTORY_LIMIT entries", () => {
  let state = start();
  for (let index = 1; index <= 55; index += 1) state = reduce(state, edit(`v${index}`, null, index));
  assert.equal(HISTORY_LIMIT, 50);
  assert.equal(state.past.length, HISTORY_LIMIT);
  assert.equal(state.past.at(-1)?.text, "v54");
});

test("saved without concurrent edits ends the history on the normalized copy", () => {
  const edited = reduce(start(), edit("b", null, 1000));
  const normalized = { text: "b!", n: 0 };
  const state = reduce(edited, { type: "saved", normalized, savedFrom: edited.present });
  assert.equal(state.present, normalized);
  assert.equal(state.baseline, normalized);
  assert.equal(state.source, normalized);
  assert.deepEqual(state.past, []);
  assert.deepEqual(state.future, []);
});

test("saved keeps edits typed while the request was in flight", () => {
  const edited = reduce(start(), edit("b", null, 1000));
  const savedFrom = edited.present;
  const typed = reduce(edited, edit("bc", null, 2000));
  const normalized = { text: "b", n: 0 };
  const state = reduce(typed, { type: "saved", normalized, savedFrom });
  assert.equal(state.present.text, "bc");
  assert.equal(state.past.length, typed.past.length);
  assert.equal(state.baseline, normalized);
  assert.equal(state.source, normalized);
});

test("sync with the current source object is a no-op", () => {
  const content = { text: "a", n: 0 };
  const state = initHistory(content, clone);
  assert.equal(reduce(state, { type: "sync", content }), state);
});

test("sync with a new object rebuilds the history on it", () => {
  const edited = reduce(start(), edit("b", null, 1000));
  const fresh = { text: "server", n: 7 };
  const state = reduce(edited, { type: "sync", content: fresh });
  assert.equal(state.source, fresh);
  assert.deepEqual(state.present, fresh);
  assert.equal(state.present, state.baseline);
  assert.deepEqual(state.past, []);
});

test("undo moves present to future and redo brings it back", () => {
  const edited = [edit("b", null, 1000), edit("c", null, 2000)].reduce(reduce, start());
  const undone = reduce(edited, { type: "undo" });
  assert.equal(undone.present.text, "b");
  assert.equal(undone.past.length, 1);
  assert.deepEqual(undone.future.map((item) => item.text), ["c"]);
  const redone = reduce(undone, { type: "redo" });
  assert.equal(redone.present.text, "c");
  assert.equal(redone.past.length, 2);
  assert.deepEqual(redone.future, []);
});

test("undo and redo end the typing coalescing, so the next keystroke is a new step", () => {
  const typed = [edit("b", "field:1", 1000), edit("bc", "field:1", 1100)].reduce(reduce, start());
  const stepped = reduce(reduce(typed, { type: "undo" }), { type: "redo" });
  assert.equal(stepped.key, null);
  assert.equal(reduce(stepped, edit("bcd", "field:1", 1200)).past.length, stepped.past.length + 1);
});

test("undo with nothing to undo and redo with nothing to redo return the same state", () => {
  const first = start();
  assert.equal(reduce(first, { type: "undo" }), first);
  assert.equal(reduce(first, { type: "redo" }), first);
});

test("a new change after an undo clears the redo stack", () => {
  const undone = reduce([edit("b", null, 1000), edit("c", null, 2000)].reduce(reduce, start()), { type: "undo" });
  const next = reduce(undone, edit("x", null, 3000));
  assert.deepEqual(next.future, []);
  assert.equal(next.present.text, "x");
});

test("undoing every step returns the baseline object itself", () => {
  const first = start();
  const undone = [edit("b", null, 1000), edit("c", null, 2000)].reduce(reduce, first);
  const back = reduce(reduce(undone, { type: "undo" }), { type: "undo" });
  assert.equal(back.present, back.baseline);
  assert.equal(back.past.length, 0);
});
