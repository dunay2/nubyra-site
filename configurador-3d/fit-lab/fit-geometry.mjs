/**
 * NUBYRA Fit Lab — POC geométrica de dos mallas independientes.
 * Entradas en cm de DEMOSTRACIÓN. Sin calibración antropométrica, sin fitting ni fabricación.
 * El cuerpo es un volumen sintético abstracto, nunca la representación de una jugadora.
 */
export const FIT_VERSION='nubyra.fit-lab/0.1';
export const DEFAULT_FIT=Object.freeze({
  bodyChestCm:88,bodyHipCm:96,bodyHeightCm:160,
  garmentChestCm:102,garmentHipCm:110,garmentLengthCm:64
});
export const LIMITS=Object.freeze({
  bodyChestCm:[65,120],bodyHipCm:[70,130],bodyHeightCm:[125,190],
  garmentChestCm:[75,135],garmentHipCm:[80,145],garmentLengthCm:[48,84]
});
export const MODES=Object.freeze(['body','garment']);
const snapshot=new WeakMap();
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const gauss=(v)=>Math.exp(-(v*v));
const smooth=(v)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};

export function normalizeFit(values){
  const result={};
  for(const [key,[min,max]] of Object.entries(LIMITS)){
    const v=Number(values?.[key]);
    result[key]=Number.isFinite(v)?clamp(v,min,max):DEFAULT_FIT[key];
  }
  return result;
}
export function serializeFit(state){
  const values=normalizeFit(state);
  return {
    schema:FIT_VERSION,
    status:'experimental-not-manufacturing-approved',
    kind:'synthetic-geometry-not-anthropometric',
    body:{chestCm:values.bodyChestCm,hipCm:values.bodyHipCm,heightReferenceCm:values.bodyHeightCm},
    garment:{chestTargetCm:values.garmentChestCm,hipTargetCm:values.garmentHipCm,
      lengthTargetCm:values.garmentLengthCm},
    differencesNominalCm:{
      chest:values.garmentChestCm-values.bodyChestCm,
      hip:values.garmentHipCm-values.bodyHipCm
    },
    note:'Entradas ilustrativas en cm: NO son perímetros medidos sobre la malla, ni holguras útiles certificadas. No se ha evaluado material elástico, fricción, tensión o fabricación.'
  };
}
export function nominalDifferences(input){
  const v=normalizeFit(input);
  return {chest:v.garmentChestCm-v.bodyChestCm,hip:v.garmentHipCm-v.bodyHipCm};
}
// Perfil de torso abstracto: no presupone edad, sexo o medidas normalizadas.
function bodyHalfAxes(y){
  const bust=gauss((y-.27)/.44),hips=gauss((y+.98)/.43);
  const shoulder=gauss((y-.86)/.38);
  return {
    width:.386+.102*bust+.083*hips+.038*shoulder,
    depth:.151+.079*bust+.063*hips+.032*shoulder
  };
}
export function createReferenceBody(T){
  if(!T?.BufferGeometry||!T?.Mesh)throw Error('Se requiere Three.js');
  const rows=44,around=56,pos=[],uv=[],indices=[];
  for(let r=0;r<=rows;r++){
    const y=-1.16+2.20*r/rows,axes=bodyHalfAxes(y);
    for(let a=0;a<=around;a++){
      const theta=Math.PI*2*a/around;
      pos.push(Math.cos(theta)*axes.width,y,Math.sin(theta)*axes.depth-.005);
      uv.push(a/around,r/rows);
    }
  }
  for(let r=0;r<rows;r++)for(let a=0;a<around;a++){
    const i=r*(around+1)+a,j=i+around+1;
    indices.push(i,j,i+1,i+1,j,j+1);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  const material=new T.MeshPhysicalMaterial({
    color:0x57a8bc,metalness:.02,roughness:.68,
    transparent:true,opacity:.80,depthWrite:false,side:T.DoubleSide
  });
  const mesh=new T.Mesh(geo,material);
  mesh.name='NUBYRA / torso sintético independiente';
  mesh.userData.fitRole='body';mesh.renderOrder=0;
  return mesh;
}
function cacheBase(mesh){
  let original=snapshot.get(mesh);
  if(original)return original;
  const attr=mesh.geometry?.getAttribute('position');
  if(!attr)throw Error('La malla no dispone de posiciones');
  original=new Float32Array(attr.array);
  snapshot.set(mesh,original);
  return original;
}
function changePositions(mesh,transform){
  const position=mesh.geometry.getAttribute('position');
  const original=cacheBase(mesh);
  for(let i=0;i<position.count;i++){
    const ix=i*3,x=original[ix],y=original[ix+1],z=original[ix+2];
    const [nx,ny,nz]=transform(x,y,z);
    if(![nx,ny,nz].every(Number.isFinite))throw Error('Deformación inválida');
    position.setXYZ(i,nx,ny,nz);
  }
  position.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
}
export function deformBody(mesh,values){
  if(mesh?.userData?.fitRole!=='body')throw Error('Se esperaba la malla corporal');
  const v=normalizeFit(values);
  const deltaChest=v.bodyChestCm/DEFAULT_FIT.bodyChestCm-1;
  const deltaHip=v.bodyHipCm/DEFAULT_FIT.bodyHipCm-1;
  changePositions(mesh,(x,y,z)=>{
    const chest=gauss((y-.28)/.43),hip=gauss((y+.98)/.46);
    const scale=1+deltaChest*chest+deltaHip*hip;
    return [x*scale,y,(z+.005)*scale-.005];
  });
  return mesh;
}
export function deformGarment(group,values){
  if(!group?.traverse)throw Error('La prenda debe ser un grupo de mallas independiente');
  const v=normalizeFit(values);
  const deltaChest=v.garmentChestCm/DEFAULT_FIT.garmentChestCm-1;
  const deltaHip=v.garmentHipCm/DEFAULT_FIT.garmentHipCm-1;
  const extraLength=(v.garmentLengthCm-DEFAULT_FIT.garmentLengthCm)/40;
  let count=0;
  group.traverse(mesh=>{
    if(!mesh.isMesh || !mesh.geometry?.getAttribute('position'))return;
    count++;
    changePositions(mesh,(x,y,z)=>{
      const bustWeight=gauss((y-.27)/.44);
      const hipWeight=gauss((y+1.02)/.48);
      const radial=1+deltaChest*bustWeight+deltaHip*hipWeight;
      // Ensanchar y dar profundidad por separado mantiene un volumen real en 3D.
      const depth=1+1.12*deltaChest*bustWeight+.94*deltaHip*hipWeight;
      // El escote y hombros apenas se desplazan; el bajo absorbe el largo.
      const lower=smooth((.53-y)/1.75);
      const shiftedY=y-extraLength*lower;
      return [x*radial,shiftedY,z*depth];
    });
  });
  if(count===0)throw Error('Prenda sin superficies deformables');
  return count;
}
// Inspección aproximada, NO holgura verificada ni perímetro real calculado.
export function getBodyExtentAt(mesh,y,band=.035){
  if(!mesh?.geometry)throw Error('Cuerpo requerido');
  const p=mesh.geometry.getAttribute('position');let maxX=0,maxZ=0;
  for(let i=0;i<p.count;i++){
    if(Math.abs(p.getY(i)-y)>band)continue;
    maxX=Math.max(maxX,Math.abs(p.getX(i)));
    maxZ=Math.max(maxZ,Math.abs(p.getZ(i)));
  }
  return {halfWidth:maxX,halfDepth:maxZ};
}
