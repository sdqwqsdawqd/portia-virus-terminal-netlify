const hasControlChar = (url: string) => [...url].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);

// Browsers read "/\host" as "//host", and URL parsers drop tab and newline, so "/<TAB>/host" is "//host" too: reject all of them, stricter is not worse.
export function isLocalMediaPath(url: string): boolean {
  return /^\/(?![/\\])/.test(url) && !hasControlChar(url);
}

// An image link a visitor's browser may load: https, or a file on this site.
// Stricter than the photo_url SQL rule: control characters are refused after https:// too (the browser drops them anyway, so the gap only refuses more).
export function isAllowedMediaUrl(url: string): boolean {
  return !hasControlChar(url) && (url.startsWith("https://") || isLocalMediaPath(url));
}
