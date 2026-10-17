import {JERSEY_RULES,FIT_POLICY_VERSION,patternSpecification} from './pattern-registry.mjs';
const finite=(v,name)=>{const n=Number(v);if(v===null||v===''||!Number.isFinite(n)||n<=0)throw Error(`Medida inválida: ${name}`);return n;};
function zone(label,garment,body,limits){
 const easeCm=garment-body;
 const status=easeCm<0?'too-small':easeCm<limits.minEaseCm?'insufficient-ease':easeCm>limits.maxEaseCm?'excessive-ease':'compatible';
 return {label,garmentCm:garment,bodyCm:body,easeCm,status,compatible:status==='compatible',limits:{...limits},
  reason:status==='too-small'?`${label}: faltan ${(-easeCm).toFixed(1)} cm de contorno.`:status==='insufficient-ease'?`${label}: holgura ${easeCm.toFixed(1)} cm, inferior a la regla de ensayo.`:status==='excessive-ease'?`${label}: sobran ${easeCm.toFixed(1)} cm, fuera del intervalo de ensayo.`:`${label}: holgura ${easeCm.toFixed(1)} cm dentro del intervalo de ensayo.`};
}
/** The selector and the on-screen assessment use exactly the same result. */
export function evaluateJersey(pattern,values,rules=JERSEY_RULES){
 if(!pattern)throw Error('Camiseta desconocida');
 const chest=finite(values.bodyChestCm,'pecho'),hip=finite(values.bodyHipCm,'cadera');
 const desired=finite(values.desiredLengthCm??values.garmentLengthCm??pattern.lengthCm,'largo');
 const height=values.bodyHeightCm===undefined?null:finite(values.bodyHeightCm,'altura');
 const torso=values.shoulderToHipCm===undefined?(height===null?null:height*.525/1.7):finite(values.shoulderToHipCm,'hombro a cadera');
 const belowHipCm=torso===null?null:pattern.lengthCm-torso,delta=pattern.lengthCm-desired;
 const zones={chest:zone('Pecho',pattern.chestCm,chest,rules.chest),hip:zone('Cadera',pattern.hipCm,hip,rules.hip)};
 const short=delta < -rules.length.preferenceToleranceCm||(belowHipCm!==null&&belowHipCm<rules.length.minBelowHipCm);
 const long=delta>rules.length.preferenceToleranceCm;
 zones.length={label:'Largo',garmentCm:pattern.lengthCm,desiredCm:desired,deltaCm:delta,belowHipCm,
  torsoSource:values.shoulderToHipCm!==undefined?'declared':torso===null?'unavailable':'synthetic-height-ratio',
  status:short?'short':long?'long':'compatible',compatible:!short&&!long,
  reason:short?'Hace falta más largo; aumentar el contorno no lo resuelve.':long?'Largo superior al solicitado; no se recorta automáticamente.':'Largo dentro de la regla de ensayo.',limits:{...rules.length}};
 const blocked=zones.chest.status==='too-small'||zones.hip.status==='too-small';
 const excessive=zones.chest.status==='excessive-ease'||zones.hip.status==='excessive-ease';
 const compatible=Object.values(zones).every(z=>z.compatible);
 const status=blocked?'too-small':short?'short':excessive?'oversized':long?'long':compatible?'candidate':'insufficient-ease';
 const failures=Object.entries(zones).filter(([,v])=>!v.compatible).map(([key,v])=>({zone:key,code:v.status,message:v.reason}));
 const score=['chest','hip'].reduce((sum,k)=>{const r=rules[k],mid=(r.minEaseCm+r.maxEaseCm)/2;return sum+((zones[k].easeCm-mid)/(r.maxEaseCm-r.minEaseCm))**2;},0)+Math.abs(delta)/Math.max(1,rules.length.preferenceToleranceCm);
 return {code:pattern.code,nominal:{chestCm:pattern.chestCm,hipCm:pattern.hipCm,lengthCm:pattern.lengthCm},specification:patternSpecification(pattern),
  rulesVersion:rules.version||FIT_POLICY_VERSION,zones,failures,compatible,recommendable:compatible,blocked,excessive,status,score,
  chestEaseCm:zones.chest.easeCm,hipEaseCm:zones.hip.easeCm,belowHipCm,
  reason:blocked?'Contorno insuficiente: no se agranda la prenda.':failures.length?failures.map(x=>x.message).join(' '):'Compatible según las reglas de ensayo. Pendiente de fitting y validación del tejido.',
  industrialApproved:false};
}
export function rankJerseys(catalog,values){
 const assessments=Object.values(catalog).map(p=>evaluateJersey(p,values));
 assessments.sort((a,b)=>Number(b.recommendable)-Number(a.recommendable)||a.score-b.score||a.code.localeCompare(b.code));
 const best=assessments.find(a=>a.recommendable)||null;
 const sameWidth=assessments.filter(a=>a.zones.chest.compatible&&a.zones.hip.compatible);
 const reason=best?`${best.code}: ${best.reason}`:sameWidth.length&&sameWidth.every(a=>a.zones.length.status==='short')?'Sin configuración disponible: falta largo con estos contornos. No se recomienda una base más ancha para compensarlo.':'Sin configuración disponible que cumpla todas las zonas. Revisa los motivos de cada prenda.';
 return {previewCode:best?.code??null,previewBase:best?catalog[best.code].base:null,recommendedCode:best?.code??null,
  hasConfiguration:!!best,hasDemoCoverage:!!best,score:best?.score??null,lateralPosition:best?catalog[best.code].position:null,
  status:best?'simulation-only':'no-configuration',reason,note:reason,rulesVersion:FIT_POLICY_VERSION,industrialApproved:false,
  candidates:assessments.map(a=>({code:a.code,score:a.score,demoCoverage:a.recommendable,assessment:a}))};
}
