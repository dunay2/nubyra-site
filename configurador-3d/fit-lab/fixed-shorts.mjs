import * as T from 'three';
import {CM_PER_UNIT} from './body-surface.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,fixedShortKey} from './fixed-sizes.mjs';
export const FIXED_SHORTS_VERSION='fixed-shorts-envelope/1.0';
/** Perimeter of an indexed triangle section; source torso membership excludes arms. */
export function horizontalPerimeter(geometry,y,base=null){
 const p=geometry.attributes.position,idx=geometry.index;let length=0;
 for(let f=0;f<idx.count;f+=3){
  const ids=[idx.getX(f),idx.getX(f+1),idx.getX(f+2)];if(base&&ids.some(i=>Math.abs(base[i*3])>=.205))continue;
  const hit=[];for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],ya=p.getY(a),yb=p.getY(b);if((ya<=y&&yb>y)||(yb<=y&&ya>y)){const t=(y-ya)/(yb-ya);hit.push([p.getX(a)+t*(p.getX(b)-p.getX(a)),p.getZ(a)+t*(p.getZ(b)-p.getZ(a))]);}}
  if(hit.length===2)length+=Math.hypot(hit[0][0]-hit[1][0],hit[0][1]-hit[1][1]);
 }
 return length*CM_PER_UNIT;
}
export function shortSupport(body,pattern){
 const d=body.userData,base=d.base,waistY=d.sourceToY(1.065),waist=horizontalPerimeter(body.geometry,waistY,base);
 const slices=[];for(let i=0;i<=48;i++){const y=waistY-i*(waistY-d.sourceToY(.80))/48;slices.push({y,cm:horizontalPerimeter(body.geometry,y,base)});}
 const maximum=Math.max(...slices.map(x=>x.cm)),hip=d.measurements.hipCm,blocked=waist>pattern.waistCm+.4||hip>pattern.hipCm+.4;
 let stopY=waistY,status=blocked?'too-small':'supported';
 if(!blocked){const i=slices.findIndex(x=>x.cm>=pattern.waistCm);if(i<0){status='unsupported';stopY=d.floorY+pattern.lengthCm/CM_PER_UNIT;}else if(i>0){const a=slices[i-1],b=slices[i];stopY=a.y+(b.y-a.y)*(pattern.waistCm-a.cm)/(b.cm-a.cm);}}
 return{status,blocked,waistCm:waist,hipCm:hip,maxSupportCm:maximum,startY:waistY,stopY,dropCm:Math.max(0,(waistY-stopY)*CM_PER_UNIT),kind:'fixed-waist-geometric-contact',elasticityModelled:false,clothSimulated:false};
}
/** Current body only sets placement/support, never any pattern vertex. */
export function createFixedShortFactory(asset){
 if(asset?.version!==FIXED_SHORTS_VERSION||!asset.patterns)throw Error('Faltan patrones fijos del pantalón');
 const templates=new Map();
 for(const[size]of Object.entries(SHORT_SIZES))for(const length of SHORT_LENGTHS){
  const key=fixedShortKey(size,length),v=asset.patterns[key];
  if(!v||v.positions.length%3||v.indices.length%3||!v.positions.every(Number.isFinite)||!v.indices.every(i=>Number.isInteger(i)&&i>=0&&i<v.positions.length/3))throw Error('Patrón fijo no válido: '+key);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.positions,3));g.setIndex(v.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();for(const q of v.groups)g.addGroup(q.start,q.count,q.materialIndex);
  if(Math.abs((g.boundingBox.max.y-g.boundingBox.min.y)*CM_PER_UNIT-length)>.02)throw Error('Largo de patrón inconsistente');templates.set(key,{geometry:g,pattern:v.nominal});
 }
 return{
  create(body,{size='P1',lengthCm=42,base='#173e64',accent='#f8c12e'}={}){
   const key=fixedShortKey(size,Number(lengthCm)),template=templates.get(key),pattern=template.pattern,support=shortSupport(body,pattern);
   if(support.blocked)throw Error('Pantalón '+size+' demasiado pequeño para el cuerpo: conserva cintura y cadera fijas.');
   const geometry=template.geometry.clone(),primary=new T.MeshStandardMaterial({color:base,roughness:.87,side:T.DoubleSide}),secondary=primary.clone();secondary.color.set(accent);
   const mesh=new T.Mesh(geometry,[primary,secondary]);mesh.name='Pantalón fijo '+key;mesh.position.y=support.startY;let elapsed=0,complete=support.dropCm<.01;
   return{mesh,version:FIXED_SHORTS_VERSION,fit:'fixed-size',lengthCm:pattern.lengthCm,requestedLengthCm:pattern.lengthCm,minLengthCm:34,maxLengthCm:50,kneeTop:body.userData.sourceToY(.53),pattern,support,
    coverage:{bodyHidden:false,bodyGeometryChanged:false,garmentAdaptedToBody:false},clothSimulated:false,
    get top(){return mesh.position.y;},get bottom(){return mesh.position.y-pattern.lengthCm/CM_PER_UNIT;},get moving(){return !complete;},
    advance(dt){if(complete)return false;elapsed+=Math.max(0,Math.min(.05,dt));mesh.position.y=Math.max(support.stopY,support.startY-.5*(981/CM_PER_UNIT)*elapsed*elapsed);complete=mesh.position.y<=support.stopY;return true;},
    settle(){mesh.position.y=support.stopY;complete=true;},
    snapshot:()=>({key,nominal:{...pattern},support:{...support},translationY:mesh.position.y,moving:!complete,restGeometryIndependent:true,clothSimulated:false}),
    colors(base,accent){primary.color.set(base);secondary.color.set(accent);},destroy(){geometry.dispose();primary.dispose();secondary.dispose();}};
  },destroy(){for(const p of templates.values())p.geometry.dispose();templates.clear();}
 };
}
