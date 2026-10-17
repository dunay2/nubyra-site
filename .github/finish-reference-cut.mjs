import {readFile,writeFile} from 'node:fs/promises';
const browser='scripts/fit-lab-reference-gallery-review.mjs';
let s=await readFile(browser,'utf8');
// Body vertices are Float32: compare centimetres at the same 0.01cm tolerance
// used by the actual body tests, rather than requiring 159.9999987 === 160.
s=s.replace('s.lastFrame.body.heightCm===s.state.bodyHeightCm','Math.abs(s.lastFrame.body.heightCm-s.state.bodyHeightCm)<.01');
s=s.replace("await shot('original-photo-right-real-model-centre');", "assert.ok(await page.evaluate(()=>{const right=document.querySelector('.editor').getBoundingClientRect().right;return [...document.querySelectorAll('#zone-assessment dd')].every(e=>e.getBoundingClientRect().right<=right+1);}),'zone report escapes the editor');await shot('original-photo-right-real-model-centre');");
await writeFile(browser,s);
const shorts='scripts/fit-lab-shorts-review.mjs';s=await readFile(shorts,'utf8');s=s.replace('f.body.heightCm===145','Math.abs(f.body.heightCm-145)<.01');await writeFile(shorts,s);
const css='configurador-3d/fit-lab/reference-gallery.css';s=await readFile(css,'utf8');
if(!s.includes('/* bounded-zone-report */'))s+='\n/* bounded-zone-report */\n.zone-review{min-width:0}.zone-review dl>div{grid-template-columns:44px minmax(0,1fr);align-items:start;gap:5px}.zone-review dd{min-width:0;white-space:normal;overflow-wrap:anywhere}.selection-result>div{flex:0 0 52px}.selection-result strong{white-space:nowrap}.selection-result>p{min-width:0}\n';
await writeFile(css,s);
