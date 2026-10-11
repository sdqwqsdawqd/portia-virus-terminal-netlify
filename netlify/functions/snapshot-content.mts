import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

type ContentRow = { payload: unknown; revision: number; updated_at: string | null };

export default async function snapshotContent() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase
    .from("portia_content")
    .select("payload, revision, updated_at")
    .eq("id", "main")
    .maybeSingle<ContentRow>();
  if (error) throw error;
  if (!data?.payload) throw new Error("PORTIA content row is empty.");

  const store = getStore({ name: "portia-content-cache", consistency: "strong" });
  const cachedAt = new Date().toISOString();
  await store.setJSON("latest", {
    content: data.payload,
    revision: data.revision ?? 0,
    updatedAt: data.updated_at ?? null,
    cachedAt,
  }, { metadata: { revision: data.revision ?? 0, cachedAt } });
}

export const config: Config = {
  schedule: "@hourly",
};
