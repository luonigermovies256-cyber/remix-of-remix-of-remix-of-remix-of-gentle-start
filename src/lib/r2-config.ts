/**
 * Cloudflare R2 direct-upload configuration.
 *
 * The backend URL and token are editable from Admin → Settings → Upload
 * backend (stored in app_settings.upload). Env vars act as the fallback,
 * then the built-in default. While the URL is empty the admin uploader
 * falls back to Firebase Storage.
 */
import { getSetting, type UploadSettings } from "@/lib/app-settings";
import { resolveUploadBackend, resolveUploadToken } from "@/lib/upload-backend";

const ENV_API = (import.meta.env["VITE_R2_UPLOAD_API"] as string | undefined) ?? "";
const ENV_TOKEN = (import.meta.env["VITE_R2_UPLOAD_TOKEN"] as string | undefined) ?? "";

export function r2Config() {
  const s = getSetting<UploadSettings>("upload") ?? {};
  // Once an admin has saved the setting, it wins — including an empty value,
  // which intentionally disables R2 and falls back to built-in storage.
  const saved = typeof s.backend_url === "string" ? s.backend_url : undefined;
  const url = resolveUploadBackend(saved, ENV_API);
  const token = resolveUploadToken(url, s.token, ENV_TOKEN);
  return { url, token };
}

export const r2Enabled = () => r2Config().url.length > 0;
