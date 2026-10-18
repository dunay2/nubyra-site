import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {mountReleaseIdentity} from '../configurador-3d/fit-lab/release-identity.mjs';
const bytes=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
test('Integrated head has one skin batch, finite optical coordinates and a bounded rendering budget',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),resolveState({})),face=createHumanFace(body);
 try{
  const g=face.group.children[0].geometry,s=face.snapshot();
  assert.equal(s.displayHeadRefined,true);assert.equal(s.drawBatches,2);assert.equal(s.extraTextureRequests,0);
  assert.ok(s.skinVertices>15000&&s.skinVertices<18000);assert.ok(s.constructionVertices<25000);assert.equal(s.lashHairs,40);assert.ok(s.sampleQueries<=2000,'Aperture-fitted lashes must stay within the one-time sampling budget');
  assert.equal(g.groups[0].materialIndex,0);assert.equal(g.groups[1].materialIndex,1);
  for(const key of ['position','normal','color','eyeCoord'])assert.ok(g.attributes[key].array.every(Number.isFinite));
 }finally{face.destroy();body.geometry.dispose();body.material.dispose();}
});
test('Only verified commit IDs may be presented as a published build',async()=>{
 const label={dataset:{},textContent:'',title:'',removeAttribute(name){if(name==='data-commit')delete this.dataset.commit;}};
 const root={getElementById:()=>label};let options;
 const good=await mountReleaseIdentity({root,fetcher:async(_,o)=>{options=o;return {ok:true,json:async()=>({commit:'a'.repeat(40),faceVersion:'test-face'})};}});
 assert.equal(options.cache,'no-store');assert.equal(good.commit,label.dataset.commit);assert.equal(label.textContent,'Lab · aaaaaaa');
 const bad=await mountReleaseIdentity({root,fetcher:async()=>({ok:true,json:async()=>({commit:'local'})})});
 assert.equal(bad,null);assert.equal(label.dataset.commit,undefined);assert.match(label.textContent,/no verificada/);
 const unavailable=await mountReleaseIdentity({root,fetcher:async()=>{throw Error('offline');}});assert.equal(unavailable,null);
});
