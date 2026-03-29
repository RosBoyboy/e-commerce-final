/**
 * Split a shipping line into street, city, postal (PH-style).
 * Accepts commas and/or newlines between segments:
 * "P-1 Bonbon, Butuan City, 8600" or multiline with city + 4–6 digit ZIP last.
 */
export function parseCommaSeparatedAddress(full) {
  const trimmed = (full || '').trim();
  if (!trimmed) return { street: '', city: '', postal: '' };

  const normalized = trimmed
    .replace(/\r\n/g, '\n')
    .replace(/[\n;|]/g, ',');
  const parts = normalized
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

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
