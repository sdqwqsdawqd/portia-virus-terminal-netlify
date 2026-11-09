import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// D-63 (20-53): every picture field of the editor offers the visible part of its picture. The fields are lines `<ImageEditorField …` in
// components/portia-editor.tsx and components/portia-editor-dossier.tsx; each carries the three frame attributes on the line of its tag
// (the guard of lib/format-launch.test.ts allows exactly that). Two fields are out on purpose: the photo block of a «Справочник» card page
// (showPreview={false}: it has its own «Расположение и видимая часть фото») and, by the owner's decision of 20-52 (variant b), «Фото сотрудника».

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fieldLines = (text: string) => text.split("\n").filter((line) => line.includes("<ImageEditorField"));

/** The decision of 20-52 about the employee photo: `employee_framing: a` or `b` in its SUMMARY. */
function employeeFraming(): "a" | "b" {
  const summary = read(".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-52-SUMMARY.md");
  const found = /^employee_framing:\s*(a|b)\s*$/m.exec(summary)?.[1];
  assert.ok(found === "a" || found === "b", "20-52-SUMMARY.md says employee_framing: a or b");
  return found;
}

const hasFraming = (line: string) => /\sframing=\{/.test(line) && /\sframingBox="(natural|band|tile)"/.test(line) && /\sonFramingChange=\{/.test(line);
const hasNoFraming = (line: string) => !/\s(framing|framingBox|onFramingChange)=/.test(line);

test("D-63: every picture field of the editor file offers the visible part, except the card page photo block and (variant b) the employee photo", () => {
  const lines = fieldLines(read("components/portia-editor.tsx"));
  assert.equal(lines.length, 8, "the editor file has eight picture fields");
  const employee = employeeFraming();
  for (const line of lines) {
    const label = /label="([^"]*)"/.exec(line)?.[1] ?? "";
    if (line.includes("showPreview={false}")) assert.ok(hasNoFraming(line), `the card page photo block keeps its own layout editor: ${label}`);
    else if (label === "Фото сотрудника") assert.ok(employee === "a" ? hasFraming(line) : hasNoFraming(line), `the employee photo follows 20-52 (employee_framing: ${employee})`);
    else assert.ok(hasFraming(line), `the field «${label}» carries framing, framingBox and onFramingChange on its tag line`);
  }
  assert.ok(lines.filter(hasFraming).length >= (employee === "a" ? 7 : 6), "six fields (seven with employees) offer the frame");
});

test("D-63: both picture fields of the archived virus editor offer the visible part", () => {
  const lines = fieldLines(read("components/portia-editor-dossier.tsx"));
  assert.equal(lines.length, 2, "the dossier file holds the two fields of ArchivedVirusEditor");
  for (const line of lines) assert.ok(hasFraming(line), `the archived virus field carries the frame attributes: ${line.slice(0, 80)}`);
});

test("D-63: the frame kinds match the surfaces of the site (band, cover tile, pictures that lie as they are)", () => {
  const lines = fieldLines(read("components/portia-editor.tsx"));
  const kindOf = (label: string) => /\sframingBox="(\w+)"/.exec(lines.find((line) => line.includes(`label="${label}"`)) ?? "")?.[1];
  assert.equal(kindOf("Фото раздела"), "band");
  assert.equal(kindOf("Обложка"), "tile");
  for (const label of ["Фото или GIF после заражения", "Изображение или GIF мутации", "Фото", "Фотография или GIF"]) {
    const kinds = lines.filter((line) => line.includes(`label="${label}"`) && !line.includes("showPreview={false}")).map((line) => /\sframingBox="(\w+)"/.exec(line)?.[1]);
    assert.ok(kinds.length > 0 && kinds.every((kind) => kind === "natural"), `«${label}» is a natural frame`);
  }
});

test("D-63: ImageEditorField shows the block only for an opened picture with a handler, and drops the frame when the address changes", () => {
  const source = read("components/portia-editor-dossier.tsx");
  assert.match(source, /value && !previewFailed && framingBox && onFramingChange && <ImageFramingEditor/, "the block needs an address, an opened picture, a kind and a handler");
  assert.match(source, /next !== value && framing && onFramingChange\) onFramingChange\(undefined\)/, "a changed address drops the frame");
  assert.match(source, /addressAtPick\.current = value/, "an upload remembers the address it was picked on");
});

test("D-66: the captions of the block and of its window live in its own file, not in the editor file (D-58); the three sliders of D-63 are gone", () => {
  const block = read("components/portia-image-framing.tsx");
  for (const text of ["Видимая часть", "Изменить", "Положение картинки", "Масштаб", "Сбросить", "Отмена", "Применить"]) assert.ok(block.includes(text), `«${text}» is in portia-image-framing.tsx`);
  for (const text of ["По горизонтали", "По вертикали"]) assert.equal(block.includes(`"${text}"`) || block.includes(`>${text}<`), false, `«${text}» (a slider of D-63) is gone from portia-image-framing.tsx`);
  const editor = read("components/portia-editor.tsx");
  // «Отмена» is a word of the editor in another place, so it is not checked here.
  for (const text of ["Положение картинки", "Масштаб", "Сбросить", "Применить"]) assert.equal(editor.includes(`>${text}<`) || editor.includes(`"${text}"`), false, `«${text}» is not a text of the editor file`);
  const dossier = read("components/portia-editor-dossier.tsx");
  for (const text of ["Положение картинки", "Масштаб", "Применить"]) assert.equal(dossier.includes(`>${text}<`) || dossier.includes(`"${text}"`), false, `«${text}» is not a text of the picture field file`);
});

test("D-66: the block uses the geometry module and the frame format only (no PortiaImage: the template builder shares the picture field)", () => {
  const block = read("components/portia-image-framing.tsx");
  assert.match(block, /from "@\/lib\/image-framing-crop"/, "the geometry comes from lib/image-framing-crop.ts");
  assert.match(block, /from "@\/lib\/image-framing"/, "the preview is made with imageFramingStyles of the site");
  assert.equal(/portia-desktop-media/.test(block), false, "the block does not import PortiaImage");
  assert.equal(/type="range"[^>]*min=\{imageFramingLimits\.position/.test(block), false, "no slider for a position");
});
