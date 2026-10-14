/** Trim attachments in the panel's material coordinates, not world-space offsets. */
import {Triangle,Vector3} from 'three';
export const MAX_TRIM_OFFSET=.006; // 1.59 mm on the shared metric model.
export function bindTrimToSurface(trim,panel,map,rest){
 const index=panel.geometry.index.array,triangles=[];
 for(let k=0;k<index.length;k+=3){
  const ids=[map[index[k]],map[index[k+1]],map[index[k+2]]];
  const triangle=new Triangle(...ids.map(id=>new Vector3(rest[3*id],rest[3*id+1],rest[3*id+2])));
  if(triangle.getArea()>1e-10)triangles.push({ids,triangle});
 }
 if(!triangles.length)throw Error('Trim requires a non-degenerate panel surface');
 const attribute=trim.geometry.getAttribute('position'),query=new Vector3(),closest=new Vector3(),bestPoint=new Vector3(),normal=new Vector3(),barycentric=new Vector3(),bindings=[];
 for(let i=0;i<attribute.count;i++){
  query.fromBufferAttribute(attribute,i);let distance=Infinity,best;
  for(const entry of triangles){entry.triangle.closestPointToPoint(query,closest);const d=query.distanceToSquared(closest);if(d<distance){distance=d;best=entry;bestPoint.copy(closest);}}
  best.triangle.getBarycoord(bestPoint,barycentric);best.triangle.getNormal(normal);
  const weights=[barycentric.x,barycentric.y,barycentric.z].map(v=>Math.max(0,Math.min(1,v))),total=weights.reduce((a,b)=>a+b,0);
  const offset=Math.max(-MAX_TRIM_OFFSET,Math.min(MAX_TRIM_OFFSET,query.sub(bestPoint).dot(normal)));
  bindings.push({ids:best.ids,weights:weights.map(v=>v/total),offset,normal:[normal.x,normal.y,normal.z]});
 }
 return bindings;
}
export function syncSurfaceTrim(attribute,bindings,positions){
 for(let i=0;i<bindings.length;i++){
  const {ids,weights,offset,normal:fallback}=bindings[i],[a,b,c]=ids.map(id=>id*3);
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2];
  const vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,ny,nz);
  if(length>1e-12){nx/=length;ny/=length;nz/=length;}else [nx,ny,nz]=fallback;
  attribute.setXYZ(i,weights[0]*positions[a]+weights[1]*positions[b]+weights[2]*positions[c]+offset*nx,
   weights[0]*positions[a+1]+weights[1]*positions[b+1]+weights[2]*positions[c+1]+offset*ny,
   weights[0]*positions[a+2]+weights[1]*positions[b+2]+weights[2]*positions[c+2]+offset*nz);
 }
 attribute.needsUpdate=true;
}
