/** Controller contracts. Real DOM interactions live in scripts/fit-lab-e2e.mjs. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../configurador-3d/fit-lab/app.mjs',import.meta.url),'utf8');
test('controller shares transitions rather than recomputing catalog rules',()=>{assert.match(app,/transition\(state,event\)/);assert.doesNotMatch(app,/chest\+14/);});
test('all shape controls are generated with range 0..10',()=>{assert.match(app,/frontVolume/);assert.match(app,/sideVolume/);assert.match(app,/backVolume/);assert.match(app,/type="range" min="0" max="10"/);});
test('export contains both selection inputs and actual simulation diagnostics',()=>{assert.match(app,/getLabSnapshot/);assert.match(app,/lastFrame:viewer\?viewer.snapshot\(\):lastSnapshot/);assert.match(app,/application\/json/);});
