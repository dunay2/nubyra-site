import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GARMENT_CATALOG,recommendPreviewConfiguration} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {JERSEY_PATTERNS,SHORT_PATTERNS,patternSpecification,FIT_POLICY_VERSION} from '../configurador-3d/fit-lab/pattern-registry.mjs';
import {evaluateJersey} from '../configurador-3d/fit-lab/fit-policy.mjs';
import {assessJersey} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {resolveState,transition} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createRestGarment} from '../configurador-3d/fit-lab/fit-mesh.mjs';
const dimensions={bodyHeightCm:170,bodyChestCm:88,bodyHipCm:96,desiredLengthCm:64};
test('Every proposed configuration is shared by registry, selector, renderer and assessment',()=>{
 assert.equal(GARMENT_CATALOG,JERSEY_PATTERNS);
 const r=recommendPreviewConfiguration(dimensions);
 assert.equal(r.hasConfiguration,true);
 for(const item of r.candidates){assert.deepEqual(item.assessment,evaluateJersey(GARMENT_CATALOG[item.code],dimensions));assert.equal(item.demoCoverage,item.assessment.recommendable);}
 assert.deepEqual(assessJersey({...dimensions,activeConfiguration:r.recommendedCode}),r.candidates.find(c=>c.code===r.recommendedCode).assessment);
 assert.equal(r.rulesVersion,FIT_POLICY_VERSION);
});
test('A tall narrow body gets no configuration when length is missing, never a wider substitute',()=>{
 const r=recommendPreviewConfiguration({...dimensions,bodyHeightCm:200,bodyChestCm:84,bodyHipCm:94,desiredLengthCm:76});
 assert.equal(r.recommendedCode,null);assert.equal(r.previewCode,null);assert.equal(r.hasConfiguration,false);assert.match(r.reason,/falta largo/);
 const a=evaluateJersey(GARMENT_CATALOG['N1-1'],{...dimensions,bodyHeightCm:200,bodyChestCm:84,bodyHipCm:94});
 assert.equal(a.blocked,false);assert.equal(a.status,'short');assert.equal(a.nominal.lengthCm,64);
});
test('Per-zone reasons distinguish missing circumference, ease and length; inputs fail closed',()=>{
 const a=evaluateJersey(GARMENT_CATALOG['N1-1'],{...dimensions,bodyChestCm:110,bodyHipCm:96});
 assert.equal(a.zones.chest.status,'too-small');assert.equal(a.zones.hip.status,'compatible');assert.equal(a.blocked,true);
 const r=recommendPreviewConfiguration({...dimensions,bodyChestCm:65,bodyHipCm:70});assert.equal(r.recommendedCode,null);
 for(const bad of[NaN,Infinity,null,'',-1])assert.throws(()=>recommendPreviewConfiguration({...dimensions,bodyChestCm:bad}),/inválida/);
});
test('Manual mode fixes the same pattern on three bodies; auto no-match never silently changes it',()=>{
 let s=resolveState({...dimensions,selectionMode:'manual',activeConfiguration:'N1-2'});
 const expected=patternSpecification(GARMENT_CATALOG[s.activeConfiguration]);const hashes=[];
 for(const height of[145,170,200]){
  s=transition(s,{type:'measure',key:'bodyHeightCm',value:height});assert.equal(s.activeConfiguration,'N1-2');assert.deepEqual(patternSpecification(GARMENT_CATALOG[s.activeConfiguration]),expected);
  const group=createRestGarment(T,GARMENT_CATALOG[s.activeConfiguration]);const h=createHash('sha256');group.traverse(m=>{if(m.isMesh)h.update(Buffer.from(m.geometry.attributes.position.array.buffer));});hashes.push(h.digest('hex'));
  group.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});
 }
 assert.equal(new Set(hashes).size,1);
 s=transition(s,{type:'measure',key:'desiredLengthCm',value:84});s=transition(s,{type:'mode',value:'auto'});assert.equal(s.recommendation.hasConfiguration,false);assert.equal(s.activeConfiguration,'N1-2');
});
test('Both garments have two bases and three positions; shorts waist does not pretend to be calibrated elastic',()=>{
 for(const catalog of[JERSEY_PATTERNS,SHORT_PATTERNS]){assert.equal(Object.keys(catalog).length,6);for(const base of['N1','N2'])assert.deepEqual(Object.values(catalog).filter(p=>p.base===base).map(p=>p.position),[1,2,3]);}
 for(const p of Object.values(SHORT_PATTERNS)){assert.equal(p.waistband.construction,'elastic-with-drawstring');assert.equal(p.waistband.usableMaxCm,null);assert.equal(p.material.calibrated,false);assert.equal(p.industrialApproved,false);assert.equal(Object.isFrozen(p),true);}
});
test('Original supplied photograph is preserved byte for byte',async()=>{
 const file=await readFile(new URL('../configurador-3d/fit-lab/assets/reference-user.webp',import.meta.url));
 const expected='e9d77444cb9bfee37667092dca2b1377dda4e5d992bfdc867ff50902cc683b3a';
 assert.equal(createHash('sha256').update(file).digest('hex'),expected);
 assert.ok(file.length>5000);
 const html=await readFile(new URL('../configurador-3d/fit-lab/index.html',import.meta.url),'utf8');assert.match(html,/data-reference-mode="original"/);assert.match(html,/reference-user.webp/);
});
