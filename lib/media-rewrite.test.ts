import test from "node:test";
import assert from "node:assert/strict";
import { imageUrlsOfRecord, mediaRewriteRefusal, parsePortiaMediaUrl, replaceImageInContent, replaceImageUrl, retirableUrls } from "./media-rewrite.ts";
import type { PortiaContent } from "./portia-content.ts";
import { retireImageUrl, rewriteImageUrl } from "./media-rewrite-client.ts";
import { uploadRefusal } from "./image-upload.ts";

const HOST = "https://project.supabase.co";
const UUID = "0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const OTHER_UUID = "11111111-2222-4333-8444-555555555555";
const publicUrl = (path: string, host = HOST, bucket = "portia-media") => `${host}/storage/v1/object/public/${bucket}/${path}`;
const goodPath = `recycle/${UUID}.png`;

test("parsePortiaMediaUrl: an address inside the site bucket gives its storage path and extension (T-25-06)", () => {
  assert.deepEqual(parsePortiaMediaUrl(publicUrl(goodPath), HOST), { path: goodPath, ext: "png" });
  for (const ext of ["jpg", "webp", "gif"]) {
    assert.deepEqual(parsePortiaMediaUrl(publicUrl(`recycle/${UUID}.${ext}`), HOST), { path: `recycle/${UUID}.${ext}`, ext });
  }
  // A trailing slash on the configured host is the same origin.
  assert.deepEqual(parsePortiaMediaUrl(publicUrl(goodPath), `${HOST}/`), { path: goodPath, ext: "png" });
});

test("parsePortiaMediaUrl: path-traversal and encoding decoys are refused before any storage call (EDGE SEC-05/encoding)", () => {
  const decoys: string[] = [
    publicUrl(`recycle/%2e%2e/${UUID}.png`),
    publicUrl(`recycle/%2E%2E/${UUID}.png`),
    publicUrl(`recycle/../recycle/${UUID}.png`),
    publicUrl(`../portia-media/${goodPath}`),
    publicUrl(`recycle%2F${UUID}.png`),
    publicUrl(`recycle/${UUID}%2epng`),
    `${HOST}/storage/v1/object/public/portia-media\\recycle/${UUID}.png`,
    publicUrl(`recycle\\${UUID}.png`),
    `${publicUrl(goodPath)}\n`,
    `${publicUrl(goodPath)}\t`,
    publicUrl(`recycle/${UUID}.png\u0000`),
    ` ${publicUrl(goodPath)}`,
    `${publicUrl(goodPath)}?download=1`,
    `${publicUrl(goodPath)}#x`,
    `https://user:pw@project.supabase.co/storage/v1/object/public/portia-media/${goodPath}`,
  ];
  for (const decoy of decoys) assert.equal(parsePortiaMediaUrl(decoy, HOST), null, `refused: ${JSON.stringify(decoy)}`);
});

test("parsePortiaMediaUrl: another host, scheme, bucket, route or shape is refused (T-25-06)", () => {
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath, "https://evil.example"), HOST), null, "another host");
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath, "https://project.supabase.co.evil.example"), HOST), null, "host suffix");
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath, "https://evil.example/https://project.supabase.co"), HOST), null, "embedded host");
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath, "http://project.supabase.co"), HOST), null, "http");
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath, HOST, "other-bucket"), HOST), null, "another bucket");
  assert.equal(parsePortiaMediaUrl(`${HOST}/storage/v1/object/sign/portia-media/${goodPath}`, HOST), null, "signed route");
  assert.equal(parsePortiaMediaUrl(`${HOST}/storage/v1/object/public/portia-media/${goodPath}/extra`, HOST), null, "extra segment");
  assert.equal(parsePortiaMediaUrl(publicUrl(`recycle/${UUID}.svg`), HOST), null, "svg is not in the list");
  assert.equal(parsePortiaMediaUrl(publicUrl(`recycle/${UUID}`), HOST), null, "no extension");
  assert.equal(parsePortiaMediaUrl(publicUrl(`recycle/${UUID}.PNG`), HOST), null, "upper case extension");
  assert.equal(parsePortiaMediaUrl(publicUrl(`other/${UUID}.png`), HOST), null, "another folder");
  assert.equal(parsePortiaMediaUrl(publicUrl("recycle/short.png"), HOST), null, "not a uuid");
  assert.equal(parsePortiaMediaUrl(publicUrl(`recycle/${UUID}.png.png`), HOST), null, "double extension");
  assert.equal(parsePortiaMediaUrl(`/images/local.png`, HOST), null, "a local file of the site");
  assert.equal(parsePortiaMediaUrl("not a url", HOST), null);
  assert.equal(parsePortiaMediaUrl("", HOST), null);
});

test("parsePortiaMediaUrl: an empty or broken configured host refuses everything", () => {
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath), ""), null);
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath), "not a url"), null);
  assert.equal(parsePortiaMediaUrl(publicUrl(goodPath), "http://project.supabase.co"), null, "an http host is not the site bucket");
});

const mine = (name: string) => publicUrl(`recycle/${name}.png`);
const virus = {
  id: "v1",
  infectedImage: mine(UUID),
  mutations: [{ id: "m1", image: mine(OTHER_UUID) }, { id: "m2", image: "" }, { id: "m3", image: "https://elsewhere.example/a.png" }, { id: "m4", image: mine(UUID) }],
  scientistLogs: [],
};

test("imageUrlsOfRecord(virus): the photo after infection and the mutation images, no empty values and no repeats", () => {
  assert.deepEqual(imageUrlsOfRecord("virus", virus), [mine(UUID), mine(OTHER_UUID), "https://elsewhere.example/a.png"]);
  assert.deepEqual(imageUrlsOfRecord("virus", { id: "v", infectedImage: "", mutations: [] }), [], "zero images");
  assert.deepEqual(imageUrlsOfRecord("virus", { id: "v", infectedImage: mine(UUID), mutations: [] }), [mine(UUID)], "one image");
});

test("replaceImageUrl: every image field of the record changes, the input is not mutated, others stay", () => {
  const before = JSON.stringify(virus);
  const next = replaceImageUrl(virus, mine(UUID), "NEW") as typeof virus;
  assert.equal(JSON.stringify(virus), before, "the input is untouched");
  assert.notEqual(next, virus);
  assert.equal(next.infectedImage, "NEW");
  assert.equal(next.mutations[0].image, mine(OTHER_UUID));
  assert.equal(next.mutations[3].image, "NEW", "a repeated address changes everywhere");
  assert.equal(next.mutations[2].image, "https://elsewhere.example/a.png");
  assert.equal(next.id, "v1");
  assert.deepEqual(replaceImageUrl(virus, "https://nobody.example/none.png", "NEW"), virus, "an unknown address changes nothing");
});

const photo = (id: string, url: string) => ({ id, type: "photo" as const, url });
const text = (id: string) => ({ id, type: "text" as const, text: "x" });
const infoSection = {
  id: "i1",
  title: "t",
  body: "",
  subsections: [
    { id: "s1", title: "a", blocks: [photo("b1", mine(UUID)), text("b2"), photo("b3", "https://elsewhere.example/b.png")] },
    { id: "s2", title: "b", blocks: [photo("b4", mine(OTHER_UUID)), photo("b5", mine(UUID))] },
    { id: "s3", title: "c", blocks: [] },
  ],
};

test("imageUrlsOfRecord(info-section and info-subsection): photo blocks of all subsections or of one", () => {
  assert.deepEqual(imageUrlsOfRecord("info-section", infoSection), [mine(UUID), "https://elsewhere.example/b.png", mine(OTHER_UUID)]);
  assert.deepEqual(imageUrlsOfRecord("info-subsection", infoSection.subsections[0]), [mine(UUID), "https://elsewhere.example/b.png"]);
  assert.deepEqual(imageUrlsOfRecord("info-subsection", infoSection.subsections[2]), []);
  assert.deepEqual(imageUrlsOfRecord("info-section", { ...infoSection, subsections: [] }), []);
});

const guidePhoto = (id: string, url: string) => ({ id, type: "photo" as const, url, caption: "" });
const guideSection = {
  id: "g1",
  title: "t",
  photo: mine(UUID),
  cards: [
    { id: "c1", title: "a", cover: mine(OTHER_UUID), blocks: [guidePhoto("p1", mine(UUID)), { id: "h", type: "heading" as const, text: "x" }, guidePhoto("p2", "https://elsewhere.example/c.png")] },
    { id: "c2", title: "b", cover: "", blocks: [guidePhoto("p3", mine("22222222-3333-4444-8555-666666666666"))] },
  ],
};

test("imageUrlsOfRecord(guide-section and guide-card): the section photo, covers and photo blocks of the cards", () => {
  assert.deepEqual(imageUrlsOfRecord("guide-section", guideSection), [
    mine(UUID), mine(OTHER_UUID), "https://elsewhere.example/c.png", mine("22222222-3333-4444-8555-666666666666"),
  ]);
  assert.deepEqual(imageUrlsOfRecord("guide-card", guideSection.cards[0]), [mine(OTHER_UUID), mine(UUID), "https://elsewhere.example/c.png"]);
  assert.deepEqual(imageUrlsOfRecord("guide-card", guideSection.cards[1]), [mine("22222222-3333-4444-8555-666666666666")]);
  assert.deepEqual(imageUrlsOfRecord("guide-section", { ...guideSection, photo: "", cards: [] }), []);
});

test("replaceImageUrl works for sections, subsections, guide sections and cards without touching the input", () => {
  const infoBefore = JSON.stringify(infoSection);
  const info = replaceImageUrl(infoSection, mine(UUID), "NEW") as typeof infoSection;
  assert.equal(JSON.stringify(infoSection), infoBefore);
  assert.deepEqual(imageUrlsOfRecord("info-section", info), ["NEW", "https://elsewhere.example/b.png", mine(OTHER_UUID)]);
  const guideBefore = JSON.stringify(guideSection);
  const guide = replaceImageUrl(guideSection, mine(UUID), "NEW") as typeof guideSection;
  assert.equal(JSON.stringify(guideSection), guideBefore);
  assert.equal(guide.photo, "NEW");
  assert.equal(guide.cards[0].blocks[0].type === "photo" && guide.cards[0].blocks[0].url, "NEW");
  const card = replaceImageUrl(guideSection.cards[0], mine(OTHER_UUID), "NEW") as typeof guideSection.cards[0];
  assert.equal(card.cover, "NEW");
  const text0 = replaceImageUrl(infoSection.subsections[0], mine(UUID), "NEW") as typeof infoSection.subsections[0];
  assert.equal(text0.blocks[1].type, "text");
});

test("replaceImageInContent: changes the record of that kind and id inside a draft, in place", () => {
  const draft = { viruses: [virus], infoSections: [infoSection], guideSections: [guideSection] } as unknown as PortiaContent;
  replaceImageInContent(draft, "virus", "v1", mine(UUID), "N1");
  assert.equal(draft.viruses[0].infectedImage, "N1");
  replaceImageInContent(draft, "info-subsection", "s2", mine(UUID), "N2");
  assert.deepEqual(imageUrlsOfRecord("info-subsection", draft.infoSections[0].subsections[0]), [mine(UUID), "https://elsewhere.example/b.png"], "another subsection is untouched");
  assert.deepEqual(imageUrlsOfRecord("info-subsection", draft.infoSections[0].subsections[1]), [mine(OTHER_UUID), "N2"]);
  replaceImageInContent(draft, "guide-card", "c1", mine(OTHER_UUID), "N3");
  assert.equal(draft.guideSections[0].cards[0].cover, "N3");
  replaceImageInContent(draft, "guide-section", "g1", mine(UUID), "N4");
  assert.equal(draft.guideSections[0].photo, "N4");
  replaceImageInContent(draft, "info-section", "i1", "https://elsewhere.example/b.png", "N5");
  assert.ok(imageUrlsOfRecord("info-section", draft.infoSections[0]).includes("N5"));
  const before = JSON.stringify(draft);
  replaceImageInContent(draft, "virus", "missing", mine(UUID), "X");
  assert.equal(JSON.stringify(draft), before, "an unknown id changes nothing");
});

test("retirableUrls: only queue addresses whose path is absent from the saved payload (D-13)", () => {
  const old = mine(UUID);
  const kept = mine(OTHER_UUID);
  const saved = JSON.stringify({ viruses: [{ infectedImage: mine("33333333-4444-4555-8666-777777777777") }] });
  assert.deepEqual(retirableUrls([old, kept], saved), [old, kept]);
  // An address brought back by undo and saved is not retired.
  assert.deepEqual(retirableUrls([old, kept], JSON.stringify({ viruses: [{ infectedImage: kept }] })), [old]);
  assert.deepEqual(retirableUrls([], saved), []);
  // Not a site bucket address: never retired.
  assert.deepEqual(retirableUrls(["https://elsewhere.example/a.png", "/images/a.png", ""], saved), []);
  // A set works as the queue and the result has no repeats.
  assert.deepEqual(retirableUrls(new Set([old]), saved), [old]);
  assert.deepEqual(retirableUrls([old, old], saved), [old]);
});

test("mediaRewriteRefusal: fixed Russian texts in the style of uploadRefusal", () => {
  assert.deepEqual(Object.keys(mediaRewriteRefusal).sort(), ["inUse", "server", "url"]);
  for (const value of Object.values(mediaRewriteRefusal)) assert.match(value, /[А-Яа-яЁё]/);
});

type Call = { url: string; init: RequestInit };
function withFetch(reply: (call: Call) => Response | Promise<Response>, run: (calls: Call[]) => Promise<void>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;
  return run(calls).finally(() => { globalThis.fetch = original; });
}

test("rewriteImageUrl: POST JSON to /api/uploads and returns the new address or the error text", async () => {
  await withFetch(() => Response.json({ url: "https://new.example/x.png" }), async (calls) => {
    assert.deepEqual(await rewriteImageUrl("https://old.example/x.png"), { url: "https://new.example/x.png" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/uploads");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(calls[0].init.headers, { "content-type": "application/json" });
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { action: "rewrite", url: "https://old.example/x.png" });
  });
  await withFetch(() => Response.json({ error: "нет" }, { status: 400 }), async () => {
    assert.deepEqual(await rewriteImageUrl("u"), { error: "нет" });
  });
  await withFetch(() => new Response("not json", { status: 502 }), async () => {
    assert.deepEqual(await rewriteImageUrl("u"), { error: uploadRefusal.server });
  });
  await withFetch(() => Response.json({}), async () => {
    assert.deepEqual(await rewriteImageUrl("u"), { error: uploadRefusal.server }, "an ok answer without an address is a failure");
  });
  await withFetch(() => { throw new TypeError("offline"); }, async () => {
    assert.deepEqual(await rewriteImageUrl("u"), { error: uploadRefusal.network });
  });
});

test("retireImageUrl: DELETE with the address; 409 is in-use, any other refusal or a network failure is failed", async () => {
  await withFetch(() => Response.json({ removed: true }), async (calls) => {
    assert.equal(await retireImageUrl("https://old.example/x.png"), "removed");
    assert.equal(calls[0].url, "/api/uploads");
    assert.equal(calls[0].init.method, "DELETE");
    assert.deepEqual(calls[0].init.headers, { "content-type": "application/json" });
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { url: "https://old.example/x.png" });
  });
  await withFetch(() => Response.json({ error: "x", code: "media-in-use" }, { status: 409 }), async () => {
    assert.equal(await retireImageUrl("u"), "in-use");
  });
  await withFetch(() => Response.json({ error: "x" }, { status: 503 }), async () => {
    assert.equal(await retireImageUrl("u"), "failed");
  });
  await withFetch(() => { throw new TypeError("offline"); }, async () => {
    assert.equal(await retireImageUrl("u"), "failed");
  });
});
