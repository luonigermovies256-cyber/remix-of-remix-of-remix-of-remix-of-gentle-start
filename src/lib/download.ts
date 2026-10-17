/**
 * Video delivery helpers.
 *
 * Two very different sources need very different handling:
 *  - S3 / OneAxcess originals block cross-origin reads, so those go through the
 *    download worker which re-serves them as a named attachment.
 *  - Everything else (R2 public buckets, our own storage) is streamed into a
 *    blob so the browser's own download manager takes over instead of the tab
 *    navigating to the video URL.
 */

export const DOWNLOAD_PROXY = "https://download.mainplatform-nexus.workers.dev/";

const hostOf = (url: string) => {
  try {
    return new URL(url, typeof window === "undefined" ? "https://x" : window.location.href).hostname;
  } catch {
    return "";
  }
};

/** Uploaded from OneAxcess / Amazon S3. */
export function isS3Source(url: string) {
  const h = hostOf(url).toLowerCase();
  return h.includes("oneaxcess") || h.endsWith("amazonaws.com");
}

/** Terabox streaming links are HLS behind a CORS-locked host. */
export function isTerabox(url: string) {
  return /terabox|1024tera/i.test(hostOf(url));
}

export function proxyUrl(url: string, opts?: { download?: boolean; filename?: string }) {
  const params = new URLSearchParams({ url });
  if (opts?.download) params.set("download", "1");
  if (opts?.filename) params.set("filename", opts.filename);
  return `${DOWNLOAD_PROXY}?${params.toString()}`;
}

/** Source the <video>/hls.js layer should actually load. */
export function playableUrl(url: string) {
  return isTerabox(url) ? proxyUrl(url) : url;
}

export function isHlsUrl(url: string) {
  return /\.m3u8(\?|$)/i.test(url) || /m3u8/i.test(url);
}

function clickDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Pull the file down as a blob so it lands in the browser download manager. */
async function blobDownload(url: string, filename: string, onProgress?: (pct: number) => void) {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get("Content-Length") ?? 0);
  let blob: Blob;
  if (res.body && total) {
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value as unknown as BlobPart);
        loaded += value.byteLength;
        onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
      }
    }
    blob = new Blob(chunks, { type: res.headers.get("Content-Type") ?? "video/mp4" });
  } else {
    blob = await res.blob();
  }
  const href = URL.createObjectURL(blob);
  clickDownload(href, filename);
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  onProgress?.(100);
}

/**
 * Download a video with the correct strategy for its origin. Never navigates
 * the browser to the raw video URL.
 */
export async function downloadVideo(
  url: string,
  title: string,
  onProgress?: (pct: number) => void,
) {
  const clean = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "video";
  const ext = (url.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
  const filename = /^[a-z0-9]{2,5}$/.test(ext) && ext !== "com" ? `${clean}.${ext}` : `${clean}.mp4`;

  if (isS3Source(url) || isTerabox(url)) {
    clickDownload(proxyUrl(url, { download: true, filename }), filename);
    return;
  }

  try {
    await blobDownload(url, filename, onProgress);
  } catch {
    // Origin refuses cross-origin reads — fall back to the worker so the user
    // still gets a real download instead of a new tab.
    clickDownload(proxyUrl(url, { download: true, filename }), filename);
  }
}
