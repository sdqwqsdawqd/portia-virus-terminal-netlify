import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";

export const dynamic = "force-dynamic";

const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, authData.user);
    if (!authData.user || !access.canEdit) {
      return Response.json({ error: "У вас нет доступа к загрузке." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Файл не выбран." }, { status: 400 });
    }

    const extension = allowedTypes.get(file.type);
    if (!extension) {
      return Response.json({ error: "Поддерживаются PNG, JPG, WEBP и GIF." }, { status: 415 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return Response.json({ error: "Файл должен быть меньше 4 МБ." }, { status: 413 });
    }

    const path = `recycle/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("portia-media").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("portia-media").getPublicUrl(path);
    return Response.json({ url: data.publicUrl });
  } catch (error) {
    console.error("PORTIA media upload failed", error);
    return Response.json({ error: "Не удалось загрузить изображение." }, { status: 500 });
  }
}
