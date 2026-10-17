/**
 * ============================================================================
 *  R2 UPLOAD SERVER  —  single file, ZERO npm dependencies, plain Node.js 18+
 * ============================================================================
 *
 *  Copy this ONE file, paste it as `server.js` on any Node host
 *  (Railway / Render / Fly / Koyeb / VPS), set the env vars below, deploy,
 *  then send me the public URL.
 *
 *  Start command:  node server.js
 *  (No `npm install` needed — it uses only Node built-ins.)
 *
 *  It only SIGNS urls; the browser sends the file bytes straight to R2,
 *  so the host's bandwidth/transfer limits never apply. 5 GB+ works.
 *
 *  ---------------------------------------------------------------------------
 *  ENVIRONMENT VARIABLES TO CONFIGURE
 *  ---------------------------------------------------------------------------
 *   R2_ACCOUNT_ID          Cloudflare account ID (R2 dashboard, right sidebar)
 *   R2_ACCESS_KEY_ID       R2 > Manage API Tokens > Object Read & Write
 *   R2_SECRET_ACCESS_KEY   secret shown with that token
 *   R2_BUCKET              your bucket name, e.g. luo-film
 *   R2_PUBLIC_BASE_URL     public bucket / custom domain, no trailing slash
 *                          e.g. https://cdn.yoursite.com
 *   UPLOAD_TOKEN           any long random string you invent (app must match)
 *   ALLOWED_ORIGINS        https://yoursite.vercel.app,http://localhost:8080
 *                          (or * while testing)
 *   PORT                   leave unset, the host sets it
 *
 *  ---------------------------------------------------------------------------
 *  CLOUDFLARE R2 BUCKET CORS  (bucket > Settings > CORS policy) — REQUIRED
 *  ---------------------------------------------------------------------------
 *  [{ "AllowedOrigins": ["https://yoursite.vercel.app","http://localhost:8080"],
 *     "AllowedMethods": ["PUT","POST","GET","HEAD"],
 *     "AllowedHeaders": ["*"],
 *     "ExposeHeaders":  ["ETag"],
 *     "MaxAgeSeconds":  86400 }]
 *
 *  ExposeHeaders ETag is mandatory or multi-part uploads cannot finish.
 * ============================================================================
 */

const http = require("node:http");
const crypto = require("node:crypto");

const ACCOUNT = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "";
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.UPLOAD_TOKEN || "";
const ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
const PORT = process.env.PORT || 8080;

const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`;
const REGION = "auto";
const SERVICE = "s3";
const EXPIRES = 6 * 60 * 60; // 6h signatures — enough for a slow 5GB upload

for (const [k, v] of Object.entries({
  R2_ACCOUNT_ID: ACCOUNT,
  R2_ACCESS_KEY_ID: ACCESS_KEY,
  R2_SECRET_ACCESS_KEY: SECRET_KEY,
  R2_BUCKET: BUCKET,
  R2_PUBLIC_BASE_URL: PUBLIC_BASE,
  UPLOAD_TOKEN: TOKEN,
})) {
  if (!v) console.warn(`[warn] missing environment variable: ${k}`);
}

/* ------------------------------ AWS SigV4 -------------------------------- */

const sha256 = (d) => crypto.createHash("sha256").update(d).digest("hex");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

// S3 keeps "/" unescaped in paths but escapes everything else RFC3986-style.
function uriEncode(str, keepSlash) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, keepSlash ? "/" : "%2F");
}

/** Presigned (query-string) SigV4 URL — body is never signed (UNSIGNED-PAYLOAD). */
function presign(method, key, query = {}, expires = EXPIRES) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalUri = "/" + uriEncode(`${BUCKET}/${key}`, true);

  const params = {
    ...query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${ACCESS_KEY}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k, false)}=${uriEncode(String(params[k]), false)}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${HOST}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const signature = hmac(hmac(kService, "aws4_request"), stringToSign).toString("hex");

  return `https://${HOST}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Call R2 ourselves using a presigned URL (create / complete / abort). */
async function r2(method, key, query, body, contentType) {
  const res = await fetch(presign(method, key, query, 600), {
    method,
    ...(body ? { body, headers: { "Content-Type": contentType || "application/xml" } } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`R2 ${method} failed (${res.status}): ${text}`);
  return text;
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : null;
};
const escapeXml = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

/* ------------------------------- helpers --------------------------------- */

const safeName = (n) => String(n || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
const makeKey = (folder, filename) =>
  `${String(folder || "misc").replace(/^\/+|\/+$/g, "")}/${crypto.randomUUID()}-${safeName(filename)}`;
const publicUrl = (key) => `${PUBLIC_BASE}/${key}`;

function cors(req, res) {
  const origin = req.headers.origin || "";
  const allow = ORIGINS.includes("*") ? "*" : ORIGINS.includes(origin) ? origin : ORIGINS[0] || "";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const send = (res, status, obj) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 5_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/* -------------------------------- routes --------------------------------- */

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  const path = (req.url || "").split("?")[0].replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/health") return send(res, 200, { ok: true, service: "r2-upload" });

  if ((req.headers.authorization || "") !== `Bearer ${TOKEN}`) {
    return send(res, 401, { error: "unauthorized" });
  }
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });

  try {
    const body = await readJson(req);

    // Small file: one presigned PUT.
    if (path === "/uploads/single") {
      const key = makeKey(body.folder, body.filename);
      return send(res, 200, { key, url: presign("PUT", key), publicUrl: publicUrl(key) });
    }

    // Big file: start a multipart upload.
    if (path === "/uploads/create") {
      const key = makeKey(body.folder, body.filename);
      const xml = await r2("POST", key, { uploads: "" });
      const uploadId = tag(xml, "UploadId");
      if (!uploadId) throw new Error("R2 did not return an UploadId");
      return send(res, 200, { key, uploadId, publicUrl: publicUrl(key) });
    }

    // Sign a batch of part numbers.
    if (path === "/uploads/sign") {
      const { key, uploadId, partNumbers } = body;
      if (!key || !uploadId || !Array.isArray(partNumbers)) return send(res, 400, { error: "bad_request" });
      return send(res, 200, {
        urls: partNumbers.map((n) => ({
          partNumber: n,
          url: presign("PUT", key, { partNumber: String(n), uploadId }),
        })),
      });
    }

    // Stitch the parts together.
    if (path === "/uploads/complete") {
      const { key, uploadId, parts } = body;
      if (!key || !uploadId || !Array.isArray(parts)) return send(res, 400, { error: "bad_request" });
      const xml =
        "<CompleteMultipartUpload>" +
        parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(
            (p) =>
              `<Part><PartNumber>${Number(p.partNumber)}</PartNumber><ETag>"${escapeXml(
                String(p.etag).replace(/"/g, ""),
              )}"</ETag></Part>`,
          )
          .join("") +
        "</CompleteMultipartUpload>";
      const out = await r2("POST", key, { uploadId }, xml);
      if (/<Error>/.test(out)) throw new Error(out);
      return send(res, 200, { key, publicUrl: publicUrl(key) });
    }

    // Cancel a failed upload so R2 doesn't keep orphan parts.
    if (path === "/uploads/abort") {
      const { key, uploadId } = body;
      await r2("DELETE", key, { uploadId });
      return send(res, 200, { ok: true });
    }

    // Delete an object.
    if (path === "/uploads/delete") {
      if (!body.key) return send(res, 400, { error: "bad_request" });
      await r2("DELETE", body.key, {});
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err && err.message ? err.message : "server_error" });
  }
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.listen(PORT, () => console.log(`R2 upload server listening on :${PORT}`));
