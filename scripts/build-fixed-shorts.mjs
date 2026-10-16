import {readFile,writeFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanOutfit} from '../configurador-3d/fit-lab/human-outfit.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,fixedShortKey} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {FIXED_SHORTS_VERSION,horizontalPerimeter} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
/** One build-time canonical authoring mannequin; current viewer measures never enter. */
export async function buildFixedShorts(destination){
 const b=await readFile('configurador-3d/fit-lab/assets/human-female.glb'),state=resolveState({bodyHeightCm:170,bodyChestCm:88,bodyHipCm:102});
 const body=updateHumanBody(await loadHumanBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),state),patterns={};
 try{for(const length of SHORT_LENGTHS){const authored=createHumanOutfit(body,state,{lengthCm:length}),src=authored.mesh.geometry.clone(),pos=src.attributes.position;
  const min=src.boundingBox.min.y,max=src.boundingBox.max.y;for(let i=0;i<pos.count;i++)pos.setY(i,(pos.getY(i)-max)/(max-min)*length/CM_PER_UNIT);
  const waist=horizontalPerimeter(src,-.001),hipY=-19/CM_PER_UNIT,hip=horizontalPerimeter(src,hipY);
  for(const size of Object.values(SHORT_SIZES)){const g=src.clone(),p=g.attributes.position;
   for(let i=0;i<p.count;i++){const w=Math.max(0,Math.min(1,-p.getY(i)*CM_PER_UNIT/19)),scale=(size.waistCm/waist)*(1-w)+(size.hipCm/hip)*w;p.setXYZ(i,p.getX(i)*scale,p.getY(i),p.getZ(i)*scale);}
   for(let pass=0;pass<3;pass++){const a=size.waistCm/horizontalPerimeter(g,-.001),h=size.hipCm/horizontalPerimeter(g,hipY);for(let i=0;i<p.count;i++){const w=Math.max(0,Math.min(1,-p.getY(i)*CM_PER_UNIT/19)),s=a*(1-w)+h*w;p.setX(i,p.getX(i)*s);p.setZ(i,p.getZ(i)*s);}}
   const key=fixedShortKey(size.code,length);patterns[key]={positions:Array.from(p.array),indices:Array.from(g.index.array),groups:g.groups,nominal:{...size,lengthCm:length,measuredWaistCm:horizontalPerimeter(g,-.001),measuredHipCm:horizontalPerimeter(g,hipY),riseReferenceCm:28,geometrySource:'fixed-canonical-pattern-proposal'}};g.dispose();
  }src.dispose();authored.destroy();}
 await writeFile(destination,JSON.stringify({version:FIXED_SHORTS_VERSION,industrialApproved:false,patterns}));
 }finally{body.geometry.dispose();body.material.dispose();}
}
