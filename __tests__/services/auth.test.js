const { test, describe } = require('node:test');
const assert = require('node:assert');
const { applyAuth, redactAuth, redactHeaders } = require('../../src/services/auth');

describe('auth service', () => {
  test('applies none auth without changes', () => {
    const headers = { 'Content-Type': 'application/json' };
    const url = 'https://api.example.com/test';
    const result = applyAuth(headers, url, { type: 'none' });

    assert.deepStrictEqual(result.headers, headers);
    assert.strictEqual(result.url, url);
  });

  test('applies bearer token auth to headers', () => {
    const headers = {};
    const url = 'https://api.example.com/test';
    const result = applyAuth(headers, url, { type: 'bearer', token: 'my-jwt-token' });

    assert.strictEqual(result.headers['Authorization'], 'Bearer my-jwt-token');
    assert.strictEqual(result.url, url);
  });

  test('applies basic auth with base64 encoded credentials', () => {
    const headers = {};
    const url = 'https://api.example.com/test';
    const result = applyAuth(headers, url, {
      type: 'basic',
      username: 'admin',
      password: 'password123',
    });

    const expectedEncoded = Buffer.from('admin:password123').toString('base64');
    assert.strictEqual(result.headers['Authorization'], `Basic ${expectedEncoded}`);
  });

  test('applies api-key auth to headers', () => {
    const headers = {};
    const url = 'https://api.example.com/test';
    const result = applyAuth(headers, url, {
      type: 'api-key',
      key: 'X-API-KEY',
      value: 'secret-key-val',
      addTo: 'header',
    });

    assert.strictEqual(result.headers['X-API-KEY'], 'secret-key-val');
    assert.strictEqual(result.url, url);
  });

  test('applies api-key auth to url query params', () => {
    const headers = {};
    const url = 'https://api.example.com/test?existing=true';
    const result = applyAuth(headers, url, {
      type: 'api-key',
      key: 'api_token',
      value: 'xyz123',
      addTo: 'query',
    });

    assert.ok(result.url.includes('api_token=xyz123'));
    assert.ok(result.url.includes('existing=true'));
  });

  test('redacts secret credentials in auth objects', () => {
    const auth = {
      type: 'basic',
      username: 'user',
      password: 'super-secret-password',
      token: 'secret-token',
      value: 'api-secret-key',
    };
    const redacted = redactAuth(auth);

    assert.strictEqual(redacted.password, '[REDACTED]');
    assert.strictEqual(redacted.token, '[REDACTED]');
    assert.strictEqual(redacted.value, '[REDACTED]');
    assert.strictEqual(redacted.username, 'user');
  });

  test('redacts sensitive headers in redactHeaders', () => {
    const headers = {
      'authorization': 'Bearer secret-token',
      'X-API-Key': 'my-key',
      'Content-Type': 'application/json',
      'custom-secret': 'sensitive',
    };
    const redacted = redactHeaders(headers);

    assert.strictEqual(redacted['authorization'], '[REDACTED]');
    assert.strictEqual(redacted['X-API-Key'], '[REDACTED]');
    assert.strictEqual(redacted['custom-secret'], '[REDACTED]');
    assert.strictEqual(redacted['Content-Type'], 'application/json');
  });
});
