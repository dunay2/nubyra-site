/** Both garments already share physical depth coordinates. A silhouette-only
 * stencil hid FRONT shorts behind the BACK shirt and exposed the skin below.
 * Keep the adapter API, but let depth testing resolve actual occlusion. */
export function createOuterGarmentLayer(){
 let current=null,enabled=false;
 return {
  bind(garment){current=garment;},
  setShorts(shorts,active){enabled=Boolean(active&&current);for(const mat of shorts.mesh.material){mat.stencilWrite=false;mat.depthTest=true;mat.depthWrite=true;}},
  render(){},
  snapshot:()=>({enabled,method:'physical-depth-test',shirtGeometryChanged:false,shortsGeometryChanged:false,bodyMasked:false,physicalLayerSimulation:true,extraDrawPasses:0}),
  destroy(){current=null;enabled=false;}
 };
}
