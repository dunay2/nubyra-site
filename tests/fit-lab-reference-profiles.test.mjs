import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REFERENCE_PROFILES,getReferenceProfile,nearestReferenceProfile,referenceImagePlacement} from '../configurador-3d/fit-lab/reference-profiles.mjs';
const assets=JSON.parse(await readFile(new URL('../configurador-3d/fit-lab/assets/reference-profiles.json',import.meta.url),'utf8'));
test('Eight sorted references have distinct images and explicit illustrative provenance',()=>{
 assert.equal(REFERENCE_PROFILES.length,8);assert.equal(new Set(REFERENCE_PROFILES.map(x=>x.id)).size,8);
 const hashes=new Set();for(const [i,p]of REFERENCE_PROFILES.entries()){
  assert.ok(Object.isFrozen(p));assert.equal(p.measurementSource,'illustrative-targets');assert.equal(p.anthropometryValidated,false);
  if(i)assert.ok(p.heightCm>REFERENCE_PROFILES[i-1].heightCm);
  const a=assets.assets[p.id],b=Buffer.from(a.data.split(',')[1],'base64');assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  assert.ok(a.head<a.feet);hashes.add(createHash('sha256').update(b).digest('hex'));
 }assert.equal(hashes.size,8);
});
test('Proximity includes stature and two circumferences, not mass, photo content or anatomy labels',()=>{
 for(const p of REFERENCE_PROFILES){const b={bodyHeightCm:p.heightCm,bodyChestCm:p.chestCm,bodyHipCm:p.hipCm};
  const result=nearestReferenceProfile(b);assert.equal(result.profile.id,p.id);assert.equal(result.score,0);assert.ok(result.withinCoverage);
  assert.deepEqual(nearestReferenceProfile({...b,weightKg:200}),result);assert.deepEqual(nearestReferenceProfile({...b,weightKg:20}),result);
 }
 const a=nearestReferenceProfile({bodyHeightCm:162,bodyChestCm:80,bodyHipCm:90}),b=nearestReferenceProfile({bodyHeightCm:162,bodyChestCm:96,bodyHipCm:108});assert.notEqual(a.profile.id,b.profile.id);
 assert.equal(nearestReferenceProfile({bodyHeightCm:210,bodyChestCm:140,bodyHipCm:150}).withinCoverage,false);
 for(const b of[null,{}, {bodyHeightCm:170,bodyChestCm:NaN,bodyHipCm:90},{bodyHeightCm:'170',bodyChestCm:80,bodyHipCm:90}])assert.equal(nearestReferenceProfile(b),null);
 assert.throws(()=>getReferenceProfile('missing'));
});
test('Image scale remains isotropic and feet share the model floor at three viewport scales',()=>{
 for(const p of REFERENCE_PROFILES)for(const pxPerCm of[.9,2,3.2]){
  const asset=assets.assets[p.id],r=referenceImagePlacement({profile:p,asset,metrics:{pxPerCm,floorPx:612}});
  assert.ok(Math.abs(r.width/r.height-asset.width/asset.height)<1e-12);
  assert.equal(r.feetPx,612);assert.ok(Math.abs(612-r.headPx-p.heightCm*pxPerCm)<1e-10);
  assert.ok(Math.abs(r.top+asset.feet*r.height-612)<1e-10);
 }
});
test('Reference selector cannot mutate body or pattern state, and original supplied photo remains in the UI',async()=>{
 const source=await readFile(new URL('../configurador-3d/fit-lab/reference-gallery.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/import .*?(human-body|fit-policy|pattern-registry|app\.mjs|human-simulation)/);
 const html=await readFile(new URL('../configurador-3d/fit-lab/index.html',import.meta.url),'utf8');
 assert.match(html,/id="fit-canvas"/);assert.match(html,/data-reference-mode="original"/);assert.match(html,/src="\.\/assets\/reference-user.webp"/);
});
