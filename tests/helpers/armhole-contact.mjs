import * as T from 'three';
import {ExtendedTriangle} from 'three-mesh-bvh';
/** Geometric regression, not a vertex/centroid gap proxy: test every side-panel
 * triangle against the complete indexed body. Coordinates share model space.
 * Deliberately scoped to the two lateral panels; this is not a global fit claim.
 */
export function sidePanelCrossings(body,garment,maps,positions){
 const box=new T.Box3(),triangle=new ExtendedTriangle(),result={left:0,right:0};
 for(const side of ['Left','Right']){
  const name='NUBYRA_Test_Side_'+side,mesh=garment.getObjectByName(name),map=maps[name];
  if(!mesh||!map)throw Error('Missing side-panel topology: '+side);
  const indices=mesh.geometry.index.array;
  for(let i=0;i<indices.length;i+=3){
   triangle.a.fromArray(positions,map[indices[i]]*3);
   triangle.b.fromArray(positions,map[indices[i+1]]*3);
   triangle.c.fromArray(positions,map[indices[i+2]]*3);triangle.needsUpdate=true;
   box.makeEmpty().expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
   const crosses=body.geometry.boundsTree.shapecast({
    intersectsBounds:bounds=>bounds.intersectsBox(box),
    intersectsTriangle:surface=>triangle.intersectsTriangle(surface)
   });
   if(crosses)result[side.toLowerCase()]++;
  }
 }
 return result;
}
