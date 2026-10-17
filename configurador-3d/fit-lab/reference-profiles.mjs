/** Declared laboratory scenarios, not measurements inferred from photographs.
 * Mass is metadata, never an input to reference or garment selection. */
export const REFERENCE_PROFILES_VERSION='reference-profiles/3.0';
export const REFERENCE_PROFILES=Object.freeze([
 ['R01',145,43,74,82,'Contornos reducidos'],['R02',150,56,86,96,'Contornos medios'],
 ['R03',155,50,80,90,'Contornos reducidos'],['R04',160,68,94,106,'Contornos amplios'],
 ['R05',165,59,86,96,'Contornos medios'],['R06',170,72,94,106,'Contornos amplios'],
 ['R07',175,70,90,102,'Contornos medios'],['R08',180,90,106,118,'Contornos amplios']
].map(([id,heightCm,weightKg,chestCm,hipCm,label])=>Object.freeze({id,heightCm,weightKg,chestCm,hipCm,label,
 source:'generated-individual-portraits',measurementSource:'illustrative-targets',anthropometryValidated:false})));
export function getReferenceProfile(id){const p=REFERENCE_PROFILES.find(p=>p.id===id);if(!p)throw Error('Referencia desconocida: '+id);return p;}
export const REFERENCE_COVERAGE_VERSION='reference-coverage/1.0';
export const REFERENCE_TOLERANCES=Object.freeze({heightCm:10,chestCm:12,hipCm:12});
export const REFERENCE_AXES=Object.freeze([
 Object.freeze({key:'heightCm',bodyKey:'bodyHeightCm',label:'Altura'}),
 Object.freeze({key:'chestCm',bodyKey:'bodyChestCm',label:'Pecho'}),
 Object.freeze({key:'hipCm',bodyKey:'bodyHipCm',label:'Cadera'})
]);
/** Only an explicit user selection applies these three values. */
export function referenceProfileMeasures(id){const p=getReferenceProfile(id);return Object.freeze({bodyHeightCm:p.heightCm,bodyChestCm:p.chestCm,bodyHipCm:p.hipCm});}
export function assessReferenceProfile(profile,body){
 const valid=REFERENCE_AXES.every(({bodyKey})=>typeof body?.[bodyKey]==='number'&&Number.isFinite(body[bodyKey])&&body[bodyKey]>0);
 const delta={};
 const zones=REFERENCE_AXES.map(({key,bodyKey,label})=>{
  const base=profile[key],tolerance=REFERENCE_TOLERANCES[key],value=valid?body[bodyKey]:null;delta[key]=valid?value-base:null;
  return {key,label,base,min:base-tolerance,max:base+tolerance,value,delta:delta[key],within:valid?Math.abs(delta[key])<=tolerance:null};
 });
 return {profile,valid,zones,delta,score:valid?zones.reduce((sum,z)=>sum+(z.delta/8)**2,0):null,
  exact:valid&&zones.every(z=>Math.abs(z.delta)<1e-9),withinCoverage:valid&&zones.every(z=>z.within),
  outside:zones.filter(z=>z.within===false).map(z=>z.label),coverageVersion:REFERENCE_COVERAGE_VERSION};
}
/** Covered candidates first, then normalized proximity and deterministic ID.
 * Choosing the nearest illustration must never snap user-entered measurements. */
export function nearestReferenceProfile(body){
 const ranked=REFERENCE_PROFILES.map(profile=>assessReferenceProfile(profile,body));if(!ranked[0].valid)return null;
 ranked.sort((a,b)=>Number(b.withinCoverage)-Number(a.withinCoverage)||a.score-b.score||a.profile.id.localeCompare(b.profile.id));return ranked[0];
}
export function referenceImagePlacement({profile,asset,metrics}){
 if(!profile||!asset||!metrics||![profile.heightCm,asset.width,asset.height,metrics.pxPerCm,metrics.floorPx].every(Number.isFinite)||metrics.pxPerCm<=0||asset.width<=0||asset.height<=0)throw Error('Escala de referencia no válida');
 const head=asset.head??0,feet=asset.feet??1;if(!(head>=0&&feet<=1&&feet>head))throw Error('Marcas de referencia no válidas');
 const height=profile.heightCm*metrics.pxPerCm/(feet-head);
 return {height,width:height*asset.width/asset.height,top:metrics.floorPx-feet*height,headPx:metrics.floorPx-profile.heightCm*metrics.pxPerCm,feetPx:metrics.floorPx};
}
