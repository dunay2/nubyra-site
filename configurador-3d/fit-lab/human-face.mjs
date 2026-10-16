import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';

/** Small surface-conforming facial details on the approved head, never a new body/collider. */
export function createHumanFace(body) {
  const base=body.userData.base, index=body.geometry.index;
  const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(base.slice(),3));
  const ids=[];let anchor=-1;
  for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(tri.every(j=>base[j*3+1]>1.49))ids.push(...tri);}
  for(let i=0;i<base.length;i+=3)if(base[i+1]>1.65){anchor=i/3;break;}
  source.setIndex(ids);const tree=new MeshBVH(source,{maxLeafTris:8});
  const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
  const positions=[],normals=[],colors=[],indices=[];
  const project=(x,y,offset)=>{ray.origin.set(x,y,.5);const hit=tree.raycastFirst(ray,T.DoubleSide);if(!hit)throw Error('Detalle facial fuera de la cabeza');return hit.point.addScaledVector(hit.face.normal,offset);};
  function patch(points,color,offset=.0008){
    const start=positions.length/3,c=new T.Color(color);
    for(const [x,y]of points){const p=project(x,y,offset);positions.push(p.x,p.y,p.z);normals.push(0,0,1);colors.push(c.r,c.g,c.b);}
    for(let i=1;i+1<points.length;i++)indices.push(start,start+i,start+i+1);
  }
  function disc(x,y,r,color,offset){const points=[[x,y]];for(let i=0;i<=40;i++){const a=i*Math.PI/20;points.push([x+r*Math.cos(a),y+r*Math.sin(a)]);}patch(points,color,offset);}
  try{
    for(const side of[-1,1]){
      const x=.0315*side,y=1.5888;
      const almond=[];
      for(let i=0;i<=32;i++){const u=-1+i/16;almond.push([x+u*.0125,y+.0031*Math.pow(Math.max(0,1-u*u),.7)+side*u*.0012]);}
      for(let i=32;i>=0;i--){const u=-1+i/16;almond.push([x+u*.0125,y-.0026*Math.pow(Math.max(0,1-u*u),.7)+side*u*.0012]);}
      patch(almond,'#e5dfd5',.0006);
      // Clipped naturally by an iris smaller than the eyelid aperture; no bulging eyeballs.
      disc(x,y,.0028,'#46382b',.0010);disc(x,y,.00215,'#785b38',.0012);disc(x,y,.00125,'#161b1a',.0014);disc(x-.00065,y+.0007,.00042,'#fff2d7',.0016);
      const brow=[];
      for(let i=0;i<=24;i++){const t=i/24;brow.push([side*(.014+.036*t),1.602+.0045*Math.sin(t*Math.PI)-.001*t]);}
      for(let i=24;i>=0;i--){const t=i/24;brow.push([side*(.014+.036*t),1.602+.0045*Math.sin(t*Math.PI)-.001*t-.0018*Math.sin(Math.PI*t)**.5]);}
      if(side<0)brow.reverse();patch(brow,'#574137',.0009);
    }
    const lips=[];
    for(let i=0;i<=32;i++){const u=-1+i/16;const peak=.0047*(1-u*u)-.0018*Math.exp(-Math.pow(u/.20,2));lips.push([u*.019,1.5208+peak]);}
    for(let i=32;i>=0;i--){const u=-1+i/16;lips.push([u*.019,1.5208-.0038*(1-u*u)]);}
    patch(lips,'#b87f70',.0005);
  }finally{source.dispose();}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0,side:T.DoubleSide});
  const mesh=new T.Mesh(geometry,material);mesh.name='avatar-facial-details';const group=new T.Group();group.name='avatar-face';group.add(mesh);body.add(group);let destroyed=false;
  function update(){if(destroyed)return;const scale=body.userData.scale/body.userData.unit,p=body.geometry.attributes.position,i=anchor*3;group.scale.setScalar(scale);group.position.set(p.getX(anchor)-base[i]*scale,p.getY(anchor)-base[i+1]*scale,p.getZ(anchor)-base[i+2]*scale);group.updateMatrix();}
  update();return {group,update,snapshot:()=>({version:'human-face/1.0',eyes:true,eyebrows:true,lips:true,bodyGeometryChanged:false}),destroy(){if(destroyed)return;destroyed=true;body.remove(group);geometry.dispose();material.dispose();}};
}
