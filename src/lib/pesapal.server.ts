/**
 * Pesapal API 3.0 server client. Credentials are configured in code as
 * requested by the merchant and never leave the server.
 */
const PESAPAL_BASE = "https://pay.pesapal.com/v3";
const CONSUMER_KEY = "gWsmOPreiW8E+A+LjjXRNBqIWlMsMFC0";
const CONSUMER_SECRET = "GA/3/5ZiQbnwjMn7muX+YeNOffw=";

type Json = Record<string, unknown>;

let tokenCache: { token: string; expires: number } | null = null;
const ipnCache = new Map<string, string>();

async function api(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(`${PESAPAL_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: Json = {};
  try {
    body = text ? (JSON.parse(text) as Json) : {};
  } catch {
    body = { message: text.slice(0, 300) };
  }
  const err = body["error"] as { message?: string; code?: string } | null | undefined;
  if (!res.ok) {
    throw new Error(String(err?.message ?? body["message"] ?? `Pesapal error ${res.status}`));
  }
  return body;
}

async function token(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now() + 15_000) return tokenCache.token;
  const body = await api("/api/Auth/RequestToken", {
    method: "POST",
    body: JSON.stringify({ consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }),
  });
  const t = body["token"] as string | undefined;
  if (!t) throw new Error(String(body["message"] ?? "Pesapal authentication failed"));
  tokenCache = { token: t, expires: Date.now() + 4 * 60 * 1000 };
  return t;
}

const authed = async (path: string, init?: RequestInit) =>
  api(path, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, ...(init?.headers ?? {}) },
  });

/** Registers (once per URL) the IPN endpoint and returns its id. */
export async function ipnId(url: string): Promise<string> {
  const hit = ipnCache.get(url);
  if (hit) return hit;
  try {
    const list = (await authed("/api/URLSetup/GetIpnList")) as unknown as Array<Json>;
    const found = Array.isArray(list) ? list.find((r) => r["url"] === url) : undefined;
    const existing = found?.["ipn_id"] as string | undefined;
    if (existing) {
      ipnCache.set(url, existing);
      return existing;
    }
  } catch {
    /* fall through to registration */
  }
  const reg = await authed("/api/URLSetup/RegisterIPN", {
    method: "POST",
    body: JSON.stringify({ url, ipn_notification_type: "POST" }),
  });
  const id = reg["ipn_id"] as string | undefined;
  if (!id) throw new Error("Could not register Pesapal IPN URL");
  ipnCache.set(url, id);
  return id;
}

export type SubmitOrderInput = {
  reference: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  cancellationUrl?: string | undefined;
  ipnUrl: string;
  email?: string | undefined;
  phone?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
};

export async function submitOrder(input: SubmitOrderInput) {
  const notification_id = await ipnId(input.ipnUrl);
  const billing: Json = { country_code: "UG" };
  if (input.email) billing["email_address"] = input.email;
  if (input.phone) billing["phone_number"] = input.phone;
  if (input.firstName) billing["first_name"] = input.firstName;
  if (input.lastName) billing["last_name"] = input.lastName;
  if (!input.email && !input.phone) billing["email_address"] = "customer@vjemma.site";

  const body = await authed("/api/Transactions/SubmitOrderRequest", {
    method: "POST",
    body: JSON.stringify({
      id: input.reference,
      currency: input.currency,
      amount: Number(input.amount),
      description: input.description.slice(0, 100),
      callback_url: input.callbackUrl,
      cancellation_url: input.cancellationUrl ?? input.callbackUrl,
      redirect_mode: "PARENT_WINDOW",
      notification_id,
      billing_address: billing,
    }),
  });
  const redirect = body["redirect_url"] as string | undefined;
  const tracking = body["order_tracking_id"] as string | undefined;
  if (!redirect || !tracking) {
    throw new Error(String(body["message"] ?? "Pesapal did not return a payment link"));
  }
  return { redirectUrl: redirect, orderTrackingId: tracking };
}

export type PesapalStatus = {
  state: "pending" | "success" | "failed" | "cancelled";
  message: string;
  method?: string | undefined;
  confirmation?: string | undefined;
};

export async function transactionStatus(orderTrackingId: string): Promise<PesapalStatus> {
  const body = await authed(
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
  );
  const code = Number(body["status_code"] ?? -1);
  const desc = String(body["payment_status_description"] ?? "").toUpperCase();
  const message = String(body["description"] ?? body["message"] ?? "");
  const method = (body["payment_method"] as string | undefined) ?? undefined;
  const confirmation = (body["confirmation_code"] as string | undefined) ?? undefined;
  if (code === 1 || desc === "COMPLETED") {
    return { state: "success", message: message || "Payment received", method, confirmation };
  }
  if (code === 2 || desc === "FAILED") {
    return { state: "failed", message: message || "Payment failed", method };
  }
  if (code === 3 || desc === "REVERSED") {
    return { state: "cancelled", message: message || "Payment reversed", method };
  }
  return { state: "pending", message: message || "Waiting for payment" };
}
