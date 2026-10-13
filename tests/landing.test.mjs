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

test('los recursos locales de la landing y su ruta 3D existen', () => {
  const paths = [...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map(m=>m[1]);
  assert.ok(paths.length >= 3, 'falta el enlace al configurador 3D');
  for (const path of paths) {
    const target = path.endsWith('/') ? path + 'index.html' : path;
    assert.ok(existsSync(resolve(root,target)), `no existe ${target}`);
  }
});

test('los seis modelos de galería usan el bucket público y conservan copia local', () => {
  for (const kit of kits) {
    const path=`02_catalogo_recursos/equipacion-${kit}.png`;
    assert.ok(html.includes(storageBase+path),`falta ${path} en Storage`);
    assert.ok(existsSync(resolve(root,'assets/nubyra',path)),`falta ${path} local`);
  }
  assert.ok(!html.includes('01_print_recursos/gallery-'),'sigue referenciando recortes antiguos');
});

test('la portada mantiene Storage, el catálogo y los estilos de marca', () => {
  assert.ok(html.includes(storageBase+'01_print_recursos/hero-photo.png'));
  assert.ok(html.includes(storageBase+'02_catalogo_recursos/equipacion-oceano.png'));
  assert.ok(html.includes(storageBase+'01_print_recursos/configurador-camiseta-frente.png'));
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

test('el configurador 3D sustituye la demo 2D como entrada del sitio', () => {
  const appHtml = readFileSync(resolve(root,'configurador-3d/index.html'),'utf8');
  assert.match(html, /<a[^>]*href="\.\/configurador-3d\/"[^>]*id="builder-launch-3d"/);
  assert.match(html, /href="\.\/configurador-3d\/">Configurador 3D<\/a>/);
  assert.match(html, /Modelo de ensayo propio, no industrial/);
  assert.match(html, /No se genera un pedido ni se envían los datos a un servidor/);
  assert.ok(!html.includes('builder-proportions-panel'), 'sigue la simulación de medidas antigua');
  assert.ok(!html.includes('id="builder-download"'), 'sigue el falso generador de propuesta 2D');
  assert.ok(!js.includes('updateKit()'), 'continúa activo el configurador anterior');
  assert.match(js, /builder-gallery-feedback/);
  assert.match(css, /builder--3d-entry/);
  assert.match(appHtml, /id="try-free-model"/);
  assert.match(appHtml, /id="webgl"/);
  assert.ok(!html.includes('nubyra-configurador-3d-preview.vercel.app'), 'la web depende de una preview externa');
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
