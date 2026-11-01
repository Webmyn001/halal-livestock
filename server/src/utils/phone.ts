/**
 * Best effort E.164 normalization. Never throws: the schema regex decides whether
 * the result is a real number, so a bad value surfaces as a field error in the form.
 */
export function toE164(raw: string): string {
  const compact = raw.trim().replace(/[\s()-]/g, '');

  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (compact.startsWith('0')) return `+234${compact.slice(1)}`;
  return `+${compact}`;
}

export const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
