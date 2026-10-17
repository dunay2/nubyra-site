import {SHORT_RISES,shortRiseKey} from '../configurador-3d/fit-lab/pattern-registry.mjs';
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
 const authored=createHumanOutfit(body,state,{lengthCm:50}),master=authored.mesh.geometry,source=master.attributes.position;
 const top=master.boundingBox.max.y,bottom=master.boundingBox.min.y;
 let crotchY=Infinity;for(let i=0;i<source.count;i++)if(Math.abs(source.getX(i))<.035)crotchY=Math.min(crotchY,source.getY(i));
 const oldRise=(top-crotchY)*CM_PER_UNIT,oldLength=(top-bottom)*CM_PER_UNIT,riseCm=33.5,hipDepth=19;
 if(!(oldRise>hipDepth&&oldLength>oldRise))throw Error('Invalid canonical shorts landmarks');
 try{for(const length of SHORT_LENGTHS){const src=master.clone(),pos=src.attributes.position;
  // Keep a single authored pelvis for every length. Only the leg portion changes;
  // the previous whole-height rescale made the short cut's rise artificially tiny.
  for(let i=0;i<pos.count;i++){
   const depth=(top-pos.getY(i))*CM_PER_UNIT;
   const fixedDepth=depth<=hipDepth?depth:depth<=oldRise?hipDepth+(depth-hipDepth)/(oldRise-hipDepth)*(riseCm-hipDepth):riseCm+(depth-oldRise)/(oldLength-oldRise)*(length-riseCm);
   pos.setY(i,-fixedDepth/CM_PER_UNIT);
  }
  const waist=horizontalPerimeter(src,-.001),hipY=-19/CM_PER_UNIT,hip=horizontalPerimeter(src,hipY);
  for(const size of Object.values(SHORT_SIZES)){const g=src.clone(),p=g.attributes.position;
   for(let i=0;i<p.count;i++){const w=Math.max(0,Math.min(1,-p.getY(i)*CM_PER_UNIT/19)),scale=(size.waistCm/waist)*(1-w)+(size.hipCm/hip)*w;p.setXYZ(i,p.getX(i)*scale,p.getY(i),p.getZ(i)*scale);}
   for(let pass=0;pass<3;pass++){const a=size.waistCm/horizontalPerimeter(g,-.001),h=size.hipCm/horizontalPerimeter(g,hipY);for(let i=0;i<p.count;i++){const w=Math.max(0,Math.min(1,-p.getY(i)*CM_PER_UNIT/19)),s=a*(1-w)+h*w;p.setX(i,p.getX(i)*s);p.setZ(i,p.getZ(i)*s);}}
   // Fixed medial-thigh ease belongs to the authored pattern. It does not
   // depend on the avatar and never changes waist, hip plane, rise or length.
   for(let i=0;i<p.count;i++){
    const depth=-p.getY(i)*CM_PER_UNIT,x=p.getX(i)*CM_PER_UNIT;
    if(depth>riseCm&&Math.abs(x)<6){const ease=1.2*Math.min(1,(depth-riseCm)/2)*(1-Math.abs(x)/6);p.setX(i,Math.sign(x)*Math.max(.006,Math.abs(x)-ease)/CM_PER_UNIT);}
   }
   const key=fixedShortKey(size.code,length);patterns[key]={positions:Array.from(p.array),indices:Array.from(g.index.array),groups:[{start:0,count:g.index.count,materialIndex:0}],nominal:{...size,lengthCm:length,measuredWaistCm:horizontalPerimeter(g,-.001),measuredHipCm:horizontalPerimeter(g,hipY),riseReferenceCm:riseCm,geometrySource:'fixed-canonical-pattern-proposal',riseIndependentOfLength:true}};g.dispose();
  }src.dispose();}
 const riseVariants={};
 for(const [key,base] of Object.entries(patterns))for(const rise of SHORT_RISES){
  if(rise===riseCm||rise>base.nominal.lengthCm-.5)continue;
  const positions=base.positions.slice(),length=base.nominal.lengthCm;
  for(let i=1;i<positions.length;i+=3){const d=-positions[i]*CM_PER_UNIT;
   const next=d<=hipDepth?d:d<=riseCm?hipDepth+(d-hipDepth)/(riseCm-hipDepth)*(rise-hipDepth):rise+(d-riseCm)/(length-riseCm)*(length-rise);
   positions[i]=Math.fround(-next/CM_PER_UNIT);
  }
  riseVariants[shortRiseKey(base.nominal.code,length,rise)]={...base,positions,nominal:{...base.nominal,patternId:`shorts/${base.nominal.code}/L${length}/R${rise}`,patternVersion:'3.0',riseReferenceCm:rise,riseCm:rise,riseVariant:true}};
 }
 await writeFile(destination,JSON.stringify({version:FIXED_SHORTS_VERSION,industrialApproved:false,patterns,riseVariants}));
 }finally{authored.destroy();body.geometry.dispose();body.material.dispose();}
}
