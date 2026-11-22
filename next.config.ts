import type { NextConfig } from "next";

const development = process.env.NODE_ENV !== "production";
// The local Playwright server (itself a production build) runs over plain HTTP; any Netlify build
// (NETLIFY=true or any deploy CONTEXT, CLI included) keeps the upgrade, so NODE_ENV cannot be the guard.
const allowHttpForE2E = process.env.PORTIA_E2E_ALLOW_HTTP === "1" && process.env.NETLIFY !== "true" && !process.env.CONTEXT;
const upgradeInsecureRequests = !development && !allowHttpForE2E;
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${development ? " ws:" : ""}`,
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "frame-src https://docs.google.com https://sdqwqsdawqd.github.io https://www.youtube.com https://www.youtube-nocookie.com",
  ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
].join("; ");

// 20-08 (D-05): stricter candidate, delivered ONLY as Content-Security-Policy-Report-Only next to the enforced policy above.
// It narrows what no approved scenario needs (browser-side https:/wss: connections, data: fonts, data:/blob: media) and keeps
// img-src https: (D-06) and the approved frame hosts. upgrade-insecure-requests is not allowed in a report-only policy, so it
// stays in the enforced one. Tightening the enforced policy needs the PC/phone acceptance of D-05; see 20-MEDIA-CSP.md.
const contentSecurityPolicyCandidate = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  `connect-src 'self'${development ? " ws:" : ""}`,
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src https://docs.google.com https://sdqwqsdawqd.github.io https://www.youtube.com https://www.youtube-nocookie.com",
].join("; ");

const nextConfig: NextConfig = {
  agentRules: false,
  // A package lock exists above the repository on this workstation; pinning the root keeps
  // Turbopack from treating the user profile as part of this application.
  turbopack: { root: process.cwd() },
  // Owner 2026-11-22: the privacy policy and the terms are plain static files (no app, no script), linked from nowhere in the desktop,
  // public for the Google Cloud app verification. Clean addresses point at them.
  async rewrites() {
    return [
      { source: "/privacy", destination: "/privacy.html" },
      { source: "/terms", destination: "/terms.html" },
    ];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyCandidate },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    }];
  },
};

export default nextConfig;
