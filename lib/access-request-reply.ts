// Reply helpers of POST /api/access/request. The route imports through "@/lib/..." aliases that node --test cannot resolve,
// so the testable part lives here with a type-only import.
import type { SubmitResult } from "./access-store.ts";

// G-PORTIA-23-3-log: the database answers `unauthorized` when it refuses the submit signature: no secret stored in the
// database, a different value than PORTIA_ACCESS_SUBMIT_SECRET, a malformed signature or server clock skew. The foundation
// migration header requires every such reply to be an alert. The line is a constant: reportAccessSubmit only receives the
// reply code, so a nickname, token hash, IP bucket, signature or secret can never reach it. A missing or short secret in the
// environment is already logged by the route's catch (accessSubmitSecret names only the variable).
export const ACCESS_SUBMIT_UNAUTHORIZED_ALERT =
  "PORTIA access request unauthorized: the database refused the submit signature (missing or different submit secret, or server clock skew); check that PORTIA_ACCESS_SUBMIT_SECRET equals the stored submit secret";

// The status map of the route, unchanged: the client reply stays the same for every code.
export function accessSubmitStatus(code: SubmitResult["code"]): number {
  return code === "created" || code === "pending" || code === "approved" ? 200
    : code === "invalid" ? 400 : code === "throttled" ? 429 : code === "cooldown" ? 409 : 503;
}

// Called for every reply, not once per process: each unauthorized reply is one alert line.
export function reportAccessSubmit(result: SubmitResult, alert: (message: string) => void = (message) => console.error(message)): void {
  if (result.code === "unauthorized") alert(ACCESS_SUBMIT_UNAUTHORIZED_ALERT);
}
