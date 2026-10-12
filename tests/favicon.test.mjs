import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(root, name));

test('la propuesta 05 Luminoso está enlazada en la web pública y la página de acceso', () => {
  for (const page of ['index.html', 'acceso.html']) {
    const html = read(page).toString('utf8');
    assert.match(html, /rel="icon" type="image\/x-icon"[^>]+href="\.\/favicon\.ico"/);
    assert.match(html, /rel="icon" type="image\/svg\+xml"[^>]+href="\.\/favicon\.svg"/);
    assert.match(html, /rel="apple-touch-icon"[^>]+href="\.\/apple-touch-icon\.png"/);
  }
});

test('favicon.ico tiene formato válido y tamaños de navegador', () => {
  const ico = read('favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0); // reservado
  assert.equal(ico.readUInt16LE(2), 1); // ICO, no CUR
  const count = ico.readUInt16LE(4);
  assert.equal(count, 7);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const width = ico[offset] || 256;
    const height = ico[offset + 1] || 256;
    assert.equal(width, height);
    const bytes = ico.readUInt32LE(offset + 8);
    const pos = ico.readUInt32LE(offset + 12);
    assert.ok(bytes > 0 && pos + bytes <= ico.length);
    sizes.push(width);
  }
  for (const size of [16, 32, 48, 256]) assert.ok(sizes.includes(size), 'falta resolución ' + size);
});

test('favicon.svg conserva el símbolo luminoso azul y amarillo', () => {
  const svg = read('favicon.svg').toString('utf8');
  assert.match(svg, /<svg\b/);
  assert.match(svg, /viewBox="0 0 256 256"/);
  assert.match(svg, /fill="#F9FBFF"/); // fondo blanco
  assert.match(svg, /fill="url\(#blue\)"/);
  assert.match(svg, /fill="url\(#gold\)"/);
  assert.doesNotMatch(svg, /<script\b/i);
});

test('apple-touch-icon es PNG RGBA de 180 por 180', () => {
  const png = read('apple-touch-icon.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 180);
  assert.equal(png.readUInt32BE(20), 180);
});
