import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createStaticMeshQuery} from './static-mesh-query.mjs';
import {CM_PER_UNIT} from './body-surface.mjs';
/** One-way shirt contact with the current short triangles, within the solver. */
export function createShortSurfaceCollider(base,shortCloth){
 const geometry=shortCloth.template.geometry.clone();geometry.clearGroups();geometry.attributes.position.array.set(shortCloth.render());geometry.boundsTree=new MeshBVH(geometry,{maxLeafTris:8});
 const query=createStaticMeshQuery(geometry);
 const p=geometry.attributes.position,idx=geometry.index,point=new T.Vector3(),hit={point:new T.Vector3(),distance:Infinity,faceIndex:0},a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),delta=new T.Vector3(),out=[0,0,0],tri=new T.Triangle(a,b,c);let queries=0,updates=0,minY=-Infinity,maxY=Infinity;
 function sync(){p.array.set(shortCloth.render());p.needsUpdate=true;geometry.boundsTree.refit();geometry.computeBoundingBox();minY=geometry.boundingBox.min.y;maxY=geometry.boundingBox.max.y;updates++;}
 function shortGap(x,y,z){if(y>maxY||y<minY)return Infinity;queries++;point.set(x,y,z);query.closestPointToPoint(point,hit);const f=hit.faceIndex*3;a.fromBufferAttribute(p,idx.getX(f));b.fromBufferAttribute(p,idx.getX(f+1));c.fromBufferAttribute(p,idx.getX(f+2));tri.getNormal(normal);delta.subVectors(point,hit.point);return delta.dot(normal)<0?-hit.distance:hit.distance;}
 sync();return {kind:'body-and-simulated-shorts',geometry:base.geometry,shoulderHalfWidth:base.shoulderHalfWidth,neckHalfWidth:base.neckHalfWidth,surfaceHeight:(x,z)=>base.surfaceHeight(x,z),sync,
 gap(x,y,z){return Math.min(base.gap(x,y,z),shortGap(x,y,z));},
 project(x,y,z,margin){let changed=false;const bodyHit=base.project(x,y,z,margin);if(bodyHit){[x,y,z]=bodyHit;changed=true;}const d=shortGap(x,y,z),separation=Math.max(margin,.35/CM_PER_UNIT);if(d<separation){if(hit.distance>1e-9)normal.copy(delta).multiplyScalar((d<0?-1:1)/hit.distance);x=hit.point.x+normal.x*separation;y=hit.point.y+normal.y*separation;z=hit.point.z+normal.z*separation;changed=true;}if(!changed)return null;out[0]=x;out[1]=y;out[2]=z;return out;},
 stats:()=>({...base.stats(),shortQueries:queries,shortSurfaceUpdates:updates,shortNearestQuery:query.stats(),shortClothContact:true,visualExtrusion:false}),destroy(){geometry.dispose();}};
}
