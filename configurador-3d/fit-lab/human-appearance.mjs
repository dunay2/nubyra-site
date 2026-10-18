import * as T from 'three';
import {MeshBVH, acceleratedRaycast} from 'three-mesh-bvh';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export const APPEARANCE_VERSION = 'human-appearance/3.6-fine-strand-surface';
export const SKIN_COLOR = '#c99377';
const HAIR_COLOR = '#38261d';
const smooth = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const EDGE_LOCKS = 42, TAIL_LOCKS = 28;

/** Render-only hairstyle. Source body buffers, measurements and its BVH are immutable here. */
export function createHumanAppearance(body) {
  const base=body.userData.base,index=body.geometry.index;
  if(!base||!index)throw Error('La apariencia requiere la base humana indexada');
  const anchor=base.findIndex((_,i)=>i%3===1&&base[i]>1.66)-1;
  if(anchor<0)throw Error('Falta la referencia de la cabeza');
  const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(base.slice(),3));
  const ids=[];for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(Math.min(base[a*3+1],base[b*3+1],base[c*3+1])>1.45)ids.push(a,b,c);}
  source.setIndex(ids);source.computeVertexNormals();source.boundsTree=new MeshBVH(source,{maxLeafTris:8});
  const tempMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),head=new T.Mesh(source,tempMaterial);head.raycast=acceleratedRaycast;head.updateMatrixWorld(true);
  const center=new T.Vector3(0,1.610,.046),ray=new T.Raycaster();ray.firstHitOnly=true;
  // Swept forehead, small asymmetric widow's peak, and continuous temple/ear transitions.
  function hairline(p){
    const theta=Math.atan2(p.x,p.z-center.z),c=Math.cos(theta),a=Math.abs(theta);
    return 1.610+.044*Math.max(0,c)-.065*Math.max(0,-c)+.007*Math.sin(theta)**2
      -.004*Math.exp(-(((theta+.22)/.26)**2))+.0024*Math.sin(2*theta)+.00065*Math.sin(13*theta+.4)
      -.036*Math.exp(-(((a-1.13)/.30)**2))-.022*Math.exp(-(((a-1.62)/.46)**2));
  }
  function onHead(p){
    const direction=p.clone().sub(center).normalize();if(Math.abs(direction.x)<1e-10)direction.x=1e-9;
    ray.set(center,direction.normalize());ray.far=.3;
    const hit=ray.intersectObject(head,false)[0];if(!hit)throw Error('Mechón fuera de la cabeza: '+p.toArray().join(','));
    const vi=[hit.face.a,hit.face.b,hit.face.c],pos=source.attributes.position,norm=source.attributes.normal;
    const vertices=vi.map(i=>new T.Vector3().fromBufferAttribute(pos,i));
    const weights=new T.Triangle(...vertices).getBarycoord(hit.point,new T.Vector3()),q=new T.Vector3();
    for(let k=0;k<3;k++){const n=new T.Vector3().fromBufferAttribute(norm,vi[k]).normalize();q.addScaledVector(hit.point.clone().addScaledVector(n,-hit.point.clone().sub(vertices[k]).dot(n)),weights.getComponent(k));}
    return hit.point.clone().lerp(q,.75);
  }
  // The old cap copied the low-poly crown, preserving a sharp peak even after subdivision.
  // Both the shell and every root use this one rounded surface; no floating ribbons.
  function envelope(p,offset=0){
    const q=p.clone(),theta=Math.atan2(p.x,p.z-center.z),root=smooth((p.y-hairline(p))/.027);
    const volume=.0004+(.006+.003*(.5+.5*Math.sin(theta+.7)))*root;
    q.addScaledVector(p.clone().sub(center).normalize(),volume);
    const dome=1.607+.105*Math.sqrt(Math.max(0,1-(q.x/.087)**2-((q.z-.045)/.120)**2));
    q.y=T.MathUtils.lerp(q.y,Math.max(p.y+.001,dome),smooth((p.y-1.653)/.035));
    q.y+=.003*root*Math.exp(-(((p.x+.024)/.035)**2))*Math.exp(-(((p.z-.095)/.040)**2));
    const flow=.0013*root*Math.sin(5*theta+12*p.y)*Math.sin(19*p.z+theta);
    return q.addScaledVector(q.clone().sub(center).normalize(),offset+flow);
  }
  function rootAt(theta){
    const p=new T.Vector3(.075*Math.sin(theta),1.64,center.z+.1*Math.cos(theta));p.y=hairline(p);
    for(let j=0;j<24;j++){const q=onHead(p),error=hairline(q)-q.y;p.y+=error*.35;if(Math.abs(error)<.00002)break;}
    return onHead(p);
  }
  const shell={positions:[],colors:[],indices:[]},locks={positions:[],colors:[],indices:[]},tail={positions:[],colors:[],indices:[]};
  let scalpGeometry,lockGeometry,tailGeometry;
  const tie=envelope(onHead(new T.Vector3(0,1.610,-.08)),-.001);
  try{
    const thetaSteps=128,rings=44,roots=Array.from({length:128},(_,i)=>rootAt((i+.37)*2*Math.PI/128));
    // Shared indexed polar rings give continuous normals at the crown and azimuth seam.
    for(let j=0;j<rings;j++)for(let i=0;i<thetaSteps;i++){
      const theta=(i+.37)*2*Math.PI/thetaSteps,root=roots[i],v=j/rings;
      const end=new T.Vector3(0,1.704,center.z),probe=root.clone().lerp(end,v);
      const p=envelope(onHead(probe));
      shell.positions.push(p.x,p.y,p.z);
      const shade=.95+.045*Math.sin(theta*3+.5)**2;shell.colors.push(shade,shade,shade);
    }
    for(let j=0;j<rings-1;j++)for(let i=0;i<thetaSteps;i++){
      const a=j*thetaSteps+i,b=j*thetaSteps+(i+1)%thetaSteps,c=a+thetaSteps,d=b+thetaSteps;
      shell.indices.push(a,b,c,b,d,c);
    }
    const top=envelope(onHead(new T.Vector3(0,1.72,center.z))),tip=shell.positions.length/3;
    shell.positions.push(top.x,top.y,top.z);shell.colors.push(.96,.96,.96);
    for(let i=0;i<thetaSteps;i++)shell.indices.push((rings-1)*thetaSteps+i,(rings-1)*thetaSteps+(i+1)%thetaSteps,tip);
    // Tapered irregular roots are less than a millimetre wide, not parallel wire sideburns.
    for(let i=0;i<EDGE_LOCKS;i++){
      const theta=-1.28+2.56*(i+.22*Math.sin(i*2.31))/(EDGE_LOCKS-1),r=rootAt(theta),d=.0015+.003*Math.sin(i*1.83)**2;
      const curve=new T.CubicBezierCurve3(r.clone().add(new T.Vector3(.002, .006,0)),r.clone().add(new T.Vector3(.001,.003,0)),r,r.clone().add(new T.Vector3(.001*Math.sin(i),-d,0)));
      addStrand(locks,curve.getPoints(12).map(p=>envelope(onHead(p),.00018)),.00016,.00007,.94,center,false);
    }
    // A filled, curved ponytail: the core prevents a disconnected bundle of thin sticks.
    const path=new T.CubicBezierCurve3(tie,
      tie.clone().add(new T.Vector3(.003,-.019,-.026)),
      tie.clone().add(new T.Vector3(-.008,-.093,-.069)),
      tie.clone().add(new T.Vector3(.006,-.120,-.058)));
    const frames=path.computeFrenetFrames(56,false),radius=t=>(.010*(1-t)+.010*Math.max(0,Math.sin(Math.PI*t))**.90+.0001)*smooth((1-t)/.18);
    for(let j=0;j<=56;j++){
      const t=j/56,p=path.getPointAt(t),r=radius(t);
      for(let k=0;k<32;k++){
        const a=k*Math.PI/16,w=1+.022*Math.sin(a*7+t*9),q=p.clone().addScaledVector(frames.normals[j],Math.cos(a)*r*w).addScaledVector(frames.binormals[j],Math.sin(a)*r*.77*w);
        tail.positions.push(q.x,q.y,q.z);const shade=.95+.05*Math.sin(a*5+t*5)**2;tail.colors.push(shade,shade,shade);
      }
    }
    for(let j=0;j<56;j++)for(let k=0;k<32;k++){const a=j*32+k,b=j*32+(k+1)%32,c=a+32,d=b+32;tail.indices.push(a,b,c,b,d,c);}
    for(let i=0;i<TAIL_LOCKS;i++){
      const angle=i*2*Math.PI/TAIL_LOCKS,phase=i*2.399,points=[];
      for(let j=0;j<=16;j++){
        const t=.58+.42*j/16,ft=t*(.91+.16*Math.sin(phase)**2),frame=Math.min(56,Math.round(ft*56)),p=path.getPointAt(Math.min(ft,1)),a=angle+.045*Math.sin(t*7+phase),r=radius(Math.min(ft,1))+.00010;
        const loose=smooth((t-.68)/.32);p.x+=.007*Math.sin(phase)*loose;p.y-=(.003+.010*Math.sin(phase)**2)*loose;p.z+=.004*Math.cos(phase)*loose;
        p.addScaledVector(frames.normals[frame],Math.cos(a)*r).addScaledVector(frames.binormals[frame],Math.sin(a)*r*.77);points.push(p);
      }
      addStrand(tail,points,t=>.00040+.0008*smooth((t-.55)/.25),t=>.00015+.00035*smooth((t-.55)/.25),.92+.12*Math.sin(phase)**2,center,false);
    }
    // Elastic band lies perpendicular to the root tangent, not upright like a hairpin.
    const band=new T.TorusGeometry(.0103,.0013,6,32);
    band.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),path.getTangent(0).normalize()));band.translate(tie.x,tie.y-.001,tie.z-.002);
    appendGeometry(tail,band,.48);band.dispose();
    scalpGeometry=geometry(shell);lockGeometry=geometry(locks);tailGeometry=geometry(tail);
    // Ribbon side normals were drawing dark wire-like grooves. Hair fibres follow
    // the scalp normal instead of acting as hundreds of tiny metallic ridges.
    const lp=lockGeometry.attributes.position,ln=lockGeometry.attributes.normal,lv=new T.Vector3();
    for(let i=0;i<lp.count;i++){lv.fromBufferAttribute(lp,i).sub(center).normalize();ln.setXYZ(i,lv.x,lv.y,lv.z);}ln.needsUpdate=true;
  }finally{source.boundsTree=null;source.dispose();tempMaterial.dispose();}
  const meshes=[scalpGeometry,lockGeometry,tailGeometry].map((g,i)=>{
    const m=new T.Mesh(g,new T.MeshStandardMaterial({color:HAIR_COLOR,roughness:.76,metalness:0,vertexColors:true,side:T.DoubleSide}));
    if(i!==1){
      m.material.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 vHairSurface;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHairSurface=position;');
        shader.fragmentShader='varying vec3 vHairSurface;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float angle=atan(vHairSurface.x,vHairSurface.z-0.046);
          float flow=angle+0.20*sin(angle*2.0+vHairSurface.y*8.0)+1.4*(vHairSurface.y-1.63);
          float strand=${i===2?'vHairSurface.x*19000.0+vHairSurface.y*400.0':'flow*680.0'};
          float width=max(fwidth(strand),0.0001);
          float detail=1.0-smoothstep(3.0,8.0,width);
          float fibres=sin(strand+1.1*sin(strand*0.017))*0.065+sin(strand*1.79+0.4)*0.024;
          float bundle=sin(flow*57.0+1.3*sin(flow*9.0))*0.021;
          diffuseColor.rgb*=1.0+fibres*detail+bundle;
        `);
      };
      m.material.customProgramCacheKey=()=>APPEARANCE_VERSION+'-surface-'+i;
    }
    m.name=['avatar-hair-scalp','avatar-hair-swept-locks','avatar-hair-ponytail'][i];return m;
  });
  const group=new T.Group();group.name='avatar-hair';group.add(...meshes);body.add(group);
  const originalColor=body.material.color.clone(),originalRoughness=body.material.roughness;body.material.color.set(SKIN_COLOR);body.material.roughness=.8;
  let destroyed=false;
  function update(){
    if(destroyed)return;const s=body.userData.scale/body.userData.unit,p=body.geometry.attributes.position;
    if(!Number.isFinite(s)||s<=0)throw Error('Escala de cabeza no válida');
    group.scale.setScalar(s);group.position.set(p.getX(anchor/3)-base[anchor]*s,p.getY(anchor/3)-base[anchor+1]*s,p.getZ(anchor/3)-base[anchor+2]*s);group.updateMatrix();
  }
  update();return {group,update,snapshot:()=>({version:APPEARANCE_VERSION,skinColor:SKIN_COLOR,hairColor:HAIR_COLOR,hairStyle:'low-gathered-ponytail',hairMeshes:3,scalpLocks:EDGE_LOCKS,scalpDetail:'filtered-surface-fibres',tailLocks:TAIL_LOCKS,scalpTriangles:scalpGeometry.index.count/3,hairTie:true,crown:'rounded-shared-envelope',tail:'low-draped-separated-taper',growthDirection:'regional-gather-to-occiput',renderOnly:true,collisionGeometryChanged:false}),destroy(){if(destroyed)return;destroyed=true;body.remove(group);for(const m of meshes){m.geometry.dispose();m.material.dispose();}body.material.color.copy(originalColor);body.material.roughness=originalRoughness;}};
}
function geometry(data){
  const raw=new T.BufferGeometry();raw.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));raw.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));const valid=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<data.indices.length;i+=3){const ids=data.indices.slice(i,i+3);a.fromArray(data.positions,ids[0]*3);b.fromArray(data.positions,ids[1]*3);c.fromArray(data.positions,ids[2]*3);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-28)valid.push(...ids);}
  raw.setIndex(valid);
  const g=mergeVertices(raw,1e-7);raw.dispose();g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function appendGeometry(out,g,shade){const start=out.positions.length/3,p=g.attributes.position;for(let i=0;i<p.count;i++){out.positions.push(p.getX(i),p.getY(i),p.getZ(i));out.colors.push(shade,shade,shade);}for(const i of g.index.array)out.indices.push(start+i);}
function addStrand(out,points,width,depth,shade,center,scalp){
  const sides=4,start=out.positions.length/3;
  for(let j=0;j<points.length;j++){
    const t=j/(points.length-1),p=points[j],tangent=points[Math.min(j+1,points.length-1)].clone().sub(points[Math.max(0,j-1)]).normalize();
    const normal=scalp?p.clone().sub(center):new T.Vector3(0,0,-1);normal.addScaledVector(tangent,-normal.dot(tangent)).normalize();
    if(normal.lengthSq()<.1)normal.set(1,0,0).addScaledVector(tangent,-tangent.x).normalize();const side=tangent.clone().cross(normal).normalize(),taper=.015+.985*Math.sin(Math.PI*t)**.55;
    for(let k=0;k<sides;k++){const a=k*2*Math.PI/sides,w=typeof width==='function'?width(t):width,d=typeof depth==='function'?depth(t):depth,q=p.clone().addScaledVector(side,Math.cos(a)*w*taper).addScaledVector(normal,Math.sin(a)*d*taper);out.positions.push(q.x,q.y,q.z);out.colors.push(shade,shade,shade);}
  }
  for(let j=0;j<points.length-1;j++)for(let k=0;k<sides;k++){const a=start+j*sides+k,b=start+j*sides+(k+1)%sides;out.indices.push(a,a+sides,b,b,a+sides,b+sides);}
}
