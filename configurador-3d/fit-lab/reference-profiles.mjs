/** Reference examples are independent of body/pattern state. No measurements are
 * inferred from an image. Mass is scenario metadata, never a sizing input. */
export const REFERENCE_PROFILES_VERSION='reference-profiles/2.0';
export const REFERENCE_PROFILES=Object.freeze([
 ['R01',145,43,74,82,'Contornos reducidos'],['R02',150,56,86,96,'Contornos medios'],
 ['R03',155,50,80,90,'Contornos reducidos'],['R04',160,68,94,106,'Contornos amplios'],
 ['R05',165,59,86,96,'Contornos medios'],['R06',170,72,94,106,'Contornos amplios'],
 ['R07',175,70,90,102,'Contornos medios'],['R08',180,90,106,118,'Contornos amplios']
].map(([id,heightCm,weightKg,chestCm,hipCm,label])=>Object.freeze({id,heightCm,weightKg,chestCm,hipCm,label,
 source:'generated-individual-portraits',measurementSource:'illustrative-targets',anthropometryValidated:false})));
export function getReferenceProfile(id){const p=REFERENCE_PROFILES.find(p=>p.id===id);if(!p)throw Error('Referencia desconocida: '+id);return p;}
/** Deterministic proximity in three independently normalised dimensions. */
export function nearestReferenceProfile(body){
 const values=[body?.bodyHeightCm,body?.bodyChestCm,body?.bodyHipCm];
 if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))return null;
 const ranked=REFERENCE_PROFILES.map(profile=>{const delta={heightCm:values[0]-profile.heightCm,chestCm:values[1]-profile.chestCm,hipCm:values[2]-profile.hipCm};
  return {profile,delta,score:(delta.heightCm/8)**2+(delta.chestCm/8)**2+(delta.hipCm/8)**2,
   withinCoverage:Math.abs(delta.heightCm)<=10&&Math.abs(delta.chestCm)<=12&&Math.abs(delta.hipCm)<=12};
 }).sort((a,b)=>a.score-b.score||a.profile.id.localeCompare(b.profile.id));return ranked[0];
}
export function referenceImagePlacement({profile,asset,metrics}){
 if(!profile||!asset||!metrics||![profile.heightCm,asset.width,asset.height,metrics.pxPerCm,metrics.floorPx].every(Number.isFinite)||metrics.pxPerCm<=0||asset.width<=0||asset.height<=0)throw Error('Escala de referencia no válida');
 const head=asset.head??0,feet=asset.feet??1;if(!(head>=0&&feet<=1&&feet>head))throw Error('Marcas de referencia no válidas');
 const height=profile.heightCm*metrics.pxPerCm/(feet-head);
 return {height,width:height*asset.width/asset.height,top:metrics.floorPx-feet*height,headPx:metrics.floorPx-profile.heightCm*metrics.pxPerCm,feetPx:metrics.floorPx};
}
