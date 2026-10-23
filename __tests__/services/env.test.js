const { test, describe } = require('node:test');
const assert = require('node:assert');
const { resolveEnvMap, substituteString, substituteVariables } = require('../../src/services/env');

describe('env service', () => {
  test('resolveEnvMap extracts enabled variables into dictionary', () => {
    const env = {
      id: 'env-1',
      name: 'Staging',
      variables: [
        { key: 'baseUrl', value: 'https://staging.api.io', enabled: true },
        { key: 'port', value: 8080, enabled: true },
        { key: 'disabledVar', value: 'hidden', enabled: false },
        { key: 'emptyVar', value: '', enabled: true },
      ],
    };

    const map = resolveEnvMap(env);

    assert.strictEqual(map.baseUrl, 'https://staging.api.io');
    assert.strictEqual(map.port, '8080');
    assert.strictEqual(map.emptyVar, '');
    assert.strictEqual(map.disabledVar, undefined);
  });

  test('substituteString replaces {{var}} placeholders', () => {
    const map = {
      host: 'api.github.com',
      version: 'v3',
    };

    const output = substituteString('https://{{ host }}/{{version}}/users', map);
    assert.strictEqual(output, 'https://api.github.com/v3/users');
  });

  test('substituteString preserves missing variables by default', () => {
    const map = { host: 'example.com' };
    const output = substituteString('https://{{host}}/{{unknown}}', map);
    assert.strictEqual(output, 'https://example.com/{{unknown}}');
  });

  test('substituteVariables works recursively on objects and arrays', () => {
    const map = {
      envName: 'prod',
      userId: '42',
    };

    const input = {
      url: 'https://api.{{envName}}.com/users',
      tags: ['role-{{envName}}', 'id-{{userId}}'],
      nested: {
        owner: 'user-{{userId}}',
      },
    };

    const result = substituteVariables(input, map);

    assert.strictEqual(result.url, 'https://api.prod.com/users');
    assert.deepStrictEqual(result.tags, ['role-prod', 'id-42']);
    assert.strictEqual(result.nested.owner, 'user-42');
  });
});
