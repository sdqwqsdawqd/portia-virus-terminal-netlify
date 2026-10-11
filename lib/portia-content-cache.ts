import { getStore } from "@netlify/blobs";

export type PortiaContentSnapshot = {
  content: unknown;
  revision: number;
  updatedAt: string | null;
  cachedAt: string;
};

const storeName = "portia-content-cache";
const snapshotKey = "latest";

function hasNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_SITE_ID);
}

export async function readPortiaContentSnapshot() {
  if (!hasNetlifyRuntime()) return null;
  try {
    const store = getStore({ name: storeName, consistency: "strong" });
    const snapshot = await store.get(snapshotKey, { type: "json", consistency: "strong" }) as PortiaContentSnapshot | null;
    if (!snapshot || typeof snapshot !== "object" || !("content" in snapshot)) return null;
    return snapshot;
  } catch (error) {
    console.error("PORTIA snapshot read failed", error);
    return null;
  }
}

export async function writePortiaContentSnapshot(snapshot: PortiaContentSnapshot) {
  if (!hasNetlifyRuntime()) return false;
  try {
    const store = getStore({ name: storeName, consistency: "strong" });
    await store.setJSON(snapshotKey, snapshot, {
      metadata: { revision: snapshot.revision, cachedAt: snapshot.cachedAt },
    });
    return true;
  } catch (error) {
    console.error("PORTIA snapshot write failed", error);
    return false;
  }
}
