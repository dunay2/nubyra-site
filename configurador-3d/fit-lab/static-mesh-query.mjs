import * as T from 'three';
import {createHumanCollider} from './human-body.mjs';

export const STATIC_QUERY_VERSION='exact-static-bvh/1.0';

/** Exact nearest-point queries for an unchanged indexed body between edits.
 * Copies the public BVH traversal into a flat array and caches immutable triangle
 * coordinates. No approximation, reduced mesh, search radius or changed contact rule.
 * Unsupported multi-root geometry falls back to the library implementation.
 */
export function createStaticMeshQuery(geometry) {
 let triangleData=new Float64Array();
 let triangleCount=0;
 const bounds=[],left=[],right=[],offset=[],count=[],parents=[];
 const memoSize=16384,memoMask=memoSize-1,memoCoordinates=new Float64Array(memoSize*3),memoHits=new Float64Array(memoSize*4),memoFaces=new Int32Array(memoSize).fill(-1);let memoReuse=0;
 let positionVersion=-1,indexVersion=-1,sourceTree=null,sourcePosition=null,sourceIndex=null,queries=0,rebuilds=0,fallbacks=0,supported=false;
 let bestDistanceSq,bestTriangle,bestX,bestY,bestZ,qx,qy,qz;
 function refresh() {
  const p=geometry.attributes.position,index=geometry.index,tree=geometry.boundsTree;
  if(!tree||!index)throw Error('Static mesh query requires an indexed BVH');
  if(sourceTree===tree&&sourcePosition===p&&sourceIndex===index&&positionVersion===p.version&&indexVersion===index.version)return;
  memoFaces.fill(-1);bounds.length=left.length=right.length=offset.length=count.length=parents.length=0;
  let covered=0;
  tree.traverse((depth,isLeaf,box,off,n)=>{
   const id=left.length;bounds.push(...box);left.push(-1);right.push(-1);offset.push(isLeaf?off:0);count.push(isLeaf?n:0);
   if(depth){const parent=parents[depth-1];if(left[parent]===-1)left[parent]=id;else right[parent]=id;}parents[depth]=id;
   if(isLeaf)covered+=n;
  });
  supported=covered===index.count/3;
  triangleCount=supported?index.count/3:0;triangleData=new Float64Array(triangleCount*15);
  for(let f=0;f<triangleCount;f++){
   const a=index.getX(f*3),b=index.getX(f*3+1),c=index.getX(f*3+2),i=f*15;
   const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),bx=p.getX(b),by=p.getY(b),bz=p.getZ(b),cx=p.getX(c),cy=p.getY(c),cz=p.getZ(c);
   triangleData.set([ax,ay,az,bx,by,bz,cx,cy,cz,bx-ax,by-ay,bz-az,cx-ax,cy-ay,cz-az],i);
  }
  sourcePosition=p;sourceIndex=index;
  sourceTree=tree;positionVersion=p.version;indexVersion=index.version;rebuilds++;
 }
 function score(node) {
  const i=node*6;
  const x=qx-Math.max(bounds[i],Math.min(bounds[i+3],qx)),y=qy-Math.max(bounds[i+1],Math.min(bounds[i+4],qy)),z=qz-Math.max(bounds[i+2],Math.min(bounds[i+5],qz));
  return x*x+y*y+z*z;
 }
 // Closest point by triangle Voronoi regions. Scalar arithmetic and its order
 // match Triangle.closestPointToPoint; edges are invariant during this request.
 function testTriangle(f) {
  const i=f*15,t=triangleData,ax=t[i],ay=t[i+1],az=t[i+2],bx=t[i+3],by=t[i+4],bz=t[i+5],cx=t[i+6],cy=t[i+7],cz=t[i+8];
  const abx=t[i+9],aby=t[i+10],abz=t[i+11],acx=t[i+12],acy=t[i+13],acz=t[i+14];
  const apx=qx-ax,apy=qy-ay,apz=qz-az,d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
  let x,y,z;
  if(d1<=0&&d2<=0){x=ax;y=ay;z=az;}
  else {
   const bpx=qx-bx,bpy=qy-by,bpz=qz-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
   if(d3>=0&&d4<=d3){x=bx;y=by;z=bz;}
   else {
    const vc=d1*d4-d3*d2;
    if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);x=ax+abx*v;y=ay+aby*v;z=az+abz*v;}
    else {
     const cpx=qx-cx,cpy=qy-cy,cpz=qz-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
     if(d6>=0&&d5<=d6){x=cx;y=cy;z=cz;}
     else {
      const vb=d5*d2-d1*d6;
      if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);x=ax+acx*w;y=ay+acy*w;z=az+acz*w;}
      else {
       const va=d3*d6-d5*d4;
       if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));x=bx+(cx-bx)*w;y=by+(cy-by)*w;z=bz+(cz-bz)*w;}
       else {const den=1/(va+vb+vc),v=vb*den,w=vc*den;x=(ax+abx*v)+acx*w;y=(ay+aby*v)+acy*w;z=(az+abz*v)+acz*w;}
      }
     }
    }
   }
  }
  const dx=qx-x,dy=qy-y,dz=qz-z,dist=dx*dx+dy*dy+dz*dz;
  if(dist<bestDistanceSq){bestDistanceSq=dist;bestTriangle=f;bestX=x;bestY=y;bestZ=z;}
 }
 function visit(node) {
  if(count[node]){
   for(let f=offset[node],end=f+count[node];f<end;f++)testTriangle(f);
   return;
  }
  let a=left[node],b=right[node],da=score(a),db=score(b);
  // Match the library's depth-first near-child order, including equal scores.
  if(db<da){const n=a;a=b;b=n;const d=da;da=db;db=d;}
  if(da<bestDistanceSq)visit(a);
  if(db<bestDistanceSq)visit(b);
 }
 function closestPointToPoint(point,target) {
  refresh();queries++;
  if(!supported){fallbacks++;return sourceTree.closestPointToPoint(point,target,0,Infinity);}
  qx=point.x;qy=point.y;qz=point.z;
  // Direct-mapped and bounded; collisions are misses, never approximate matches.
  // Checking all three doubles makes the hash harmless to numerical correctness.
  const slot=(Math.imul(Math.floor(qx*100003),73856093)^Math.imul(Math.floor(qy*100003),19349663)^Math.imul(Math.floor(qz*100003),83492791))&memoMask,k=slot*3,h=slot*4;
  if(memoFaces[slot]>=0&&memoCoordinates[k]===qx&&memoCoordinates[k+1]===qy&&memoCoordinates[k+2]===qz){memoReuse++;target.point.set(memoHits[h],memoHits[h+1],memoHits[h+2]);target.distance=memoHits[h+3];target.faceIndex=memoFaces[slot];return target;}
  bestDistanceSq=Infinity;bestTriangle=-1;
  visit(0);if(bestTriangle<0)return null;
  target.point.set(bestX,bestY,bestZ);target.distance=Math.sqrt(bestDistanceSq);target.faceIndex=bestTriangle;
  memoCoordinates[k]=qx;memoCoordinates[k+1]=qy;memoCoordinates[k+2]=qz;
  memoHits[h]=bestX;memoHits[h+1]=bestY;memoHits[h+2]=bestZ;memoHits[h+3]=target.distance;memoFaces[slot]=bestTriangle;
  return target;
 }
 return {closestPointToPoint,stats:()=>({queries,rebuilds,fallbacks,version:STATIC_QUERY_VERSION,cachedTriangles:triangleCount,memoReuse,memoCapacity:memoSize})};
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
