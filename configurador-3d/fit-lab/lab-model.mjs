/** Pure state transitions. No renderer, DOM, network or physical fit claims. */
import {DEFAULT_CONFIGURATION, GARMENT_CATALOG, stateForConfiguration, recommendPreviewConfiguration} from './garment-catalog.mjs';
export const FIELD_LIMITS=Object.freeze({bodyChestCm:[65,120],bodyHipCm:[70,130],bodyHeightCm:[125,190],desiredLengthCm:[48,84],frontVolume:[0,10],sideVolume:[0,10],backVolume:[0,10]});
export const DEFAULT_INPUT=Object.freeze({bodyChestCm:88,bodyHipCm:96,bodyHeightCm:160,desiredLengthCm:64,frontVolume:3,sideVolume:5,backVolume:5,selectionMode:'auto',activeConfiguration:DEFAULT_CONFIGURATION});
export function resolveState(input){
 const state={...DEFAULT_INPUT,...input};
 for(const [key,[min,max]] of Object.entries(FIELD_LIMITS)){
  const n=Number(state[key]);state[key]=Number.isFinite(n)?Math.max(min,Math.min(max,n)):DEFAULT_INPUT[key];
 }
 state.selectionMode=state.selectionMode==='manual'?'manual':'auto';
 if(!GARMENT_CATALOG[state.activeConfiguration])state.activeConfiguration=DEFAULT_CONFIGURATION;
 const recommendation=recommendPreviewConfiguration(state);
 if(state.selectionMode==='auto'&&recommendation.hasDemoCoverage)state.activeConfiguration=recommendation.previewCode;
 Object.assign(state,stateForConfiguration(state.activeConfiguration));
 return Object.freeze({...state,recommendation:Object.freeze(recommendation),reviewRequired:!recommendation.hasDemoCoverage});
}
export function transition(state,event){
 if(event.type==='reset')return resolveState(DEFAULT_INPUT);
 if(event.type==='measure'&&Object.hasOwn(FIELD_LIMITS,event.key))return resolveState({...state,[event.key]:event.value});
 if(event.type==='mode')return resolveState({...state,selectionMode:event.value});
 if(event.type==='garment'&&GARMENT_CATALOG[event.code])return resolveState({...state,selectionMode:'manual',activeConfiguration:event.code});
 return state;
}
