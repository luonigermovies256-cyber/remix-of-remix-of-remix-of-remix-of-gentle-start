export const DEFAULT_UPLOAD_API = "https://r2upload.nexusplatformafrica.workers.dev";
// This service uses a public wildcard, not a private credential.
export const DEFAULT_UPLOAD_TOKEN = "*";

export function resolveUploadToken(url: string, saved?: string, environment = "") {
  if (resolveUploadBackend(url) === DEFAULT_UPLOAD_API) return DEFAULT_UPLOAD_TOKEN;
  return (saved || environment || DEFAULT_UPLOAD_TOKEN).trim();
}

const LEGACY_UPLOAD_APIS = new Set([
  "https://function-bun-production-e794.up.railway.app",
  "https://function-bun-production-9a7c.up.railway.app",
]);

export function resolveUploadBackend(saved?: string, environment = "") {
  const url = (saved ?? (environment || DEFAULT_UPLOAD_API)).trim().replace(/\/+$/, "");
  return LEGACY_UPLOAD_APIS.has(url) ? DEFAULT_UPLOAD_API : url;
}