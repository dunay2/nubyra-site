import * as T from 'three';
import {MeshBVH, SAH} from 'three-mesh-bvh';

/** Outfit-only projection. The visible/collision body and its indices stay untouched. */
export function clearShortsAgainstBody(geometry, body) {
  const source=body.geometry.clone(), tree=new MeshBVH(source,{strategy:SAH,maxLeafTris:10});
  const point=new T.Vector3(), target={point:new T.Vector3()}, a=new T.Vector3(), b=new T.Vector3(), c=new T.Vector3(), n=new T.Vector3();
  const p=geometry.attributes.position, bp=source.attributes.position, idx=source.index, d=body.userData;
  const ray=new T.Ray(new T.Vector3(),new T.Vector3());
  let corrected=0;
  try {
    for(let i=0;i<p.count;i++) {
      point.fromBufferAttribute(p,i);
      // Keep upper waistband under the jersey. More seam allowance near crotch.
      const t=Math.max(0,Math.min(1,(d.sourceToY(.95)-point.y)/(.16*d.scale/d.unit)));
      const margin=(.0008+.004*t*t*(3-2*t))*d.scale/d.unit;
      for(let iteration=0;iteration<3;iteration++) {
        tree.closestPointToPoint(point,target);
        const k=target.faceIndex*3;
        a.fromBufferAttribute(bp,idx.getX(k));b.fromBufferAttribute(bp,idx.getX(k+1));c.fromBufferAttribute(bp,idx.getX(k+2));
        T.Triangle.getNormal(a,b,c,n);
        const delta=point.clone().sub(target.point), signed=delta.dot(n)<0?-target.distance:target.distance;
        if(signed>=margin)break;
        if(signed>1e-7)n.copy(delta).normalize();
        point.copy(target.point).addScaledVector(n,margin);
        corrected++;
      }
      // Bridge the medial pelvis with the outermost surface, rather than copying
      // a gluteal cleft. This is an actual fabric allowance, not a skin mask.
      if(Math.abs(point.x)<.04*d.scale/d.unit&&point.y>d.sourceToY(.765)){
        const side=point.z<0?-1:1;ray.origin.set(point.x,point.y,side*4);ray.direction.set(0,0,-side);
        const hit=tree.raycastFirst(ray,T.DoubleSide);
        if(hit)point.z=side<0?Math.min(point.z,hit.point.z-margin*1.5):Math.max(point.z,hit.point.z+margin*1.5);
      }
      p.setXYZ(i,point.x,point.y,point.z);
    }
    p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {corrected,bodyHidden:false,method:'outward-seam-allowance-and-surface-projection'};
  } finally { source.dispose(); }
}
