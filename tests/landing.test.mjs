import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'landing.css'), 'utf8');
const js = readFileSync(resolve(root, 'landing.js'), 'utf8');
const kits = ['oceano','canaria','lava','brisa','cumbre','horizonte'];
const assetRoot = 'https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/';
const assetSource = readFileSync(resolve(root, 'public-assets.js'), 'utf8');
await import('../public-assets.js');
const assets = globalThis.NUBYRA_ASSETS;

test('todas las imágenes HTML usan Supabase y conservan copia de respaldo local', () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert.ok(imgs.length >= 15);
  const paths = [];
  for (const tag of imgs) {
    const match = tag.match(/data-nubyra-asset="([^"]+)"/);
    assert.ok(match, 'falta data-nubyra-asset');
    const path = match[1];
    paths.push(path);
    assert.ok(tag.includes('src="' + assetRoot + path + '"'), 'origen inesperado: ' + path);
    assert.ok(existsSync(resolve(root, 'assets/nubyra', path)), 'falta respaldo local: ' + path);
  }
  assert.ok(new Set(paths).size >= 9);
  assert.ok(html.includes('href="' + assetRoot + '01_print_recursos/hero-photo.png" as="image"'));
  assert.ok(html.indexOf('src="./public-assets.js"') < html.indexOf('src="./landing.js"'));
});

test('los seis diseños del catálogo utilizan el bucket público', () => {
  for (const kit of kits) {
    const path='02_catalogo_recursos/equipacion-'+kit+'.png';
    assert.ok(html.includes('src="' + assetRoot + path + '"'), 'falta '+path);
    assert.ok(existsSync(resolve(root,'assets/nubyra',path)), 'falta fallback '+path);
  }
  assert.ok(!html.includes('01_print_recursos/gallery-'), 'no reutilizar recortes antiguos');
});

test('la portada refleja el titular vigente en Figma', () => {
  assert.match(html, /<h1 id="hero-title">Distintas mujeres\.<br>Un mismo equipo\.<\/h1>/);
  assert.ok(!html.includes('hero__break-desktop'));
  assert.match(css,/Figma 2026-10-12 revision/);
});

test('la navegación enlaza exclusivamente anclas existentes', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const match of html.matchAll(/\bhref="#([^" ]+)"/g)) assert.ok(ids.has(match[1]), `ancla no encontrada: ${match[1]}`);
  for(const anchor of ['inicio','equipaciones','configurador','como-funciona','proyecto','contacto']) assert.ok(ids.has(anchor));
});

test('el acceso privado no se anuncia públicamente y la landing no duplica la autenticación', () => {
  assert.ok(!html.includes('acceso.html'));
  assert.ok(!html.includes('access-link'));
  assert.ok(!html.includes('mobile-nav__access'));
  assert.ok(!css.includes('.access-link'));
  assert.ok(!css.includes('.mobile-nav__access'));
  assert.ok(!/supabase-js|service_role|createClient\(/.test(js));
});

test('la demostración deja claro que no ejecuta 3D ni simula medidas', () => {
  assert.match(html,/No hay simulación 3D ni patrón validado/);
  assert.match(html,/No enviamos ni almacenamos tus datos en un servidor/);
  assert.match(js,/manufacturingApproved:false/);
  assert.match(js,/equipacion-/);
});

test('no quedan referencias a imágenes temporales de Figma', () => {
  for(const content of [html,css,js]) {
    assert.ok(!content.includes('figma.com/api/mcp/asset/'));
  }
});

test('en ultrawide la fotografía y el velo usan el mismo lienzo centrado', () => {
  assert.match(css, /@media\s*\(min-width:\s*1440px\)/);
  assert.match(css, /\.hero__photo\s*\{\s*right:\s*calc\(\(100% - 1440px\)\s*\/\s*2 \+ 58px\)/);
  assert.match(css, /\.hero__shade\s*\{[^}]*width:\s*1440px;[^}]*transform:\s*translateX\(-50%\)/s);
  assert.match(css, /\.hero,\s*\.hero__inner\s*\{\s*min-height:\s*max\(900px,\s*100svh\)/);
});

test('en escritorio la fotografía queda fusionada detrás del titular', () => {
  assert.match(css, /@media\s*\(min-width:\s*1001px\)/);
  assert.match(css, /\.hero__photo\s*\{\s*width:\s*min\(740px,\s*52vw\)/);
  assert.match(css, /mask-image:\s*linear-gradient\(to right,\s*transparent 0%/);
  assert.match(html, /<div class="hero__photo"[^>]*>/);
  assert.match(html, /<div class="hero__shade"[^>]*>/);
});

test('resolver de imágenes valida rutas y proporciona respaldo sin secretos', () => {
  assert.equal(assets.publicUrl('01_print_recursos/hero-photo.png'), assetRoot+'01_print_recursos/hero-photo.png');
  assert.equal(assets.localUrl('02_catalogo_recursos/equipacion-brisa.png'), './assets/nubyra/02_catalogo_recursos/equipacion-brisa.png');
  assert.throws(() => assets.publicUrl('../config.js'), TypeError);
  assert.throws(() => assets.publicUrl('other-bucket/foto.png'), TypeError);
  assert.ok(!/sb_publishable_|service_role|createClient|fetch\(/.test(assetSource));
  assert.match(js, /assetLoader\.setImage\(photo,relativePath\)/);
});

test('un error remoto conmuta a GitHub una sola vez y admite cambios de diseño', () => {
  const img = {tagName:'IMG',src:'',currentSrc:'',dataset:{}};
  assets.setImage(img,'02_catalogo_recursos/equipacion-lava.png');
  assert.equal(img.src,assetRoot+'02_catalogo_recursos/equipacion-lava.png');
  assets.onImageError({target:img});
  assert.equal(img.src,'./assets/nubyra/02_catalogo_recursos/equipacion-lava.png');
  assert.equal(img.dataset.nubyraSource,'fallback');
  assets.onImageError({target:img});
  assert.equal(img.src,'./assets/nubyra/02_catalogo_recursos/equipacion-lava.png');
  assets.setImage(img,'02_catalogo_recursos/equipacion-brisa.png');
  assert.equal(img.src,assetRoot+'02_catalogo_recursos/equipacion-brisa.png');
  // currentSrc may temporarily be stale while a dynamic replacement fails.
  img.currentSrc='./assets/nubyra/02_catalogo_recursos/equipacion-lava.png';
  assets.onImageError({target:img});
  assert.equal(img.src,'./assets/nubyra/02_catalogo_recursos/equipacion-brisa.png');
});
