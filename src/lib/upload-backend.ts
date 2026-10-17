export const DEFAULT_UPLOAD_API = "https://r2upload.nexusplatformafrica.workers.dev";
// This service uses a public wildcard, not a private credential.
export const DEFAULT_UPLOAD_TOKEN = "*";

export function resolveUploadToken(url: string, saved?: string, environment = "") {
  if (resolveUploadBackend(url) === DEFAULT_UPLOAD_API) return DEFAULT_UPLOAD_TOKEN;
  return (saved || environment || DEFAULT_UPLOAD_TOKEN).trim();
}

/** Same-origin server relay for control calls to the built-in service. */
export const UPLOAD_PROXY_PREFIX = "/api/public/uploads";

/**
 * True when the URL is the built-in service. The service omits CORS headers
 * on its responses, so browsers reach it through the app's own server relay
 * (/api/public/uploads/*) instead of calling it directly.
 */
export function isBuiltInUploadApi(url: string) {
  return url.trim().replace(/\/+$/, "") === DEFAULT_UPLOAD_API;
}



const LEGACY_UPLOAD_APIS = new Set([
  "https://function-bun-production-e794.up.railway.app",
  "https://function-bun-production-9a7c.up.railway.app",
]);

export function resolveUploadBackend(saved?: string, environment = "") {
  const url = (saved ?? (environment || DEFAULT_UPLOAD_API)).trim().replace(/\/+$/, "");
  return LEGACY_UPLOAD_APIS.has(url) ? DEFAULT_UPLOAD_API : url;
}