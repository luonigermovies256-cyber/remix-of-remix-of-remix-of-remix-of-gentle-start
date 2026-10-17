/** Uganda mobile number helpers shared by checkout and profile forms. */

export function normalizeMsisdn(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.startsWith("0")) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  return input.startsWith("+") ? input : `+${digits}`;
}

export function isValidMsisdn(input: string): boolean {
  return /^\+256\d{9}$/.test(normalizeMsisdn(input));
}
