import {CM_PER_UNIT} from './body-surface.mjs';
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
export const OUTFIT_REFERENCE_VERSION='lower-reference/3.0';

/** Synthetic proportions only: not measured anatomy, a size recommendation or a cloth solver. */
export function referenceLayout(body,state){
 const p=body.geometry.attributes.position;let minY=Infinity,maxY=-Infinity;
 for(let i=0;i<p.count;i++){minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));}
 const scale=state.bodyHeightCm/160,headHeight=.70*scale,headTop=maxY+headHeight,floor=headTop-state.bodyHeightCm/CM_PER_UNIT;
 const waistY=p.getY(16*(body.userData.around+1));
 return {joinY:minY,neckTop:maxY,headTop,floor,headHeight,waistY,scale,nominalHeightCm:state.bodyHeightCm};
}

/** Shape-preserving cubic, C1 at each knot; linear lofts made rings at every profile change. */
function profile(points){
 const slopes=points.map((p,i)=>p.slice(1).map((_,axis)=>{
  const sec=j=>(points[j+1][axis+1]-points[j][axis+1])/(points[j+1][0]-points[j][0]);
  if(i===0)return sec(0);if(i===points.length-1)return sec(i-1);
  const a=sec(i-1),b=sec(i);return a*b<=0?0:2*a*b/(a+b);
 }));
 return t=>{
  let i=0;while(i<points.length-2&&t>points[i+1][0])i++;
  const a=points[i],b=points[i+1],h=b[0]-a[0],u=clamp((t-a[0])/h),u2=u*u,u3=u2*u;
  return a.slice(1).map((v,k)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*h*slopes[i][k]+(-2*u3+3*u2)*b[k+1]+(u3-u2)*h*slopes[i+1][k]);
 };
}

/** Interpolate the actual torso rings, not an ellipse through their maximum extents. */
function bodySampler(body){
 const {rows,around}=body.userData,p=body.geometry.attributes.position;
 const ys=Array.from({length:rows+1},(_,r)=>p.getY(r*(around+1)));
 function ring(r,angle){
  const a=((angle/(2*Math.PI))%1+1)%1*around,i=Math.floor(a),j=(i+1)%around,t=a-i;
  const u=r*(around+1)+i,v=r*(around+1)+j;
  return [lerp(p.getX(u),p.getX(v),t),lerp(p.getZ(u),p.getZ(v),t)];
 }
 return (y,angle)=>{
  let lo=0,hi=rows;while(lo<hi){const m=(lo+hi)>>1;if(ys[m]<y)lo=m+1;else hi=m;}
  const a=Math.max(0,Math.min(rows-1,lo-1)),t=(y-ys[a])/(ys[a+1]-ys[a]),u=ring(a,angle),v=ring(a+1,angle);
  // Extrapolating the bottom tangent makes the torso/leg transition continuous.
  return [lerp(u[0],v[0],t),lerp(u[1],v[1],t)];
 };
}

function blendNormal(a,i,b,j){
 const an=a.attributes.normal,bn=b.attributes.normal;
 const x=an.getX(i)+bn.getX(j),y=an.getY(i)+bn.getY(j),z=an.getZ(i)+bn.getZ(j),length=Math.hypot(x,y,z);
 if(length<1e-8)return;an.setXYZ(i,x/length,y/length,z/length);bn.setXYZ(j,x/length,y/length,z/length);
}
function smoothSharedNormals(meshes){
 // Known grid neighbours avoid an allocation-heavy coordinate hash of every vertex.
 for(const mesh of meshes){const g=mesh.geometry,{rows,around}=g.userData;
  for(let r=0;r<=rows;r++)blendNormal(g,r*(around+1),g,r*(around+1)+around);
 }
 if(meshes.length===2){const a=meshes[0].geometry,b=meshes[1].geometry,around=a.userData.around;
  if(a.userData.rows!==b.userData.rows){
   const offset=a.userData.rows*(around+1);for(let i=0;i<=around;i++)blendNormal(a,offset+i,b,i);
  }else{
   const pa=a.attributes.position,pb=b.attributes.position;
   for(let i=0;i<pa.count;i++)if(Math.abs(pa.getX(i))<1e-6&&Math.abs(pb.getX(i))<1e-6)blendNormal(a,i,b,i);
  }
 }
 for(const m of meshes)m.geometry.attributes.normal.needsUpdate=true;
}

function halfTube(T,side,rows,around,rowAt,sole=false,includeFace=()=>true){
 const pos=[],uv=[],idx=[];
 for(let r=0;r<=rows;r++)for(let a=0;a<=around;a++){
  // Reuse theta exactly at the seam, not a nearly-equal floating-point endpoint.
  const theta=-Math.PI/2+2*Math.PI*(a%around)/around,v=rowAt(r/rows,theta);
  pos.push(side*v[0],v[1],v[2]);uv.push(a/around,1-r/rows);
 }
 for(let r=0;r<rows;r++)for(let a=0;a<around;a++){if(!includeFace(r,a))continue;const i=r*(around+1)+a,j=i+around+1;
  if(side>0)idx.push(i,i+1,j,i+1,j+1,j);else idx.push(i,j,i+1,i+1,j,j+1);
 }
 if(sole){
  const start=rows*(around+1),center=pos.length/3;let x=0,z=0;
  for(let a=0;a<around;a++){x+=pos[(start+a)*3];z+=pos[(start+a)*3+2];}
  pos.push(x/around,pos[start*3+1],z/around);uv.push(.5,.5);
  for(let a=0;a<around;a++){if(side>0)idx.push(center,start+a,start+a+1);else idx.push(center,start+a+1,start+a);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={rows,around,sole};return g;
}

export function createOutfitReference(T,body,state,options={}){
 const group=new T.Group(),bodyGroup=new T.Group(),shortsGroup=new T.Group();group.name='Referencia de equipación · no simulada';group.add(bodyGroup,shortsGroup);
 const L=referenceLayout(body,state),sampleBody=bodySampler(body),width=sampleBody(L.joinY,0)[0];
 const length=Number.isFinite(options.shortsLengthCm)?Math.max(25,Math.min(60,options.shortsLengthCm)):40;
 const primary=new T.MeshStandardMaterial({color:options.base||'#173e64',roughness:.85,side:T.DoubleSide}),accent=primary.clone();accent.color.set(options.accent||'#f8c12e');
 const add=(g,name,geo,mat)=>{const m=new T.Mesh(geo,mat);m.name=name;g.add(m);return m;};
 const ankleY=L.floor+.32*L.scale,lowerLength=L.joinY-ankleY,shank=L.scale*Math.pow(state.bodyHipCm/96,.2),center=.46*width;
 // Compact upper-thigh reference: do not flare outward/deepen below the hip.
 // Knees, calves, ankles and feet keep their previous sections and positions.
 const legProfile=profile([
  [0,.44*width,.38*width,.40*width,0], [.14,.43*width,.30*width,.36*width,0],
  [.37,center,.185*shank,.195*shank,.016*L.scale], [.47,center,.145*shank,.15*shank,.016*L.scale],
  [.63,center,.205*shank,.215*shank,-.028*L.scale], [.78,center,.168*shank,.173*shank,-.03*L.scale],
  [.93,center,.108*shank,.125*shank,-.004*L.scale], [1,center,.10*shank,.12*shank,0]
 ]);
 const crotchDrop=.19*L.scale;
 const legRing=(t,theta)=>{
  const rawY=lerp(L.joinY,ankleY,t),[cx,rx,rz,cz]=legProfile(t),c=Math.cos(theta),sn=Math.sin(theta);
  const inner=Math.max(0,-c),blend=smooth(t/.06),upper=sampleBody(rawY,theta);
  // Each half starts on an outer hip arc and a SHARED curved centre seam.
  // The inner arc descends to a crotch saddle instead of drawing two coincident
  // vertical walls and a collapsed disc across the whole hip plane.
  const y=rawY-crotchDrop*inner*inner*(1-smooth(t/.22));
  return [lerp(Math.max(0,upper[0]),cx+rx*c,blend),y,lerp(upper[1],cz+rz*sn,blend)];
 };

 // Plantigrade reference: heel, instep and toe share one flat supporting sole.
 const footProfile=profile([
  [0,.32,.10*shank/L.scale,.12*shank/L.scale,0], [.22,.24,.118*shank/L.scale,.235,.085],
  [.50,.14,.15*shank/L.scale,.39,.18], [.72,.065,.157*shank/L.scale,.43,.20],
  [.88,.020,.152*shank/L.scale,.43,.20], [1,0,.145*shank/L.scale,.415,.20]
 ]);
 for(const side of [-1,1]){
  const leg=add(bodyGroup,'Pierna sintética '+side,halfTube(T,side,32,56,legRing),body.material);
  const foot=add(bodyGroup,'Pie de referencia '+side,halfTube(T,side,8,56,(t,theta)=>{
   const [y,rx,rz,z]=footProfile(t);return [center+rx*L.scale*Math.cos(theta),L.floor+y*L.scale,(z+rz*Math.sin(theta))*L.scale];
  },true),body.material);
  smoothSharedNormals([leg,foot]);
 }
 smoothSharedNormals([bodyGroup.getObjectByName('Pierna sintética -1'),bodyGroup.getObjectByName('Pierna sintética 1')]);
 // Only the outer hip arcs meet the torso. Share their outward tangent normals;
 // the torso's internal closing cap must not create a false black belt.
 const bp=body.geometry.attributes.position,bn=body.geometry.attributes.normal;
 for(let a=0;a<body.userData.around;a++){
  const angle=2*Math.PI*a/body.userData.around,side=Math.cos(angle)>=0?1:-1;
  const theta=side>0?angle:Math.PI-angle;
  const leg=bodyGroup.getObjectByName('Pierna sintética '+side).geometry;
  const j=Math.round((((theta+Math.PI/2)/(2*Math.PI))%1+1)%1*56)%56;
  const dy=bp.getY(57+a)-bp.getY(a),dx=bp.getX(57+a)-bp.getX(a),dz=bp.getZ(57+a)-bp.getZ(a);
  const prev=(a+55)%56,next=(a+1)%56,tx=bp.getX(next)-bp.getX(prev),tz=bp.getZ(next)-bp.getZ(prev);
  let nx=dy*tz,ny=dz*tx-dx*tz,nz=-dy*tx;const norm=Math.hypot(nx,ny,nz)||1;nx/=norm;ny/=norm;nz/=norm;
  bn.setXYZ(a,nx,ny,nz);leg.attributes.normal.setXYZ(j,nx,ny,nz);if(j===0)leg.attributes.normal.setXYZ(56,nx,ny,nz);
 }
 bn.setXYZ(56,bn.getX(0),bn.getY(0),bn.getZ(0));bn.needsUpdate=true;

 const head=new T.SphereGeometry(1,28,20),headRadius=L.headHeight/2+.105*L.scale;
 head.scale(.245*L.scale,headRadius,.27*L.scale);head.translate(0,L.headTop-headRadius,0);add(bodyGroup,'Cabeza neutra de referencia',head,body.material);
 const shortsBottom=L.waistY-length/CM_PER_UNIT,crotch=L.joinY-crotchDrop;
 // Reuse the underlying body's section heights. A different row grid crossed the
 // sharp hip-to-thigh transition and exposed skin through a thinner underlayer.
 const bodyPositions=body.geometry.attributes.position,shortsYs=[];
 for(let r=16;r>=0;r--){const y=bodyPositions.getY(r*(body.userData.around+1));if(y>shortsBottom+1e-7)shortsYs.push(y);}
 const legGeometry=bodyGroup.getObjectByName('Pierna sintética 1').geometry;
 const lp=legGeometry.attributes.position,lr=legGeometry.userData.rows,la=legGeometry.userData.around;
 for(let r=1;r<=lr;r++){const y=lerp(L.joinY,ankleY,r/lr);if(y>shortsBottom+1e-7)shortsYs.push(y);}
 shortsYs.push(shortsBottom);
 const sampleLeg=(y,theta)=>{const row=clamp((L.joinY-y)/lowerLength)*lr,r=Math.min(lr-1,Math.floor(row)),v=row-r;
  const a=((theta+Math.PI/2)/(2*Math.PI)%1+1)%1*la,col=Math.floor(a),u=a-col;
  const point=(rr,cc)=>{const i=rr*(la+1)+(cc%la);return [lp.getX(i),lp.getZ(i),lp.getY(i)];};
  const p00=point(r,col),p01=point(r,col+1),p10=point(r+1,col),p11=point(r+1,col+1);
  return [0,1,2].map(k=>lerp(lerp(p00[k],p01[k],u),lerp(p10[k],p11[k],u),v));
 };
 for(const side of [-1,1]){
  const rows=shortsYs.length-1,around=56;
  const geometry=halfTube(T,side,rows,around,(t,theta)=>{
   const y=shortsYs[Math.round(t*rows)],c=Math.cos(theta),s=Math.sin(theta);
   // A thin underlayer above the hips avoids an artificial ring protruding through the shirt.
   // It opens gradually below the torso, without a branch discontinuity at joinY.
   // Reference-only underlayer: no renderOrder/depth-test trick and no cloth rescaling.
   const ease=.0008+.0212*smooth((L.joinY-y)/(.55*L.scale));
   if(y<=L.joinY){
    const v=sampleLeg(y,theta);
    // A woven-sport reference hangs from the upper thigh instead of tracing the
    // narrowing knee. This is a geometric envelope, not a second cloth solver.
    const hanging=smooth((L.joinY-y-.035*L.scale)/(.20*L.scale));
    const legCenter=.46*width,hemRadiusX=.27*width+.040*L.scale,hemRadiusZ=.315*width+.035*L.scale;
    const target=[legCenter+hemRadiusX*c,hemRadiusZ*s];
    // An outer envelope may add ease but must not cut through the existing leg.
    const outer=[c>=0?Math.max(v[0],target[0]):Math.min(v[0],target[0]),s>=0?Math.max(v[1],target[1]):Math.min(v[1],target[1])];
    const hemBlend=smooth((y-shortsBottom)/Math.max(.01,L.joinY-shortsBottom));
    return [Math.max(0,lerp(v[0],outer[0],hanging)+ease*c),lerp(y,v[2],hemBlend*Math.min(1,.7*Math.max(0,L.joinY-shortsBottom)/crotchDrop)),lerp(v[1],outer[1],hanging)+ease*s];
   }
   const v=sampleBody(y,theta);return [Math.max(0,v[0]+ease*c),y,v[1]+ease*s];
  },false,(r,a)=>shortsYs[r]<L.joinY+1e-7||a<around/2);
  // Two draw batches per leg, exclusively a vertical side band; no horizontal material ring.
  const original=geometry.index.array,main=[],stripe=[];let faceOffset=0;
  for(let r=0;r<rows;r++)for(let a=0;a<around;a++){if(shortsYs[r]>=L.joinY+1e-7&&a>=around/2)continue;const target=a>=around/4-2&&a<=around/4+2?stripe:main;for(let k=0;k<6;k++)target.push(original[faceOffset++]);}
  geometry.setIndex([...main,...stripe]);geometry.clearGroups();geometry.addGroup(0,main.length,0);geometry.addGroup(main.length,stripe.length,1);
  add(shortsGroup,'Pantalón visual '+side,geometry,[primary,accent]);
 }
 smoothSharedNormals(shortsGroup.children);
 const ruler=new T.Group(),rulerMat=new T.LineBasicMaterial({color:0x5d96a8,transparent:true,opacity:.8});group.add(ruler);
 const points=[new T.Vector3(-1.2,L.floor,0),new T.Vector3(-1.2,L.headTop,0)];
 for(let cm=0;cm<=state.bodyHeightCm;cm+=10){const y=L.floor+cm/CM_PER_UNIT;points.push(new T.Vector3(-1.2,y,0),new T.Vector3(-1.27,y,0));}
 ruler.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points),rulerMat));
 ruler.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-1,L.floor,0),new T.Vector3(1,L.floor,0)]),rulerMat));
 const bodyMeshes=bodyGroup.children,shortsMeshes=shortsGroup.children;
 return {group,bodyGroup,shortsGroup,ruler,bodyMeshes,shortsMeshes,layout:L,
  snapshot:()=>({version:OUTFIT_REFERENCE_VERSION,mode:'visual-reference',anthropometryValidated:false,clothSimulated:false,heightCm:state.bodyHeightCm,shortsLengthCm:length,floorY:L.floor,headTopY:L.headTop,crotchY:crotch}),
  colors(base,second){primary.color.set(base);accent.color.set(second);},
  destroy(){group.traverse(m=>m.geometry?.dispose());primary.dispose();accent.dispose();rulerMat.dispose();}
 };
}
