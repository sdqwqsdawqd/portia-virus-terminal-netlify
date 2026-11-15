import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { imageExtensionFromSignature, MAX_UPLOAD_BYTES, uploadGate, uploadRefusal } from "@/lib/image-upload";
import { mediaRewriteRefusal, PORTIA_MEDIA_BUCKET, parsePortiaMediaUrl } from "@/lib/media-rewrite";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { parseLimitedJsonObject } from "@/lib/request-json";

export const dynamic = "force-dynamic";

const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

// A rewrite or delete body is one address: a few hundred bytes. The bound keeps a hostile body from being buffered whole.
const JSON_BODY_LIMIT_BYTES = 4096;

type SessionClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// One gate for upload, rewrite and delete: the editor session, then the declared size. It runs before any body is read.
async function editorGate(request: Request): Promise<{ supabase: SessionClient; refusal: Response | null }> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  // A network or 5xx auth failure is not "logged out": it answers 503 so the editor can retry (WR-03).
  const authRetryable = isAuthRetryableFetchError(authError);
  const access = authRetryable ? null : await getEditorAccess(supabase, authData.user);
  // Permission and the declared size are decided before the body is parsed.
  const refusal = uploadGate({ authRetryable, user: authData.user, access, contentLength: request.headers.get("content-length") });
  return { supabase, refusal: refusal ? Response.json({ error: refusal.error }, { status: refusal.status, headers: noStoreHeaders }) : null };
}

// D-14: copies the same file under a new random name. The address is checked against the site bucket first (T-25-06).
async function rewriteImage(supabase: SessionClient, request: Request): Promise<Response> {
  const body = await parseLimitedJsonObject(request, JSON_BODY_LIMIT_BYTES);
  const parsed = body?.action === "rewrite" && typeof body.url === "string"
    ? parsePortiaMediaUrl(body.url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    : null;
  if (!parsed) return Response.json({ error: mediaRewriteRefusal.url }, { status: 400, headers: noStoreHeaders });
  const path = `recycle/${crypto.randomUUID()}.${parsed.ext}`;
  // The copy keeps the metadata of the source, so the year-long cache of the upload carries over (D-12, assumed: proved on staging).
  const { error } = await supabase.storage.from(PORTIA_MEDIA_BUCKET).copy(parsed.path, path);
  if (error) throw error;
  const { data } = supabase.storage.from(PORTIA_MEDIA_BUCKET).getPublicUrl(path);
  return Response.json({ url: data.publicUrl }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  try {
    const { supabase, refusal } = await editorGate(request);
    if (refusal) return refusal;

    if ((request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      return await rewriteImage(supabase, request);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: uploadRefusal.missing }, { status: 400, headers: noStoreHeaders });
    }

    const declaredExtension = allowedTypes.get(file.type);
    if (!declaredExtension) {
      return Response.json({ error: uploadRefusal.format }, { status: 415, headers: noStoreHeaders });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: uploadRefusal.size }, { status: 413, headers: noStoreHeaders });
    }

    const detectedExtension = imageExtensionFromSignature(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!detectedExtension || detectedExtension !== declaredExtension) {
      return Response.json({ error: uploadRefusal.signature }, { status: 415, headers: noStoreHeaders });
    }

    const path = `recycle/${crypto.randomUUID()}.${detectedExtension}`;
    const { error } = await supabase.storage.from("portia-media").upload(path, file, {
      // UUID paths are immutable. A year-long edge/browser cache makes repeat opens instant.
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("portia-media").getPublicUrl(path);
    return Response.json({ url: data.publicUrl }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA media upload failed", error);
    return Response.json({ error: uploadRefusal.server }, { status: 500, headers: noStoreHeaders });
  }
}

// D-13: removing a file cannot be undone, so it happens only after the record that dropped the address was saved, and only
// when no saved record shows it. The server checks this itself, whatever order the browser acts in: the stored content and
// the employee photos are read first; an unknown state (a failed read) removes nothing.
export async function DELETE(request: Request) {
  try {
    const { supabase, refusal } = await editorGate(request);
    if (refusal) return refusal;

    const body = await parseLimitedJsonObject(request, JSON_BODY_LIMIT_BYTES);
    const parsed = typeof body?.url === "string" ? parsePortiaMediaUrl(body.url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") : null;
    if (!parsed) return Response.json({ error: mediaRewriteRefusal.url }, { status: 400, headers: noStoreHeaders });

    const { data: stored, error: contentError } = await supabase.from("portia_content").select("payload")
      .eq("id", "main").maybeSingle<{ payload: unknown }>();
    // The path has only [0-9a-f-/.] characters (parsePortiaMediaUrl), so it holds no LIKE wildcard.
    const { data: photos, error: photoError } = await supabase.from("portia_employee_profiles").select("employee_id")
      .like("photo_url", `%${parsed.path}`).limit(1);
    if (contentError || photoError) {
      return Response.json({ error: uploadRefusal.server }, { status: 503, headers: noStoreHeaders });
    }
    if (JSON.stringify(stored?.payload ?? null).includes(parsed.path) || (photos?.length ?? 0) > 0) {
      return Response.json({ error: mediaRewriteRefusal.inUse, code: "media-in-use" }, { status: 409, headers: noStoreHeaders });
    }

    const { error } = await supabase.storage.from(PORTIA_MEDIA_BUCKET).remove([parsed.path]);
    if (error) throw error;
    return Response.json({ removed: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA media delete failed", error);
    return Response.json({ error: uploadRefusal.server }, { status: 500, headers: noStoreHeaders });
  }
}
