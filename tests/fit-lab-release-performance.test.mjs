import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createFixedShortFactory,FIXED_SHORTS_VERSION} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {authorShortPattern} from '../scripts/build-fixed-shorts.mjs';import {SHORT_SIZES} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {createOuterGarmentLayer} from '../configurador-3d/fit-lab/outer-garment-layer.mjs';
import {MeshBVH} from 'three-mesh-bvh';import {createStaticMeshQuery} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
test('Only selected short templates are allocated, reused, immutable and released',()=>{
 const raw=authorShortPattern(SHORT_SIZES['N1-2'],42,33.5),before=JSON.stringify(raw),f=createFixedShortFactory({version:FIXED_SHORTS_VERSION,patterns:{'N1-2-42':raw},riseVariants:{}});
 assert.equal(f.stats().allocatedTemplates,0);const a=f.template(),b=f.template();assert.strictEqual(a.geometry,b.geometry);assert.equal(f.stats().allocatedTemplates,1);assert.equal(JSON.stringify(raw),before);
 assert.deepEqual(Array.from(a.geometry.attributes.position.array),raw.positions);assert.throws(()=>f.template({size:'N1-3'}));assert.equal(f.stats().allocatedTemplates,1);
 let disposed=0;a.geometry.addEventListener('dispose',()=>disposed++);f.destroy();f.destroy();assert.equal(disposed,1);assert.throws(()=>f.template());
});
test('Moving cloth query invalidates cached hits and stays equivalent to canonical BVH',()=>{
 const g=new T.SphereGeometry(1,24,18);g.clearGroups();g.boundsTree=new MeshBVH(g);const query=createStaticMeshQuery(g),a={point:new T.Vector3()},b={point:new T.Vector3()};
 for(let pass=0;pass<3;pass++){
  if(pass){const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+.15);p.needsUpdate=true;g.boundsTree.refit();}
  for(let i=0;i<500;i++){const p=new T.Vector3(Math.sin(i*2.399)*1.8,Math.cos(i*.713)*1.4,Math.sin(i*.349)*1.6);query.closestPointToPoint(p,a);g.boundsTree.closestPointToPoint(p,b);assert.ok(a.point.distanceTo(b.point)<1e-8);assert.ok(Math.abs(a.distance-b.distance)<1e-8);}
 }
 assert.equal(query.stats().rebuilds,3);g.dispose();
});
test('Depth layer cannot mask the foreground shorts with a background shirt silhouette',()=>{
 const layer=createOuterGarmentLayer(),shirt=new T.Group(),p=new T.PlaneGeometry(),shorts={mesh:new T.Mesh(p,[new T.MeshStandardMaterial()])};let passes=0;
 layer.bind(shirt);layer.setShorts(shorts,true);layer.render({render(){passes++;}},new T.Camera());
 assert.equal(passes,0);assert.equal(shorts.mesh.material[0].stencilWrite,false);assert.equal(shorts.mesh.material[0].depthTest,true);assert.equal(shorts.mesh.material[0].depthWrite,true);assert.equal(layer.snapshot().extraDrawPasses,0);
 layer.destroy();p.dispose();shorts.mesh.material[0].dispose();
});
