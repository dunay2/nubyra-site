import {CM_PER_UNIT} from './body-surface.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
/** Technical sports-bra reference clipped from the visible torso triangles.
 * No breast-support force, compression model, inferred underbust measurement or size claim.
 */
export function createBustReference(T,body,state){
 const p=body.geometry.attributes.position,n=body.geometry.attributes.normal,index=body.geometry.index.array;
 const {chestY,shoulderY}=body.userData,scale=state.bodyHeightCm/160;
 const bottom=chestY-.34*scale,bandTop=bottom+.085*scale,neckline=chestY+.26*scale,offset=.15/CM_PER_UNIT;
 const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)];
 function clip(poly,field){const output=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],fa=field(a),fb=field(b);
  if(fa>=0)output.push(a);if((fa<0)!==(fb<0))output.push(mix(a,b,fa/(fa-fb)));
 }return output;}
 const top=v=>{const c=Math.abs(v[0])/Math.max(.0001,Math.hypot(v[0],v[2]));return neckline+(shoulderY+.30*scale-neckline)*smooth((c-.62)/.30);};
 // Elliptic side openings leave a band below and a supported strip above the shoulder.
 const armhole=v=>{const angle=Math.atan2(v[2],Math.abs(v[0]));return (angle/.35)**2+((v[1]-(chestY+.20*scale))/(.19*scale))**2-1;};
 const positions=[],normals=[],indices=[],counts=[],vertices=new Map();
 function add(poly){if(poly.length<3)return;const ids=[];
  for(const v of poly){const norm=Math.hypot(v[3],v[4],v[5])||1,point=[v[0]+offset*v[3]/norm,v[1]+offset*v[4]/norm,v[2]+offset*v[5]/norm],key=point.map(x=>Math.round(x*1e8)).join(',');
   if(!vertices.has(key)){vertices.set(key,positions.length/3);positions.push(...point);normals.push(v[3]/norm,v[4]/norm,v[5]/norm);}ids.push(vertices.get(key));
  }
  for(let i=1;i<ids.length-1;i++)if(ids[0]!==ids[i]&&ids[0]!==ids[i+1]&&ids[i]!==ids[i+1])indices.push(ids[0],ids[i],ids[i+1]);
 }

 for(const band of [false,true]){const start=indices.length;
  for(let i=0;i<index.length;i+=3){let poly=[vertex(index[i]),vertex(index[i+1]),vertex(index[i+2])];
   if(poly.every(v=>v[1]<bottom)||poly.every(v=>v[1]>shoulderY+.30*scale))continue;
   for(const f of [v=>v[1]-bottom,v=>top(v)-v[1],armhole,band?v=>bandTop-v[1]:v=>v[1]-bandTop]){poly=clip(poly,f);if(!poly.length)break;}
   add(poly);
  }
  counts.push(indices.length-start);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(indices);g.addGroup(0,counts[0],0);g.addGroup(counts[0],counts[1],1);g.computeBoundingBox();g.computeBoundingSphere();
 const mat=new T.MeshStandardMaterial({color:0x254352,roughness:.94,side:T.DoubleSide}),band=mat.clone();band.color.set(0xd6a837);
 const mesh=new T.Mesh(g,[mat,band]);mesh.name='Guía visual · sujetador deportivo';
 return {mesh,snapshot:()=>({kind:'sports-bra-visual-guide',simulated:false,calibrated:false,bustPlaneY:chestY,underbustGuideY:bottom,offsetMm:1.5}),destroy(){g.dispose();mat.dispose();band.dispose();}};
}
