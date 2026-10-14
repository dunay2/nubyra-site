import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../configurador-3d/fit-lab/'+n,import.meta.url),'utf8');
test('no scroll containers nested in panels',()=>assert.doesNotMatch(read('styles.css'),/overflow(?:-y)?:\s*(auto|scroll)/));
test('reference and 3D are colocated; diagnostics secondary',()=>{const html=read('index.html');assert.match(html,/class="visual-comparison"/);assert.match(html,/id="fit-scale-diagram"/);assert.match(html,/<details id="advanced">/);assert.equal((html.match(/id="fit-scale-diagram"/g)||[]).length,1);});
test('old exclusive profile buttons, duplicate body forms and magic deformation paths are absent from runtime',()=>{const html=read('index.html');assert.doesNotMatch(html,/data-body-profile|adjust-body-fields/);assert.doesNotMatch(read('fit-viewer.mjs'),/drapedPoint|animateMotion|fit-drape/);});
