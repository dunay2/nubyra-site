import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshBVH,SAH} from 'three-mesh-bvh';
import {CM_PER_UNIT} from './body-surface.mjs';
export const HUMAN_VERSION='mpfb-female/1.0';
export const SOURCE_HEIGHT=1.7000000476837158;
export const LANDMARKS=Object.freeze({chest:1.25,hip:.875,waist:1.1,shoulder:1.40,crotch:.785});
const unit=CM_PER_UNIT/100,zc=.045,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const blend=(a,b,t)=>a+(b-a)*smooth(t);
/** Exact horizontal torso section. Arms/hands are distinct loops and excluded. */
function sectionEdges(p,index,y){
 const segments=[];
 for(let i=0;i<index.length;i+=3){const crossing=[];
  for(let k=0;k<3;k++){const a=index[i+k],b=index[i+(k+1)%3],u=p[3*a+1],v=p[3*b+1];if((y-u)*(y-v)<0){const t=(y-u)/(v-u);crossing.push({a,b,t,x:p[3*a]+t*(p[3*b]-p[3*a]),z:p[3*a+2]+t*(p[3*b+2]-p[3*a+2])});}}
  if(crossing.length===2)segments.push(crossing);
 }
 const key=v=>Math.round(v.x*1e6)+':'+Math.round(v.z*1e6),adj=new Map();
 for(const [a,b]of segments){for(const[u,v]of[[a,b],[b,a]]){const k=key(u);if(!adj.has(k))adj.set(k,{p:u,to:[]});adj.get(k).to.push(key(v));}}
 let best=[],score=Infinity;const visited=new Set();
 for(const id of adj.keys()){if(visited.has(id))continue;const q=[id],ids=new Set();while(q.length){const k=q.pop();if(visited.has(k))continue;visited.add(k);ids.add(k);q.push(...adj.get(k).to);}
  const xs=[...ids].map(k=>adj.get(k).p.x),center=Math.abs((Math.min(...xs)+Math.max(...xs))/2),width=Math.max(...xs)-Math.min(...xs);
  if(width>.10&&center<score){score=center;best=segments.filter(([a])=>ids.has(key(a)));}
 }
 if(!best.length)throw Error('No se encuentra la sección corporal de referencia');return best;
}
const coord=(p,v,k)=>p[v.a*3+k]+v.t*(p[v.b*3+k]-p[v.a*3+k]);
function measure(p,edges){return edges.reduce((c,[a,b])=>c+Math.hypot(coord(p,a,0)-coord(p,b,0),coord(p,a,2)-coord(p,b,2)),0)*CM_PER_UNIT;}
export async function loadHumanBody(bytes){
 const loader=new GLTFLoader();const gltf=bytes?await loader.parseAsync(bytes,''):await loader.loadAsync(new URL('./assets/human-female.glb',import.meta.url).href);
 gltf.scene.updateMatrixWorld(true);const found=[];gltf.scene.traverse(m=>{if(m.isMesh)found.push(m);});if(found.length!==1)throw Error('La base humana debe contener una sola malla');
 const src=found[0],geometry=src.geometry.clone().applyMatrix4(src.matrixWorld),base=geometry.attributes.position.array.slice();
 const body=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x83b5bd,roughness:.88,metalness:0}));body.name='NUBYRA · base humana femenina MPFB';
 const sections={chest:sectionEdges(base,geometry.index.array,LANDMARKS.chest),hip:sectionEdges(base,geometry.index.array,LANDMARKS.hip)};
 body.userData={version:HUMAN_VERSION,base,sections,sourceHeight:SOURCE_HEIGHT,adultReference:true,anthropometryValidated:false};
 return body;
}
/** Smooth, bounded metric deformation of an existing human; not anatomy inferred from a photograph. */
export function updateHumanBody(body,state,{collision=true}={}){
 for(const k of ['bodyHeightCm','bodyChestCm','bodyHipCm','frontVolume','sideVolume','backVolume'])if(!Number.isFinite(state[k]))throw Error('Medida no válida: '+k);
 const {base,sections}=body.userData,p=body.geometry.attributes.position.array,s=state.bodyHeightCm/100/SOURCE_HEIGHT;
 const height=y=>1.20+(y-LANDMARKS.shoulder)*s/unit;
 let chestFactor=1,hipFactor=1;
 function apply(){
  for(let i=0;i<base.length;i+=3){const x=base[i],y=base[i+1],z=base[i+2]-zc;
   let factor;
   if(y<.52)factor=Math.pow(hipFactor,.25);else if(y<.84)factor=blend(Math.pow(hipFactor,.25),hipFactor,(y-.52)/.32);else if(y<=.93)factor=hipFactor;
   else if(y<1.19)factor=blend(hipFactor,chestFactor,(y-.93)/.26);else if(y<=1.29)factor=chestFactor;
   else if(y<1.44)factor=blend(chestFactor,Math.pow(chestFactor,.25),(y-1.29)/.15);else factor=blend(Math.pow(chestFactor,.25),1,(y-1.44)/.09);
   // Preserve arms and hands; translate at the shoulder rather than inflating every extremity.
   const arm=smooth((Math.abs(x)-.18)/.08)*smooth((y-.86)/.12);factor=blend(factor,Math.pow(chestFactor,.25),arm);
   const band=smooth((y-1.10)/.09)*(1-smooth((y-1.30)/.11))*(1-arm);
   const side=1+(state.sideVolume-5)*.014*band,depth=1+(z>=0?(state.frontVolume-3):state.backVolume-5)*.018*band;
   p[i]=x*s/unit*factor*side;p[i+1]=height(y);p[i+2]=z*s/unit*factor*depth;
  }
 }
 apply();for(let n=0;n<3;n++){chestFactor*=state.bodyChestCm/measure(p,sections.chest);hipFactor*=state.bodyHipCm/measure(p,sections.hip);apply();}
 const g=body.geometry;g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 if(collision){if(g.boundsTree)g.boundsTree.refit();else g.boundsTree=new MeshBVH(g,{strategy:SAH,maxLeafTris:10});}
 body.userData.measurements={chestCm:measure(p,sections.chest),hipCm:measure(p,sections.hip),heightCm:(g.boundingBox.max.y-g.boundingBox.min.y)*CM_PER_UNIT};
 Object.assign(body.userData,{height:state.bodyHeightCm,scale:s,unit,sourceToY:height,chestY:height(LANDMARKS.chest),hipY:height(LANDMARKS.hip),waistY:height(LANDMARKS.waist),shoulderY:1.2,floorY:height(0),headTopY:height(SOURCE_HEIGHT),chestFactor,hipFactor,shapeWithinPreset:chestFactor>=.75&&chestFactor<=1.4&&hipFactor>=.75&&hipFactor<=1.4});
 return body;
}
/** Exact mesh BVH. Visible positions and indexed collision triangles are the same buffers. */
export function createHumanCollider(body){
 const geometry=body.geometry,tree=geometry.boundsTree,pos=geometry.attributes.position,index=geometry.index;
 const point=new T.Vector3(),hit={point:new T.Vector3(),distance:Infinity,faceIndex:0},a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),delta=new T.Vector3(),out=[0,0,0];
 const tri=new T.Triangle(a,b,c),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));let queries=0;
 function sample(x,y,z){queries++;point.set(x,y,z);tree.closestPointToPoint(point,hit,0,Infinity);const f=hit.faceIndex*3;a.fromBufferAttribute(pos,index.getX(f));b.fromBufferAttribute(pos,index.getX(f+1));c.fromBufferAttribute(pos,index.getX(f+2));tri.getNormal(normal);delta.subVectors(point,hit.point);return delta.dot(normal)<0?-hit.distance:hit.distance;}
 return {kind:'same-mesh-bvh',geometry,shoulderHalfWidth:.72,neckHalfWidth:.20,
  gap:sample,
  project(x,y,z,margin){const gap=sample(x,y,z);if(gap>=margin)return null;if(hit.distance>1e-9)normal.copy(delta).multiplyScalar((gap<0?-1:1)/hit.distance);out[0]=hit.point.x+normal.x*margin;out[1]=hit.point.y+normal.y*margin;out[2]=hit.point.z+normal.z*margin;return out;},
  surfaceHeight(x,z){ray.origin.set(x,body.userData.shoulderY+.3,z);const h=tree.raycastFirst(ray,T.DoubleSide);return h?h.point.y:body.userData.shoulderY;},
  stats:()=>({queries,triangles:index.count/3,sharedPositionBuffer:geometry===body.geometry})
 };
}
export function humanSection(body,name){const {sections}=body.userData,p=body.geometry.attributes.position.array,edges=sections[name];return edges.flatMap(([a,b])=>[new T.Vector3(coord(p,a,0),coord(p,a,1),coord(p,a,2)),new T.Vector3(coord(p,b,0),coord(p,b,1),coord(p,b,2))]);}
