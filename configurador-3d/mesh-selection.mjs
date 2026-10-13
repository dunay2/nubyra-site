/** NUBYRA: diagnóstico de mallas, sin alterar la geometría ni el material original. */
const GARMENT=/jersey|singlet|shirt|camiseta|vest|top|tank|front|back|torso|bodycloth|cloth|garment|fabric|tee/i;
const EXCLUDE=/shorts?|pants?|trouser|sock|shoe|avatar|human|skin|hair|head|hands?|legs?|armature|rig|trim|rib|collar|piping|badge|logo|label|button|zip/i;

export function describeGarmentMeshes(root){
  const descriptors=[];
  let next=0;
  root.traverse(object=>{
    if(!object?.isMesh || !object.geometry?.attributes?.position)return;
    const position=object.geometry.attributes.position;
    const count=object.geometry.index?.count??position.count;
    const name=String(object.name||'Malla '+(next+1)).trim();
    const materialName=Array.isArray(object.material)
      ?object.material.map(x=>x?.name||'').join(', '):object.material?.name||'';
    const label=name+' '+materialName;
    const notGarment=EXCLUDE.test(label);
    const candidate=GARMENT.test(label)&&!notGarment;
    const id='garment-'+next++;
    object.userData.nubyraMeshId=id;
    descriptors.push({id,name,materialName,triangles:Math.floor(count/3),
      uv:!!object.geometry.attributes.uv,candidate,excluded:notGarment});
  });
  return descriptors;
}

export function validateGarmentMeshChoice(meshes,selectedIds){
  if(!Array.isArray(selectedIds)||selectedIds.length===0)throw Error('Selecciona al menos una malla de tejido');
  const ids=new Set(meshes.map(x=>x.id));
  const chosen=[...new Set(selectedIds)];
  if(chosen.length>32)throw Error('Demasiadas mallas seleccionadas');
  if(chosen.some(id=>!ids.has(id)))throw Error('La selección incluye una malla desconocida');
  return chosen;
}
