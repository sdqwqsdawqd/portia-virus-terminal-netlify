import { uploadRefusal } from "./image-upload.ts";

// Phase 25, D-13 / D-14: the editor's two calls to /api/uploads for "change the address of a picture". They live here and not
// in components/portia-editor.tsx so the module is tested with a replaced fetch and the editor file keeps its pinned set of requests.
const JSON_HEADERS = { "content-type": "application/json" };

export type RewriteResult = { url: string } | { error: string };

export async function rewriteImageUrl(url: string): Promise<RewriteResult> {
  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ action: "rewrite", url }) });
  } catch {
    return { error: uploadRefusal.network };
  }
  const payload = (await response.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
  if (response.ok && typeof payload.url === "string" && payload.url) return { url: payload.url };
  return { error: typeof payload.error === "string" ? payload.error : uploadRefusal.server };
}

export type RetireResult = "removed" | "in-use" | "failed";

// D-13: called only after the record that dropped the address was saved. 409 means the server still sees a reference.
export async function retireImageUrl(url: string): Promise<RetireResult> {
  try {
    const response = await fetch("/api/uploads", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ url }) });
    if (response.status === 409) return "in-use";
    return response.ok ? "removed" : "failed";
  } catch {
    return "failed";
  }
}
