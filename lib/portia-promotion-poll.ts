export type StatusPollOutcome = "keep-stale" | "ignore" | "reset";

export function statusPollOutcome(_input: { httpStatus: number; hasStatus: boolean; explicit: boolean; restore: boolean }): StatusPollOutcome {
  return "reset";
}
