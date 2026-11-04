/** The visible card must always belong to the queue selected by the filter. */
export function requestForActiveQueue<T extends { requestId: string }>(rows: readonly T[], selectedRequestId: string): T | null {
  return rows.find((row) => row.requestId === selectedRequestId) ?? rows[0] ?? null;
}
