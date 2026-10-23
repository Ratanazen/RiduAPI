/**
 * Ridu API Studio — Core HTTP/HTTPS API Engine (Agent 2)
 *
 * Built strictly with Node.js built-in 'http' and 'https' modules (zero external HTTP dependencies).
 * Enforces TLS certificate verification by default and supports timeouts and cancellation.
 */

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

/**
 * Sends an HTTP/HTTPS request based on configuration.
 *
 * @param {Object} config
 * @param {string} [config.method='GET'] - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} config.url - Destination URL
 * @param {Object} [config.headers={}] - Request headers map
 * @param {string|Buffer|null} [config.body=null] - Request payload
 * @param {number} [config.timeout=30000] - Request timeout in milliseconds
 * @param {boolean} [config.rejectUnauthorized=true] - TLS certificate verification
 * @returns {Promise<Object>} Resolves with { statusCode, statusMessage, headers, body, sizeBytes }
 */
function sendRequest(config) {
  return new Promise((resolve, reject) => {
    if (!config || !config.url) {
      return reject(new Error('URL is required'));
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(config.url);
    } catch (err) {
      return reject(new Error(`Invalid URL: ${config.url}`));
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const isHttp = parsedUrl.protocol === 'http:';

    if (!isHttps && !isHttp) {
      return reject(new Error(`Unsupported protocol: ${parsedUrl.protocol}`));
    }

    const transport = isHttps ? https : http;
    const method = (config.method || 'GET').toUpperCase();
    const timeoutMs = typeof config.timeout === 'number' ? config.timeout : 30000;
    const rejectUnauthorized = config.rejectUnauthorized !== false;

    const headers = { ...(config.headers || {}) };

    let bodyData = null;
    if (config.body !== null && config.body !== undefined && method !== 'GET' && method !== 'HEAD') {
      if (Buffer.isBuffer(config.body)) {
        bodyData = config.body;
      } else if (typeof config.body === 'object') {
        bodyData = Buffer.from(JSON.stringify(config.body), 'utf8');
        if (!hasHeader(headers, 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }
      } else {
        bodyData = Buffer.from(String(config.body), 'utf8');
      }

      if (!hasHeader(headers, 'content-length')) {
        headers['Content-Length'] = bodyData.length;
      }
    }

    const requestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
      timeout: timeoutMs,
    };

    if (isHttps) {
      requestOptions.rejectUnauthorized = rejectUnauthorized;
    }

    let isSettled = false;

    const req = transport.request(requestOptions, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (isSettled) return;
        isSettled = true;

        const buffer = Buffer.concat(chunks);
        const bodyText = buffer.toString('utf8');

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          rawHeaders: res.rawHeaders,
          body: bodyText,
          sizeBytes: buffer.length,
        });
      });

      res.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        reject(new Error(`Response stream error: ${err.message}`));
      });
    });

    req.on('timeout', () => {
      if (isSettled) return;
      isSettled = true;
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      reject(new Error(`Network error: ${err.message}`));
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

function hasHeader(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

module.exports = {
  sendRequest,
};
