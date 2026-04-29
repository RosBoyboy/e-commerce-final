/**
 * Use for product/image paths from the API.
 * Paths like "images/photo.jpg" are served from frontend public folder → need "/images/photo.jpg".
 * Full URLs (http/https) are returned as-is. Safe to call during SSR (returns relative path).
 */
export function productImageUrl(path) {
  try {
    if (path == null || typeof path !== 'string') return null;
    const normalized = String(path).replace(/\\/g, '/').trim();
    if (!normalized) return null;
    if (
      normalized.startsWith('http://') ||
      normalized.startsWith('https://') ||
      normalized.startsWith('data:')
    ) {
      return normalized;
    }

    const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    const apiBase =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
      'http://localhost:8000/api';
    const backendOrigin = apiBase.replace(/\/api\/?$/, '');
    return backendOrigin.replace(/\/$/, '') + withSlash;
  } catch (_) {
    return null;
  }
}
