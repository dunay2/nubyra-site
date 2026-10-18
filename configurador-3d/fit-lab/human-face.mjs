import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SKIN_COLOR} from './human-appearance.mjs';
import {buildPortraitSurface,PORTRAIT_JOIN_Y,PORTRAIT_SURFACE_VERSION} from './portrait-surface.mjs';

export const FACE_VERSION='human-face/3.2-soft-athletic';
const IRIS_RADIUS=.0053,PUPIL_RADIUS=.00185;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

/** A single refined skin surface and recessed optical eyes replace the old
 * overlapping lid/lip patches. Canonical measurement/collision data are untouched. */
export function createHumanFace(body){
 const base=body.userData.base,index=body.geometry.index;
 if(!base||!index)throw Error('La cara necesita la base humana indexada');
 let anchor=-1;for(let i=0;i<base.length;i+=3)if(base[i+1]>1.65){anchor=i/3;break;}
 if(anchor<0)throw Error('No se encuentra la referencia de la cabeza');
 const started=performance.now();
 const head=buildPortraitSurface(base,index),tree=new MeshBVH(head.clone(),{maxLeafTris:8});
 const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));let queries=0;
 const skin=new T.Color(SKIN_COLOR),brow=new T.Color('#473128');
 const positions=Array.from(head.attributes.position.array),normals=Array.from(head.attributes.normal.array),indices=Array.from(head.index.array),colors=[],coords=[],ranges=[];
 for(let i=0;i<head.attributes.position.count;i++){colors.push(skin.r,skin.g,skin.b);coords.push(0,0);}
 const headVertexCount=head.attributes.position.count,portraitStyle={version:head.userData.styleVersion,maxDisplacementMm:head.userData.maxStyleDisplacementMm};let headIndexCount=indices.length;
 const attachments=head.userData.attachments,restSkin=head.attributes.position.array.slice(),restNormals=head.attributes.normal.array.slice();
 const sample=(x,y)=>{ray.origin.set(x,y,.5);queries++;const h=tree.raycastFirst(ray,T.DoubleSide);if(!h)throw Error('Detalle fuera de la superficie de la cara');return h.point;};
 const append=(p,n,c,uv=[0,0])=>{positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);colors.push(c.r,c.g,c.b);coords.push(...uv);};
 // Short tapered upper lashes anchored by the actual display aperture. This
 // finite search locates a skin/cavity boundary in Y; it never offsets an eye in Z.
 let lashHairs=0;
 for(const side of [-1,1])for(let i=0;i<20;i++){
  const t=(i+.5)/20,x=side*.0315+(t-.5)*.021;
  let inside=1.589,outside=1.604;
  if(sample(x,inside).z>.12)continue;
  for(let j=0;j<10;j++){const y=(inside+outside)/2;if(sample(x,y).z>.12)outside=y;else inside=y;}
  const root=sample(x,outside+.00012);root.z+=.00016;
  const phase=i*2.399,arch=Math.sin(Math.PI*t),length=(.0009+.0007*arch)*(.90+.15*Math.sin(phase)**2);
  const start=positions.length/3;
  for(let j=0;j<=3;j++)for(let k=0;k<2;k++){
   const v=j/3,p=root.clone();p.x+=(t-.5)*.0009*v+(k-.5)*.00011*(1-v);
   p.y+=length*v;p.z+=.0007*Math.sin(v*Math.PI/2);
   append(p,new T.Vector3(0,0,1),new T.Color('#302720').lerp(skin,.12+.42*v*v));
  }
  for(let j=0;j<3;j++){const a=start+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}lashHairs++;
 }
 // Low-contrast irregular brow strokes. No straight comb of identical hairs.
 const browHairs=144;
 for(const side of[-1,1])for(let i=0;i<browHairs/2;i++){
  const phase=i*2.3999632,t=(i+.35+.20*Math.sin(phase))/72,arch=Math.pow(Math.sin(Math.PI*t),.55);
  const x=side*(.014+.036*t),y=1.602+.0040*Math.sin(Math.PI*t)-.0016*t+Math.sin(phase*2.1)*.00055;
  const length=(.0011+.0013*Math.sin(phase)**2)*arch,width=(.00008+.00009*Math.sin(phase*.8)**2)*arch;
  const start=positions.length/3;
  for(let j=0;j<=4;j++)for(let k=0;k<2;k++){
   const v=j/4,xx=x+side*(v*.00095+(k-.5)*width*2*Math.sin(Math.PI*v)),yy=y+(v-.4)*length;
   const p=sample(xx,yy);p.z+=.00040;
   append(p,new T.Vector3(0,0,1),brow.clone().lerp(skin,.18+.62*(1-Math.sin(Math.PI*v))));
  }
  for(let j=0;j<4;j++){const a=start+2*j;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 let skinIndexCount=indices.length;
 // Complete ellipsoidal optical surfaces sit behind the skin aperture. The
 // refined skin occludes them naturally, with no additional eyelid strips.
 for(const side of[-1,1]){
  const cx=side*.0315,cy=1.5890,cz=.1248,g=new T.SphereGeometry(1,64,40),p=g.attributes.position,n=g.attributes.normal;
  const start=positions.length/3;
  for(let i=0;i<p.count;i++){
   const xx=p.getX(i)*.0148,yy=p.getY(i)*.0102,zz=p.getZ(i)*.0087;
   const q=new T.Vector3(cx+xx,cy+yy,cz+zz-side*xx*.13);
   const norm=new T.Vector3(n.getX(i)/.0148,n.getY(i)/.0102,n.getZ(i)/.0087).normalize();
   const r=Math.hypot(xx,yy),c=new T.Color(r<PUPIL_RADIUS?'#111310':r<IRIS_RADIUS?'#63442f':'#cdc8bf');
   append(q,norm,c,[xx,yy]);
  }
  for(const i of g.index.array)indices.push(start+i);ranges.push({start,count:p.count,center:[cx,cy,cz]});g.dispose();
 }
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 const clean=part=>{const valid=[];for(let i=0;i<part.length;i+=3){a.fromArray(positions,part[i]*3);b.fromArray(positions,part[i+1]*3);c.fromArray(positions,part[i+2]*3);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-26)valid.push(part[i],part[i+1],part[i+2]);}return valid;};
 const headFaces=clean(indices.slice(0,headIndexCount)),browFaces=clean(indices.slice(headIndexCount,skinIndexCount)),eyeFaces=clean(indices.slice(skinIndexCount));
 indices.length=0;for(const face of [headFaces,browFaces,eyeFaces])for(const v of face)indices.push(v);headIndexCount=headFaces.length;skinIndexCount=headFaces.length+browFaces.length;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('eyeCoord',new T.Float32BufferAttribute(coords,2));geometry.setIndex(indices);
 geometry.addGroup(0,skinIndexCount,0);geometry.addGroup(skinIndexCount,indices.length-skinIndexCount,1);
 geometry.userData.eyeVertexRanges=ranges;geometry.userData.headVertexCount=headVertexCount;geometry.userData.headIndexCount=headIndexCount;geometry.userData.neckAttachments=attachments;geometry.userData.restSkin=restSkin;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.74,metalness:0,side:T.FrontSide});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vPortraitPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPortraitPosition=position;');
  shader.fragmentShader='varying vec3 vPortraitPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   if(vPortraitPosition.y < ${PORTRAIT_JOIN_Y.toFixed(4)}) discard;
   float front=smoothstep(0.10,0.125,vPortraitPosition.z);
   float browT=(abs(vPortraitPosition.x)-0.014)/0.036;
   float browY=1.602+0.0040*sin(clamp(browT,0.0,1.0)*3.14159)-0.0016*browT;
   float browArch=pow(max(0.0,sin(clamp(browT,0.0,1.0)*3.14159)),0.65);
   float browWidth=0.0010*browArch;
   float browNoise=sin(vPortraitPosition.x*7200.0+vPortraitPosition.y*3300.0)*0.00012;
   float browMask=(1.0-smoothstep(browWidth*0.15,browWidth+0.0005,abs(vPortraitPosition.y-browY)+browNoise))*browArch*front;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.093,0.051,0.034),browMask*0.68);
   float u=vPortraitPosition.x/0.0235;
   float arch=pow(max(0.0,1.0-u*u),0.72);
   float centre=1.5235-0.0003*u*u;
   float top=centre+0.0102*arch-0.0020*exp(-pow(u/0.21,2.0));
   float bottom=centre-0.0093*arch;
   float lipMask=smoothstep(bottom-0.0011,bottom+0.0010,vPortraitPosition.y)*(1.0-smoothstep(top-0.001,top+0.0012,vPortraitPosition.y))*(1.0-smoothstep(0.90,1.03,abs(u)))*front;
   vec3 lip=mix(vec3(0.515,0.276,0.224),vec3(0.436,0.224,0.182),smoothstep(centre-0.001,centre+0.001,vPortraitPosition.y));
   diffuseColor.rgb=mix(diffuseColor.rgb,lip,lipMask*0.68);
   float cheek=exp(-pow((abs(vPortraitPosition.x)-0.048)/0.024,2.0)-pow((vPortraitPosition.y-1.564)/0.024,2.0))*front;
   diffuseColor.rgb*=mix(vec3(1.0),vec3(1.025,0.97,0.965),cheek*0.65);
  `);
 };
 material.customProgramCacheKey=()=>FACE_VERSION+'-integrated-skin';
 const ocular=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.24,metalness:0,clearcoat:.3,clearcoatRoughness:.20});
 ocular.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec2 eyeCoord; varying vec2 vEyeCoord;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeCoord=eyeCoord;');
  shader.fragmentShader='varying vec2 vEyeCoord;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float r=length(vEyeCoord),a=atan(vEyeCoord.y,vEyeCoord.x),aa=max(fwidth(r),0.000025);
   float irisMask=1.0-smoothstep(${IRIS_RADIUS}-aa,${IRIS_RADIUS}+aa,r);
   float pupilMask=1.0-smoothstep(${PUPIL_RADIUS}-aa,${PUPIL_RADIUS}+aa,r);
   float limbus=1.0-smoothstep(0.0054-aa,0.0054+aa,r);
   float fibres=0.94+0.035*sin(a*47.0+r*4400.0)+0.025*sin(a*83.0-r*7300.0);
   vec3 pigment=mix(vec3(0.475,0.443,0.400),vec3(0.037,0.026,0.018),limbus);
   vec3 iris=mix(vec3(0.18,0.092,0.046),vec3(0.084,0.039,0.018),smoothstep(0.002,0.005,r))*fibres;
   pigment=mix(pigment,iris,irisMask);pigment=mix(pigment,vec3(0.006,0.007,0.005),pupilMask);
   pigment*=1.0-0.11*smoothstep(0.0008,0.004,vEyeCoord.y);
   float reflection=1.0-smoothstep(0.00012,0.00033,length(vEyeCoord-vec2(-0.0011,0.0013)));
   pigment=mix(pigment,vec3(0.88,0.86,0.80),reflection*0.6);
   diffuseColor.rgb=diffuse*pigment;
  `);
 };
 ocular.customProgramCacheKey=()=>FACE_VERSION+'-recessed-iris';
 const mesh=new T.Mesh(geometry,[material,ocular]);mesh.name='avatar-facial-details';
 const group=new T.Group();group.name='avatar-face';group.add(mesh);
 const previousCompile=body.material.onBeforeCompile,previousKey=body.material.customProgramCacheKey;
 const scaleUniform={value:1},offsetUniform={value:new T.Vector3()};
 const skinCompile=function(shader,renderer){
  previousCompile.call(this,shader,renderer);shader.uniforms.portraitScale=scaleUniform;shader.uniforms.portraitOffset=offsetUniform;
  shader.vertexShader='uniform float portraitScale;uniform vec3 portraitOffset;varying float vOriginalHeadY;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOriginalHeadY=(position.y-portraitOffset.y)/portraitScale;');
  shader.fragmentShader='varying float vOriginalHeadY;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nif(vOriginalHeadY>=${PORTRAIT_JOIN_Y.toFixed(4)})discard;`);
 };
 body.material.onBeforeCompile=skinCompile;body.material.customProgramCacheKey=function(){return previousKey.call(this)+'-'+FACE_VERSION;};body.material.needsUpdate=true;body.add(group);
 let destroyed=false,updates=0;const normalScratch=new T.Vector3(),bodyNormalScratch=new T.Vector3();
 function update(){
  if(destroyed)return;updates++;
  const scale=body.userData.scale/body.userData.unit,p=body.geometry.attributes.position,n=body.geometry.attributes.normal,i=anchor*3;
  if(!Number.isFinite(scale)||scale<=0)throw Error('Escala facial inválida');
  group.scale.setScalar(scale);group.position.set(p.getX(anchor)-base[i]*scale,p.getY(anchor)-base[i+1]*scale,p.getZ(anchor)-base[i+2]*scale);group.updateMatrix();
  scaleUniform.value=scale;offsetUniform.value.copy(group.position);
  // Exact source-edge attachments preserve the neck join on every body setting.
  // Only this small band updates: eyes, skin topology and shaders are not rebuilt.
  const gp=geometry.attributes.position,gn=geometry.attributes.normal;
  for(const {vertex,a,b,basePoint} of attachments){
   const k=vertex*3;
   for(let axis=0;axis<3;axis++){
    const world=(p.array[a*3+axis]+p.array[b*3+axis])/2;
    gp.array[k+axis]=restSkin[k+axis]+(world-group.position.getComponent(axis))/scale-basePoint[axis];
   }
   const blend=1-smooth((restSkin[k+1]-PORTRAIT_JOIN_Y)/.020);
   const normal=normalScratch.fromArray(restNormals,k),bodyNormal=bodyNormalScratch.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();
   normal.lerp(bodyNormal,blend).normalize();gn.setXYZ(vertex,normal.x,normal.y,normal.z);
  }
  gp.needsUpdate=true;gn.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 update();head.dispose();tree.geometry.dispose();const buildMs=performance.now()-started;
 return {group,update,snapshot:()=>({version:FACE_VERSION,buildMs,updates,eyes:true,eyebrows:true,lips:true,eyeSurface:'recessed-ellipsoid',eyeVertices:ranges.reduce((n,r)=>n+r.count,0),gaze:'parallel-forward',irisRadiusMm:IRIS_RADIUS*1000,pupilRadiusMm:PUPIL_RADIUS*1000,eyelids:'integrated-head-surface',browHairs,lashHairs,expression:'neutral',continuousEyePigment:true,constructionVertices:positions.length/3,skinVertices:headVertexCount,skinSurfaceVersion:PORTRAIT_SURFACE_VERSION,portraitStyle,drawBatches:2,extraTextureRequests:0,sampleQueries:queries,bodyGeometryChanged:false,bodyMeasurementsChanged:false,clothChanged:false,displayHeadRefined:true,neckAttachmentVertices:attachments.length,headJoinY:PORTRAIT_JOIN_Y}),destroy(){if(destroyed)return;destroyed=true;body.remove(group);geometry.dispose();material.dispose();ocular.dispose();if(body.material.onBeforeCompile===skinCompile){body.material.onBeforeCompile=previousCompile;body.material.customProgramCacheKey=previousKey;body.material.needsUpdate=true;}}};
}
