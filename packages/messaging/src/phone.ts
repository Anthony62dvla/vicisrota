/**
 * UK mobile numbers in any common format ("07700 900123", "+44 7700 900123", "0044 7700-900123")
 * become E.164 ("+447700900123"). Anything that is not a UK mobile gives null, so a typo is caught
 * when the number is saved rather than when an alert fails to arrive.
 */
export const normaliseUkMobile = (input: string): string | null => {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("44")) digits = "0" + digits.slice(2);
  return /^07\d{9}$/.test(digits) ? `+44${digits.slice(1)}` : null;
};

/** For display: "+447700900123" becomes "07700 900123". */
export const formatUkMobile = (e164: string) => {
  const national = "0" + e164.slice(3);
  return `${national.slice(0, 5)} ${national.slice(5)}`;
};
