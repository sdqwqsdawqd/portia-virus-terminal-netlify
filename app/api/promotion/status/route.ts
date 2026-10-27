import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { createPromotionApiDependencies, promotionStatus } from "@/lib/portia-promotion-api";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const nickname = new URL(request.url).searchParams.get("nickname") ?? "";
    const secret = promotionDeviceSecret();
    const result = await promotionStatus(
      { nickname, token: readDeviceToken(request.headers) },
      createPromotionApiDependencies(createPublicSupabaseClient(), secret),
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
