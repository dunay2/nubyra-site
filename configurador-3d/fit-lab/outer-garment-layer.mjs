/** Physical garment layers use the depth buffer. A screen-space silhouette mask
 * cannot distinguish the rear hem from the front hem and cuts holes in the short.
 * Keep this adapter so existing callers can bind/destroy without owning GPU masks. */
export function createOuterGarmentLayer(){
 let current=null;
 return {bind(garment){current=garment;},
  setShorts(shorts){if(!shorts)return;for(const mat of(Array.isArray(shorts.mesh.material)?shorts.mesh.material:[shorts.mesh.material])){mat.stencilWrite=false;mat.depthTest=true;mat.depthWrite=true;}},
  render(){},snapshot:()=>({enabled:false,method:'depth-tested-physical-layers',shirtGeometryChanged:false,shortsGeometryChanged:false,bodyMasked:false,physicalLayerSimulation:true}),
  destroy(){current=null;}};
}
