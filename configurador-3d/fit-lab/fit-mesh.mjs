/** Metric synthetic bodies, fixed garment rest shapes and stitched cloth topology. */
import {createFreeTestJersey} from '../free-test-jersey.mjs';
import {ClothSolver} from './cloth-solver.mjs';
export const CM_PER_UNIT=64/2.42;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const gauss=x=>Math.exp(-x*x);
const ellipseA=(c,k=.58)=>c/(Math.PI*(3*(1+k)-Math.sqrt((3+k)*(1+3*k))))/CM_PER_UNIT;
export function createBody(T){
 const rows=44,around=56,positions=new Float32Array((rows+1)*(around+1)*3),indices=[];
 for(let r=0;r<rows;r++)for(let a=0;a<around;a++){const i=r*(around+1)+a,j=i+around+1;indices.push(i,j,i+1,i+1,j,j+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setIndex(indices);
 const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:0x68adbd,roughness:.72,side:T.DoubleSide}));mesh.userData={rows,around,fitRole:'body'};return mesh;
}
export function updateBody(mesh,state){
 const {rows,around}=mesh.userData,p=mesh.geometry.getAttribute('position'),chestRow=29,hipRow=4,scale=state.bodyHeightCm/160;
 for(let r=0;r<=rows;r++){
  const y0=-1.16+2.2*r/rows,y=1.20+(y0-1.20)*scale,t=clamp((r-hipRow)/(chestRow-hipRow));
  const target=r>chestRow?state.bodyChestCm*(1-.08*clamp((r-chestRow)/(rows-chestRow))):lerp(state.bodyHipCm,state.bodyChestCm,t)*(1-.07*Math.pow(Math.sin(t*Math.PI),2));
  const chest=gauss((y0-.28)/.48),hip=gauss((y0+1.0)/.45),ring=[];
  for(let a=0;a<around;a++){
   const angle=2*Math.PI*a/around,c=Math.cos(angle),s=Math.sin(angle);
   const x=c*(.43+.035*hip)*(1+(state.sideVolume-5)*.045*chest);
   const broad=Math.pow(Math.max(0,1-Math.pow(Math.abs(c),6)),.35);
   const forward=state.frontVolume*.028*gauss((y0-.27)/(.34+state.frontVolume*.014))*broad*Math.max(0,s);
   const z=s*(.22+.025*hip)*(1+(s<0?(state.backVolume-5)*.055*chest:0))+forward;
   ring.push([x,z]);
  }
  let perimeter=0;for(let a=0;a<around;a++){const b=(a+1)%around;perimeter+=Math.hypot(ring[a][0]-ring[b][0],ring[a][1]-ring[b][1]);}
  const factor=target/(perimeter*CM_PER_UNIT);
  for(let a=0;a<=around;a++){const [x,z]=ring[a%around];p.setXYZ(r*(around+1)+a,x*factor,y,z*factor);}
 }
 p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();
 mesh.userData.chestY=p.getY(chestRow*(around+1));mesh.userData.hipY=p.getY(hipRow*(around+1));
 return mesh;
}
export function createCollider(body){
 const p=body.geometry.getAttribute('position'),{rows,around}=body.userData,ys=[],rings=[];
 for(let r=0;r<=rows;r++){
  ys.push(p.getY(r*(around+1)));const ring=[];
  for(let a=0;a<around;a++){const i=r*(around+1)+a,x=p.getX(i),z=p.getZ(i);ring.push([Math.atan2(z,x),Math.hypot(x,z)]);}
  ring.sort((a,b)=>a[0]-b[0]);rings.push(ring);
 }
 const radial=(ring,theta)=>{
  let lo=0,hi=ring.length;while(lo<hi){const m=(lo+hi)>>1;if(ring[m][0]<theta)lo=m+1;else hi=m;}
  const a=ring[(lo-1+ring.length)%ring.length],b=ring[lo%ring.length];let ta=a[0],tb=b[0],q=theta;if(lo===0)ta-=2*Math.PI;if(lo===ring.length)tb+=2*Math.PI;
  return lerp(a[1],b[1],clamp((q-ta)/(tb-ta)));
 };
 const radius=(y,theta)=>{const f=clamp((y-ys[0])/(ys.at(-1)-ys[0]))*rows,r=Math.min(rows-1,Math.floor(f));return lerp(radial(rings[r],theta),radial(rings[r+1],theta),f-r);};
 const gap=(x,y,z)=>y<ys[0]-.08||y>ys.at(-1)+.03?Infinity:Math.hypot(x,z)-radius(y,Math.atan2(z,x));
 return {ys,radius,gap,project(x,y,z,margin){const g=gap(x,y,z);if(g>=margin)return null;const d=Math.hypot(x,z);if(d<1e-10)return [radius(y,0)+margin,y,0];const r=d-g+margin;return [x*r/d,y,z*r/d];}};
}
export function createRestGarment(T,configuration){
 const garment=createFreeTestJersey(T);
 // Resolution budget: retain the authored topology, sample a regular simulation grid.
 for(const mesh of garment.children.filter(m=>!m.name.startsWith('trim-'))){
  const panel=mesh.name.includes('Jersey_'),front=mesh.name.endsWith('Front'),oldRows=panel?48:28,oldCols=panel?15:10,rows=panel?24:14,cols=panel?8:5,halves=panel?2:1;
  const old=mesh.geometry,p=old.getAttribute('position'),uv=old.getAttribute('uv'),pos=[],tex=[],index=[];
  for(let half=0;half<halves;half++){
   const start=pos.length/3;
   for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
    const i=half*(oldRows+1)*(oldCols+1)+Math.round(r*oldRows/rows)*(oldCols+1)+Math.round(c*oldCols/cols);
    pos.push(p.getX(i),p.getY(i),p.getZ(i));tex.push(uv.getX(i),uv.getY(i));
   }
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=start+r*(cols+1)+c,b=a+cols+1;
    if(!panel||front===(half===1))index.push(a,a+1,b,a+1,b+1,b);else index.push(a,b,a+1,a+1,b,b+1);
   }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(tex,2));g.setIndex(index);g.userData={gridRows:rows,halfColumns:cols};g.computeVertexNormals();mesh.geometry=g;old.dispose();
 }
 garment.traverse(mesh=>{
  if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y0=p.getY(i),z=p.getZ(i),t=clamp((y0+.98)/1.25);
   const c=lerp(configuration.hipCm,configuration.chestCm,t)*(1-.05*Math.pow(Math.sin(Math.PI*t),2));
   const upper=1-.16*clamp((y0-.39)/.81),a=ellipseA(c)*upper,angle=Math.atan2(z,x);
   p.setXYZ(i,a*Math.cos(angle),1.20-(1.20-y0)*configuration.lengthCm/64,a*.58*Math.sin(angle));
  }
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
 });return garment;
}
export function createClothAdapter(garment,body){
 const positions=[],lookup=new Map(),maps=new Map(),edges=new Map(),opposites=new Map(),seams=[],triangles=[];
 const surfaces=garment.children.filter(m=>m.isMesh&&!m.name.startsWith('trim-'));
 for(const mesh of surfaces){
  const p=mesh.geometry.getAttribute('position'),map=[];
  for(let i=0;i<p.count;i++){
   const xyz=[p.getX(i),p.getY(i),p.getZ(i)],key=xyz.map(v=>Math.round(v*1e5)).join(',');
   if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...xyz);}map.push(lookup.get(key));
  }maps.set(mesh.name,map);
  const index=mesh.geometry.index.array;
  for(let k=0;k<index.length;k+=3){const tri=[map[index[k]],map[index[k+1]],map[index[k+2]]];triangles.push(tri);
   for(let a=0;a<3;a++){const i=tri[a],j=tri[(a+1)%3],key=i<j?i+':'+j:j+':'+i;if(i===j)continue;edges.set(key,[i,j]);const opp=opposites.get(key)||[];opp.push(tri[(a+2)%3]);opposites.set(key,opp);}
  }
 }
 for(const side of ['Left','Right'])for(const front of [true,false]){
  const sideMap=maps.get('NUBYRA_Test_Side_'+side),panel=maps.get('NUBYRA_Test_Jersey_'+(front?'Front':'Back')),offset=side==='Left'?0:25*9;
  for(let row=0;row<=14;row++){
   const y=-1.22+1.61*row/14,q=(y+1.22)/2.31*24,k=Math.min(23,Math.floor(q));
   const s=sideMap[row*6+(front?0:5)],a=panel[offset+k*9+8],b=panel[offset+(k+1)*9+8];if(s!==a&&s!==b)seams.push({s,a,b,t:q-k});
  }
 }
 const collider=createCollider(body),pins=[];
 for(let id=0;id<positions.length/3;id++){
  const k=id*3,x=positions[k],y=positions[k+1],z=positions[k+2];if(y<1.075||Math.abs(x)<.28)continue;
  const angle=Math.atan2(z,x),r=collider.radius(collider.ys.at(-1),angle)+.015;
  pins.push({id,position:[r*Math.cos(angle),y-.10,r*Math.sin(angle)]});
 }
 const bends=[...opposites.values()].filter(v=>v.length===2&&v[0]!==v[1]);
 const solver=new ClothSolver({positions,triangles,edges:[...edges.values()],bends,seams,pins,collider});
 const trims=[];
 for(const mesh of garment.children.filter(m=>m.isMesh&&m.name.startsWith('trim-'))){
  const p=mesh.geometry.getAttribute('position'),candidate=maps.get('NUBYRA_Test_Jersey_'+(mesh.name.includes('front')?'Front':'Back')),bindings=[];
  for(let i=0;i<p.count;i++){
   const xyz=[p.getX(i),p.getY(i),p.getZ(i)],near=[];
   for(const id of candidate){const k=id*3,d=(positions[k]-xyz[0])**2+(positions[k+1]-xyz[1])**2+(positions[k+2]-xyz[2])**2;if(near.length<3||d<near[2].d){near.push({id,d});near.sort((a,b)=>a.d-b.d);near.length=Math.min(3,near.length);}}
   const total=near.reduce((s,n)=>s+1/(n.d+1e-6),0);const w=near.map(n=>(1/(n.d+1e-6))/total),offset=xyz.map((v,axis)=>v-near.reduce((s,n,j)=>s+w[j]*positions[n.id*3+axis],0));bindings.push({ids:near.map(n=>n.id),w,offset});
  }trims.push({mesh,bindings});
 }
 function sync(){
  const s=solver.positions;
  for(const mesh of surfaces){const p=mesh.geometry.getAttribute('position'),map=maps.get(mesh.name);for(let i=0;i<map.length;i++){const k=map[i]*3;p.setXYZ(i,s[k],s[k+1],s[k+2]);}p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
  for(const {mesh,bindings} of trims){const p=mesh.geometry.getAttribute('position');for(let i=0;i<bindings.length;i++){const b=bindings[i],xyz=b.offset.map((v,a)=>v+b.ids.reduce((sum,id,j)=>sum+b.w[j]*s[id*3+a],0));p.setXYZ(i,...xyz);}p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
 }
 return {solver,sync,maps,surfaces};
}
export function ringPerimeter(body,row){const {around}=body.userData,p=body.geometry.getAttribute('position');let c=0;for(let i=0;i<around;i++){const a=row*(around+1)+i,b=a+1;c+=Math.hypot(p.getX(a)-p.getX(b),p.getZ(a)-p.getZ(b));}return c*CM_PER_UNIT;}
