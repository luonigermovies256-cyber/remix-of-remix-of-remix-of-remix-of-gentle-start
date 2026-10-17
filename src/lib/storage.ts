import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFbStorage } from "@/lib/firebase";
import { getFbAuth } from "@/lib/firebase";
import { loadAppSettings } from "@/lib/app-settings";
import { r2Enabled } from "@/lib/r2-config";
import { uploadToR2 } from "@/lib/r2-upload";
import type { UploadProgress } from "@/lib/storage-types";
import { beginUpload } from "@/lib/app-update-policy";

export const MEDIA_BUCKET = "media";

/** Firebase Storage hands back full download URLs, so paths pass straight through. */
export function fileUrl(path: string | null | undefined) {
  if (!path) return null;
  return path;
}

export type { UploadProgress };

export async function uploadFile(
  folder: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  if (!getFbAuth().currentUser) throw new Error("You must be signed in to upload.");
  const finishUpload = beginUpload();
  let release = () => {};

  try {
  // Pick up the admin-configured upload backend before deciding where to send.
  await loadAppSettings().catch(() => ({}));

  // Keep the device awake and warn before a reload so switching tabs or
  // dimming the screen cannot kill an in-flight upload.
  release = await keepAwake();
    // Cloudflare R2 (via the signer service) handles multi-GB files.
    if (r2Enabled()) return await uploadToR2(`${MEDIA_BUCKET}/${folder}`, file, onProgress);
    return await firebaseUpload(folder, file, onProgress);
  } finally {
    release();
    finishUpload();
  }
}

async function keepAwake(): Promise<() => void> {
  const guard = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", guard);
  let lock: { release: () => Promise<void> } | null = null;
  const nav = navigator as Navigator & {
    wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
  };
  const acquire = async () => {
    try {
      lock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      lock = null;
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void acquire();
  };
  await acquire();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("beforeunload", guard);
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => {});
  };
}

async function firebaseUpload(
  folder: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${MEDIA_BUCKET}/${folder}/${crypto.randomUUID()}.${ext}`;
  const task = uploadBytesResumable(ref(getFbStorage(), path), file, { contentType: file.type });


  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (s) =>
        onProgress?.({
          loaded: s.bytesTransferred,
          total: s.totalBytes,
          percent: s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0,
        }),
      (err) => reject(err),
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
      },
    );
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
