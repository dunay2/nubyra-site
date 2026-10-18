import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SKIN_COLOR} from './human-appearance.mjs';

export const FACE_VERSION = 'human-face/2.0-rim-fitted';
// Source-head metres. Appearance never writes to the metric body or its collider.
export const FACE_DETAIL = Object.freeze({eyeColumns:64,eyeRows:18,irisRadiusM:.00535,pupilRadiusM:.00195,eyeLiftM:.00016,cornealBulgeM:.00075});
const smooth = x => {const t=T.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};

export function createHumanFace(body) {
  const {base}=body.userData,index=body.geometry.index;
  const source=new T.BufferGeometry();
  source.setAttribute('position',new T.Float32BufferAttribute(base.slice(),3));
  const ids=[];
  for(let i=0;i<index.count;i+=3){const t=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(t.every(j=>base[j*3+1]>1.49))ids.push(...t);}
  source.setIndex(ids);
  const tree=new MeshBVH(source,{maxLeafTris:8}),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
  let queries=0,anchor=-1;
  for(let i=0;i<base.length;i+=3)if(base[i+1]>1.65){anchor=i;break;}
  if(anchor<0){source.dispose();throw Error('No se encuentra la referencia de la cabeza');}
  function sample(x,y){queries++;ray.origin.set(x,y,.5);const hit=tree.raycastFirst(ray,T.DoubleSide);if(!hit)throw Error('Detalle facial fuera de la cabeza');return hit.point.clone();}
  const positions=[],colors=[],indices=[],groups=[],eyeVertexRanges=[],eyeRims=[];
  const skin=new T.Color(SKIN_COLOR),sclera=new T.Color('#ded8ce'),iris=new T.Color('#654732'),irisGold=new T.Color('#8b6645'),limbus=new T.Color('#362b24'),pupil=new T.Color('#10100f'),brow=new T.Color('#50382a'),lash=new T.Color('#684b39');
  function grid(nx,ny,point,color,material=0){
    const start=positions.length/3,indexStart=indices.length;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=-1+2*i/nx,v=j/ny,p=point(u,v,i,j),c=color(u,v,p);positions.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);}
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=start+j*(nx+1)+i,b=a+nx+1;indices.push(a,a+1,b,a+1,b+1,b);}
    groups.push({start:indexStart,count:indices.length-indexStart,materialIndex:material});return {start,count:positions.length/3-start};
  }
  // Locate the visible rim, rather than sampling the recessed socket wall. Each
  // column is traced once and reused by all rows (no per-frame or per-row rays).
  function rimAt(x){
    const low=1.578,high=1.601,cy=1.5885;
    const lowerSkin=sample(x,low),upperSkin=sample(x,high),threshold=Math.min(lowerSkin.z,upperSkin.z)-.008;
    const samples=[];
    for(let y=1.580;y<=1.5991;y+=.001)samples.push({y,z:sample(x,y).z});
    const recessed=samples.filter(s=>s.z<threshold);
    if(!recessed.length){const p=sample(x,cy);return {lower:p,upper:p.clone(),open:false};}
    function border(inside,outside){for(let k=0;k<10;k++){const mid=(inside+outside)/2;if(sample(x,mid).z<threshold)inside=mid;else outside=mid;}return sample(x,outside);}
    const lower=border(recessed[0].y,recessed[0].y-.0012),upper=border(recessed.at(-1).y,recessed.at(-1).y+.0012);
    if(upper.y-lower.y>.014||Math.abs(upper.z-lower.z)>.010)throw Error('Contorno de párpado no válido');
    return {lower,upper,open:true};
  }
  let eyeVertices=0;
  try {
    for(const side of [-1,1]){
      const cx=.0315*side,halfWidth=.0135,n=FACE_DETAIL.eyeColumns;
      const rims=Array.from({length:n+1},(_,i)=>rimAt(cx+(-1+2*i/n)*halfWidth));
      eyeRims.push(rims.map(r=>({lower:r.lower.toArray(),upper:r.upper.toArray(),open:r.open})));
      const centre=rims[Math.round(n/2)],cy=(centre.lower.y+centre.upper.y)/2+.0003;
      const range=grid(n,FACE_DETAIL.eyeRows,(u,v,i)=>{
        const r=rims[i],p=r.lower.clone().lerp(r.upper,v);
        const bulge=FACE_DETAIL.cornealBulgeM*Math.max(0,1-u*u)*Math.sin(Math.PI*v);
        p.z+=FACE_DETAIL.eyeLiftM+bulge;return p;
      },(u,v,p)=>{
        const dx=p.x-cx,dy=p.y-cy,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx),edge=Math.min(v,1-v);
        const c=sclera.clone().multiplyScalar(.87+.13*Math.sin(Math.PI*v));
        if(r<FACE_DETAIL.irisRadiusM){const radial=r/FACE_DETAIL.irisRadiusM;
          c.copy(iris).lerp(irisGold,(1-radial)*.38).multiplyScalar(.92+.08*Math.sin(a*31+r*3700)**2);
          if(radial>.85)c.lerp(limbus,smooth((radial-.85)/.15)*.82);
          if(r<FACE_DETAIL.pupilRadiusM)c.copy(pupil);
        }
        if(edge<.055)c.lerp(skin,(.055-edge)/.055*.72);
        return c;
      },1);eyeVertices+=range.count;eyeVertexRanges.push(range);
      // Skin-coloured rims and a submillimetre lash edge remain attached to the
      // measured opening, including the tear-duct corners; no floating eye cards.
      for(const upper of [false,true]){
        const endpoints=rims.map(r=>upper?r.upper:r.lower);
        const outer=endpoints.map((p,i)=>sample(p.x,p.y+(upper?1:-1)*.0017*Math.sin(i/n*Math.PI)));
        grid(n,3,(u,v,i)=>endpoints[i].clone().lerp(outer[i],v).add(new T.Vector3(0,0,.00021)),(u,v)=>skin.clone().lerp(lash,(1-v)*(upper?.30:.10)),0);
      }
      // Tapered individual brow hairs instead of a flat, uniformly dark stripe.
      for(let k=0;k<82;k++){
        const t=(k+.5)/82,x=side*(.014+.037*t),y=1.603+.0042*Math.sin(Math.PI*t)-.001*t;
        const width=.00019,length=.0011+.0012*Math.sin(Math.PI*t),slant=side*(.00065+.00045*t);
        const lower=sample(x,y-length*.5),upper=sample(x+slant,y+length*.5);
        grid(1,2,(u,v)=>lower.clone().lerp(upper,v).add(new T.Vector3(u*width*Math.sin(Math.PI*(.08+.84*v)),0,.00024)),()=>brow.clone().multiplyScalar(.88+.15*Math.sin(k*2.39)**2));
      }
    }
    // Lips meet at one continuous, shallow seam. Sampling only the outer rim
    // prevents an interior-mouth ray from carving an artificial black opening.
    const lipColumns=64,lipWidth=.022;
    const lipData=Array.from({length:lipColumns+1},(_,i)=>{
      const u=-1+2*i/lipColumns,x=u*lipWidth,arch=Math.max(0,1-u*u),centre=1.5235-.0004*u*u;
      const topY=centre+.0090*arch**.72-.0018*Math.exp(-((u/.22)**2));
      const bottomY=centre-.0091*arch**.72;
      const top=sample(x,topY),bottom=sample(x,bottomY);
      const seamZ=(top.z+bottom.z)*.5-.0027*arch;
      return {u,x,arch,centre,top,bottom,seamZ};
    });
    for(const upper of [true,false])grid(lipColumns,8,(u,v,i)=>{
      const d=lipData[i],outer=upper?d.top:d.bottom;
      const seam=new T.Vector3(d.x,d.centre+(upper?.00009:-.00009)*d.arch,d.seamZ);
      const p=seam.lerp(outer,v);p.z+=.00024+.00040*Math.sin(Math.PI*v)*d.arch;return p;
    },(u,v)=>{
      const c=new T.Color(upper?'#b88574':'#c08c7a');
      const feather=Math.max(smooth((v-.18)/.82),smooth((Math.abs(u)-.65)/.35));
      return c.lerp(skin,feather*.96).multiplyScalar(.99+.01*Math.sin(Math.PI*v));
    });
  } finally {source.dispose();}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData={eyeVertexRanges,eyeRims};
  const batches=[[],[]];for(const g of groups)batches[g.materialIndex].push(...indices.slice(g.start,g.start+g.count));geometry.setIndex([...batches[0],...batches[1]]);geometry.addGroup(0,batches[0].length,0);geometry.addGroup(batches[0].length,batches[1].length,1);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.83,side:T.DoubleSide});
  const ocular=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.28,clearcoat:.32,clearcoatRoughness:.21,metalness:0,side:T.DoubleSide});
  const mesh=new T.Mesh(geometry,[material,ocular]);mesh.name='avatar-facial-details';
  const group=new T.Group();group.name='avatar-face';group.add(mesh);body.add(group);let destroyed=false;
  function update(){if(destroyed)return;const s=body.userData.scale/body.userData.unit,p=body.geometry.attributes.position;group.scale.setScalar(s);group.position.set(p.getX(anchor/3)-base[anchor]*s,p.getY(anchor/3)-base[anchor+1]*s,p.getZ(anchor/3)-base[anchor+2]*s);group.updateMatrix();}
  update();
  return {group,update,snapshot:()=>({version:FACE_VERSION,eyes:true,eyebrows:true,lips:true,eyeSurface:'eyelid-rim-cap',eyeVertices,rimFitted:true,maxEyeLiftMm:(FACE_DETAIL.eyeLiftM+FACE_DETAIL.cornealBulgeM)*1000,sourceRayQueries:queries,bodyGeometryChanged:false,expression:'relaxed-closed-lips'}),destroy(){if(destroyed)return;destroyed=true;body.remove(group);geometry.dispose();material.dispose();ocular.dispose();}};
}
