const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const https = require('node:https');
const { sendRequest } = require('../../src/services/apiClient');

describe('apiClient service', () => {
  let server;
  let port;
  let baseUrl;

  before((_, done) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === '/get') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, method: req.method, query: Object.fromEntries(url.searchParams) }));
        return;
      }

      if (url.pathname === '/post') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          res.writeHead(201, {
            'Content-Type': 'application/json',
            'X-Echo-Custom': req.headers['x-custom-header'] || '',
          });
          res.end(JSON.stringify({ received: body, method: req.method }));
        });
        return;
      }

      if (url.pathname === '/slow') {
        // Delay beyond timeout
        setTimeout(() => {
          res.writeHead(200);
          res.end('delayed');
        }, 300);
        return;
      }

      if (url.pathname === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Resource Not Found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    });

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  test('sends successful GET request and receives response', async () => {
    const res = await sendRequest({
      method: 'GET',
      url: `${baseUrl}/get?foo=bar&test=1`,
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.statusMessage, 'OK');
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.method, 'GET');
    assert.strictEqual(parsed.query.foo, 'bar');
    assert.strictEqual(parsed.query.test, '1');
    assert.strictEqual(res.headers['content-type'], 'application/json');
    assert.ok(res.sizeBytes > 0);
  });

  test('sends POST request with body and headers', async () => {
    const payload = JSON.stringify({ message: 'hello world' });
    const res = await sendRequest({
      method: 'POST',
      url: `${baseUrl}/post`,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'ridu-test-value',
      },
      body: payload,
    });

    assert.strictEqual(res.statusCode, 201);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.method, 'POST');
    assert.strictEqual(parsed.received, payload);
    assert.strictEqual(res.headers['x-echo-custom'], 'ridu-test-value');
  });

  test('handles 404 Not Found response cleanly', async () => {
    const res = await sendRequest({
      method: 'GET',
      url: `${baseUrl}/not-found`,
    });

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body, 'Resource Not Found');
  });

  test('times out when response takes longer than specified timeout', async () => {
    await assert.rejects(
      async () => {
        await sendRequest({
          method: 'GET',
          url: `${baseUrl}/slow`,
          timeout: 50,
        });
      },
      (err) => {
        assert.ok(err.message.includes('timed out'));
        return true;
      }
    );
  });

  test('rejects on invalid URL or unsupported protocol', async () => {
    await assert.rejects(
      async () => {
        await sendRequest({
          method: 'GET',
          url: 'ftp://example.com/test',
        });
      },
      (err) => {
        assert.ok(err.message.includes('Unsupported protocol'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await sendRequest({
          method: 'GET',
          url: 'not-a-valid-url',
        });
      },
      (err) => {
        assert.ok(err.message.includes('Invalid URL'));
        return true;
      }
    );
  });
});
