import {readFile,writeFile} from 'node:fs/promises';
/** One-time integration against the reviewed 98a005b source. Prepare every change
 * before writing and reject any unexpected base rather than overwriting edits. */
const prepared=[];
async function transform(path,fn){const old=await readFile(path,'utf8');prepared.push({path,text:fn(old)});}
function replace(text,old,value){if(text.split(old).length!==2)throw Error('Unexpected source near '+old.slice(0,90));return text.replace(old,value);}
await transform('configurador-3d/fit-lab/lab-model.mjs',s=>{
 s="import {referenceProfileMeasures} from './reference-profiles.mjs';\n"+s;
 return replace(s," if(event.type==='reset')", " if(event.type==='reference-profile')return resolveState({...state,...referenceProfileMeasures(event.id)});\n if(event.type==='reset')");
});
await transform('configurador-3d/fit-lab/app.mjs',s=>replace(s,"viewer=await createHumanViewer($('fit-canvas'),state,onFrame);","viewer=await createHumanViewer($('fit-canvas'),state,onFrame,{onApplyReferenceProfile(id){dispatch({type:'reference-profile',id});committedInputs.reset();}});"));
await transform('configurador-3d/fit-lab/human-viewer.mjs',s=>{
 s=replace(s,'export async function createHumanViewer(canvas,initial,onFrame=()=>{})','export async function createHumanViewer(canvas,initial,onFrame=()=>{},actions={})');
 s=replace(s,'await referenceResponse.json(),shortFactory);','await referenceResponse.json(),shortFactory,actions);\n fullReference.setBody(initial);');
 return replace(s,'function update(next){const start=performance.now();counts.physicalUpdates++;','function update(next){const start=performance.now();counts.physicalUpdates++;fullReference.setBody(next);');
});
await transform('configurador-3d/fit-lab/full-reference.mjs',s=>{
 s=replace(s,'canvas,bytes,seed,shortFactory){','canvas,bytes,seed,shortFactory,actions={}){');
 s=replace(s,'mountReferenceGallery({stage,onSelectMode','mountReferenceGallery({stage,onApplyProfile:actions.onApplyReferenceProfile,onSelectMode');
 return replace(s,'return{render,snapshot:','return{render,setBody(next){gallery.setBody(next);},snapshot:');
});
await transform('configurador-3d/fit-lab/index.html',s=>{
 s=replace(s,'<link rel="stylesheet" href="./reference-gallery.css">','<link rel="stylesheet" href="./reference-gallery.css"><link rel="stylesheet" href="./reference-ranges.css">');
 s=replace(s,'Selecciona una referencia, sin modificar el modelo','Selecciona un perfil para aplicar altura, pecho y cadera');
 return replace(s,'De menor a mayor estatura, con distintos contornos y pesos de escenario.','Pulsa una foto para aplicar altura, pecho y cadera. ⓘ consulta rangos sin cambiar medidas.');
});
await transform('scripts/build-fit-lab.mjs',s=>{
 s="import {REFERENCE_PROFILES_VERSION,REFERENCE_COVERAGE_VERSION} from '../configurador-3d/fit-lab/reference-profiles.mjs';\n"+s;
 s=replace(s,"await copyFile('configurador-3d/fit-lab/reference-gallery.css',out+'/fit-lab/reference-gallery.css');", "await copyFile('configurador-3d/fit-lab/reference-gallery.css',out+'/fit-lab/reference-gallery.css');await copyFile('configurador-3d/fit-lab/reference-ranges.css',out+'/fit-lab/reference-ranges.css');");
 s=replace(s,"release:'tied-waist-hd-references'","release:'reference-measures-ranges',referenceMeasureSync:'explicit-apply-automatic-follow',referenceCoverageVersion:REFERENCE_COVERAGE_VERSION,referenceRangeHelp:true");
 return replace(s,"referenceProfilesVersion:'reference-profiles/2.0'",'referenceProfilesVersion:REFERENCE_PROFILES_VERSION');
});
for(const {path,text}of prepared)await writeFile(path,text);
console.log('Integrated reference synchronization in '+prepared.length+' files');
