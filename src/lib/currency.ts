export const CURRENCY_CODE = "UGX";
export const CURRENCY_LABEL = "UG SHS";

/** Formats any amount in the site currency (Ugandan Shillings). */
export function formatMoney(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return `${CURRENCY_LABEL} ${value.toLocaleString("en-UG", {
    maximumFractionDigits: 0,
  })}`;
}
