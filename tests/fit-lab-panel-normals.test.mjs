import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {createRestGarment} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {createSurfaceNormalReconciler} from '../configurador-3d/fit-lab/surface-normals.mjs';
function prepare() {
  const garment = createRestGarment(T,GARMENT_CATALOG['N1-2']);
  const surfaces = garment.children.filter(m=>m.isMesh&&!m.name.startsWith('trim-'));
  const ids = new Map(), maps = new Map();
  for (const mesh of surfaces) {
    const p=mesh.geometry.attributes.position, map=[];
    for(let i=0;i<p.count;i++) {
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
      if(!ids.has(key)) ids.set(key,ids.size); map.push(ids.get(key));
    }
    maps.set(mesh.name,map); mesh.geometry.computeVertexNormals();
  }
  return {garment,surfaces,maps};
}
function centerPairs(mesh,map) {
  const byId=new Map(), result=[], p=mesh.geometry.attributes.position;
  for(let i=0;i<map.length;i++) {
    if(Math.abs(p.getX(i))>1e-6) continue;
    if(byId.has(map[i])) result.push([byId.get(map[i]),i]); else byId.set(map[i],i);
  }
  return result;
}
function jump(mesh,pairs) {
  const n=mesh.geometry.attributes.normal;
  return Math.max(...pairs.map(([a,b])=>Math.hypot(n.getX(a)-n.getX(b),n.getY(a)-n.getY(b),n.getZ(a)-n.getZ(b))));
}
function dispose(garment) {
  const materials=new Set(); garment.traverse(m=>{if(m.isMesh){m.geometry.dispose();materials.add(m.material);}});for(const m of materials)m.dispose();
}
test('Worker-viewer normal reconciliation removes the false front/back center seam without moving fabric or UVs',()=>{
  const {garment,surfaces,maps}=prepare();
  const before=surfaces.map(m=>({position:m.geometry.attributes.position.array.slice(),uv:m.geometry.attributes.uv.array.slice(),index:m.geometry.index.array.slice(),normal:m.geometry.attributes.normal}));
  const panels=surfaces.filter(m=>m.name.includes('Jersey_'));
  const pairs=panels.map(m=>centerPairs(m,maps.get(m.name)));
  for(let i=0;i<panels.length;i++) {assert.ok(pairs[i].length>15); assert.ok(jump(panels[i],pairs[i])>.01,'baseline must reproduce a shading discontinuity');}
  // The Worker serializes its Map as a plain object; the render-side consumer must support it.
  const sync=createSurfaceNormalReconciler(surfaces,Object.fromEntries(maps)); sync();
  for(let i=0;i<panels.length;i++) assert.ok(jump(panels[i],pairs[i])<1e-7);
  for(let i=0;i<surfaces.length;i++) {
    const g=surfaces[i].geometry;
    assert.deepEqual(g.attributes.position.array,before[i].position);
    assert.deepEqual(g.attributes.uv.array,before[i].uv);
    assert.deepEqual(g.index.array,before[i].index);
    assert.equal(g.attributes.normal,before[i].normal);
  }
  // Every incoming frame recomputes per-panel normals. The reconciliation must be reusable.
  for(let frame=0;frame<3;frame++) {
    for(const m of surfaces)m.geometry.computeVertexNormals(); sync();
    for(let i=0;i<panels.length;i++)assert.ok(jump(panels[i],pairs[i])<1e-7);
  }
  dispose(garment);
});
test('Adapter Map and serialized Worker map give the same normal buffers',()=>{
  const {garment,surfaces,maps}=prepare();createSurfaceNormalReconciler(surfaces,maps)();
  const expected=surfaces.map(m=>m.geometry.attributes.normal.array.slice());
  for(const m of surfaces)m.geometry.computeVertexNormals();createSurfaceNormalReconciler(surfaces,Object.fromEntries(maps))();
  surfaces.forEach((m,i)=>assert.deepEqual(m.geometry.attributes.normal.array,expected[i]));dispose(garment);
});
test('Invalid normal maps fail explicitly',()=>{
  const {garment,surfaces}=prepare();assert.throws(()=>createSurfaceNormalReconciler(surfaces,{}),/Invalid cloth normal map/);dispose(garment);
});
test('Human Worker viewer reconciles normals after all surface updates and before trim updates',async()=>{
  const code=await readFile(new URL('../configurador-3d/fit-lab/human-viewer.mjs',import.meta.url),'utf8');
  assert.match(code,/reconcileSurfaceNormals=createSurfaceNormalReconciler/);
  const start=code.indexOf('worker.onmessage');const sync=code.indexOf('reconcileSurfaceNormals();',start);
  assert.ok(sync>code.indexOf('mesh.geometry.computeVertexNormals()',start));
  assert.ok(sync<code.indexOf('for(const {name,bindings}of trims)',start));
});
