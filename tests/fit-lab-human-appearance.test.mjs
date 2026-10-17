import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {loadHumanBody, updateHumanBody, createHumanCollider} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanAppearance, SKIN_COLOR} from '../configurador-3d/fit-lab/human-appearance.mjs';
const data = await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb', import.meta.url));
const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
const state = {bodyHeightCm:170, bodyChestCm:84, bodyHipCm:94, frontVolume:3, sideVolume:5, backVolume:5};

 test('Hair and natural skin do not alter body geometry, measurements or BVH', async () => {
  const body = updateHumanBody(await loadHumanBody(bytes), state);
  const before = body.geometry.attributes.position.array.slice(), indices = body.geometry.index.array.slice();
  const measures = {...body.userData.measurements}, tree = body.geometry.boundsTree, collider = createHumanCollider(body);
  const gap = collider.gap(0, body.userData.chestY, .8), original = body.material.color.getHexString();
  const appearance = createHumanAppearance(body);
  assert.deepEqual(body.geometry.attributes.position.array, before);
  assert.deepEqual(body.geometry.index.array, indices);
  assert.deepEqual(body.userData.measurements, measures);
  assert.equal(body.geometry.boundsTree, tree);
  assert.equal(collider.gap(0, body.userData.chestY, .8), gap);
  assert.equal('#' + body.material.color.getHexString(), SKIN_COLOR);
  assert.equal(appearance.group.parent, body);
  assert.equal(appearance.group.children.length, 3);
  assert.equal(appearance.snapshot().hairStyle, 'gathered-natural-ponytail');
  assert.equal(appearance.snapshot().scalpLocks, 140);
  assert.equal(appearance.snapshot().tailLocks, 24);
  assert.ok(appearance.group.getObjectByName('avatar-hair-swept-locks'));
  assert.ok(appearance.group.getObjectByName('avatar-hair-ponytail'));
  assert.ok(appearance.snapshot().scalpTriangles > 100);
  assert.ok(appearance.snapshot().scalpTriangles < 10000);
  for (const mesh of appearance.group.children) {
    assert.equal(mesh.material.metalness, 0);
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
  }
  let disposed = 0;
  for (const mesh of appearance.group.children) mesh.geometry.addEventListener('dispose', () => disposed++);
  appearance.destroy(); appearance.destroy();
  assert.equal(disposed, 3); assert.equal(appearance.group.parent, null);
  assert.equal(body.material.color.getHexString(), original);
  body.geometry.dispose(); body.material.dispose();
 });

 test('Hair follows head scale, clears the jersey and inherits body visibility', async () => {
  const body = updateHumanBody(await loadHumanBody(bytes), state, {collision:false});
  const appearance = createHumanAppearance(body), geometry = appearance.group.children[0].geometry;
  for (const height of [143,170,195]) {
    updateHumanBody(body, {...state, bodyHeightCm:height}, {collision:false});
    const before = body.geometry.attributes.position.array.slice(); appearance.update();
    assert.deepEqual(body.geometry.attributes.position.array, before);
    assert.equal(appearance.group.children[0].geometry, geometry);
    body.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(appearance.group);
    assert.ok(box.min.y > body.userData.shoulderY + .2, 'hair intersects shoulder/jersey area');
    assert.ok(Math.abs(box.max.y - body.userData.headTopY) < .04 * body.userData.scale / body.userData.unit, 'hair detached from crown');
    body.visible = false; let visible = 0;
    body.traverseVisible(() => visible++); assert.equal(visible, 0); body.visible = true;
  }
  appearance.destroy(); body.geometry.dispose(); body.material.dispose();
 });
