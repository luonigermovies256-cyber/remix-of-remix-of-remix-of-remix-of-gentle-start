import { createFileRoute } from "@tanstack/react-router";
import { resolveUploadBackend, resolveUploadToken } from "@/lib/upload-backend";

/**
 * Same-origin relay for the built-in upload service.
 *
 * The signing service answers every request but does not send CORS headers
 * on its JSON responses, so browsers cannot call it directly (fetch fails
 * with "Failed to fetch" even on HTTP 200). The app's server fetches it
 * instead. File bytes never pass through here — the browser still PUTs
 * them straight to R2 using the presigned URLs the service returns.
 */

const FORWARDED_ACTIONS = new Set(["single", "create", "sign", "complete", "abort", "delete"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/uploads/$")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request, params }) => {
        // Some hosts pass the splat differently (e.g. "uploads/single" or with
        // a trailing slash), so read the last path segment of the URL.
        const fromUrl = new URL(request.url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
        const fromSplat = (params._splat ?? "").replace(/\/+$/, "").split("/").pop() ?? "";
        const action = FORWARDED_ACTIONS.has(fromSplat) ? fromSplat : fromUrl;
        if (!FORWARDED_ACTIONS.has(action)) {
          return Response.json({ error: "not_found" }, { status: 404, headers: CORS_HEADERS });
        }
        // The built-in service uses a public wildcard token, not a private
        // credential, so relaying it adds no new capability for a caller.
        const base = resolveUploadBackend();
        const token = resolveUploadToken(base);
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          /* empty body is treated as {} */
        }
        try {
          const upstream = await fetch(`${base}/uploads/${action}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body ?? {}),
          });
          const text = await upstream.text();
          return new Response(text, {
            status: upstream.status,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        } catch {
          return Response.json(
            { error: "upload_service_unreachable" },
            { status: 502, headers: CORS_HEADERS },
          );
        }
      },
    },
  },
});
