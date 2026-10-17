import { createFileRoute } from "@tanstack/react-router";

/**
 * Pesapal IPN endpoint. The app confirms every payment by polling
 * GetTransactionStatus, so this endpoint only acknowledges the alert.
 */
async function ack(request: Request) {
  let payload: Record<string, unknown> = {};
  try {
    if (request.method === "POST") payload = (await request.json()) as Record<string, unknown>;
    else {
      const u = new URL(request.url);
      payload = {
        OrderNotificationType: u.searchParams.get("OrderNotificationType"),
        OrderTrackingId: u.searchParams.get("OrderTrackingId"),
        OrderMerchantReference: u.searchParams.get("OrderMerchantReference"),
      };
    }
  } catch {
    /* ignore malformed body */
  }
  return Response.json({
    orderNotificationType: payload["OrderNotificationType"] ?? "IPNCHANGE",
    orderTrackingId: payload["OrderTrackingId"] ?? "",
    orderMerchantReference: payload["OrderMerchantReference"] ?? "",
    status: 200,
  });
}

export const Route = createFileRoute("/api/public/pesapal-ipn")({
  server: {
    handlers: {
      GET: ({ request }) => ack(request),
      POST: ({ request }) => ack(request),
    },
  },
});
