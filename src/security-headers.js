// Security headers for every response: pages the worker renders (worker.js wraps its router with
// withSecurityHeaders) and the static files Cloudflare serves (build.mjs writes them into public/_headers).
// One list, so the two can never drift apart.

// Scripts come from this site, Google AdSense, Cloudflare Turnstile and Microsoft Clarity.
// Frames stay open to https: because reviews embed YouTube, Spotify, Apple Music and SoundCloud
// players, and AdSense and Turnstile render inside frames.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "script-src 'self' 'unsafe-inline' https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.googleadservices.com https://*.googletagservices.com https://*.adtrafficquality.google https://challenges.cloudflare.com https://www.clarity.ms https://*.clarity.ms",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Only wackometer.com may read responses from another tab or site (replaces the host's "*").
  // Badges and images embedded elsewhere load as <img>, which this does not affect.
  "Access-Control-Allow-Origin": "https://wackometer.com",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

/** A copy of the response with the security headers added; headers the route set itself win. */
export function withSecurityHeaders(res) {
  if (!res || res.status === 101 || res.webSocket) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** The same headers as a Cloudflare _headers block for every static file. */
export function headersFileBlock() {
  return `/*\n${Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n`;
}
