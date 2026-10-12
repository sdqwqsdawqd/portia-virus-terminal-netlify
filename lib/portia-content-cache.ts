import { getStore } from "@netlify/blobs";

export type PortiaContentSnapshot = {
  content: unknown;
  revision: number;
  updatedAt: string | null;
  cachedAt: string;
};

const storeName = "portia-content-cache";
const snapshotKey = "latest";

// getStore throws outside Netlify (local dev); the cache is then simply skipped.
export async function readPortiaContentSnapshot() {
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
