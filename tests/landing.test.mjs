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

test('los recursos locales referenciados en HTML existen', () => {
  const paths = [...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)].map(m=>m[1]);
  assert.ok(paths.length > 10);
  for (const path of paths) assert.ok(existsSync(resolve(root,path)), `no existe ${path}`);
});

test('los seis modelos de galería reutilizan los assets completos publicados', () => {
  for (const kit of kits) {
    const path=`./assets/nubyra/02_catalogo_recursos/equipacion-${kit}.png`;
    assert.ok(html.includes(path),`falta ${path}`);
    assert.ok(existsSync(resolve(root,path)),`falta ${path} local`);
  }
  assert.ok(!html.includes('01_print_recursos/gallery-'),'sigue referenciando recortes antiguos');
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

test('el acceso de Google y Supabase se conserva sin duplicar lógica de login', () => {
  assert.ok(html.includes('https://nubyra.es/acceso.html'));
  assert.ok(html.includes('class="mobile-nav__access"'));
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
