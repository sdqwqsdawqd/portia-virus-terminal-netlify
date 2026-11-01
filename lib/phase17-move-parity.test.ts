import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { codeLines, moveProblems } from "../scripts/phase17-move-parity.mjs";

const fn = ["function add(a: number, b: number) {", "  return a + b;", "}"];
const source = (...lines: string[]) => lines.join("\n") + "\n";

describe("phase17 move parity", () => {
  test("codeLines drops imports, blanks, use client and the export prefix", () => {
    const text = source(
      '"use client";',
      "",
      'import { a } from "x";',
      "import {",
      "  b,",
      '} from "y";',
      'import "side";',
      "export function f() {}  ",
      "export const c = 1;",
      "export default function d() {}",
    );
    assert.deepEqual(codeLines(text), ["function f() {}", "const c = 1;", "export default function d() {}"]);
  });

  test("a pure move with added use client, imports and export prefix has no problems", () => {
    const before = source('import { a } from "x";', ...fn, "const keep = 1;");
    const after = source('import { a } from "x";', "const keep = 1;");
    const target = source('"use client";', 'import { z } from "z";', "export " + fn[0], ...fn.slice(1));
    assert.deepEqual(moveProblems({ sourceBefore: before, sourceAfter: after, targets: [{ before: "", after: target }] }), []);
  });

  test("one changed character inside the moved body is reported both ways", () => {
    const before = source(...fn);
    const target = source(fn[0], "  return a - b;", fn[2]);
    const problems = moveProblems({ sourceBefore: before, sourceAfter: "", targets: [{ before: "", after: target }] });
    assert.ok(problems.includes("problem: missing in target:   return a + b;"));
    assert.ok(problems.includes("problem: not from source:   return a - b;"));
  });

  test("an extra non-import line in the target is not from the source", () => {
    const target = source(...fn, "const extra = 1;");
    assert.deepEqual(moveProblems({ sourceBefore: source(...fn), sourceAfter: "", targets: [{ before: "", after: target }] }), [
      "problem: not from source: const extra = 1;",
    ]);
  });

  test("a non-import line added to the source is reported as gained", () => {
    const after = source("const added = 1;");
    const problems = moveProblems({ sourceBefore: source(...fn), sourceAfter: after, targets: [{ before: "", after: source(...fn) }] });
    assert.deepEqual(problems, ["problem: source gained: const added = 1;"]);
  });

  test("only the growth of a target that already had code counts", () => {
    const old = source("const old = 1;");
    assert.deepEqual(
      moveProblems({ sourceBefore: source(...fn), sourceAfter: "", targets: [{ before: old, after: old + source(...fn) }] }),
      [],
    );
  });

  test("CRLF in the before text and LF in the after text is not a difference", () => {
    const crlf = source(...fn, "const keep = 1;").replaceAll("\n", "\r\n");
    assert.deepEqual(
      moveProblems({ sourceBefore: crlf, sourceAfter: source("const keep = 1;"), targets: [{ before: "", after: source(...fn) }] }),
      [],
    );
  });

  test("dropping a specifier from a multi-line import in the source is fine; nothing moved is a problem", () => {
    const before = source("import {", "  a,", "  b,", '} from "x";', "const keep = 1;");
    const after = source("import {", "  a,", '} from "x";', "const keep = 1;");
    assert.deepEqual(moveProblems({ sourceBefore: before, sourceAfter: after, targets: [{ before: "", after: "" }] }), ["problem: nothing moved"]);
  });
});
