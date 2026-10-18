import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fullBodyFrustum,REFERENCE_HEIGHT_CM} from '../configurador-3d/fit-lab/comparison-frame.mjs';
import {simulationKey,SettledCache} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {createOuterGarmentLayer} from '../configurador-3d/fit-lab/outer-garment-layer.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';

test('Full-body comparison has identical horizontal/vertical metric scale at all widths',()=>{
 for(const [w,h] of [[920,610],[700,480],[250,430],[160,430]]){
  const a=fullBodyFrustum(w,h,{floorY:-4.5});
  assert.ok(Math.abs(w/(a.right-a.left)-h/(a.top-a.bottom))<1e-10);
  assert.ok(a.floorFraction*h-195*a.pxPerCm>0);
  assert.ok(REFERENCE_HEIGHT_CM*a.pxPerCm<h);
  assert.equal(a.targetY,-4.5+a.half*.84);
  const b=fullBodyFrustum(w,h,{floorY:-2.5});assert.equal(a.half,b.half);
 }
 assert.throws(()=>fullBodyFrustum(0,100,{floorY:0}));
});
test('Cache keys separate poses, bodies and garments; requested lengths do not deform a fixed pattern',()=>{
 const a=resolveState({selectionMode:'manual',activeConfiguration:'N1-1'});
 assert.equal(simulationKey(a),simulationKey({...a,desiredLengthCm:75}));
 for(const key of ['bodyChestCm','bodyHipCm','bodyHeightCm','armLoweringDeg','frontVolume','sideVolume','backVolume'])assert.notEqual(simulationKey(a),simulationKey({...a,[key]:a[key]+1}));
 assert.notEqual(simulationKey(a),simulationKey({...a,activeConfiguration:'N1-2'}));
 const c=new SettledCache(2);c.set('a',1);c.set('b',2);assert.equal(c.get('a'),1);c.set('c',3);assert.equal(c.get('b'),undefined);assert.equal(c.entries.size,2);
});
test('Physical layer adapter never paints a rear silhouette over the foreground short',()=>{
 const layer=createOuterGarmentLayer(),shirt=new T.Group(),g=new T.PlaneGeometry(1,1),mesh=new T.Mesh(g,new T.MeshStandardMaterial());shirt.add(mesh);
 const shortGeometry=new T.SphereGeometry(),m1=new T.MeshStandardMaterial(),m2=m1.clone(),shorts={mesh:new T.Mesh(shortGeometry,[m1,m2])};
 const before=g.attributes.position.array.slice(),shortBefore=shortGeometry.attributes.position.array.slice();
 layer.bind(shirt);layer.setShorts(shorts,true);let observed;
 layer.render({render(scene){observed=scene;}},new T.Camera());
 assert.equal(observed,undefined);assert.equal(m1.stencilWrite,false);assert.equal(m1.depthTest,true);assert.equal(m1.depthWrite,true);assert.equal(layer.snapshot().method,'depth-tested-physical-layers');
 assert.deepEqual(g.attributes.position.array,before);assert.deepEqual(shortGeometry.attributes.position.array,shortBefore);
 layer.setShorts(shorts,false);assert.equal(m1.stencilWrite,false);assert.equal(layer.snapshot().enabled,false);
 let disposed=0;g.addEventListener('dispose',()=>disposed++);layer.destroy();assert.equal(disposed,0);
 g.dispose();mesh.material.dispose();shortGeometry.dispose();m1.dispose();m2.dispose();
});
