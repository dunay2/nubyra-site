import {CM_PER_UNIT} from './body-surface.mjs';
const lerp=(a,b,t)=>a+(b-a)*t,clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
/** Visual reference only. Its proportions and shorts are not inferred body measurements or a fit solver. */
export function referenceLayout(body,state){
 const p=body.geometry.attributes.position;let minY=Infinity,maxY=-Infinity;
 for(let i=0;i<p.count;i++){minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));}
 const scale=state.bodyHeightCm/160,headHeight=.70*scale,headTop=maxY+headHeight,floor=headTop-state.bodyHeightCm/CM_PER_UNIT;
 const waistY=p.getY(16*(body.userData.around+1));
 return {joinY:minY,neckTop:maxY,headTop,floor,headHeight,waistY,scale,nominalHeightCm:state.bodyHeightCm};
}
function interpolate(points,t){for(let i=1;i<points.length;i++)if(t<=points[i][0]){const a=points[i-1],b=points[i],v=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((x,j)=>lerp(x,b[j+1],v));}return points.at(-1).slice(1);}
function bodySection(body,y){const {rows,around}=body.userData,p=body.geometry.attributes.position;let a=0;
 while(a<rows&&p.getY((a+1)*(around+1))<y)a++;const b=Math.min(rows,a+1),ya=p.getY(a*(around+1)),yb=p.getY(b*(around+1)),t=yb===ya?0:clamp((y-ya)/(yb-ya));
 const ext=r=>{let x=0,f=0,b=0;for(let j=0;j<around;j++){const i=r*(around+1)+j;x=Math.max(x,Math.abs(p.getX(i)));f=Math.max(f,p.getZ(i));b=Math.max(b,-p.getZ(i));}return [x,f,b];};
 const A=ext(a),B=ext(b);return A.map((v,i)=>lerp(v,B[i],t));
}
function halfTube(T,side,rows,around,rowAt){const pos=[],uv=[],idx=[];
 for(let r=0;r<=rows;r++)for(let a=0;a<=around;a++){const t=r/rows,theta=-Math.PI/2+2*Math.PI*a/around;const v=rowAt(t,theta);pos.push(side*v[0],v[1],v[2]);uv.push(a/around,1-t);}
 for(let r=0;r<rows;r++)for(let a=0;a<around;a++){const i=r*(around+1)+a,j=i+around+1;if(side>0)idx.push(i,i+1,j,i+1,j+1,j);else idx.push(i,j,i+1,i+1,j,j+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function createOutfitReference(T,body,state,options={}){
 const group=new T.Group(),bodyGroup=new T.Group(),shortsGroup=new T.Group();group.name='Referencia de equipación · no simulada';group.add(bodyGroup,shortsGroup);
 const L=referenceLayout(body,state),base=bodySection(body,L.joinY),width=base[0],length=Number.isFinite(options.shortsLengthCm)?Math.max(25,Math.min(60,options.shortsLengthCm)):40;
 const primary=new T.MeshStandardMaterial({color:options.base||'#173e64',roughness:.85,side:T.DoubleSide}),accent=primary.clone();accent.color.set(options.accent||'#f8c12e');
 const add=(g,name,geo,mat)=>{const m=new T.Mesh(geo,mat);m.name=name;g.add(m);return m;};
 const legRing=(t,theta)=>{
  const [center,rx,rz]=interpolate([[0,.47,.47,.68],[.14,.46,.39,.65],[.40,.45,.25,.39],[.52,.46,.22,.31],[.72,.46,.28,.38],[.93,.46,.14,.22],[1,.46,.13,.20]],t).map(x=>x*width);
  const c=Math.cos(theta),s=Math.sin(theta),blend=smooth(t/.15);
  return [lerp(Math.max(0,c)*width,center+rx*c,blend),lerp(L.joinY,L.floor+.12*L.scale,t),lerp(s*(s>0?base[1]:base[2]),s*rz,blend)];
 };
 for(const side of [-1,1]){
  add(bodyGroup,'Pierna sintética '+side,halfTube(T,side,32,48,legRing),body.material);
  const foot=new T.SphereGeometry(1,20,12);foot.scale(width*.17,.115*L.scale,.23*L.scale);foot.translate(side*width*.46,L.floor+.115*L.scale,.10*L.scale);add(bodyGroup,'Pie de referencia '+side,foot,body.material);
 }
 const head=new T.SphereGeometry(1,28,20);head.scale(.245*L.scale,L.headHeight/2,.27*L.scale);head.translate(0,L.neckTop+L.headHeight/2,0);add(bodyGroup,'Cabeza neutra de referencia',head,body.material);
 const shortsBottom=L.waistY-length/CM_PER_UNIT,crotch=L.joinY-.28*L.scale;
 for(const side of [-1,1]){
  const geometry=halfTube(T,side,24,48,(t,theta)=>{
   const y=lerp(L.waistY,shortsBottom,t),c=Math.cos(theta),s=Math.sin(theta),sec=bodySection(body,Math.max(y,L.joinY));
   const split=smooth((L.joinY+.09*L.scale-y)/(.46*L.scale));
   const w=sec[0]+.032,dep=(s>=0?sec[1]:sec[2])+.032;
   return [lerp(Math.max(0,c)*w,width*.48+(width*.43+.025)*c,split),y,s*lerp(dep,width*.62,split)];
  });
  // Same two-color design, a genuine side strip in the shorts material groups.
  const original=geometry.index.array,main=[],stripe=[];for(let r=0;r<24;r++)for(let a=0;a<48;a++){const target=a>=10&&a<=14?stripe:main;for(let k=0;k<6;k++)target.push(original[(r*48+a)*6+k]);}
  geometry.setIndex([...main,...stripe]);geometry.clearGroups();geometry.addGroup(0,main.length,0);geometry.addGroup(main.length,stripe.length,1);
  add(shortsGroup,'Pantalón visual '+side,geometry,[primary,accent]);
 }
 const ruler=new T.Group(),rulerMat=new T.LineBasicMaterial({color:0x5d96a8,transparent:true,opacity:.8});group.add(ruler);
 const points=[new T.Vector3(-1.2,L.floor,0),new T.Vector3(-1.2,L.headTop,0)];
 for(let cm=0;cm<=state.bodyHeightCm;cm+=10){const y=L.floor+cm/CM_PER_UNIT;points.push(new T.Vector3(-1.2,y,0),new T.Vector3(-1.27,y,0));}
 ruler.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points),rulerMat));
 const floorGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(-1,L.floor,0),new T.Vector3(1,L.floor,0)]);ruler.add(new T.Line(floorGeo,rulerMat));
 const bodyMeshes=bodyGroup.children,shortsMeshes=shortsGroup.children;
 return {group,bodyGroup,shortsGroup,ruler,bodyMeshes,shortsMeshes,layout:L,
  snapshot:()=>({mode:'visual-reference',anthropometryValidated:false,clothSimulated:false,heightCm:state.bodyHeightCm,shortsLengthCm:length,floorY:L.floor,headTopY:L.headTop,crotchY:crotch}),
  colors(base,second){primary.color.set(base);accent.color.set(second);},
  destroy(){group.traverse(m=>m.geometry?.dispose());primary.dispose();accent.dispose();rulerMat.dispose();}
 };
}
