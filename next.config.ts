import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Production analytics are first-party (/_vercel/insights); only the dev build
// loads its debug script from another origin, and React needs eval in dev.
const devScript = isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : "";
const devConnect = isDev ? " ws:" : "";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devScript}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  `connect-src 'self'${devConnect}`,
  "worker-src 'self' blob:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation only for "what is above me", asked on a button press.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), fullscreen=(self), camera=(), microphone=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
