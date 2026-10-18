import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export const PORTRAIT_SURFACE_VERSION='portrait-surface/1.0';
export const PORTRAIT_JOIN_Y=1.475;
const clamp=(t)=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const gauss=(v,c,w)=>Math.exp(-(((v-c)/w)**2));

/** A render-only head surface. Canonical body arrays and metric/collision data
 * are never touched. The neck seam and scalp stay in the canonical coordinates. */
export function buildPortraitSurface(base,index){
 const packed=[],ids=[];const map=new Map(),sourceByPosition=new Map();
 const positionKey=(x,y,z)=>Math.round(x*1e7)+':'+Math.round(y*1e7)+':'+Math.round(z*1e7);
 for(let i=0;i<index.count;i+=3){
  const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  if(!tri.some(j=>base[3*j+1]>PORTRAIT_JOIN_Y-.012))continue;
  for(const j of tri){if(!map.has(j)){map.set(j,packed.length/3);packed.push(base[j*3],base[j*3+1],base[j*3+2]);sourceByPosition.set(positionKey(base[j*3],base[j*3+1],base[j*3+2]),j);}ids.push(map.get(j));}
 }
 const raw=new T.BufferGeometry();raw.setAttribute('position',new T.Float32BufferAttribute(packed,3));raw.setIndex(ids);
 const merged=mergeVertices(raw,1e-7);raw.dispose();
 const p=merged.attributes.position,idx=merged.index,neighbors=Array.from({length:p.count},()=>new Set()),edges=new Map();
 for(let i=0;i<idx.count;i+=3){
  const tri=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
  for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],c=tri[(k+2)%3],key=Math.min(a,b)+':'+Math.max(a,b);
   neighbors[a].add(b);neighbors[b].add(a);
   if(!edges.has(key))edges.set(key,{a,b,opposite:[]});edges.get(key).opposite.push(c);
  }
 }
 const points=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i));
 const sources=points.map(v=>sourceByPosition.get(positionKey(v.x,v.y,v.z)));
 const bindings=sources.map(j=>[j,j]);
 const boundary=new Set();for(const e of edges.values())if(e.opposite.length!==2){boundary.add(e.a);boundary.add(e.b);}
 const weight=v=>smooth((v.y-(PORTRAIT_JOIN_Y+.004))/.023)*(1-smooth((v.y-1.643)/.030))*smooth((v.z-.04)/.035);
 const out=points.map((v,i)=>{
  if(boundary.has(i))return v.clone();
  const ns=[...neighbors[i]],n=ns.length,beta=n===3?3/16:3/(8*n),q=v.clone().multiplyScalar(1-n*beta);
  for(const j of ns)q.addScaledVector(points[j],beta);
  const delta=q.sub(v),maxMove=.0012;if(delta.length()>maxMove)delta.setLength(maxMove);
  return v.clone().addScaledVector(delta,weight(v));
 });
 for(const e of edges.values()){
  const midpoint=points[e.a].clone().add(points[e.b]).multiplyScalar(.5),q=midpoint.clone();
  if(e.opposite.length===2){q.multiplyScalar(.75).addScaledVector(points[e.opposite[0]],.125).addScaledVector(points[e.opposite[1]],.125);q.lerp(midpoint,1-weight(midpoint));}
  e.vertex=out.length;out.push(q);bindings.push([sources[e.a],sources[e.b]]);
 }
 const triangles=[];
 const edge=(a,b)=>edges.get(Math.min(a,b)+':'+Math.max(a,b)).vertex;
 for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);triangles.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
 // Display-only regional refinement. No global head scaling or body fitting.
 for(const v of out){
  const front=smooth((v.z-.118)/.015),eyeX=Math.abs(v.x)-.0315;
  const orbit=gauss(eyeX,0,.016)*front;
  v.y+=orbit*(.00060*gauss(v.y,1.584,.0035)-.00105*gauss(v.y,1.594,.0040));
  const width=1-smooth((Math.abs(v.x)-.018)/.012),w=width*smooth((v.z-.128)/.013);
  const seam=1.5232+.0006*(v.x/.023)**2+.00017*Math.cos(v.x/.023*5),dy=v.y-seam;
  // Compress, rather than cross, the two inner lip boundaries. Smooth monotone
  // mapping around the seam keeps a closed neutral reading and an actual cleft.
  v.y-=w*dy*.85*Math.exp(-((dy/.0034)**4));
  v.z+=w*.0018*gauss(dy,0,.0037)-w*.0017*gauss(v.y,1.532,.0058);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(out.flatMap(v=>v.toArray()),3));g.setIndex(triangles);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 const attachments=[];for(let i=0;i<out.length;i++)if(out[i].y<1.535){const [a,b]=bindings[i];attachments.push({vertex:i,a,b,basePoint:[(base[a*3]+base[b*3])/2,(base[a*3+1]+base[b*3+1])/2,(base[a*3+2]+base[b*3+2])/2]});}
 g.userData={attachments,version:PORTRAIT_SURFACE_VERSION,sourceVertices:p.count,sourceTriangles:idx.count/3,subdivision:1,joinY:PORTRAIT_JOIN_Y,scalpUnchanged:true,renderOnly:true};merged.dispose();
 return g;
}
