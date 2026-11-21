// Pure checks of a POST /api/promotion/banks request (26.1-17, owner item 14: review items L1-L3). No I/O, so they run without a server.

/** The largest accepted request body, in UTF-8 bytes. Applies to every action, preview and confirm included. */
export const BANK_BODY_LIMIT = 64 * 1024;

const MANUAL_IDS_MAX = 100;
const ID_MAX_LENGTH = 64;

/** L1: true when the raw body text is over the limit. Checked before the JSON is parsed. Cyrillic counts as 2 bytes, like on the wire. */
export function bankBodyTooLarge(text: string): boolean {
  // A text of N UTF-16 units is at most 3N bytes, so the exact count is only needed near the limit.
  if (text.length * 3 <= BANK_BODY_LIMIT) return false;
  return new TextEncoder().encode(text).byteLength > BANK_BODY_LIMIT;
}

/** L1: `manualIds` of a preview. Absent stays `undefined`; an array of up to 100 strings of up to 64 characters passes; anything else is "invalid". */
export function parseManualIds(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MANUAL_IDS_MAX) return "invalid";
  return value.every((id) => typeof id === "string" && id.length <= ID_MAX_LENGTH) ? value as string[] : "invalid";
}
