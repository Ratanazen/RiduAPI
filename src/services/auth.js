/**
 * Ridu API Studio — Authentication Service (Agent 2)
 *
 * Supports Bearer token, HTTP Basic Auth, and API Key (header or query param).
 * Provides header and credential redaction to prevent secret leaks in logs.
 */

/**
 * Applies authentication settings to request headers and/or target URL.
 *
 * @param {Object} headers - Plain headers object (mutated or cloned)
 * @param {string} url - Target request URL
 * @param {Object|null} auth - Auth configuration { type: 'none'|'bearer'|'basic'|'api-key', ... }
 * @returns {{ headers: Object, url: string }}
 */
function applyAuth(headers = {}, url = '', auth = null) {
  const nextHeaders = { ...headers };
  let nextUrl = url;

  if (!auth || !auth.type || auth.type === 'none') {
    return { headers: nextHeaders, url: nextUrl };
  }

  switch (auth.type) {
    case 'bearer': {
      if (auth.token) {
        nextHeaders['Authorization'] = `Bearer ${auth.token.trim()}`;
      }
      break;
    }

    case 'basic': {
      const username = auth.username || '';
      const password = auth.password || '';
      const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
      nextHeaders['Authorization'] = `Basic ${encoded}`;
      break;
    }

    case 'api-key': {
      const key = (auth.key || '').trim();
      const value = auth.value || '';
      const addTo = (auth.addTo || 'header').toLowerCase();

      if (key) {
        if (addTo === 'header') {
          nextHeaders[key] = value;
        } else if (addTo === 'query') {
          try {
            const parsed = new URL(nextUrl);
            parsed.searchParams.set(key, value);
            nextUrl = parsed.toString();
          } catch {
            // If URL is relative or partial, append manually
            const sep = nextUrl.includes('?') ? '&' : '?';
            nextUrl = `${nextUrl}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
          }
        }
      }
      break;
    }

    default:
      break;
  }

  return { headers: nextHeaders, url: nextUrl };
}

/**
 * Redacts secret information from auth configuration for safe logging/display.
 *
 * @param {Object|null} auth
 * @returns {Object|null}
 */
function redactAuth(auth) {
  if (!auth || typeof auth !== 'object') return auth;
  const clone = { ...auth };

  if (clone.token) clone.token = '[REDACTED]';
  if (clone.password) clone.password = '[REDACTED]';
  if (clone.value) clone.value = '[REDACTED]';

  return clone;
}

/**
 * Redacts sensitive HTTP header values.
 *
 * @param {Object} headers
 * @returns {Object}
 */
function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const lk = String(key).toLowerCase();
    if (
      lk === 'authorization' ||
      lk === 'proxy-authorization' ||
      lk === 'x-api-key' ||
      lk.endsWith('-key') ||
      lk.endsWith('-token') ||
      lk.endsWith('-secret')
    ) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

module.exports = {
  applyAuth,
  redactAuth,
  redactHeaders,
};
