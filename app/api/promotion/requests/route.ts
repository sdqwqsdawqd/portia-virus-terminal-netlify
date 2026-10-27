import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { createPromotionApiDependencies, submitPromotionRequest } from "@/lib/portia-promotion-api";
import type { PromotionRequestKind } from "@/lib/portia-promotion";
import { parseJsonObject } from "@/lib/request-json";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = parseJsonObject(await request.text());
    if (!body) return Response.json({ error: "Некорректные данные.", code: "invalid-request" }, { status: 400, headers: noStoreHeaders });
    const nickname = typeof body.nickname === "string" ? body.nickname : "";
    const kind = typeof body.kind === "string" ? body.kind as PromotionRequestKind : "" as PromotionRequestKind;
    const secret = promotionDeviceSecret();
    const result = await submitPromotionRequest(
      { nickname, kind, token: readDeviceToken(request.headers), headers: request.headers },
      createPromotionApiDependencies(createPublicSupabaseClient(), secret),
    );
    const headers = new Headers(noStoreHeaders);
    if (result.setCookie) headers.set("Set-Cookie", result.setCookie);
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error("PORTIA promotion request failed", error instanceof Error ? error.message : "unknown");
    return Response.json(
      { error: "Система повышения временно недоступна.", code: "promotion-unavailable" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
