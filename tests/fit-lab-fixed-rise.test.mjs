import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,fixedShortKey} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
test('Length variants preserve the exact authored pelvis and rise rather than rescaling the whole short',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fixed-rise-'));
 try{
  await buildFixedShorts(join(dir,'shorts.json'));const data=JSON.parse(await readFile(join(dir,'shorts.json'),'utf8'));
  for(const size of Object.keys(SHORT_SIZES)){
   const base=data.patterns[fixedShortKey(size,SHORT_LENGTHS[0])];
   for(const length of SHORT_LENGTHS){
    const p=data.patterns[fixedShortKey(size,length)];assert.equal(p.nominal.riseIndependentOfLength,true);assert.equal(p.nominal.riseReferenceCm,33.5);
    assert.equal(p.positions.length,base.positions.length);assert.deepEqual(p.indices,base.indices);
    for(let i=0;i<p.positions.length;i+=3)if(-base.positions[i+1]*CM_PER_UNIT<33.49)assert.deepEqual(p.positions.slice(i,i+3),base.positions.slice(i,i+3));
    assert.equal(p.groups.length,1,'The smooth side colour band must not depend on coarse triangle groups');
   }
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Full reference uses the same kit and outer garment layer as the main viewer',async()=>{
 const s=await readFile(new URL('../configurador-3d/fit-lab/full-reference.mjs',import.meta.url),'utf8');
 assert.match(s,/kit\.attach\(shirt\)/);assert.match(s,/outerLayer\.setShorts\(shorts,true\)/);assert.match(s,/outerLayer\.render\(renderer,camera\)/);assert.match(s,/stencil:true/);assert.match(s,/originalExtended:false/);assert.match(s,/photographInvented:mode==='profiles'/);
});
