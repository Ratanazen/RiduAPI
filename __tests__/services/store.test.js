const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Store, createDefaultData } = require('../../src/services/store');

describe('store service', () => {
  const tmpDir = path.join(os.tmpdir(), `ridu-store-test-${Date.now()}`);
  const tmpFile = path.join(tmpDir, 'test-store.json');

  after(() => {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  test('createDefaultData provides default structure', () => {
    const data = createDefaultData();
    assert.strictEqual(data.version, 1);
    assert.ok(Array.isArray(data.collections));
    assert.ok(Array.isArray(data.requests));
    assert.ok(Array.isArray(data.environments));
    assert.ok(Array.isArray(data.history));
    assert.strictEqual(data.settings.tlsVerifyEnabled, true);
  });

  test('initializes and saves data to new file', () => {
    const store = new Store(tmpFile);
    assert.deepStrictEqual(store.get().collections, []);

    store.set({
      collections: [{ id: 'col-1', name: 'Auth APIs' }],
    });

    assert.ok(fs.existsSync(tmpFile));
    const content = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    assert.strictEqual(content.collections.length, 1);
    assert.strictEqual(content.collections[0].name, 'Auth APIs');
  });

  test('loads existing file content on instantiation', () => {
    const store2 = new Store(tmpFile);
    assert.strictEqual(store2.get().collections.length, 1);
    assert.strictEqual(store2.get().collections[0].name, 'Auth APIs');
  });

  test('falls back safely if file is corrupted', () => {
    const corruptFile = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(corruptFile, 'not-valid-json{{{', 'utf8');

    const store = new Store(corruptFile);
    assert.strictEqual(store.get().version, 1);
    assert.deepStrictEqual(store.get().collections, []);
  });
});
