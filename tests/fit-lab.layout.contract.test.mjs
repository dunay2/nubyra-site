import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../configurador-3d/fit-lab/'+name,import.meta.url),'utf8');
test('single-scroll policy: nested panels are not scroll containers',()=>{
 const css=read('styles.css');
 assert.match(css,/\.editor-panels\{max-height:none!important;overflow:visible!important/);
 assert.match(css,/\.view-panel\{max-height:none!important;overflow:visible!important/);
 assert.match(css,/html,body\{scrollbar-width:none/);
});
test('comparison has one metric SVG next to the 3D scene',()=>{
 const html=read('index.html');
 const start=html.indexOf('<div class="visual-comparison">');
 const end=html.indexOf('<div class="camera-controls"',start);
 assert.ok(start>0&&end>start);
 const block=html.slice(start,end);
 assert.match(block,/id="fit-canvas"/);
 assert.match(block,/id="fit-scale-diagram"/);
 assert.equal((html.match(/id="fit-scale-diagram"/g)||[]).length,1);
});
test('motion is optional and explicitly illustrative',()=>{
 const html=read('index.html'),app=read('app.mjs'),viewer=read('fit-viewer.mjs');
 assert.match(html,/id="show-motion"/);
 assert.match(app,/setMotion\(\$\('show-motion'\)\.checked\)/);
 assert.match(viewer,/setMotion\(on\)/);
 assert.match(viewer,/prefers-reduced-motion: reduce/);
});
test('measurement changes propagate to control, proposal, scale and WebGL render',()=>{
 const app=read('app.mjs');
 const redraw=app.slice(app.indexOf('function redraw(){'),app.indexOf('function changeValue(',app.indexOf('function redraw(){')));
 for(const fn of ['syncInputs','syncDiscreteControls','updateReadings','updateProposalUI','updateScaleDiagram','updateGeometry']){
  assert.ok(redraw.includes(fn+'()'),fn);
 }
 const update=app.slice(app.indexOf('function updateGeometry(){'),app.indexOf('function redraw(){'));
 assert.match(update,/viewer.update\(state\)/);
 assert.match(update,/updateScaleDiagram\(\)/);
});
