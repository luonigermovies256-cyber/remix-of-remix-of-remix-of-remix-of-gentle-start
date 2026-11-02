/** Dashboard access follows the authenticated account, never a supplied password. */
export const ADMIN_EMAIL = "vjemmatruelightstudios@gmail.com";
export const ADMIN_PHONE = "0760734679";

const ADMIN_EMAILS = new Set([ADMIN_EMAIL, "dwonluomovies@gmail.com"]);

export function isAdminEmail(email: string | null | undefined) {
  return ADMIN_EMAILS.has((email ?? "").trim().toLowerCase());
}

export function isAdminCredential(email: string | null | undefined) {
  const credential = (email ?? "").trim().toLowerCase();
  return isAdminEmail(credential) || credential === `p${ADMIN_PHONE}@vjemma.site`;
}