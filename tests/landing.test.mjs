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
const storageBase = 'https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/';

test('los recursos locales referenciados en HTML existen', () => {
  const paths = [...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map(m=>m[1]);
  assert.equal(paths.length, 2);
  for (const path of paths) assert.ok(existsSync(resolve(root,path)), `no existe ${path}`);
});

test('los seis modelos de galería usan el bucket público y conservan copia local', () => {
  for (const kit of kits) {
    const path=`02_catalogo_recursos/equipacion-${kit}.png`;
    assert.ok(html.includes(storageBase+path),`falta ${path} en Storage`);
    assert.ok(existsSync(resolve(root,'assets/nubyra',path)),`falta ${path} local`);
  }
  assert.ok(!html.includes('01_print_recursos/gallery-'),'sigue referenciando recortes antiguos');
});

test('las URLs de imagen usan Storage y mantienen la paleta local', () => {
  assert.ok(html.includes(storageBase+'01_print_recursos/hero-photo.png'));
  assert.ok(html.includes(storageBase+'02_catalogo_recursos/equipacion-oceano.png'));
  assert.ok(js.includes(storageBase+'01_print_recursos/'));
  assert.ok(js.includes(storageBase+'02_catalogo_recursos/'));
  assert.ok(css.includes("./assets/nubyra/04_paleta/paleta.css"));
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

test('Hablemos sustituye Contacto en la navegación de escritorio y móvil', () => {
  const desktop = html.match(/<nav class="desktop-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  const mobile = html.match(/<nav class="mobile-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.ok(desktop && mobile, 'faltan menús públicos');
  assert.ok(!desktop.includes('>Contacto</a>'), 'Contacto duplicado en escritorio');
  assert.ok(!mobile.includes('>Contacto</a>'), 'Contacto duplicado en móvil');
  assert.match(html, /class="btn btn--small btn--yellow header-contact" href="#contacto">Hablemos<\/a>/);
  assert.match(mobile, /href="#contacto" class="mobile-nav__cta">Hablemos/);
  assert.match(html, /<section class="section section--contact" id="contacto"/);
  assert.equal((html.match(/data-contact="/g) || []).length, 3, 'se mantienen las tres vías de consulta');
});
