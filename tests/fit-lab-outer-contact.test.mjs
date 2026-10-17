import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createShortsOuterContact} from '../configurador-3d/fit-lab/shorts-outer-contact.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
test('Outer contact moves only the overlapping cloth, restores cleanly, and never resizes the short',()=>{
 const garment=new T.Group(),g=new T.CylinderGeometry(.8,.8,1,96,16,true);g.translate(0,-.4,0);const shirt=new T.Mesh(g);garment.add(shirt);
 const inner=new T.CylinderGeometry(1,1,1,96,16,true);inner.translate(0,-.5,0);const mesh=new T.Mesh(inner),shorts={mesh,pattern:{riseReferenceCm:CM_PER_UNIT},lengthCm:CM_PER_UNIT};
 const original=g.attributes.position.array.slice(),fixed=inner.attributes.position.array.slice(),contact=createShortsOuterContact();
 contact.bind(garment,shorts);const first=g.attributes.position.array.slice();assert.ok(contact.snapshot().adjustedVertices>0);
 assert.deepEqual(inner.attributes.position.array,fixed);
 const p=g.attributes.position;for(let i=0;i<p.count;i++){assert.equal(p.getY(i),original[i*3+1]);if(original[i*3+1]>0)assert.deepEqual(Array.from(p.array.slice(i*3,i*3+3)),Array.from(original.slice(i*3,i*3+3)));}
 contact.apply();assert.deepEqual(g.attributes.position.array,first,'contact must not accumulate');
 mesh.position.y=-4;contact.apply();assert.deepEqual(g.attributes.position.array,original,'cloth must recover when the short no longer overlaps');
 assert.equal(contact.snapshot().visualOnly,true);contact.destroy();g.dispose();inner.dispose();shirt.material.dispose();mesh.material.dispose();
});
