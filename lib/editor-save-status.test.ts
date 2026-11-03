import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partialSave, saveStatusText } from "./editor-save-status.ts";

const editor = readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");
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
  assert.ok((editor.match(/saveStatusText\(/g) ?? []).length >= 2);
  assert.doesNotMatch(editor, /"СОХРАНЕНИЕ…"|"СОХРАНЕНО"/);
});

test("«Сохранено» goes out after 4s, not 1.8s, and the save button keeps focus while saving (UI E3, D-12)", () => {
  assert.match(desktop, /setSaveState\("idle"\), 4000\)/);
  assert.doesNotMatch(desktop, /setSaveState\("idle"\), 1800\)/);
  assert.match(editor, /setState\("idle"\), 4000\)/);
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
