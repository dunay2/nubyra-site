import test from 'node:test';
import assert from 'node:assert/strict';
import {REFERENCE_PROFILES,referenceProfileMeasures,assessReferenceProfile,nearestReferenceProfile,getReferenceProfile} from '../configurador-3d/fit-lab/reference-profiles.mjs';
import {resolveState,transition} from '../configurador-3d/fit-lab/lab-model.mjs';
test('A profile atomically applies three body measures, preserving manual garment, length, pose and volumes',()=>{
 for(const p of REFERENCE_PROFILES){
  const previous=resolveState({selectionMode:'manual',activeConfiguration:'N1-2',desiredLengthCm:71,armLoweringDeg:20,frontVolume:6,sideVolume:4,backVolume:2});
  const next=transition(previous,{type:'reference-profile',id:p.id});
  assert.deepEqual([next.bodyHeightCm,next.bodyChestCm,next.bodyHipCm],[p.heightCm,p.chestCm,p.hipCm]);
  for(const key of['selectionMode','activeConfiguration','desiredLengthCm','armLoweringDeg','frontVolume','sideVolume','backVolume','garmentLengthCm','garmentChestCm','garmentHipCm'])assert.equal(next[key],previous[key],key);
  assert.equal(previous.bodyHeightCm,160);assert.equal(next.weightKg,undefined);assert.ok(Object.isFrozen(next));
 }assert.throws(()=>transition(resolveState({}),{type:'reference-profile',id:'invalid'}));
});
test('Selection ranges include endpoints, reject each outside axis and fail closed on invalid input',()=>{
 const p=getReferenceProfile('R02'),base=referenceProfileMeasures(p.id),a=assessReferenceProfile(p,base);
 assert.deepEqual(a.zones.map(z=>[z.min,z.max]),[[140,160],[74,98],[84,108]]);assert.ok(a.exact);
 for(const [key,lower,upper]of[['bodyHeightCm',140,160],['bodyChestCm',74,98],['bodyHipCm',84,108]]){
  for(const value of[lower,upper])assert.equal(assessReferenceProfile(p,{...base,[key]:value}).withinCoverage,true);
  for(const value of[lower-.01,upper+.01])assert.equal(assessReferenceProfile(p,{...base,[key]:value}).withinCoverage,false);
 }
 for(const bad of[null,{}, {...base,bodyHeightCm:NaN},{...base,bodyChestCm:'86'}])assert.equal(nearestReferenceProfile(bad),null);
});
test('Covered candidates take precedence over a closer excluded profile without mutating inputs',()=>{
 let nonNearestCovered=0;
 for(let h=135;h<=195;h+=3)for(let c=68;c<=118;c+=3)for(let hip=76;hip<=130;hip+=3){
  const body=Object.freeze({bodyHeightCm:h,bodyChestCm:c,bodyHipCm:hip}),all=REFERENCE_PROFILES.map(p=>assessReferenceProfile(p,body));
  const covered=all.filter(a=>a.withinCoverage),match=nearestReferenceProfile(body);assert.equal(match.withinCoverage,covered.length>0);
  const target=(covered.length?covered:all).sort((a,b)=>a.score-b.score||a.profile.id.localeCompare(b.profile.id))[0];assert.equal(match.profile.id,target.profile.id);
  if(covered.length&&all.sort((a,b)=>a.score-b.score)[0].withinCoverage===false)nonNearestCovered++;
  assert.deepEqual(body,{bodyHeightCm:h,bodyChestCm:c,bodyHipCm:hip});
 }assert.ok(nonNearestCovered>0);
});
test('Automatic proximity neither snaps exact values nor uses body mass; no-match is explicit',()=>{
 const body=Object.freeze({bodyHeightCm:162.5,bodyChestCm:87.3,bodyHipCm:95.2}),a=nearestReferenceProfile(body);
 assert.deepEqual(nearestReferenceProfile({...body,weightKg:999}),a);
 assert.deepEqual(body,{bodyHeightCm:162.5,bodyChestCm:87.3,bodyHipCm:95.2});
 assert.equal(nearestReferenceProfile({bodyHeightCm:210,bodyChestCm:120,bodyHipCm:130}).withinCoverage,false);
});
