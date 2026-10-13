import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_STATE, VIEW_ZONES, PRESETS, normalizeText, normalizeNumber, validNumber, fitText,
  getCollisionWarnings, profileInfo, serializeProposal, hexColor } from '../configurador-3d/layout.mjs';
const root = resolve(import.meta.dirname, '..', 'configurador-3d');
const markup = readFileSync(resolve(root, 'index.html'), 'utf8');
const app = readFileSync(resolve(root, 'app.mjs'), 'utf8');
const viewer = readFileSync(resolve(root, 'viewer.mjs'), 'utf8');
const style = readFileSync(resolve(root, 'styles.css'), 'utf8');

const sampleCtx = { font: '', measureText(t) { return { width: t.length * Number(/\d+(?=px)/.exec(this.font)?.[0] ?? 40) * 0.56 }; } };
test('los dorsales admitidos son 0, 00, 1..99; se excluyen tres dígitos y letras', () => {
  for (const s of ['0', '00', '1', '9', '10', '99']) assert.equal(validNumber(s), true, s);
  for (const s of ['01', '002', '100', '-1', 'A', '']) assert.equal(validNumber(s), false, s);
  assert.equal(normalizeNumber('12a3'), '12');
  assert.equal(normalizeNumber('08'), '8');
});

test('texto normalizado y límites de color evitan entradas arbitrarias', () => {
  assert.equal(normalizeText('  NUBYRA    CANARIAS ', 30), 'NUBYRA CANARIAS');
  assert.equal(hexColor('#ffffff'), '#ffffff');
  assert.equal(hexColor('url(script)'), '#102d50');
});

test('las reservas estáticas del frontal y la espalda no se cruzan ni a 18 px', () => {
  assert.deepEqual(getCollisionWarnings('front', 18), []);
  assert.deepEqual(getCollisionWarnings('back', 18), []);
  assert.equal(Object.keys(VIEW_ZONES.front).length, 5);
  assert.equal(Object.keys(VIEW_ZONES.back).length, 5);
});

test('nombre largo y sponsor extremo activan error de ajuste, nunca overflow silencioso', () => {
  const short = fitText(sampleCtx, 'PÉREZ', VIEW_ZONES.back.surname, { minFont: 26, maxFont: 70 });
  assert.equal(short.fit, true);
  assert.ok(short.fontSize <= 70);
  const impossible = fitText(sampleCtx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ABCDEFGHIJKLMNOPQRSTUVWXYZ', VIEW_ZONES.front.team, { minFont: 38, maxFont: 68 });
  assert.equal(impossible.fit, false);
  assert.match(impossible.reason, /excesivo/);
});

test('la configuración serializada no contiene imágenes ni aprueba fabricación', () => {
  const o = serializeProposal({ ...DEFAULT_STATE, crest: 'data:secret', crestName: 'logo.png' });
  assert.equal(o.manufacturingApproved, false);
  assert.equal(o.containsCrestImage, false);
  assert.equal(JSON.stringify(o).includes('data:secret'), false);
  assert.match(o.profile, /^FCB_/);
  assert.equal(profileInfo().verifiedPrintScale, false);
});

test('el visor 3D y el editor son reales pero aislados de la landing y login', () => {
  assert.ok(markup.includes('id="webgl"'));
  assert.ok(markup.includes('id="flat-preview"'));
  assert.ok(viewer.includes("from 'three'"));
  assert.ok(viewer.includes('GLTFLoader'));
  assert.ok(viewer.includes('OrbitControls'));
  assert.ok(app.includes("import('./viewer.mjs')"));
  assert.ok(markup.includes('id="model-file"'));
  assert.ok(markup.includes('SIN HOMOLOGAR'));
  assert.ok(!/supabase\.co|createClient|service_role|api_key/.test(app + viewer));
  assert.ok(style.includes('@media'));
  for (const file of ['layout.mjs','viewer.mjs','app.mjs','styles.css','index.html','flat.mjs']) {
    assert.ok(existsSync(resolve(root, file)), file);
  }
});

test('presets explícitos en vez de colores inventados por HTML', () => {
  assert.equal(Object.keys(PRESETS).length, 4);
  assert.equal(PRESETS.oceano.base, '#102d50');
});


// Sección de regresión de GLB — independiente del render Three.js.
import { inspectGlb, projectedAtlasUV } from '../configurador-3d/model-audit.mjs';

function glbForTest(gltf) {
  const raw=Buffer.from(JSON.stringify(gltf),'utf8');
  const pad=(4-raw.length%4)%4;
  const chunk=Buffer.concat([raw,Buffer.alloc(pad,0x20)]);
  const header=Buffer.alloc(20);
  header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+chunk.length,8);
  header.writeUInt32LE(chunk.length,12);header.write('JSON',16);
  return Buffer.concat([header,chunk]);
}
const glbValid={asset:{version:'2.0'},meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3}]}],accessors:[{count:8},{count:8},{count:8},{count:36}],materials:[{name:'Fabric'}]};

test('auditoría GLB 2.0: inspecciona triángulos, materiales y cobertura UV',()=>{
 const result=inspectGlb(glbForTest(glbValid));
 assert.equal(result.triangles,12);assert.equal(result.meshes,1);
 assert.equal(result.uvCoverage,1);assert.equal(result.materials,1);
 assert.equal(result.missingNormals,0);
});

test('auditoría GLB rechaza cabeceras falsas, tamaños inconsistentes y versiones distintas de 2',()=>{
 const good=glbForTest(glbValid);
 const corrupt=Buffer.from(good);corrupt.writeUInt32LE(42,8);
 assert.throws(()=>inspectGlb(corrupt),/Longitud GLB/);
 const noHeader=Buffer.from(good);noHeader.write('BAD!',0);
 assert.throws(()=>inspectGlb(noHeader),/cabecera GLB/);
 const version=Buffer.from(good);version.writeUInt32LE(1,4);
 assert.throws(()=>inspectGlb(version),/2.0/);
});

test('GLB excesivo o con compresión no soportada no entra en GLTFLoader',()=>{
 const oversized=glbForTest({...glbValid, accessors:[{count:5},{count:5},{count:5},{count:2_000_000}]});
 assert.throws(()=>inspectGlb(oversized),/optimizar/);
 const compressed=glbForTest({...glbValid,extensionsRequired:['KHR_draco_mesh_compression']});
 assert.throws(()=>inspectGlb(compressed),/descodificador/);
});

test('atlas: la parte frontal y trasera ocupan mitades separadas y texto queda derecha arriba',()=>{
 const box={minX:-1,maxX:1,minY:0,maxY:10};
 assert.deepEqual(projectedAtlasUV({x:0,y:5,z:1},box),[.25,.5]);
 assert.deepEqual(projectedAtlasUV({x:0,y:5,z:-1},box),[.75,.5]);
 assert.deepEqual(projectedAtlasUV({x:1,y:10,z:1},box),[.5,1]);
 assert.deepEqual(projectedAtlasUV({x:1,y:10,z:-1},box),[.5,1]);
 assert.throws(()=>projectedAtlasUV({x:0,y:0,z:0},{minX:0,maxX:0,minY:0,maxY:1}),/Límites/);
});

test('GLB importado aplica atlas como material y desactiva planos flotantes',()=>{
 assert.match(viewer,/projectGarment\(gltf\.scene,atlas\)/);
 assert.match(viewer,/printFront\.mesh\.visible=false;printBack\.mesh\.visible=false/);
 assert.match(viewer,/atlas\.texture/);
 assert.ok(existsSync(resolve(root,'model-audit.mjs')));
});
