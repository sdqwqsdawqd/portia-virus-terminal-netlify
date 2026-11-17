/** An empty, broken or non-object body must become a 400, not a thrown 500: returns the plain object or null. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Read a small JSON request without buffering an unbounded body. */
export async function parseLimitedJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  if (!request.body || !Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parseJsonObject(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
