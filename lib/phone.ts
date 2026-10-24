/**
 * Phone helpers shared by ushdesk forms.
 * Kuwait (+965): exactly 8 digits, starting with 4, 5, 6 or 9.
 * Other countries: 6–14 digits (digits only).
 */

export const KUWAIT_CODE = '+965';

/** Keep digits only, drop a pasted country-code prefix, and cap the length. */
export function sanitizeLocalPhone(raw: string, countryCode: string = KUWAIT_CODE): string {
  const codeDigits = countryCode.replace(/\D/g, '');
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00' + codeDigits)) digits = digits.slice(2 + codeDigits.length);
  else if (codeDigits && digits.startsWith(codeDigits) && digits.length > (countryCode === KUWAIT_CODE ? 8 : 10)) {
    digits = digits.slice(codeDigits.length);
  }
  return digits.slice(0, countryCode === KUWAIT_CODE ? 8 : 14);
}

export function isValidLocalPhone(local: string, countryCode: string = KUWAIT_CODE): boolean {
  if (countryCode === KUWAIT_CODE) return /^[4569]\d{7}$/.test(local);
  return /^\d{6,14}$/.test(local);
}

export function phoneErrorMessage(countryCode: string = KUWAIT_CODE): string {
  return countryCode === KUWAIT_CODE
    ? 'Phone number must be 8 digits and start with 4, 5, 6 or 9.'
    : 'Phone number must contain 6 to 14 digits only.';
}

/**
 * Turn any stored phone (+96541028983, 96541028983, 41028983 …) into the local part for +965.
 * Returns '' if it cannot be interpreted as a valid Kuwait number.
 */
export function toKuwaitLocal(phone: string | null | undefined): string {
  const local = sanitizeLocalPhone(String(phone ?? ''), KUWAIT_CODE);
  return isValidLocalPhone(local, KUWAIT_CODE) ? local : '';
}
