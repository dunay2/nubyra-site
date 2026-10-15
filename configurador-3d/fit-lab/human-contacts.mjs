import * as T from 'three';
import {MeshBVH,CENTER} from 'three-mesh-bvh';
/** Reverse point/face contact catches anatomical detail between cloth samples.
 * Forces are applied to dynamic cloth particles; the body and pattern never change.
 */
export function addHumanSurfaceContacts(adapter,body){
 const s=adapter.solver,geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(s.positions,3));geometry.setIndex(s.triangles.flat());geometry.boundsTree=new MeshBVH(geometry,{strategy:CENTER,maxLeafTris:8});
 const p=body.geometry.attributes.position,n=body.geometry.attributes.normal,samples=[];
 for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>body.userData.hipY&&y<body.userData.sourceToY(1.29)&&Math.abs(p.getX(i))<.72)samples.push(i);}
 const query=new T.Vector3(),result={point:new T.Vector3(),distance:0,faceIndex:0},a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),bary=new T.Vector3(),tri=new T.Triangle(a,b,c),delta=new T.Vector3();
 const base=s.projectFaces.bind(s);let count=0,corrected=0;
 s.projectFaces=function(){base();count++;geometry.boundsTree.refit();const index=geometry.index.array,pos=s.positions,w=s.weights;
  for(const id of samples){query.fromBufferAttribute(p,id);const hit=geometry.boundsTree.closestPointToPoint(query,result,0,.08);if(!hit)continue;const f=hit.faceIndex*3,ids=[index[f],index[f+1],index[f+2]];a.fromArray(pos,ids[0]*3);b.fromArray(pos,ids[1]*3);c.fromArray(pos,ids[2]*3);tri.getNormal(normal);if(normal.dot(delta.fromBufferAttribute(n,id))<.35)continue;
   tri.getBarycoord(hit.point,bary);const weights=[bary.x,bary.y,bary.z];if(Math.min(...weights)<.00001)continue;
   const protrusion=delta.subVectors(query,hit.point).dot(normal);if(protrusion<=-.018)continue;
   const den=ids.reduce((d,i,k)=>d+w[i]*weights[k]**2,0);if(den<1e-12)continue;
   const correction=Math.min(.035,protrusion+.020);
   for(let k=0;k<3;k++){const f=correction*w[ids[k]]*weights[k]/den,j=ids[k]*3;pos[j]+=f*normal.x;pos[j+1]+=f*normal.y;pos[j+2]+=f*normal.z;}corrected++;
  }
 };
 return {stats:()=>({method:'body-vertex/cloth-face',bodySamples:samples.length,corrections:corrected}),destroy(){s.projectFaces=base;geometry.dispose();}};
}
