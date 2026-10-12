import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path));
const iconVersion = 'v=03';

function assertPngDimensions(path, expected) {
  const png = read(path);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} no es PNG`);
  assert.equal(png.readUInt32BE(16), expected, `${path} ancho`);
  assert.equal(png.readUInt32BE(20), expected, `${path} alto`);
}

test('la propuesta 03 se referencia en portada y acceso, con invalidación de caché', () => {
  for (const page of ['index.html', 'acceso.html']) {
    const html = read(page).toString('utf8');
    for (const path of ['favicon.ico', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png',
      'apple-touch-icon.png', 'site.webmanifest']) {
      assert.ok(html.includes(`./${path}?${iconVersion}`), `${page} no enlaza ${path}`);
    }
    assert.ok(!html.includes('href="data:,"'), `${page} contiene icono vacío`);
  }
});

test('el favicon ICO contiene siete resoluciones cuadradas verificables', () => {
  const data = read('favicon.ico');
  assert.equal(data.readUInt16LE(0), 0);
  assert.equal(data.readUInt16LE(2), 1);
  const n = data.readUInt16LE(4);
  assert.equal(n, 7);
  const sizes = new Set();
  for (let i = 0; i < n; i++) {
    const pos = 6 + i*16;
    const width = data[pos] || 256;
    const height = data[pos + 1] || 256;
    assert.equal(width, height);
    const size = data.readUInt32LE(pos + 8);
    const start = data.readUInt32LE(pos + 12);
    assert.ok(size > 100 && start >= 6 + n*16 && start + size <= data.length);
    sizes.add(width);
  }
  assert.deepEqual([...sizes].sort((a,b)=>a-b), [16,24,32,48,64,128,256]);
});

test('SVG conserva la silueta femenina y el balón, con rutas vectoriales internas', () => {
  const svg = read('favicon.svg').toString('utf8');
  assert.match(svg, /<svg\b/);
  assert.match(svg, /viewBox="0 0 1024 1024"/);
  assert.match(svg, /mujer lanzando un balón/);
  assert.match(svg, /fill="url\(#blue\)"/);
  assert.match(svg, /fill="url\(#gold\)"/);
  assert.match(svg, /fill-rule="evenodd"/);
  assert.ok((svg.match(/<path\b/g) || []).length >= 2);
  assert.doesNotMatch(svg, /<script\b|<image\b|xlink:href=|javascript:|href="https?:/i);
});

test('PNG y original seleccionado conservan sus dimensiones', () => {
  for (const [name, size] of Object.entries({
    'favicon-16x16.png':16,'favicon-32x32.png':32,'apple-touch-icon.png':180,
    'android-chrome-192x192.png':192,'android-chrome-512x512.png':512,
    'maskable-icon-512x512.png':512
  })) assertPngDimensions(name,size);
  for (const n of [24,48,64,96,128,256])
    assertPngDimensions(`assets/brand/favicon-03/icon-${n}.png`,n);
  assertPngDimensions('assets/brand/favicon-03/original-seleccionado-1024.png',1024);
});

test('manifiesto web apunta a iconos existentes y no introduce servicios', () => {
  const manifest = JSON.parse(read('site.webmanifest').toString('utf8'));
  assert.equal(manifest.name, 'NUBYRA');
  assert.equal(manifest.background_color, '#F9FBFF');
  assert.equal(manifest.theme_color, '#061727');
  const paths = manifest.icons.map(x=>x.src);
  assert.equal(paths.length,3);
  for(const p of paths) {
    assert.ok(p.startsWith('/') && !p.includes('..'));
    assert.ok(existsSync(resolve(root,p.slice(1))),`falta icono de manifiesto ${p}`);
  }
  assert.ok(manifest.icons.some(x=>x.purpose==='maskable'));
});