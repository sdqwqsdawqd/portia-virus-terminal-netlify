import type { Config } from "@netlify/functions";
import { syncEmployeesSnapshot } from "../../lib/portia-employees";

export default async function syncEmployees() {
  const snapshot = await syncEmployeesSnapshot();
  return new Response(JSON.stringify({ ok: true, count: snapshot.employees.length, syncedAt: snapshot.syncedAt }), {
    headers: { "content-type": "application/json" },
  });
}

export const config: Config = {
  schedule: "@hourly",
};
