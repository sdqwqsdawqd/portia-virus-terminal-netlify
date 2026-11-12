import { ACCESS_ORIGINS, type AccessOrigin } from "@/lib/access-levels";
import { accessIpBucket, accessSessionSecret, accessSubmitSecret, accessTokenDigest, buildAccessCookie, createAccessToken, readAccessToken } from "@/lib/access-session";
import { submitAccessRequest } from "@/lib/access-store";
import { parseNicknameInput } from "@/lib/nickname";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { parseJsonObject } from "@/lib/request-json";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = parseJsonObject(await request.text());
    const parsedNickname = parseNicknameInput(body?.nickname);
    const origin = body?.origin;
    if (!parsedNickname || typeof origin !== "string" || !(ACCESS_ORIGINS as readonly string[]).includes(origin)) {
      return Response.json({ code: "invalid", error: "Укажите ник Roblox и кем вы являетесь." }, { status: 400, headers: noStoreHeaders });
    }
    const secret = accessSessionSecret();
    const existingToken = readAccessToken(request.headers);
    const token = existingToken ?? createAccessToken();
    const result = await submitAccessRequest(createPublicSupabaseClient(), {
      nickname: parsedNickname.nickname,
      origin: origin as AccessOrigin,
      tokenHash: accessTokenDigest(token, secret),
      ipBucket: accessIpBucket(request.headers, secret),
      submitSecret: accessSubmitSecret(),
    });
    const headers = new Headers(noStoreHeaders);
    if (["created", "pending", "approved"].includes(result.code) && !existingToken) headers.set("Set-Cookie", buildAccessCookie(token));
    const status = result.code === "created" || result.code === "pending" || result.code === "approved" ? 200
      : result.code === "invalid" ? 400 : result.code === "throttled" ? 429 : result.code === "cooldown" ? 409 : 503;
    return Response.json(result, { status, headers });
  } catch (error) {
    console.error("PORTIA access request failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ code: "unavailable", error: "Не удалось отправить заявку. Проверьте соединение и повторите." }, { status: 503, headers: noStoreHeaders });
  }
}
