export type StatusPollOutcome = "keep-stale" | "ignore" | "reset";

/** Background refusals keep the runner mounted: unmounting releases its lock and stops heartbeat without a report (WR-04). */
export function statusPollOutcome(input: { httpStatus: number; hasStatus: boolean; explicit: boolean; restore: boolean }): StatusPollOutcome {
  if (input.hasStatus && input.httpStatus === 503) return "keep-stale";
  if (input.explicit) return "reset";
  if (input.restore && !input.hasStatus) return "ignore";
  if (input.httpStatus === 404 || input.httpStatus === 423) return "reset";
  if (input.hasStatus) return "keep-stale";
  return "reset";
}
