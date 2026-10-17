import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {CM_PER_UNIT} from './body-surface.mjs';

/** Local dressed-surface clearance. Rest patterns, anatomy, Y/rise and length
 * are immutable. Front/back depth can move by at most 3 cm; no body masking. */
export function clearFixedShortContact(geometry,body,{clearanceCm=.30,maxOffsetCm=3,passes=4}={}) {
 const p=geometry.attributes.position,index=geometry.index,source=new T.BufferGeometry();
 const base=body.userData.base,bi=body.geometry.index,ids=[];
 source.setAttribute('position',body.geometry.attributes.position.clone());
 for(let i=0;i<bi.count;i+=3){const tri=[bi.getX(i),bi.getX(i+1),bi.getX(i+2)];
  if(tri.every(j=>base[j*3+1]<1.24&&Math.abs(base[j*3])<.205))ids.push(...tri);
 }
 source.setIndex(ids);const tree=new MeshBVH(source),ray=new T.Ray(new T.Vector3(),new T.Vector3());
 const originalZ=new Float32Array(p.count);for(let i=0;i<p.count;i++)originalZ[i]=p.getZ(i);
 const corrections=new Float32Array(p.count),cap=maxOffsetCm/CM_PER_UNIT,margin=clearanceCm/CM_PER_UNIT;
 const waistY=body.userData.waistY,weights=[[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]];
 let queries=0,remaining=0,adjustedVertices=0,maxApplied=0;
 function deficiency(x,y,z,side){
  if(-y*CM_PER_UNIT<11.99)return 0;
  ray.origin.set(x,y+waistY,side*4);ray.direction.set(0,0,-side);queries++;
  const h=tree.raycastFirst(ray,T.DoubleSide);return h?Math.max(0,side*(h.point.z-z)+margin):0;
 }
 function visit(apply){
  let worst=0;
  for(let i=0;i<p.count;i++){
   const side=Math.sign(originalZ[i]);if(!side)continue;
   const d=deficiency(p.getX(i),p.getY(i),p.getZ(i),side);worst=Math.max(worst,d);if(apply)corrections[i]=Math.max(corrections[i],d);
  }
  for(let f=0;f<index.count;f+=3){const t=[index.getX(f),index.getX(f+1),index.getX(f+2)];
   const side=Math.sign(originalZ[t[0]]);if(!side||t.some(j=>Math.sign(originalZ[j])!==side))continue;
   for(const w of weights){let x=0,y=0,z=0;for(let k=0;k<3;k++){x+=p.getX(t[k])*w[k];y+=p.getY(t[k])*w[k];z+=p.getZ(t[k])*w[k];}
    const d=deficiency(x,y,z,side);worst=Math.max(worst,d);
    if(apply&&d>0)for(let k=0;k<3;k++)if(w[k]>0)corrections[t[k]]=Math.max(corrections[t[k]],d);
   }
  }
  return worst;
 }
 try{
  for(let pass=0;pass<passes;pass++){
   corrections.fill(0);if(visit(true)<1e-5)break;
   for(let i=0;i<p.count;i++)if(corrections[i]>0&&-p.getY(i)*CM_PER_UNIT>=11.99){const side=Math.sign(originalZ[i]);
    const moved=side*(p.getZ(i)-originalZ[i]);p.setZ(i,originalZ[i]+side*Math.min(cap,moved+corrections[i]));
   }
  }
  remaining=visit(false)*CM_PER_UNIT;
  for(let i=0;i<p.count;i++){const d=Math.abs(p.getZ(i)-originalZ[i])*CM_PER_UNIT;if(d>1e-5){adjustedVertices++;maxApplied=Math.max(maxApplied,d);}}
 }finally{source.dispose();}
 p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {method:'bounded-front-back-surface-contact',visualOnly:true,clearanceCm,maxAllowedOffsetCm:maxOffsetCm,
  adjustedVertices,maxOffsetCm:maxApplied,remainingDeficitCm:remaining,requiresReview:remaining>.1,
  queries,restPatternChanged:false,bodyChanged:false,lengthChanged:false,textileValidated:false};
}
