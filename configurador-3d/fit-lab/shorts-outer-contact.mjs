import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {CM_PER_UNIT} from './body-surface.mjs';
/** One-way VISUAL contact, restricted to the overlap. Never edits rest patterns,
 * the body, or the worker buffers. This is not a textile/elasticity solver. */
export function createShortsOuterContact(){
 let garment=null,shorts=null,original=[],table=null,lastGeometry=null;
 const rows=80,columns=96,margin=.45/CM_PER_UNIT;
 let depth=0,last={adjustedVertices:0,maxOffsetCm:0,requiresReview:false};
 function build(){
  if(!shorts||lastGeometry===shorts.mesh.geometry)return;
  lastGeometry=shorts.mesh.geometry;depth=Math.min(shorts.pattern.riseReferenceCm||33.5,shorts.lengthCm)/CM_PER_UNIT;
  const g=lastGeometry.clone(),tree=new MeshBVH(g),ray=new T.Ray(new T.Vector3(),new T.Vector3());table=new Float32Array((rows+1)*columns);
  try{for(let r=0;r<=rows;r++)for(let c=0;c<columns;c++){
   const a=c*2*Math.PI/columns,x=Math.sin(a),z=Math.cos(a),y=-Math.max(.0002,depth*r/rows);
   ray.origin.set(4*x,y,4*z);ray.direction.set(-x,0,-z);
   const hit=tree.raycastFirst(ray,T.DoubleSide);table[r*columns+c]=hit?Math.hypot(hit.point.x,hit.point.z):0;
  }}finally{g.dispose();}
 }
 function radius(y,theta){
  const rr=Math.max(0,Math.min(rows,-y/depth*rows)),r=Math.min(rows-1,Math.floor(rr)),v=rr-r;
  const cc=((theta/(2*Math.PI)%1)+1)%1*columns,c=Math.floor(cc)%columns,u=cc-Math.floor(cc),c1=(c+1)%columns;
  const a=table[r*columns+c]*(1-u)+table[r*columns+c1]*u,b=table[(r+1)*columns+c]*(1-u)+table[(r+1)*columns+c1]*u;
  return a*(1-v)+b*v;
 }
 function restore(){for(const {mesh,positions} of original){mesh.geometry.attributes.position.array.set(positions);mesh.geometry.attributes.position.needsUpdate=true;}}
 function apply(){
  if(!garment||!shorts||!table)return;restore();last={adjustedVertices:0,maxOffsetCm:0,requiresReview:false};
  for(const {mesh} of original){const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    const localY=p.getY(i)-shorts.mesh.position.y;if(localY>0||localY<-depth)continue;
    const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z);if(r<1e-6)continue;
    const outer=radius(localY,Math.atan2(x,z));if(!outer||r>=outer+margin)continue;
    const delta=outer+margin-r;last.maxOffsetCm=Math.max(last.maxOffsetCm,delta*CM_PER_UNIT);last.adjustedVertices++;
    const s=(outer+margin)/r;p.setX(i,x*s);p.setZ(i,z*s);
   }
   p.needsUpdate=true;mesh.geometry.computeBoundingSphere();
  }
  last.requiresReview=last.maxOffsetCm>3;
 }
 return {bind(next,inner){
   if(garment!==next){garment=next;original=[];next?.traverse(mesh=>{if(mesh.isMesh)original.push({mesh,positions:mesh.geometry.attributes.position.array.slice()});});}
   shorts=inner;build();apply();
  },capture(){for(const item of original)item.positions.set(item.mesh.geometry.attributes.position.array);apply();},apply,
  snapshot:()=>({...last,method:'sampled-fixed-short-envelope',visualOnly:true,bodyChanged:false,restPatternsChanged:false,textileValidated:false}),
  destroy(){original=[];table=null;lastGeometry=null;garment=null;shorts=null;}};
}
