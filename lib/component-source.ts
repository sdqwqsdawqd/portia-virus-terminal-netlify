import { readdirSync, readFileSync } from "node:fs";

/** Source tests follow code moved into seam modules: the main file first, then its `<main>-*.tsx` siblings sorted by name. */
export function componentFamily(main: "portia-desktop" | "portia-editor"): { file: string; text: string }[] {
  const dir = new URL("../components/", import.meta.url);
  const seams = readdirSync(dir).filter((name) => name.startsWith(`${main}-`) && name.endsWith(".tsx")).sort();
  return [`${main}.tsx`, ...seams].map((file) => ({ file, text: readFileSync(new URL(file, dir), "utf8") }));
}
