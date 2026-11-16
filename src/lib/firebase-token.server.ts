import { createRemoteJWKSet, jwtVerify } from "jose";
import { isAdminCredential } from "@/lib/admin-access";

const PROJECT_ID = "vj-emma";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/** Verifies a Firebase ID token and returns its claims. */
export async function verifyFirebaseToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  return { uid: String(payload.sub), email: (payload["email"] as string | undefined) ?? null };
}

/** Throws unless the token belongs to an admin account. */
export async function requireFirebaseAdmin(idToken: string) {
  const claims = await verifyFirebaseToken(idToken).catch(() => null);
  if (!claims || !isAdminCredential(claims.email)) throw new Error("Forbidden");
  return claims;
}
