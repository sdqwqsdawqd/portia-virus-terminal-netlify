import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { accessIpBucket, accessSessionSecret, accessSubmitSecret, accessTokenDigest, buildAccessCookie, readAccessToken } from "@/lib/access-session";
import { resolveEditorRequest, submitAccessRequest } from "@/lib/access-store";
import { editorRequestToken } from "@/lib/access-identity";
import { getEditorAccess } from "@/lib/editor-access";
import { parseNicknameInput } from "@/lib/nickname";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { parseLimitedJsonObject } from "@/lib/request-json";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function editorClient() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (isAuthRetryableFetchError(error)) return { status: 503 as const };
  const access = await getEditorAccess(client, data.user);
  if (access.unavailable) return { status: 503 as const };
  if (!access.canEdit) return { status: 403 as const };
  return { client };
}

export async function GET(request: Request) {
  try {
    const verified = await editorClient();
    if (!verified.client) return Response.json({ error: "Доступ редактора не подтверждён." }, { status: verified.status, headers: noStoreHeaders });
    const token = readAccessToken(request.headers);
    const state = token ? await resolveEditorRequest(verified.client, accessTokenDigest(token, accessSessionSecret())) : { state: "none" };
    return Response.json(state, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA editor request status failed", error);
    return Response.json({ error: "Проверка заявки временно недоступна." }, { status: 503, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const verified = await editorClient();
    if (!verified.client) return Response.json({ error: "Доступ редактора не подтверждён." }, { status: verified.status, headers: noStoreHeaders });
    const body = await parseLimitedJsonObject(request, 1024);
    const parsed = parseNicknameInput(body?.nickname);
    if (!parsed) return Response.json({ code: "invalid", error: "Введите ник Roblox: 3–20 латинских букв, цифр или подчёркиваний." }, { status: 400, headers: noStoreHeaders });
    const secret = accessSessionSecret();
    const existing = readAccessToken(request.headers);
    const ownStatus = existing ? await resolveEditorRequest(verified.client, accessTokenDigest(existing, secret)) : { state: "none" } as const;
    const token = editorRequestToken(existing, ownStatus);
    const result = await submitAccessRequest(verified.client, {
      nickname: parsed.nickname, origin: "sheet", tokenHash: accessTokenDigest(token, secret),
      ipBucket: accessIpBucket(request.headers, secret), submitSecret: accessSubmitSecret(),
    });
    const headers = new Headers(noStoreHeaders);
    if (["created", "pending", "approved"].includes(result.code) && token !== existing) headers.set("Set-Cookie", buildAccessCookie(token));
    const status = ["created", "pending", "approved"].includes(result.code) ? 200
      : result.code === "invalid" ? 400 : result.code === "throttled" ? 429 : result.code === "cooldown" ? 409 : 503;
    return Response.json(result, { status, headers });
  } catch (error) {
    console.error("PORTIA editor request failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ code: "unavailable", error: "Не удалось отправить заявку. Повторите позже." }, { status: 503, headers: noStoreHeaders });
  }
}
