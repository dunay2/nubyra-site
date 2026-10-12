import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

// Navegador y sesión sintéticos; el SDK es real y no se permite ninguna red real.
globalThis.BroadcastChannel = undefined;
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const source = (await readFile(new URL('../src/login.js', import.meta.url), 'utf8'))
  .replace("import { createClient } from '@supabase/supabase-js';", '');
let scenario = 0;

async function runFrontend(href) {
  let location = new URL(href);
  const storageKey = `sb-review-${++scenario}-auth-token`;
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
  values.set(storageKey, JSON.stringify({
    access_token: 'simulated-previous-token', refresh_token: 'simulated-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'simulated-user' }
  }));
  const nodes = Object.fromEntries(['auth-status', 'auth-detail', 'auth-role', 'auth-login', 'auth-retry', 'auth-logout']
    .map((id) => [id, { hidden: true, textContent: '', addEventListener() {} }]));
  const root = { dataset: {}, dispatchEvent() {} };
  const document = {
    visibilityState: 'visible', addEventListener() {}, removeEventListener() {},
    querySelector: () => root, getElementById: (id) => nodes[id]
  };
  const window = {
    get location() { return location; }, localStorage: storage,
    addEventListener() {}, removeEventListener() {}, setTimeout,
    history: { replaceState: (_a, _b, url) => { location = new URL(url, location); } },
    NUBYRA_AUTH_CONFIG: {
      supabaseUrl: 'https://review.supabase.co', supabasePublishableKey: 'sb_publishable_test_only',
      callbackUrl: 'https://nubyra.es/acceso.html'
    }
  };
  globalThis.window = window;
  globalThis.document = document;
  globalThis.localStorage = storage;
  let client;
  let requests = 0;
  vm.runInNewContext(source, {
    window, document, URL, URLSearchParams, queueMicrotask, CustomEvent,
    createClient: (url, key, options) => {
      client = createClient(url, key, {
        ...options, auth: { ...options.auth, storage, storageKey, autoRefreshToken: false },
        global: { fetch: async (input) => {
          requests++;
          assert.equal(String(input), 'https://review.supabase.co/rest/v1/rpc/resolve_my_access');
          return new Response(JSON.stringify({ status: 'active', role: 'lector' }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        } }
      });
      return client;
    }
  }, { filename: 'src/login.js' });
  await client.auth.initialize();
  for (let i = 0; i < 10; i++) await new Promise(setImmediate);
  await client.auth.stopAutoRefresh();
  return { root, nodes, requests, href: location.href };
}

test('real SDK: failed fragment callback cannot authorize previous session', async () => {
  const result = await runFrontend('https://nubyra.es/acceso.html#error=access_denied&error_description=OAuth+cancelled');
  assert.equal(result.root.dataset.state, 'error');
  assert.equal(result.nodes['auth-role'].hidden, true);
  assert.equal(result.requests, 0);
  assert.equal(result.href, 'https://nubyra.es/acceso.html');
});

test('real SDK: valid previous session still resolves authorization normally', async () => {
  const result = await runFrontend('https://nubyra.es/acceso.html');
  assert.equal(result.root.dataset.state, 'active');
  assert.equal(result.nodes['auth-role'].textContent, 'Rol: lector');
  assert.ok(result.requests >= 1);
});
