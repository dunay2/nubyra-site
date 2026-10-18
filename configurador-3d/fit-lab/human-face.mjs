import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SKIN_COLOR} from './human-appearance.mjs';

export const FACE_VERSION='human-face/1.2-soft-gaze';

/** Appearance only: fit eye surfaces to eyelid rims, not the empty socket behind them. */
export function createHumanFace(body) {
  const base=body.userData.base,index=body.geometry.index;
  const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(base.slice(),3));
  const ids=[];let anchor=-1;
  for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(tri.every(j=>base[j*3+1]>1.49))ids.push(...tri);}
  for(let i=0;i<base.length;i+=3)if(base[i+1]>1.65){anchor=i/3;break;}
  if(anchor<0)throw Error('No se encuentra la referencia de la cabeza');
  source.setIndex(ids);const tree=new MeshBVH(source,{maxLeafTris:8});
  const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
  const positions=[],colors=[],indices=[];
  const skin=new T.Color(SKIN_COLOR),sclera=new T.Color('#d4c7b8'),iris=new T.Color('#543a26'),rim=new T.Color('#30251c'),pupil=new T.Color('#101513'),glint=new T.Color('#e5dbc9');
  const sample=(x,y)=>{ray.origin.set(x,y,.5);const hit=tree.raycastFirst(ray,T.DoubleSide);if(!hit)throw Error('Detalle facial fuera de la cabeza');return hit.point;};
  // Fine, surface-conforming grids prevent a large triangle from bridging a curved
  // lip or an eye socket and then hiding the smaller details behind that triangle.
  function grid(nx,ny,point,color){
    const start=positions.length/3;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=-1+2*i/nx,v=j/ny,p=point(u,v),c=color(u,v,p);
      positions.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const a=start+j*(nx+1)+i,b=a+nx+1;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  let eyeVertices=0;const eyeVertexRanges=[],eyeIndexRanges=[];
  try{
    for(const side of[-1,1]){
      const cx=.0315*side,cy=1.5895,halfWidth=.0125;
      const bounds=u=>{const arch=Math.max(0,1-u*u)**.65,tilt=side*u*.0010;return {bottom:cy-.0031*arch+tilt,top:cy+.0038*arch+tilt,arch};};
      // The approved mesh has empty eye sockets. Shooting the iris directly into
      // that hole places it ~3 cm behind the eyelids, underneath the white patch.
      // Sample the two actual eyelid rims instead, then span a shallow ocular cap.
      const before=positions.length/3,indexStart=indices.length;
      grid(80,20,(u,v)=>{
        const x=cx+u*halfWidth,{bottom,top,arch}=bounds(u);
        const lower=sample(x,bottom-.0025),upper=sample(x,top+.0025);
        const z=lower.z+(upper.z-lower.z)*v+.0012*arch*Math.sin(Math.PI*v);
        return new T.Vector3(x,bottom+(top-bottom)*v,z+.0005);
      },(u,v,p)=>{
        const r=Math.hypot(p.x-cx,p.y-cy),a=Math.atan2(p.y-cy,p.x-cx);
        let c=sclera.clone();
        if(r<.0053){c.copy(rim);if(r<.0049)c.copy(iris).multiplyScalar(.92+.10*Math.sin(a*31+r*4200)**2);if(r<.0022)c.copy(pupil);}
        if(Math.hypot(p.x-cx+.0010,p.y-cy-.0012)<.00030)c.lerp(glint,.72);
        // A shared forward gaze; eyelids occlude the upper iris rather than a
        // separate flat white patch hiding the pupils.
        c.multiplyScalar(1-.22*Math.max(0,(v-.55)/.45));
        const edge=Math.min(v,1-v)*16;
        if(edge<.7)c.lerp(new T.Color('#745548'),(.7-edge)*.65);
        return c;
      });
      eyeIndexRanges.push({start:indexStart,count:indices.length-indexStart});
      eyeVertexRanges.push({start:before,count:positions.length/3-before});eyeVertices+=positions.length/3-before;
      grid(40,3,(u,v)=>{
        const t=(u+1)/2,x=side*(.014+.036*t),y=1.602+.0045*Math.sin(t*Math.PI)-.001*t-(1-v)*.0020*Math.sin(Math.PI*t)**.5;
        return sample(x,y).add(new T.Vector3(0,0,.0010));
      },u=>new T.Color('#50392b').multiplyScalar(.92+.12*Math.sin(u*47)**2));
    }
    // Separate upper and lower lips follow the existing mouth, leaving its narrow
    // centre opening intact rather than painting a flat polygon across it.
    for(const upper of[false,true])grid(64,8,(u,v)=>{
      const x=u*.022,arch=Math.max(0,1-u*u),centre=1.523-.0004*u*u;
      const outer=upper?centre+.0105*arch**.7-.0025*Math.exp(-((u/.20)**2)):centre-.0110*arch**.7;
      const inner=centre+(upper?.0010:-.0009)*arch;
      const y=upper?inner+(outer-inner)*v:outer+(inner-outer)*v;
      const p=sample(x,y),edge=sample(x,outer);
      // A seam sample can hit the back of the mouth. Keep lip edges on the rim.
      p.z=Math.max(p.z,edge.z-.0045)+.00065;return p;
    },(u,v)=>{
      const c=new T.Color(upper?'#ab7769':'#b78171');
      const edge=upper?v:1-v;
      return c.lerp(skin,Math.max(0,(edge-.70)/.30)*.6).multiplyScalar(.97+.03*Math.cos(u*44)**2);
    });
  }finally{source.dispose();}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData.eyeVertexRanges=eyeVertexRanges;
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.80,metalness:0,side:T.DoubleSide});
  const ocular=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.36,metalness:0,clearcoat:1,clearcoatRoughness:.18,side:T.DoubleSide});
  let cursor=0;for(const eye of eyeIndexRanges){if(eye.start>cursor)geometry.addGroup(cursor,eye.start-cursor,0);geometry.addGroup(eye.start,eye.count,1);cursor=eye.start+eye.count;}if(cursor<indices.length)geometry.addGroup(cursor,indices.length-cursor,0);
  const mesh=new T.Mesh(geometry,[material,ocular]);mesh.name='avatar-facial-details';const group=new T.Group();group.name='avatar-face';group.add(mesh);body.add(group);let destroyed=false;
  function update(){if(destroyed)return;const scale=body.userData.scale/body.userData.unit,p=body.geometry.attributes.position,i=anchor*3;group.scale.setScalar(scale);group.position.set(p.getX(anchor)-base[i]*scale,p.getY(anchor)-base[i+1]*scale,p.getZ(anchor)-base[i+2]*scale);group.updateMatrix();}
  update();return {group,update,snapshot:()=>({version:FACE_VERSION,eyes:true,eyebrows:true,lips:true,eyeSurface:'eyelid-rim-cap',eyeVertices,gaze:'parallel-forward',irisRadiusMm:5.3,ocularMaterial:'clearcoat',bodyGeometryChanged:false}),destroy(){if(destroyed)return;destroyed=true;body.remove(group);geometry.dispose();material.dispose();ocular.dispose();}};
}
