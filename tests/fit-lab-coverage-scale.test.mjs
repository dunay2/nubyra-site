import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {readFile} from 'node:fs/promises';
import {REFERENCE_PROFILES,referenceImagePlacement} from '../configurador-3d/fit-lab/reference-profiles.mjs';
import {createShortSurfaceCollider} from '../configurador-3d/fit-lab/shorts-contact.mjs';
import {createStaticMeshQuery} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
import {MeshBVH} from 'three-mesh-bvh';
const assets=JSON.parse(await readFile(new URL('../configurador-3d/fit-lab/assets/reference-profiles.json',import.meta.url),'utf8')).assets;
test('Every reference retains its aspect ratio, common projected scale and floor through zoom/pan',()=>{
 for(const profile of REFERENCE_PROFILES)for(const zoom of [.35,1,2,5])for(const floorPx of [220,550,980]){
  const a=assets[profile.id],metrics={pxPerCm:2.5*zoom,floorPx};const p=referenceImagePlacement({profile,asset:a,metrics});
  assert.ok(Math.abs(p.top+p.height*a.feet-floorPx)<1e-9);assert.ok(Math.abs(p.top+p.height*a.head-(floorPx-profile.heightCm*metrics.pxPerCm))<1e-9);assert.ok(Math.abs(p.width/p.height-a.width/a.height)<1e-12);
 }
});
test('Moving BVH nearest queries invalidate exact caches when positions change',()=>{
 const g=new T.SphereGeometry(1,16,12);g.clearGroups();g.boundsTree=new MeshBVH(g);const q=createStaticMeshQuery(g),a={point:new T.Vector3()},b={point:new T.Vector3()};
 for(let step=0;step<3;step++){
  const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+.07);p.needsUpdate=true;g.boundsTree.refit();
  for(let i=0;i<80;i++){const x=new T.Vector3(Math.sin(i)*1.3,Math.cos(i*2)*1.4,Math.sin(i*1.9)*1.5);q.closestPointToPoint(x,a);g.boundsTree.closestPointToPoint(x,b);assert.ok(a.point.distanceTo(b.point)<1e-10);assert.ok(Math.abs(a.distance-b.distance)<1e-10);}
 }
 assert.equal(q.stats().rebuilds,3);g.dispose();
});
test('Moving short surface keeps signed contact while exact traversal is accelerated',()=>{
 const g=new T.CylinderGeometry(.6,.8,1,16,6,true);g.clearGroups();const positions=g.attributes.position.array.slice();let dz=0;
 const cloth={template:{geometry:g},render(){const p=positions.slice();for(let i=2;i<p.length;i+=3)p[i]+=dz;return p;}};
 const base={geometry:g,shoulderHalfWidth:1,neckHalfWidth:.2,surfaceHeight:()=>1,gap:()=>Infinity,project:()=>null,stats:()=>({})};const c=createShortSurfaceCollider(base,cloth);
 const first=c.gap(0,0,1);dz=.2;c.sync();const second=c.gap(0,0,1);assert.ok(second<first);assert.ok(c.stats().shortNearestQuery.rebuilds>=2);assert.equal(c.stats().visualExtrusion,false);c.destroy();g.dispose();
});
