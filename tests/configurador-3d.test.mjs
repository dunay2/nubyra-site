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
  assert.match(app,/import\(\'\.\/viewer\.mjs(?:\?[^\']+)?\'\)/);
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
 assert.match(viewer,/projectGarment\(sourceScene,atlas,selected\)/);
 assert.match(viewer,/printFront\.mesh\.visible=false;printBack\.mesh\.visible=false/);
 assert.match(viewer,/atlas\.texture/);
 assert.ok(existsSync(resolve(root,'model-audit.mjs')));
});


// Modelo ClothingAxis aprobado: importar de forma local sin alojarlo en la web.
import { chooseModelFiles, inspectLocalGltf, MODEL_PROVENANCE, MODEL_LIMITS } from '../configurador-3d/model-package.mjs';
const mockFile=(name,size=1024)=>({name,size});

test('ClothingAxis registrado como candidato, sin presumir adquisición o autorización WebGL pública',()=>{
 assert.match(MODEL_PROVENANCE.product,/Basketball Tshirt/);
 assert.match(MODEL_PROVENANCE.uri,/cgtrader\.com/);
 assert.equal(MODEL_PROVENANCE.purchased,false);
 assert.equal(MODEL_PROVENANCE.publicEmbeddingAuthorized,false);
 assert.match(markup,/Girls Sleeveless Basketball Tshirt/);
});

test('GLB autocontenido: único archivo, límite de tamaño y mezclas bloqueadas',()=>{
 const chosen=chooseModelFiles([mockFile('CAMISETA.GLB',18_500_000)]);
 assert.equal(chosen.format,'glb');
 assert.equal(chosen.resources.size,0);
 assert.throws(()=>chooseModelFiles([mockFile('a.glb'),mockFile('b.gltf')]),/exactamente un/);
 assert.throws(()=>chooseModelFiles([mockFile('a.glb'),mockFile('material.png')]),/no válido/);
 assert.throws(()=>chooseModelFiles([mockFile('a.glb',MODEL_LIMITS.maxGlbBytes+1)]),/35 MB/);
});

test('glTF externo con BIN y texturas: dependencias detectadas y cobertura UV',()=>{
 const selection=chooseModelFiles([mockFile('modelo.gltf'),mockFile('cuerpo.bin'),mockFile('tejido.png'),mockFile('logo.jpg')]);
 assert.equal(selection.format,'gltf');
 const obj={...glbValid,buffers:[{uri:'cuerpo.bin',byteLength:48}],images:[{uri:'texturas/tejido.png'}]};
 const out=inspectLocalGltf(JSON.stringify(obj),selection.resources);
 assert.deepEqual(out.required.sort(),['cuerpo.bin','tejido.png']);
 assert.deepEqual(out.unused,['logo.jpg']);
 assert.equal(out.audit.triangles,12);
});

test('glTF bloquea URLs externas, path traversal, recursos faltantes y paquetes excesivos',()=>{
 const p=chooseModelFiles([mockFile('prenda.gltf'),mockFile('data.bin')]);
 const doc={...glbValid,buffers:[{uri:'https://externo.com/model.bin'}]};
 assert.throws(()=>inspectLocalGltf(JSON.stringify(doc),p.resources),/no segura/);
 doc.buffers[0].uri='../data.bin';
 assert.throws(()=>inspectLocalGltf(JSON.stringify(doc),p.resources),/no segura/);
 doc.buffers[0].uri='otra.bin';
 assert.throws(()=>inspectLocalGltf(JSON.stringify(doc),p.resources),/Faltan recursos/);
 assert.throws(()=>chooseModelFiles([mockFile('a.gltf'),mockFile('dupe.png'),mockFile('dupe.png')]),/duplicado/);
 assert.throws(()=>chooseModelFiles([mockFile('a.gltf',1),mockFile('b.bin',MODEL_LIMITS.maxTotalBytes)]),/90 MB/);
});

test('integración del paquete y orientación presentes sin modificar la landing pública',()=>{
 assert.match(viewer,/async importFiles\(files/);
 assert.match(viewer,/manager\.setURLModifier/);
 assert.match(viewer,/URL\.revokeObjectURL/);
 assert.match(app,/viewer\.importFiles\(files/);
 assert.match(markup,/id="model-orientation"/);
 assert.match(markup,/id="model-file" multiple/);
 assert.match(markup,/no subiremos esos archivos a ningún servidor/);
 assert.ok(existsSync(resolve(root,'model-package.mjs')));
});


import { jerseySVG } from '../configurador-3d/flat.mjs';
test('marcajes del SVG ajustados al torso y render frontal/trasera sin fallos',()=>{
 const zones=VIEW_ZONES.front;
 assert.ok(zones.team.x>=240 && zones.sponsor.x>=250);
 assert.ok(zones.crest.x+zones.crest.width<790);
 const ctx={font:'',measureText(t){return {width:String(t).length*Number(this.font.match(/(\d+)px/)?.[1]||40)*.56}}};
 const front=jerseySVG(DEFAULT_STATE,'front',ctx);
 const back=jerseySVG(DEFAULT_STATE,'back',ctx);
 assert.ok(front.includes('NUBYRA CANARIAS'));
 assert.ok(back.includes('PÉREZ'));
 assert.doesNotMatch(front,/>NC<\/text>/);
 assert.doesNotMatch(front,/>N<\/text>/);
 assert.doesNotMatch(back,/>N<\/text>/);
});


import { describeGarmentMeshes, validateGarmentMeshChoice } from '../configurador-3d/mesh-selection.mjs';
function fixtureMeshes(){
  const objects=[
    {isMesh:true,name:'Jersey_Front',geometry:{attributes:{position:{count:900},uv:{count:900}}},material:{name:'jersey fabric'},userData:{}},
    {isMesh:true,name:'Shorts',geometry:{attributes:{position:{count:600}}},material:{name:'pants fabric'},userData:{}},
    {isMesh:true,name:'collar',geometry:{attributes:{position:{count:60}}},material:{name:'trim'},userData:{}}
  ];
  return {objects,traverse(cb){objects.forEach(cb)}};
}
test('candidatos de tejido distinguen camiseta, pantalón y ribete sin modificar materiales',()=>{
 const root=fixtureMeshes();
 const existing=root.objects.map(m=>m.material);
 const meshes=describeGarmentMeshes(root);
 assert.equal(meshes.length,3);
 assert.equal(meshes[0].candidate,true);
 assert.equal(meshes[1].candidate,false);
 assert.equal(meshes[2].candidate,false);
 assert.equal(meshes[0].triangles,300);
 assert.equal(meshes[0].uv,true);
 assert.deepEqual(root.objects.map(m=>m.material),existing);
});

test('selección de mallas es explícita y valida identidad, repetidos y límite',()=>{
 const meshes=describeGarmentMeshes(fixtureMeshes());
 assert.throws(()=>validateGarmentMeshChoice(meshes,[]),/al menos una/);
 assert.throws(()=>validateGarmentMeshChoice(meshes,['extraña']),/desconocida/);
 assert.deepEqual(validateGarmentMeshChoice(meshes,['garment-0','garment-0']),['garment-0']);
 assert.throws(()=>validateGarmentMeshChoice(
  Array.from({length:40},(_,id)=>({id:'x'+id})),
  Array.from({length:40},(_,id)=>'x'+id)
 ),/Demasiadas/);
});

test('el importador no altera automáticamente la malla y exige confirmar los marcajes',()=>{
 assert.match(viewer,/function restoreSurfaces\(\)/);
 assert.match(viewer,/function applyGarmentSelection\(ids\)/);
 assert.match(viewer,/meshCandidates:descriptors,projectedMeshes:0/);
 assert.match(viewer,/const selected=meshes.filter\(m=>chosen.includes/);
 assert.match(app,/displayGarmentMeshes\(report\.meshCandidates\|\|\[\]\)/);
 assert.match(app,/viewer\.applyGarmentSelection\(ids\)/);
 assert.match(markup,/id="mesh-list"/);
 assert.match(markup,/id="apply-meshes"/);
});

import { TEST_JERSEY_META, createFreeTestJersey } from '../configurador-3d/free-test-jersey.mjs';
const freeModelSource=readFileSync(resolve(root,'free-test-jersey.mjs'),'utf8');

test('modelo de prueba sin descarga: geometría propia NUBYRA y separada de ClothingAxis',()=>{
 assert.equal(TEST_JERSEY_META.license,'NUBYRA-internal-test');
 assert.equal(TEST_JERSEY_META.industrial,false);
 assert.equal(TEST_JERSEY_META.independentFromClothingAxis,true);
 assert.throws(()=>createFreeTestJersey(null),/Three.js/);
 assert.match(freeModelSource,/NUBYRA_Test_Jersey_Front/);
 assert.match(freeModelSource,/NUBYRA_Test_Jersey_Back/);
 assert.match(freeModelSource,/NUBYRA_Test_Side_Left/);
 assert.match(freeModelSource,/trim-front-neck/);
 assert.match(freeModelSource,/createFreeTestJersey/);
});

test('camiseta libre de ensayo recorre exportador glTF, importador y mallas seleccionadas',()=>{
 assert.match(viewer,/GLTFExporter/);
 assert.match(viewer,/async loadFreeTestJersey\(\)/);
 assert.match(viewer,/this\.importModel\(glb\)/);
 assert.match(app,/viewer\.loadFreeTestJersey\(\)/);
 assert.match(app,/filter\(m=>m\.candidate && \/Jersey_\(Front\|Back\)\/\.test\(m\.name\)\)/);
 assert.match(app,/viewer\.applyGarmentSelection\(\[\.\.\.accepted\]\)/);
 assert.match(markup,/id="try-free-model"/);
 assert.match(markup,/sin descargar archivos/);
 assert.match(style,/\.trial-model__button/);
});


test('el visor 3D y la vista SVG no dibujan logotipos fijos N/NC',()=>{
 const ctx={font:'',measureText(text){return {width:String(text).length*45*.56}}};
 const clean={...DEFAULT_STATE,team:'TELDE',surname:'RIOS',number:'10',
  sponsorFront:'',sponsorTop:'',sponsorBottom:'',crest:null,crestDataUrl:null};
 const front=jerseySVG(clean,'front',ctx,true),back=jerseySVG(clean,'back',ctx,true);
 for(const svg of [front,back]){
   assert.doesNotMatch(svg,/>N<\/text>/);
   assert.doesNotMatch(svg,/>NC<\/text>/);
   assert.doesNotMatch(svg,/<g transform=/);
   assert.doesNotMatch(svg,/x="278" y="307"/);
 }
 assert.match(front,/>TELDE<\/text>/);
 assert.match(back,/>RIOS<\/text>/);
 assert.match(back,/>10<\/text>/);
 const uploaded=jerseySVG({...clean,crestDataUrl:'data:image/png;base64,AAAA'},'front',ctx);
 assert.match(uploaded,/<image href="data:image\/png;base64,AAAA"/);
 assert.doesNotMatch(uploaded,/>NC<\/text>/);
 const print=viewer.slice(viewer.indexOf('function drawPrint('),viewer.indexOf('/** Atlas'));
 assert.doesNotMatch(print,/printBlock\(ctx,z\.brand/);
 assert.doesNotMatch(print,/fillText\('NC'/);
 assert.match(print,/ctx\.drawImage\(state\.crest/);
 assert.match(print,/printBlock\(ctx,z\.number/);
});
