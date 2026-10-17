import {BODY_REGION_LIMITS,REGION_DEFAULTS,REGION_KEYS} from './body-regions.mjs';
import {referenceProfileMeasures} from './reference-profiles.mjs';
/** Pure state transitions. No renderer, DOM, network or physical fit claims. */
import {DEFAULT_CONFIGURATION, GARMENT_CATALOG, stateForConfiguration, recommendPreviewConfiguration} from './garment-catalog.mjs';
export const FIELD_LIMITS=Object.freeze({bodyChestCm:[65,120],bodyHipCm:[70,130],bodyHeightCm:[125,210],armLoweringDeg:[0,25],desiredLengthCm:[48,84],frontVolume:[0,10],sideVolume:[0,10],backVolume:[0,10],...Object.fromEntries(Object.entries(BODY_REGION_LIMITS).map(([k,v])=>[k,[v.min,v.max]]))});
export const DEFAULT_INPUT=Object.freeze({bodyChestCm:88,bodyHipCm:96,bodyHeightCm:160,armLoweringDeg:0,desiredLengthCm:64,frontVolume:3,sideVolume:5,backVolume:5,...REGION_DEFAULTS,selectionMode:'auto',activeConfiguration:DEFAULT_CONFIGURATION});
export function resolveState(input){
 const state={...DEFAULT_INPUT,...input};
 for(const [key,[min,max]] of Object.entries(FIELD_LIMITS)){
  const n=Number(state[key]);state[key]=Number.isFinite(n)?Math.max(min,Math.min(max,n)):DEFAULT_INPUT[key];
 }
 for(const key of ['bodyBaseChestCm','bodyBaseHipCm']){if(state[key]!=null){const [lo,hi]=FIELD_LIMITS[key==='bodyBaseChestCm'?'bodyChestCm':'bodyHipCm'];if(!Number.isFinite(state[key])||state[key]<lo||state[key]>hi)delete state[key];}}
 state.selectionMode=state.selectionMode==='manual'?'manual':'auto';
 if(!GARMENT_CATALOG[state.activeConfiguration])state.activeConfiguration=DEFAULT_CONFIGURATION;
 const recommendation=recommendPreviewConfiguration(state);
 if(state.selectionMode==='auto'&&recommendation.hasConfiguration)state.activeConfiguration=recommendation.previewCode;
 Object.assign(state,stateForConfiguration(state.activeConfiguration,recommendation.proposedLengthCm));
 return Object.freeze({...state,recommendation:Object.freeze(recommendation),reviewRequired:!recommendation.hasDemoCoverage});
}
export function transition(state,event){
 if(event.type==='reference-profile')return resolveState({...state,...REGION_DEFAULTS,bodyBaseChestCm:undefined,bodyBaseHipCm:undefined,...referenceProfileMeasures(event.id),selectionMode:'auto'});
 if(event.type==='body-shape'){const allowed=[...REGION_KEYS,'bodyBaseChestCm','bodyBaseHipCm','bodyChestCm','bodyHipCm','bodyHeightCm'];const patch=Object.fromEntries(allowed.filter(k=>event.patch[k]!==undefined).map(k=>[k,event.patch[k]]));return resolveState({...state,...patch});}
 if(event.type==='reset')return resolveState(DEFAULT_INPUT);
 if(event.type==='measure'&&Object.hasOwn(FIELD_LIMITS,event.key)){const rebase=['bodyChestCm','bodyHipCm'].includes(event.key);return resolveState({...state,...(rebase?{...REGION_DEFAULTS,bodyBaseChestCm:undefined,bodyBaseHipCm:undefined}:{}),[event.key]:event.value});}
 if(event.type==='mode')return resolveState({...state,selectionMode:event.value});
 if(event.type==='garment'&&GARMENT_CATALOG[event.code])return resolveState({...state,selectionMode:'manual',activeConfiguration:event.code});
 return state;
}
