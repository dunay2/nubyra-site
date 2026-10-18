/** Both garments now have physical positions. Visibility must use camera depth,
 * never a screen-space silhouette: a back shirt panel must not cut a hole in
 * shorts that are in front of the body. This adapter retains the viewer API.
 */
export function createOuterGarmentLayer(){
 let current=null,enabled=false;
 return {
  bind(garment){current=garment;},
  setShorts(shorts,active){
   enabled=Boolean(active&&current);
   const materials=Array.isArray(shorts.mesh.material)?shorts.mesh.material:[shorts.mesh.material];
   for(const material of materials){material.stencilWrite=false;material.depthTest=true;material.depthWrite=true;}
  },
  render(){/* The main scene renders both real surfaces through the depth buffer. */},
  snapshot:()=>({enabled,method:'physical-surfaces-depth-test',shirtGeometryChanged:false,shortsGeometryChanged:false,bodyMasked:false,physicalLayerSimulation:true,silhouetteDiscard:false}),
  destroy(){current=null;}
 };
}
