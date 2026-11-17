import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { createPromotionApiDependencies, promotionStatus } from "@/lib/portia-promotion-api";
import { promotionParticipantResponse, resolvePromotionParticipant } from "@/lib/promotion-participant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const participant = await resolvePromotionParticipant(request.headers);
    if (participant.status !== "approved") return promotionParticipantResponse(participant);
    const secret = promotionDeviceSecret();
    const result = await promotionStatus(
      { nickname: participant.nickname, token: readDeviceToken(request.headers), headers: request.headers },
      createPromotionApiDependencies(participant.client, secret, participant.accessHash),
    );
    return Response.json(result.body, { status: result.status, headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA promotion status failed", error instanceof Error ? error.message : "unknown");
    return Response.json(
      { error: "Система повышения временно недоступна.", code: "promotion-unavailable" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
