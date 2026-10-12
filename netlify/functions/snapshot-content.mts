import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { writePortiaContentSnapshot } from "../../lib/portia-content-cache";
import { getSupabaseConfig } from "../../lib/supabase/env";

type ContentRow = { payload: unknown; revision: number; updated_at: string | null };

export default async function snapshotContent() {
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase
    .from("portia_content")
    .select("payload, revision, updated_at")
    .eq("id", "main")
    .maybeSingle<ContentRow>();
  if (error) throw error;
  if (!data?.payload) throw new Error("PORTIA content row is empty.");

  const written = await writePortiaContentSnapshot({
    content: data.payload,
    revision: data.revision ?? 0,
    updatedAt: data.updated_at ?? null,
    cachedAt: new Date().toISOString(),
  });
  if (!written) throw new Error("PORTIA content snapshot was not written.");
}

export const config: Config = {
  schedule: "@hourly",
};
