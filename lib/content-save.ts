import { levelCopy } from "./level-copy.ts";
import { raiseChildLevels } from "./level-hierarchy.ts";
import { isViewerShapedContent } from "./level-placeholders.ts";
import type { PortiaContent } from "./portia-content.ts";

export type ContentSavePlan =
  | { kind: "refuse"; status: 422; body: { error: string; code: "viewer-copy" } }
  | { kind: "save"; content: PortiaContent; levelsRaised: number };

// Phase 24, LVL-08 / D-17. Pure: the input is never changed, so a repeated send of the same body gives the same answer.
// The editor works only with the full content (D-05); a copy built for a viewer, with records withheld from them, is never
// written over the stored content (LVL-08). A full copy has the levels of subsections and cards lifted to their section (D-17)
// before it is written, so a broken hierarchy is not stored whatever client sent it.
export function prepareContentSave(normalized: PortiaContent): ContentSavePlan {
  if (isViewerShapedContent(normalized)) {
    return { kind: "refuse", status: 422, body: { error: levelCopy.putRefused, code: "viewer-copy" } };
  }
  const { content, raised } = raiseChildLevels(normalized);
  return { kind: "save", content, levelsRaised: raised };
}
