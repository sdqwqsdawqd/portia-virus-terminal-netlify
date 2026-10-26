// Browsers read "/\host" as "//host", and URL parsers drop tab and newline, so "/<TAB>/host" is "//host" too: reject all of them, stricter is not worse.
export function isLocalMediaPath(url: string): boolean {
  return /^\/(?![/\\])/.test(url) && ![...url].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
}

// An image link a visitor's browser may load: https, or a file on this site.
export function isAllowedMediaUrl(url: string): boolean {
  return url.startsWith("https://") || isLocalMediaPath(url);
}
