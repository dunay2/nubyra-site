import * as T from 'three';
import {createHumanCollider} from './human-body.mjs';
export const STATIC_QUERY_VERSION='exact-static-bvh/1.1';

/*! Triangle closest-point arithmetic adapted from THREE.Triangle.
 * The MIT License
 * Copyright © 2010-2025 three.js authors
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/** Exact nearest-point traversal for the static human collider.
 * Copies bounds using MeshBVH's public traverse API, never its binary/private layout.
 * Geometry edits invalidate both caches. Grouped and indirect trees fall back to
 * MeshBVH. No simplified body, distance grid or skipped contacts.
 */
export function createStaticMeshQuery(geometry) {
 const size=16384,mask=size-1,coordinates=new Float64Array(size*3),hits=new Float64Array(size*4),faces=new Int32Array(size).fill(-1);
 const seedSize=4096,seedMask=seedSize-1,seeds=new Float64Array(seedSize*3),seedValid=new Uint8Array(seedSize);
 let queries=0,rebuilds=0,fallbacks=0,memoReuse=0,seededQueries=0;
 let tree,position,index,version=-1,indexVersion=-1,bounds,left,right,offset,count,triangles,stack,scores,supported=false;
 function rebuild(){
  rebuilds++;faces.fill(-1);seedValid.fill(0);
  tree=geometry.boundsTree;position=geometry.attributes.position;index=geometry.index;
  if(!tree||!position||!index)throw Error('Closest query requires an indexed mesh with a BVH');
  version=position.version;indexVersion=index.version;
  supported=!tree.indirect&&geometry.groups.length===0&&geometry.drawRange.start===0;
  if(!supported)return;
  const boxes=[],ls=[],rs=[],os=[],cs=[],parents=[];
  tree.traverse((depth,leaf,box,a,b)=>{
   const id=ls.length;boxes.push(...box);ls.push(-1);rs.push(-1);os.push(leaf?a:0);cs.push(leaf?b:0);
   if(depth){const parent=parents[depth-1];if(ls[parent]<0)ls[parent]=id;else rs[parent]=id;}
   parents[depth]=id;
  });
  bounds=Float64Array.from(boxes);left=Int32Array.from(ls);right=Int32Array.from(rs);offset=Int32Array.from(os);count=Int32Array.from(cs);
  stack=new Int32Array(ls.length);scores=new Float64Array(ls.length);
  triangles=new Float64Array(index.count*3);
  for(let i=0;i<index.count;i++){const v=index.getX(i);triangles[i*3]=position.getX(v);triangles[i*3+1]=position.getY(v);triangles[i*3+2]=position.getZ(v);}
 }
 const distanceBox=(id,x,y,z)=>{
  const k=id*6;
  const dx=x-Math.max(bounds[k],Math.min(bounds[k+3],x));
  const dy=y-Math.max(bounds[k+1],Math.min(bounds[k+4],y));
  const dz=z-Math.max(bounds[k+2],Math.min(bounds[k+5],z));
  return dx*dx+dy*dy+dz*dz;
 };
 function closestPointToPoint(point,target){
  const x=point.x,y=point.y,z=point.z;queries++;
  if(tree!==geometry.boundsTree||position!==geometry.attributes.position||index!==geometry.index||version!==position.version||indexVersion!==index.version)rebuild();
  if(!supported){fallbacks++;return tree.closestPointToPoint(point,target,0,Infinity);}
  const slot=(Math.imul(Math.floor(x*100003),73856093)^Math.imul(Math.floor(y*100003),19349663)^Math.imul(Math.floor(z*100003),83492791))&mask,k=slot*3,h=slot*4;
  if(faces[slot]>=0&&coordinates[k]===x&&coordinates[k+1]===y&&coordinates[k+2]===z){memoReuse++;target.point.set(hits[h],hits[h+1],hits[h+2]);target.distance=hits[h+3];target.faceIndex=faces[slot];return target;}
  // A previous point ON this unchanged surface is an upper bound, not the answer.
  // Hash collisions can only weaken the bound. Traverse in canonical near-first
  // order and include equal bounds, preserving shared-edge/vertex tie breaking.
  const seedSlot=(Math.imul(Math.floor(x*16),73856093)^Math.imul(Math.floor(y*16),19349663)^Math.imul(Math.floor(z*16),83492791))&seedMask,sk=seedSlot*3;
  let seedLimit=Infinity;
  if(seedValid[seedSlot]){const dx=x-seeds[sk],dy=y-seeds[sk+1],dz=z-seeds[sk+2],d=dx*dx+dy*dy+dz*dz;seedLimit=d+1e-10*(1+d);seededQueries++;}
  let top=1,best=Infinity,face=-1,hx=0,hy=0,hz=0;stack[0]=0;scores[0]=0;
  while(top){
   --top;const node=stack[top];if(scores[top]>=best||scores[top]>seedLimit)continue;
   if(count[node]){
    const end=offset[node]+count[node];
    for(let f=offset[node];f<end;f++){
     const i=f*9,t=triangles;
     const ax=t[i],ay=t[i+1],az=t[i+2],bx=t[i+3],by=t[i+4],bz=t[i+5],cx=t[i+6],cy=t[i+7],cz=t[i+8];
     const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az;
     const apx=x-ax,apy=y-ay,apz=z-az,d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
     let qx,qy,qz;
     if(d1<=0&&d2<=0){qx=ax;qy=ay;qz=az;}
     else{
      const bpx=x-bx,bpy=y-by,bpz=z-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
      if(d3>=0&&d4<=d3){qx=bx;qy=by;qz=bz;}
      else{
       const vc=d1*d4-d3*d2;
       if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);qx=ax+abx*v;qy=ay+aby*v;qz=az+abz*v;}
       else{
        const cpx=x-cx,cpy=y-cy,cpz=z-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
        if(d6>=0&&d5<=d6){qx=cx;qy=cy;qz=cz;}
        else{
         const vb=d5*d2-d1*d6;
         if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);qx=ax+acx*w;qy=ay+acy*w;qz=az+acz*w;}
         else{
          const va=d3*d6-d5*d4;
          if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));qx=bx+(cx-bx)*w;qy=by+(cy-by)*w;qz=bz+(cz-bz)*w;}
          else{const den=1/(va+vb+vc),v=vb*den,w=vc*den;qx=(ax+abx*v)+acx*w;qy=(ay+aby*v)+acy*w;qz=(az+abz*v)+acz*w;}
         }
        }
       }
      }
     }
     const dx=x-qx,dy=y-qy,dz=z-qz,d=dx*dx+dy*dy+dz*dz;
     if(d<best){best=d;face=f;hx=qx;hy=qy;hz=qz;}
    }
   }else{
    let near=left[node],far=right[node],dn=distanceBox(near,x,y,z),df=distanceBox(far,x,y,z);
    if(df<dn){const id=near,d=dn;near=far;dn=df;far=id;df=d;}
    if(df<best&&df<=seedLimit){stack[top]=far;scores[top++]=df;}
    if(dn<best&&dn<=seedLimit){stack[top]=near;scores[top++]=dn;}
   }
  }
  if(face<0){fallbacks++;return tree.closestPointToPoint(point,target,0,Infinity);}
  target.point.set(hx,hy,hz);target.distance=Math.sqrt(best);target.faceIndex=face;
  coordinates[k]=x;coordinates[k+1]=y;coordinates[k+2]=z;hits[h]=hx;hits[h+1]=hy;hits[h+2]=hz;hits[h+3]=target.distance;faces[slot]=face;
  seeds[sk]=hx;seeds[sk+1]=hy;seeds[sk+2]=hz;seedValid[seedSlot]=1;
  return target;
 }
 return {closestPointToPoint,stats:()=>({queries,rebuilds,fallbacks,version:STATIC_QUERY_VERSION,cachedTriangles:supported?index.count/3:0,memoReuse,memoCapacity:size,seededQueries,seedCapacity:seedSize})};
}

/** The same signed-gap/projection formula as createHumanCollider; only the
 * nearest-point traversal is accelerated. Body topology and material are untouched.
 */
export function createOptimizedHumanCollider(body) {
 const original=createHumanCollider(body),geometry=body.geometry,query=createStaticMeshQuery(geometry);
 const point=new T.Vector3(),hit={point:new T.Vector3(),distance:Infinity,faceIndex:0};
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),tri=new T.Triangle(a,b,c),normal=new T.Vector3(),delta=new T.Vector3(),out=[0,0,0];let queries=0;
 function gap(x,y,z){
  queries++;point.set(x,y,z);query.closestPointToPoint(point,hit);
  const p=geometry.attributes.position,index=geometry.index,f=hit.faceIndex*3;
  a.fromBufferAttribute(p,index.getX(f));b.fromBufferAttribute(p,index.getX(f+1));c.fromBufferAttribute(p,index.getX(f+2));
  tri.getNormal(normal);delta.subVectors(point,hit.point);return delta.dot(normal)<0?-hit.distance:hit.distance;
 }
 return {...original,gap,project(x,y,z,margin){
  const distance=gap(x,y,z);if(distance>=margin)return null;
  if(hit.distance>1e-9)normal.copy(delta).multiplyScalar((distance<0?-1:1)/hit.distance);
  out[0]=hit.point.x+normal.x*margin;out[1]=hit.point.y+normal.y*margin;out[2]=hit.point.z+normal.z*margin;return out;
 },stats:()=>({...original.stats(),queries,nearestQuery:query.stats()})};
}
