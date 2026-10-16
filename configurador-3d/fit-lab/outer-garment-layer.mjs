import * as T from 'three';
/** Render-only occlusion for the unsimulated short. Uses the actual moving shirt
 * triangles (including its openings), not a fixed horizontal cut or a body mask. */
export function createOuterGarmentLayer(){
 const scene=new T.Scene();
 const material=new T.MeshBasicMaterial({side:T.DoubleSide,colorWrite:false,depthWrite:false,depthTest:false,stencilWrite:true,stencilRef:1,stencilFunc:T.AlwaysStencilFunc,stencilWriteMask:1,stencilFuncMask:1,stencilZPass:T.ReplaceStencilOp});
 let current=null,enabled=false;
 function bind(garment){if(current===garment)return;scene.clear();current=garment;if(garment)garment.traverse(m=>{if(m.isMesh){const mask=new T.Mesh(m.geometry,material);mask.matrixAutoUpdate=false;m.updateWorldMatrix(true,false);mask.matrix.copy(m.matrixWorld);mask.frustumCulled=false;scene.add(mask);}});}
 return {
  bind,
  setShorts(shorts,active){enabled=Boolean(active&&current);for(const mat of shorts.mesh.material){mat.stencilWrite=enabled;mat.stencilRef=1;mat.stencilFunc=T.NotEqualStencilFunc;mat.stencilFuncMask=1;mat.stencilWriteMask=0;mat.stencilFail=T.KeepStencilOp;mat.stencilZFail=T.KeepStencilOp;mat.stencilZPass=T.KeepStencilOp;}},
  render(renderer,camera){if(enabled)renderer.render(scene,camera);},
  snapshot:()=>({enabled,method:'actual-jersey-silhouette-stencil',shirtGeometryChanged:false,shortsGeometryChanged:false,bodyMasked:false,physicalLayerSimulation:false}),
  destroy(){scene.clear();material.dispose();current=null;}
 };
}
