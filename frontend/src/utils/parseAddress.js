/**
 * Parse a single-line address like "P-1 BONBON, BUTUAN CITY, 8600":
 * last segment → ZIP (4–6 digits), previous segment → city, remainder → street.
 */
export function parseCommaSeparatedAddress(full) {
  const trimmed = (full || '').trim();
  if (!trimmed) return { street: '', city: '', postal: '' };

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { street: trimmed, city: '', postal: '' };
  }

  const last = parts[parts.length - 1];
  if (!/^\d{4,6}$/.test(last)) {
    return { street: trimmed, city: '', postal: '' };
  }

  if (parts.length >= 3) {
    return {
      street: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2],
      postal: last,
    };
  }

  return { street: parts[0], city: '', postal: last };
}
