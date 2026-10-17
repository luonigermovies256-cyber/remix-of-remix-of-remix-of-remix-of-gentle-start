import { isBuiltInUploadApi, UPLOAD_PROXY_PREFIX } from "@/lib/upload-backend";
import { r2Config } from "@/lib/r2-config";

import type { UploadProgress } from "@/lib/storage-types";

const PART_SIZE = 16 * 1024 * 1024; // 16MB parts: smaller retries, more parallelism
const CONCURRENCY = 6;
const SINGLE_LIMIT = 16 * 1024 * 1024; // above this we go multipart so parts can retry
const MAX_ATTEMPTS = 8;

/** Wait until the tab is online again (background tabs often drop the socket). */
async function waitForNetwork() {
  if (typeof navigator === "undefined" || navigator.onLine) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      resolve();
    };
    window.addEventListener("online", done);
    window.setTimeout(done, 15000);
  });
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const { url: base, token } = r2Config();
  // The built-in service answers every request but omits CORS headers, so its
  // control calls are relayed through this app's own server proxy. Custom
  // endpoints are still called directly.
  const viaProxy = isBuiltInUploadApi(base) && typeof window !== "undefined";
  const target = viaProxy
    ? `${window.location.origin}${UPLOAD_PROXY_PREFIX}${path}`
    : `${base}${path}`;
  let res: Response;
  try {
    res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(viaProxy || !token ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Cannot connect to the upload service. Check your connection" +
        (viaProxy
          ? "."
          : "; a custom upload endpoint must allow this website with Access-Control-Allow-Origin on every response, not only OPTIONS."),
    );
  }

  if (!res.ok) throw new Error(`Upload service error (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

/** PUT one blob with progress + ETag capture. */
function putBlob(
  url: string,
  blob: Blob,
  contentType: string | undefined,
  onBytes: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onBytes(blob.size);
        resolve((xhr.getResponseHeader("ETag") ?? "").replace(/"/g, ""));
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(blob);
  });
}

/** Uploads a file straight to R2 and returns its public URL. */
export async function uploadToR2(
  folder: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const report = (loaded: number) =>
    onProgress?.({
      loaded,
      total: file.size,
      percent: Math.min(100, Math.round((loaded / Math.max(file.size, 1)) * 100)),
    });

  report(0);

  if (file.size <= SINGLE_LIMIT) {
    const { url, publicUrl } = await api<{ url: string; publicUrl: string }>("/uploads/single", {
      folder,
      filename: file.name,
      contentType: file.type,
    });
    await putBlob(url, file, file.type, report);
    return publicUrl;
  }

  const { key, uploadId, publicUrl } = await api<{
    key: string;
    uploadId: string;
    publicUrl: string;
  }>("/uploads/create", { folder, filename: file.name, contentType: file.type });

  const total = Math.ceil(file.size / PART_SIZE);
  const partNumbers = Array.from({ length: total }, (_, i) => i + 1);

  try {
    const { urls } = await api<{ urls: { partNumber: number; url: string }[] }>("/uploads/sign", {
      key,
      uploadId,
      partNumbers,
    });
    const urlByPart = new Map(urls.map((u) => [u.partNumber, u.url]));

    const done = new Array<number>(total).fill(0);
    const etags: { partNumber: number; etag: string }[] = [];
    let next = 0;

    const worker = async () => {
      for (;;) {
        const idx = next++;
        if (idx >= total) return;
        const partNumber = idx + 1;
        const blob = file.slice(idx * PART_SIZE, Math.min((idx + 1) * PART_SIZE, file.size));
        const url = urlByPart.get(partNumber);
        if (!url) throw new Error(`Missing signed URL for part ${partNumber}`);

        let etag = "";
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            etag = await putBlob(url, blob, undefined, (loaded) => {
              done[idx] = loaded;
              report(done.reduce((a, b) => a + b, 0));
            });
            break;
          } catch (err) {
            // Backgrounded tabs and flaky mobile networks kill single parts —
            // wait for the connection and retry the same part instead of
            // failing the whole upload.
            done[idx] = 0;
            if (attempt === MAX_ATTEMPTS - 1) throw err;
            await waitForNetwork();
            await new Promise((r) => setTimeout(r, Math.min(10000, 1000 * (attempt + 1))));
          }
        }
        if (!etag) throw new Error(`Part ${partNumber} did not return an ETag (check R2 CORS ExposeHeaders)`);
        etags.push({ partNumber, etag });
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

    await api("/uploads/complete", { key, uploadId, parts: etags });
    report(file.size);
    return publicUrl;
  } catch (err) {
    void api("/uploads/abort", { key, uploadId }).catch(() => {});
    throw err;
  }
}
