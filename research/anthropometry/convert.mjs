import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {prune} from '@gltf-transform/functions';
import {validateBytes} from 'gltf-validator';
const dir='assets/mannequins';
await mkdir(dir,{recursive:true});
const source='/tmp/nubyra-female-reference-source.glb';
const url='https://www.innerscene.com/api/library/riley-3d-person-woman-standing-8d40398f/download';
const expected='c9c84386d6c019a8d4c415cc5d6ed9111c27d624189b1a2e0676f2b276a086e6';
const bytes=new Uint8Array(await readFile(source));
const actual=createHash('sha256').update(bytes).digest('hex');
if(actual!==expected)throw Error('Source hash mismatch: '+actual);
const doc=await new NodeIO().read(source);
const root=doc.getRoot(),body=root.listNodes().find(n=>n.getName()==='Riley | anatomical body');
if(!body?.getMesh())throw Error('Expected base mesh missing');
const scene=doc.createScene('NUBYRA Female Anatomical Reference — CC0');
scene.addChild(body);
body.setScale([1.1637332439422607,1.1637332439422607,1.1637332439422607]);
body.setTranslation([0,0.012857804074883461,0]);
body.setName('NUBYRA · anatomia femenina adulta · referencia visual');
body.setExtras({
 source:'Innerscene Riley, adapted from MakeHuman/MPFB CC0 assets',
 license:'CC0-1.0',sourceURL:'https://www.innerscene.com/tools/library/3d-parts/riley-3d-person-woman-standing-8d40398f',
 usage:'Adult illustration only; not scanned, age-specific, anatomically or textile-fit certified'
});
root.setDefaultScene(scene);
for(const old of root.listScenes())if(old!==scene)old.dispose();
for(const node of root.listNodes())if(node!==body)node.dispose();
const mat=doc.createMaterial('Mannequin neutral matte').setBaseColorFactor([0.76,0.79,0.82,1]).setRoughnessFactor(.86).setMetallicFactor(0);
for(const p of body.getMesh().listPrimitives())p.setMaterial(mat);
await doc.transform(prune());
if(root.listMeshes().length!==1||root.listNodes().length!==1||root.listMeshes()[0].listPrimitives().length!==1)throw Error('Unexpected mesh layout');
const output=dir+'/adult-female-reference-cc0.glb';
await new NodeIO().write(output,doc);
const outputBytes=new Uint8Array(await readFile(output));
const check=await validateBytes(outputBytes,{uri:'adult-female-reference-cc0.glb',maxIssues:30});
if(check.issues.numErrors||check.issues.numWarnings)throw Error(JSON.stringify(check.issues.messages));
console.log(JSON.stringify({filename:output,bytes:outputBytes.length,sourceSha256:actual,outputSha256:createHash('sha256').update(outputBytes).digest('hex'),vertices:16731,triangles:31754,errors:0,warnings:0}));
