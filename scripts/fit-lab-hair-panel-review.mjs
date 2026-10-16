import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {APPEARANCE_VERSION} from '../configurador-3d/fit-lab/human-appearance.mjs';
const root = path.resolve(process.env.REVIEW_ROOT || 'fit-dist');
const dir = process.env.EVIDENCE_DIR || 'artifacts/hair-panel-review';
await mkdir(dir, {recursive:true});
const server = createServer(async (req, res) => {
  try {
    let file = path.join(root, new URL(req.url, 'http://local').pathname);
    if (file.endsWith('/')) file += 'index.html';
    if (!file.startsWith(root + path.sep)) throw Error('path');
    res.setHeader('Content-Type', ({'.mjs':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1040}}), errors = [], results=[];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:' + server.address().port + '/fit-lab/');
  await page.waitForFunction(() => document.querySelector('#render-status').textContent.includes('Malla humana'), null, {timeout:60000});
  await page.evaluate(async () => window.lab = await import('./app.mjs'));
  for (const [name, height, chest, hip] of [['reference',170,84,94],['reported',160,88,96]]) {
    for (const [key, value] of [['bodyHeightCm',height],['bodyChestCm',chest],['bodyHipCm',hip]]) {
      await page.locator('#'+key+'-number').fill(String(value));
      await page.locator('#'+key+'-number').press('Enter');
    }
    await page.waitForFunction(({height,chest,hip}) => {
      const f = window.lab.getLabSnapshot().lastFrame;
      return f.sleeping && f.state.bodyHeightCm===height && f.state.bodyChestCm===chest && f.state.bodyHipCm===hip;
    }, {height,chest,hip}, {timeout:120000});
    await page.locator('#show-dimensions').uncheck();
    for (const view of ['front','back','side','quarter']) {
      await page.locator('[data-view="'+view+'"]').click(); await page.waitForTimeout(200);
      await page.screenshot({path:dir+'/'+name+'-'+view+'.png'});
    }
    const snapshot = await page.evaluate(() => window.lab.getLabSnapshot());
    assert.equal(snapshot.lastFrame.body.vertices,13380);
    assert.ok(snapshot.lastFrame.cloth.maxPenetrationCm < .1);
    if (!process.env.BASELINE) assert.equal(snapshot.lastFrame.appearance.version,APPEARANCE_VERSION);
    results.push({name,snapshot});
  }
  await page.locator('[data-view="front"]').click();
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:dir+'/mobile-front.png',fullPage:true});
  await page.locator('[data-view="back"]').click(); await page.waitForTimeout(200);
  await page.screenshot({path:dir+'/mobile-back.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(dir+'/review.json', JSON.stringify({errors,results},null,2));
  console.log(JSON.stringify({passed:results.length,errors,evidence:dir}));
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
