import * as T from 'three';

export const PORTRAIT_SURFACE_VERSION = 'portrait-surface/1.0';
export const PORTRAIT_CUT_Y = 1.465;
const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t*t*(3-2*t); };

/** Single, bounded subdivision of the display head. The fitting mesh is read-only.
 * Skull height, scalp, neck join and boundary positions are preserved. Not a
 * reconstruction from the concept image or a new anthropometric measurement. */
export function createPortraitSurface(base, sourceIndex) {
  if (!(base instanceof Float32Array) || !sourceIndex) throw Error('Base facial inválida');
  const mapped = new Map(), vertices = [], faces = [];
  const vertex = id => {
    if (!mapped.has(id)) { mapped.set(id, vertices.length); vertices.push(new T.Vector3().fromArray(base,id*3)); }
    return mapped.get(id);
  };
  for (let i=0;i<sourceIndex.count;i+=3) {
    const ids=[0,1,2].map(k=>sourceIndex.getX(i+k));
    if (ids.every(id=>base[id*3+1]>1.445)) faces.push(ids.map(vertex));
  }
  if (!faces.length) throw Error('No se encontró la superficie de la cabeza');
  const edges=new Map(), neighbours=vertices.map(()=>new Set());
  function edge(a,b,opposite) {
    const key=a<b?`${a}:${b}`:`${b}:${a}`;
    if(!edges.has(key)) edges.set(key,{a,b,opposites:[]});
    edges.get(key).opposites.push(opposite);neighbours[a].add(b);neighbours[b].add(a);
  }
  for(const [a,b,c] of faces){edge(a,b,c);edge(b,c,a);edge(c,a,b);}
  const boundary=new Set();for(const e of edges.values())if(e.opposites.length!==2){boundary.add(e.a);boundary.add(e.b);}
  // Damp the subdivision displacement in source metres; never move the cranium
  // under the existing hair, the neck junction, or a source vertex by >1.2 mm.
  const strength=p=>smooth((p.y-1.478)/.024)*(1-smooth((p.y-1.635)/.022))*.85;
  let maxShift=0;
  function blend(p,q){
    const delta=q.clone().sub(p).multiplyScalar(strength(p));
    if(delta.length()>.0012)delta.setLength(.0012);
    maxShift=Math.max(maxShift,delta.length());return p.clone().add(delta);
  }
  const result=vertices.map((p,i)=>{
    if(boundary.has(i))return p.clone();
    const adjacent=[...neighbours[i]],n=adjacent.length,beta=n===3?3/16:3/(8*n);
    const q=p.clone().multiplyScalar(1-n*beta);for(const j of adjacent)q.addScaledVector(vertices[j],beta);
    return blend(p,q);
  });
  for(const e of edges.values()){
    const mid=vertices[e.a].clone().lerp(vertices[e.b],.5);let q=mid.clone();
    if(e.opposites.length===2){q=vertices[e.a].clone().add(vertices[e.b]).multiplyScalar(3/8);for(const o of e.opposites)q.addScaledVector(vertices[o],1/8);}
    e.id=result.length;result.push(blend(mid,q));
  }
  const edgeId=(a,b)=>edges.get(a<b?`${a}:${b}`:`${b}:${a}`).id,indices=[];
  for(const[a,b,c]of faces){const ab=edgeId(a,b),bc=edgeId(b,c),ca=edgeId(c,a);indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(result.flatMap(p=>p.toArray()),3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.portrait={version:PORTRAIT_SURFACE_VERSION,sourceVertices:vertices.length,vertices:result.length,triangles:indices.length/3,maxSourceShiftMm:maxShift*1000,cutY:PORTRAIT_CUT_Y,bodyMutated:false};
  return geometry;
}

/** Shader detail is shading only and fades below a pixel; no texture request. */
export function configurePortraitMaterial(material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPortraitSource;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPortraitSource=position;');
    shader.fragmentShader='varying vec3 vPortraitSource;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(vPortraitSource.y < ${PORTRAIT_CUT_Y.toFixed(4)}) discard;
      float cheek=exp(-pow((abs(vPortraitSource.x)-0.048)/0.023,2.0)-pow((vPortraitSource.y-1.562)/0.023,2.0));
      float front=smoothstep(0.04,0.11,vPortraitSource.z);
      diffuseColor.rgb*=mix(vec3(1.0),vec3(1.024,0.983,0.980),cheek*front);
      float frequency=16000.0;
      float fade=1.0-smoothstep(0.35,1.5,length(fwidth(vPortraitSource))*frequency);
      float grain=sin(vPortraitSource.x*frequency)*sin(vPortraitSource.y*frequency*.91)*sin(vPortraitSource.z*frequency*1.13);
      diffuseColor.rgb*=1.0+0.006*grain*fade*front;
    `);
  };
  material.customProgramCacheKey=()=>PORTRAIT_SURFACE_VERSION;
}
