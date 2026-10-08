import { env } from "cloudflare:workers";
import { defaultPortiaContent, type PortiaContent } from "@/lib/portia-content";

export const dynamic = "force-dynamic";

type ContentRow = { payload: string; revision: number; updated_at: string };
const PORTIA_OWNER_EMAIL = "qloxzick@gmail.com";

function database() {
  if (!env.DB) throw new Error("PORTIA database binding is unavailable");
  return env.DB;
}

function currentUser(request: Request) {
  const hostname = new URL(request.url).hostname;
  const isLocalPreview = hostname === "127.0.0.1" || hostname === "localhost";
  return {
    id: request.headers.get("oai-authenticated-user-id")?.trim() || (isLocalPreview ? "local-preview-owner" : ""),
    email: request.headers.get("oai-authenticated-user-email")?.trim() || (isLocalPreview ? "preview@local" : ""),
  };
}

async function ensureAdmin(request: Request) {
  const user = currentUser(request);
  const isLocalPreview = user.id === "local-preview-owner";
  const isSiteOwner = user.email.toLocaleLowerCase("en-US") === PORTIA_OWNER_EMAIL;
  return { canEdit: isLocalPreview || isSiteOwner, user };
}

function isPortiaContent(value: unknown): value is PortiaContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PortiaContent>;
  return (
    Array.isArray(candidate.viruses) &&
    Array.isArray(candidate.infoSections) &&
    Array.isArray(candidate.broadcasts) &&
    Array.isArray(candidate.searchRecommendations)
  );
}

export async function GET(request: Request) {
  try {
    const db = database();
    const [{ canEdit }, row] = await Promise.all([
      ensureAdmin(request),
      db.prepare(
        "SELECT payload, revision, updated_at FROM portia_content WHERE id = ? LIMIT 1",
      )
        .bind("main")
        .first<ContentRow>(),
    ]);

    let content = defaultPortiaContent;
    if (row?.payload) {
      const parsed = JSON.parse(row.payload) as unknown;
      if (isPortiaContent(parsed)) content = parsed;
    }

    return Response.json({
      content,
      canEdit,
      revision: row?.revision ?? 0,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    console.error("PORTIA content read failed", error);
    return Response.json(
      { content: defaultPortiaContent, canEdit: false, revision: 0, updatedAt: null, degraded: true },
      { status: 200 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const db = database();
    const { canEdit, user } = await ensureAdmin(request);
    if (!canEdit) return Response.json({ error: "Редактирование доступно только владельцу." }, { status: 403 });

    const raw = await request.text();
    if (raw.length > 2_000_000) return Response.json({ error: "Данные слишком большие." }, { status: 413 });
    const body = JSON.parse(raw) as { content?: unknown };
    if (!isPortiaContent(body.content)) {
      return Response.json({ error: "Некорректная структура данных." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO portia_content (id, payload, revision, updated_at, updated_by)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         revision = portia_content.revision + 1,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
    )
      .bind("main", JSON.stringify(body.content), now, user.id)
      .run();

    const saved = await db.prepare(
      "SELECT revision, updated_at FROM portia_content WHERE id = ? LIMIT 1",
    )
      .bind("main")
      .first<{ revision: number; updated_at: string }>();

    return Response.json({ ok: true, revision: saved?.revision ?? 1, updatedAt: saved?.updated_at ?? now });
  } catch (error) {
    console.error("PORTIA content save failed", error);
    return Response.json({ error: "Не удалось сохранить изменения." }, { status: 500 });
  }
}
