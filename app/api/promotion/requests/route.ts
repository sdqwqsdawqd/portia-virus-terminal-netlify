import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { createPromotionApiDependencies, submitPromotionRequest } from "@/lib/portia-promotion-api";
import type { PromotionRequestKind } from "@/lib/portia-promotion";
import { parseLimitedJsonObject } from "@/lib/request-json";
import { promotionParticipantResponse, resolvePromotionParticipant } from "@/lib/promotion-participant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const participant = await resolvePromotionParticipant(request.headers);
    if (participant.status !== "approved") return promotionParticipantResponse(participant);
    const body = await parseLimitedJsonObject(request, 1024);
    if (!body) return Response.json({ error: "Некорректные данные.", code: "invalid-request" }, { status: 400, headers: noStoreHeaders });
    const kind = typeof body.kind === "string" ? body.kind as PromotionRequestKind : "" as PromotionRequestKind;
    const secret = promotionDeviceSecret();
    const result = await submitPromotionRequest(
      { nickname: participant.nickname, kind, token: readDeviceToken(request.headers), headers: request.headers },
      createPromotionApiDependencies(participant.client, secret, participant.accessHash),
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
