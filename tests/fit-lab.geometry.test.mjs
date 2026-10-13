import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreeTestJersey} from '../configurador-3d/free-test-jersey.mjs';
import {
  DEFAULT_FIT,createReferenceBody,deformBody,deformGarment,getBodyExtentAt
} from '../configurador-3d/fit-lab/fit-geometry.mjs';

const home=process.env.THREE_TEST_DIR;
if(!home){
  test('geometry lab requires Three.js', {skip:'THREE_TEST_DIR no disponible'},()=>{});
}else{
  const url=pathToFileURL(resolve(home,'node_modules/three/build/three.module.js')).href;
  const THREE=await import(url);
  const clone=(geometry)=>new Float32Array(geometry.getAttribute('position').array);
  const uv=(geometry)=>new Float32Array(geometry.getAttribute('uv').array);
  const differs=(a,b)=>a.some((v,i)=>Math.abs(v-b[i])>1e-6);
  function sectionExtent(mesh,y){
    const p=mesh.geometry.getAttribute('position');let x=0,z=0;
    for(let i=0;i<p.count;i++){
      if(Math.abs(p.getY(i)-y)<.04){
        x=Math.max(x,Math.abs(p.getX(i)));
        z=Math.max(z,Math.abs(p.getZ(i)));
      }
    }
    return {x,z};
  }

  test('dos geometrías independientes con referencias y materiales distintos',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    assert.equal(mannequin.userData.fitRole,'body');
    assert.ok(mannequin.geometry!==garment.children[0].geometry);
    assert.ok(mannequin.material!==garment.children[0].material);
    assert.equal(garment.children.filter(x=>x.isMesh).length,12);
    assert.ok(mannequin.geometry.getAttribute('position').count>2200);
  });
  test('Experimento A: al ampliar pecho corporal no cambia ni un vértice de la camiseta',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const g=garment.children[0],gBefore=clone(g.geometry),uvBefore=uv(g.geometry);
    deformBody(mannequin,DEFAULT_FIT);
    const before=sectionExtent(mannequin,.27);
    deformBody(mannequin,{...DEFAULT_FIT,bodyChestCm:115});
    const after=sectionExtent(mannequin,.27);
    assert.ok(after.x>before.x*1.20,'torso debe ensancharse al aumentar pecho');
    assert.ok(after.z>before.z*1.15,'torso debe abombarse en profundidad');
    assert.deepEqual(clone(g.geometry),gBefore);
    assert.deepEqual(uv(g.geometry),uvBefore);
  });
  test('Experimento B: ampliar pecho de la prenda aumenta ancho y profundidad sin mover el cuerpo',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const bodyBefore=clone(mannequin.geometry);
    const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
    const frontUV=uv(front.geometry);
    deformGarment(garment,DEFAULT_FIT);
    const before=sectionExtent(front,.27),positionBase=clone(front.geometry);
    deformGarment(garment,{...DEFAULT_FIT,garmentChestCm:132});
    const after=sectionExtent(front,.27);
    assert.ok(after.x>before.x*1.20,'frontal debe ensancharse');
    assert.ok(after.z>before.z*1.22,'debe abombarse el frente');
    assert.ok(differs(positionBase,clone(front.geometry)));
    assert.deepEqual(clone(mannequin.geometry),bodyBefore);
    assert.deepEqual(uv(front.geometry),frontUV);
  });
  test('Cadera cambia bajo sin desplazar escote; largo desplaza bajo sin modificar cuerpo',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const bodyBefore=clone(mannequin.geometry);
    const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
    deformGarment(garment,DEFAULT_FIT);
    const basePos=clone(front.geometry);
    const hipBefore=sectionExtent(front,-.98);
    deformGarment(garment,{...DEFAULT_FIT,garmentHipCm:145});
    assert.ok(sectionExtent(front,-.98).x>hipBefore.x*1.20);
    assert.deepEqual(clone(mannequin.geometry),bodyBefore);
    deformGarment(garment,{...DEFAULT_FIT,garmentLengthCm:78});
    const pos=front.geometry.getAttribute('position');
    let lower=0,highest=0;
    for(let i=0;i<pos.count;i++){
      const y=basePos[i*3+1],diff=pos.getY(i)-y;
      if(y< -1.16){lower++;assert.ok(diff<-.20)}
      if(y>1.08){highest++;assert.ok(Math.abs(diff)<.002)}
    }
    assert.ok(lower>0&&highest>0);
  });
  test('restablecimiento determinista: volver al estado base recupera vértices y mantiene UV',()=>{
    const group=createFreeTestJersey(THREE);
    const front=group.getObjectByName('NUBYRA_Test_Jersey_Front');
    deformGarment(group,DEFAULT_FIT);
    const original=clone(front.geometry),coords=uv(front.geometry);
    deformGarment(group,{...DEFAULT_FIT,garmentChestCm:78,garmentHipCm:136,garmentLengthCm:52});
    deformGarment(group,DEFAULT_FIT);
    assert.deepEqual(clone(front.geometry),original);
    assert.deepEqual(uv(front.geometry),coords);
    const mannequin=createReferenceBody(THREE);
    deformBody(mannequin,DEFAULT_FIT);
    const origBody=clone(mannequin.geometry);
    deformBody(mannequin,{...DEFAULT_FIT,bodyChestCm:120,bodyHipCm:75});
    deformBody(mannequin,DEFAULT_FIT);
    assert.deepEqual(clone(mannequin.geometry),origBody);
    assert.ok(getBodyExtentAt(mannequin,.28).halfWidth>.3);
  });
}
