import test from "node:test";
import assert from "node:assert/strict";
import { changedDossierTabs, changedSections, deniedSections, dossierTabs, editorSections, sectionOfKey, unclassifiedTextKeys, type EditorSection } from "./editor-changes.ts";
import { defaultPortiaContent, portiaTextKey, type PortiaContent } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";

const fixture = (): PortiaContent => structuredClone(defaultPortiaContent);

test("identical copies have no changed sections", () => {
  assert.deepEqual(changedSections(fixture(), fixture()), []);
});

test("renaming a virus changes only the viruses section", () => {
  const draft = fixture();
  draft.viruses[0].name = "ПЕРЕИМЕНОВАН";
  assert.deepEqual(changedSections(fixture(), draft), ["viruses"]);
});

test("moving a virus to the bin changes viruses and the bin", () => {
  const draft = fixture();
  const [virus] = draft.viruses.splice(0, 1);
  draft.recycledViruses.push(virus);
  draft.recycleOrder.push(`virus:${virus.id}`);
  assert.deepEqual(changedSections(fixture(), draft), ["viruses", "recycle"]);
});

test("an info formattedText entry marks the info section", () => {
  const draft = fixture();
  draft.formattedText["info:some:body"] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(changedSections(fixture(), draft), ["info"]);
});

test("a virus formattedText entry follows where the virus lives", () => {
  const live = fixture();
  live.formattedText[`virus:${live.viruses[0].id}:external`] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(changedSections(fixture(), live), ["viruses"]);

  const baseline = fixture();
  const [virus] = baseline.viruses.splice(0, 1);
  baseline.recycledViruses.push(virus);
  const recycled = structuredClone(baseline);
  recycled.formattedText[`virus:${virus.id}:external`] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(changedSections(baseline, recycled), ["recycle"]);
});

test("toggling an assistant flag marks the assistant section", () => {
  const draft = fixture();
  draft.assistantIdleEnabled = !draft.assistantIdleEnabled;
  assert.deepEqual(changedSections(fixture(), draft), ["assistant"]);
});

test("every content key except formattedText belongs to a section", () => {
  for (const key of Object.keys(defaultPortiaContent)) {
    if (key === "formattedText") continue;
    assert.notEqual(sectionOfKey(key), null, key);
  }
  assert.equal(sectionOfKey("formattedText"), null);
  assert.equal(sectionOfKey("somethingNew"), null);
});

const richText = { runs: [{ text: "x" }] } as never;

test("dossier tabs are labelled in the order main, text, mutations, logs", () => {
  assert.deepEqual(dossierTabs, [["main", "Основное"], ["text", "Описание"], ["mutations", "Мутации"], ["logs", "Записи учёных"]]);
});

test("identical copies have no changed dossier tabs", () => {
  const id = fixture().viruses[0].id;
  assert.deepEqual(changedDossierTabs(fixture(), fixture(), id), []);
});

test("name, status, image and classification mark the main tab", () => {
  const id = fixture().viruses[0].id;
  const edits: ((virus: PortiaContent["viruses"][number]) => void)[] = [
    (virus) => { virus.name = "X"; },
    (virus) => { virus.status = "X"; },
    (virus) => { virus.infectedImage = "X"; },
    (virus) => { virus.classification.danger = "X"; },
  ];
  for (const edit of edits) {
    const draft = fixture();
    edit(draft.viruses[0]);
    assert.deepEqual(changedDossierTabs(fixture(), draft, id), ["main"]);
  }
});

test("external, physiology, ppu and their formattedText mark the text tab", () => {
  const id = fixture().viruses[0].id;
  const edits: ((draft: PortiaContent) => void)[] = [
    (draft) => { draft.viruses[0].external = "X"; },
    (draft) => { draft.viruses[0].physiology = "X"; },
    (draft) => { draft.viruses[0].ppu.speed = "X"; },
    (draft) => { draft.formattedText[`virus:${id}:external`] = richText; },
    (draft) => { draft.formattedText[`virus:${id}:ppu-abilities`] = richText; },
  ];
  for (const edit of edits) {
    const draft = fixture();
    edit(draft);
    assert.deepEqual(changedDossierTabs(fixture(), draft, id), ["text"]);
  }
});

test("editing, adding or removing a mutation marks the mutations tab", () => {
  const id = fixture().viruses[0].id;
  const edit = fixture();
  edit.viruses[0].mutations[0].name = "X";
  assert.deepEqual(changedDossierTabs(fixture(), edit, id), ["mutations"]);

  const removed = fixture();
  removed.viruses[0].mutations.pop();
  assert.deepEqual(changedDossierTabs(fixture(), removed, id), ["mutations"]);

  const text = fixture();
  text.formattedText[`virus:${id}:mutation:0:description`] = richText;
  assert.deepEqual(changedDossierTabs(fixture(), text, id), ["mutations"]);
});

test("editing a scientist log marks the logs tab", () => {
  const draft = fixture();
  draft.viruses[0].scientistLogs[0].title = "X";
  assert.deepEqual(changedDossierTabs(fixture(), draft, draft.viruses[0].id), ["logs"]);
});

test("changes to several parts come back in tab order", () => {
  const draft = fixture();
  draft.viruses[0].scientistLogs.pop();
  draft.viruses[0].name = "X";
  assert.deepEqual(changedDossierTabs(fixture(), draft, draft.viruses[0].id), ["main", "logs"]);
});

test("a virus new since the last save marks every dossier tab", () => {
  const draft = fixture();
  draft.viruses.push({ ...structuredClone(draft.viruses[0]), id: "vir-new" });
  assert.deepEqual(changedDossierTabs(fixture(), draft, "vir-new"), ["main", "text", "mutations", "logs"]);
});

test("a recycled virus is looked up in recycledViruses and moving it alone changes nothing", () => {
  const baseline = fixture();
  const [virus] = baseline.viruses.splice(0, 1);
  baseline.recycledViruses.push(virus);
  const draft = structuredClone(baseline);
  assert.deepEqual(changedDossierTabs(baseline, draft, virus.id), []);
  draft.recycledViruses[0].physiology = "X";
  assert.deepEqual(changedDossierTabs(baseline, draft, virus.id), ["text"]);
});

test("changedDossierTabs treats a missing recycledViruses as empty", () => {
  const old = (): PortiaContent => {
    const content = fixture();
    delete (content as Partial<PortiaContent>).recycledViruses;
    return content;
  };
  const draft = old();
  draft.viruses[0].physiology = "X";
  assert.deepEqual(changedDossierTabs(old(), draft, draft.viruses[0].id), ["text"]);
});

test("a virus id in neither draft list has no changed tabs", () => {
  assert.deepEqual(changedDossierTabs(fixture(), fixture(), "nope"), []);
});

// PERM-04 (Phase 12): which closed sections a save changes.
const moveToBin = (content: PortiaContent, index = 0) => {
  const [virus] = content.viruses.splice(index, 1);
  content.recycledViruses.push(virus);
  content.recycleOrder.push(`virus:${virus.id}`);
  return virus;
};
const withBinVirus = (): PortiaContent => {
  const content = fixture();
  moveToBin(content);
  return content;
};

test("info-block formatting keys count as an info change", () => {
  const draft = fixture();
  draft.formattedText["info-block:abc:text"] = richText;
  assert.deepEqual(changedSections(fixture(), draft), ["info"]);
  assert.deepEqual(unclassifiedTextKeys(fixture(), draft), []);
  assert.deepEqual(deniedSections(fixture(), draft, ["info"]), ["info"]);
});

test("every portiaTextKey builder output classifies into a section", () => {
  const id = fixture().viruses[0].id;
  const cases: [string, EditorSection][] = [
    [portiaTextKey.virus(id, "external"), "viruses"],
    [portiaTextKey.mutation(id, 0), "viruses"],
    [portiaTextKey.info("s"), "info"],
    [portiaTextKey.infoBlock("b"), "info"],
    [portiaTextKey.broadcast("n"), "broadcasts"],
    [portiaTextKey.recycle("f"), "recycle"],
    [portiaTextKey.searchRecommendations, "search"],
    [portiaTextKey.assistantAdvice, "assistant"],
    [portiaTextKey.assistantOffended, "assistant"],
    [portiaTextKey.assistantIdle, "assistant"],
    [portiaTextKey.assistantActivity, "assistant"],
  ];
  for (const [key, section] of cases) {
    const draft = fixture();
    draft.formattedText[key] = richText;
    assert.deepEqual(changedSections(fixture(), draft), [section], key);
    assert.deepEqual(unclassifiedTextKeys(fixture(), draft), [], key);
  }
});

test("unclassifiedTextKeys lists changed keys that belong to no section", () => {
  const draft = fixture();
  draft.formattedText["zzz:1"] = richText;
  assert.deepEqual(unclassifiedTextKeys(fixture(), draft), ["zzz:1"]);
  const baseline = fixture();
  baseline.formattedText["zzz:1"] = richText;
  assert.deepEqual(unclassifiedTextKeys(baseline, structuredClone(baseline)), []);
});

test("a broadcast title edit is denied only when broadcasts is closed", () => {
  const baseline = fixture();
  baseline.broadcasts.push({ id: "b1", type: "news", title: "a", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" });
  const draft = structuredClone(baseline);
  draft.broadcasts[0].title = "b";
  assert.deepEqual(deniedSections(baseline, draft, ["broadcasts"]), ["broadcasts"]);
  assert.deepEqual(deniedSections(baseline, draft, ["info"]), []);
});

test("D-13: moving a live virus to the bin is a viruses edit, not a bin edit", () => {
  const draft = fixture();
  moveToBin(draft);
  assert.deepEqual(deniedSections(fixture(), draft, ["recycle"]), []);
  assert.deepEqual(deniedSections(fixture(), draft, ["viruses"]), ["viruses"]);
  assert.deepEqual(deniedSections(fixture(), draft, ["viruses", "recycle"]), ["viruses"]);

  const withText = structuredClone(draft);
  withText.formattedText[`virus:${withText.recycledViruses[0].id}:external`] = richText;
  assert.deepEqual(deniedSections(fixture(), withText, ["recycle"]), []);
});

test("D-13: every other bin change stays a bin edit", () => {
  const closed: EditorSection[] = ["recycle"];
  const edits: [string, PortiaContent, (draft: PortiaContent) => void][] = [
    ["a new record that was never live", fixture(), (draft) => {
      draft.recycledViruses.push({ ...structuredClone(draft.viruses[0]), id: "vir-new" });
      draft.recycleOrder.push("virus:vir-new");
    }],
    ["editing a bin virus", withBinVirus(), (draft) => { draft.recycledViruses[0].name = "X"; }],
    ["editing a recycle file", fixture(), (draft) => { draft.recycleFiles[0].name = "X"; }],
    ["deleting a bin entry", withBinVirus(), (draft) => { draft.recycledViruses = []; draft.recycleOrder.pop(); }],
    ["reversing recycleOrder", fixture(), (draft) => { draft.recycleOrder.reverse(); }],
    ["restoring a bin virus", withBinVirus(), (draft) => {
      draft.viruses.push(draft.recycledViruses.pop()!);
      draft.recycleOrder.pop();
    }],
    ["a move plus a recycle file edit", fixture(), (draft) => { moveToBin(draft); draft.recycleFiles[0].name = "X"; }],
  ];
  for (const [name, baseline, edit] of edits) {
    const draft = structuredClone(baseline);
    edit(draft);
    assert.deepEqual(deniedSections(baseline, draft, closed), ["recycle"], name);
  }
});

test("a copy without recycledViruses or recycleOrder is treated as empty lists", () => {
  const old = (): PortiaContent => {
    const content = fixture();
    delete (content as Partial<PortiaContent>).recycledViruses;
    delete (content as Partial<PortiaContent>).recycleOrder;
    return content;
  };
  const draft = old();
  draft.viruses[0].name = "X";
  assert.deepEqual(deniedSections(old(), draft, ["recycle"]), []);
  assert.deepEqual(deniedSections(old(), draft, ["viruses"]), ["viruses"]);
});

test("normalizePortiaContent is idempotent, so a normalized compare shows no phantom difference", () => {
  const rich = fixture();
  rich.infoSections[0].subsections.push({
    id: "sub-1",
    title: "T",
    blocks: [{ id: "blk-photo", type: "photo", url: "/x.png" }, { id: "blk-text", type: "text", text: "hello" }],
  });
  rich.formattedText[portiaTextKey.infoBlock("blk-text")] = richText;
  rich.broadcasts.push({ id: "b1", type: "quest", title: "a", body: "b", published: true, important: false, startsAt: "", endsAt: "", conditions: "" });
  rich.formattedText[portiaTextKey.broadcast("b1")] = richText;
  moveToBin(rich);
  for (const content of [defaultPortiaContent, rich]) {
    const once = normalizePortiaContent(content)!;
    const twice = normalizePortiaContent(once)!;
    assert.deepEqual(twice, once);
    assert.deepEqual(deniedSections(once, twice, editorSections), []);
  }
});
