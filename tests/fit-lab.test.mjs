import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
  FIT_VERSION,DEFAULT_FIT,LIMITS,MODES,
  normalizeFit,serializeFit,nominalDifferences
} from '../configurador-3d/fit-lab/fit-geometry.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','configurador-3d','fit-lab');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const app=readFileSync(resolve(root,'app.mjs'),'utf8');
const viewer=readFileSync(resolve(root,'fit-viewer.mjs'),'utf8');
const css=readFileSync(resolve(root,'styles.css'),'utf8');

test('A/B: cinco variables del modelo y altura auxiliar están acotadas',()=>{
 assert.deepEqual(MODES,['body','garment']);
 assert.equal(Object.keys(LIMITS).length,6);
 assert.deepEqual(normalizeFit({bodyChestCm:999,garmentLengthCm:-2}),
   {...DEFAULT_FIT,bodyChestCm:120,garmentLengthCm:48});
 assert.equal(normalizeFit({bodyChestCm:'invalid'}).bodyChestCm,88);
});
test('las diferencias nominales usan entradas independientes y no pretenden certificar holgura',()=>{
 assert.deepEqual(nominalDifferences(DEFAULT_FIT),{chest:14,hip:14});
 assert.deepEqual(nominalDifferences({...DEFAULT_FIT,bodyChestCm:110}),{chest:-8,hip:14});
 const payload=serializeFit({...DEFAULT_FIT,bodyChestCm:110});
 assert.equal(payload.schema,FIT_VERSION);
 assert.equal(payload.status,'experimental-not-manufacturing-approved');
 assert.equal(payload.body.chestCm,110);
 assert.equal(payload.garment.chestTargetCm,102);
 assert.equal(payload.garment.lengthTargetCm,64);
 assert.match(payload.note,/NO son perímetros medidos/);
 assert.equal(JSON.stringify(payload).includes('password'),false);
});
test('pantalla A: controles del cuerpo; pantalla B: controles de prenda en grupos independientes',()=>{
 for(const id of ['mode-body','mode-garment','body-fields','garment-fields','bodyChestCm-range',
 'bodyChestCm-number','bodyHipCm-range','garmentChestCm-range','garmentChestCm-number',
 'garmentHipCm-range','garmentLengthCm-range','bodyHeightCm-number','reset-all'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<fieldset[^>]*id="garment-fields"[^>]*disabled/);
 assert.match(html,/Altura corporal \(auxiliar\)/);
 assert.match(html,/No hay fotos, medidas de jugadoras ni cálculo de tensión textil/);
 assert.match(html,/Ningún resultado permite aprobar una orden de producción/);
 assert.match(css,/@media\(max-width:620px\)/);
});
test('se congelan los campos de la otra malla en cada modo y se sincronizan dos entradas',()=>{
 assert.match(app,/\$\('body-fields'\)\.disabled=!body/);
 assert.match(app,/\$\('garment-fields'\)\.disabled=body/);
 assert.match(app,/range\.addEventListener\('input'/);
 assert.match(app,/numeric\.addEventListener\('change'/);
 assert.match(app,/viewer\.update\(state\)/);
 assert.match(app,/activeMode='body'/);
});
test('viewer renderiza dos referencias de geometría separadas y nunca reescala ambas automáticamente',()=>{
 assert.match(viewer,/createReferenceBody\(THREE\)/);
 assert.match(viewer,/createFreeTestJersey\(THREE\)/);
 assert.match(viewer,/pivot\.add\(mannequin,garment\)/);
 assert.match(viewer,/deformBody\(mannequin,v\)/);
 assert.match(viewer,/deformGarment\(garment,v\)/);
 assert.match(viewer,/mannequin!==garment/);
 assert.ok(!viewer.includes('MPFB2'),'no hay dependencia de Blender en el navegador');
});
