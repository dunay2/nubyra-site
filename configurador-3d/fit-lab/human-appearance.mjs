import * as T from 'three';

export const APPEARANCE_VERSION = 'human-appearance/1.0';
export const SKIN_COLOR = '#c99377';
const HAIR_COLOR = '#38261d';

/** Render-only hair, fitted to the approved scalp. Never modifies collider buffers. */
export function createHumanAppearance(body) {
  const base = body.userData.base;
  const sourcePosition = body.geometry.attributes.position;
  const sourceNormal = body.geometry.attributes.normal;
  const sourceIndex = body.geometry.index;
  if (!base || !sourceNormal || !sourceIndex) throw Error('La apariencia requiere la base humana indexada');

  let anchor = -1, minZ = Infinity, maxZ = -Infinity, backZ = Infinity;
  for (let i = 0; i < sourcePosition.count; i++) {
    const y = base[i * 3 + 1], z = base[i * 3 + 2];
    if (y > 1.56) backZ = Math.min(backZ, z);
    if (y > 1.63) {
      if (anchor < 0) anchor = i;
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
  }
  if (anchor < 0 || !Number.isFinite(backZ)) throw Error('No se encuentra el cuero cabelludo de la base aprobada');
  const centerZ = (minZ + maxZ) / 2;
  // Hairline clears the face and ears; lower at the back for a gathered hairstyle.
  const hairline = p => {
    const dz = p.z - centerZ, r = Math.hypot(p.x, dz);
    return 1.586 + .037 * (r > 1e-8 ? dz / r : 1);
  };
  const vertex = id => {
    const p = new T.Vector3().fromArray(base, id * 3);
    return { p, n: new T.Vector3().fromBufferAttribute(sourceNormal, id), d: p.y - hairline(p) };
  };
  const positions = [], normals = [], colors = [];
  function append(v) {
    const theta = Math.atan2(v.p.x, v.p.z - centerZ);
    const strand = .5 + .5 * Math.cos(theta * 24 + v.p.y * 16);
    const n = v.n.clone().normalize(), p = v.p.clone().addScaledVector(n, .0045 + .0006 * strand);
    positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
    const shade = .86 + .14 * strand; colors.push(shade, shade, shade);
  }
  for (let i = 0; i < sourceIndex.count; i += 3) {
    const ids = [sourceIndex.getX(i), sourceIndex.getX(i + 1), sourceIndex.getX(i + 2)];
    if (ids.every(id => base[id * 3 + 1] < 1.54)) continue;
    const tri = ids.map(vertex), polygon = [];
    // Clip at the hairline instead of exposing a staircase of whole triangles.
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      if (a.d >= 0) polygon.push(a);
      if ((a.d >= 0) !== (b.d >= 0)) {
        const t = a.d / (a.d - b.d);
        polygon.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), d: 0 });
      }
    }
    for (let k = 1; k + 1 < polygon.length; k++) {
      const a = polygon[0], b = polygon[k], c = polygon[k + 1];
      const area = b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).lengthSq();
      if (area > 1e-16) { append(a); append(b); append(c); }
    }
  }
  if (!positions.length) throw Error('No se pudo construir la superficie del pelo');
  const scalpGeometry = new T.BufferGeometry();
  scalpGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  scalpGeometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  scalpGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  scalpGeometry.computeBoundingBox(); scalpGeometry.computeBoundingSphere();
  const scalpMaterial = new T.MeshStandardMaterial({ color: HAIR_COLOR, roughness: .76, metalness: 0, vertexColors: true });
  const scalp = new T.Mesh(scalpGeometry, scalpMaterial); scalp.name = 'avatar-hair-scalp';
  const bunMaterial = new T.MeshStandardMaterial({ color: HAIR_COLOR, roughness: .8, metalness: 0 });
  const bun = new T.Mesh(new T.SphereGeometry(1, 24, 16), bunMaterial);
  bun.name = 'avatar-hair-bun'; bun.position.set(0, 1.631, backZ - .012); bun.scale.set(.037, .041, .035);
  const group = new T.Group(); group.name = 'avatar-hair'; group.add(scalp, bun); body.add(group);
  const originalColor = body.material.color.clone(), originalRoughness = body.material.roughness;
  body.material.color.set(SKIN_COLOR); body.material.roughness = .8;
  let destroyed = false;
  function update() {
    if (destroyed) return;
    const scale = body.userData.scale / body.userData.unit;
    if (!Number.isFinite(scale) || scale <= 0) throw Error('Escala de cabeza no válida');
    // The crown is outside all regional deformations. Follow its exact source/world transform.
    const p = body.geometry.attributes.position, i = anchor * 3;
    group.scale.setScalar(scale);
    group.position.set(p.getX(anchor) - base[i] * scale, p.getY(anchor) - base[i + 1] * scale, p.getZ(anchor) - base[i + 2] * scale);
    group.updateMatrix();
  }
  update();
  return {
    group, update,
    snapshot: () => ({ version: APPEARANCE_VERSION, skinColor: SKIN_COLOR, hairColor: HAIR_COLOR, hairStyle: 'compact-bun', hairMeshes: 2, scalpTriangles: positions.length / 9, renderOnly: true, collisionGeometryChanged: false }),
    destroy() {
      if (destroyed) return;
      destroyed = true; body.remove(group);
      scalpGeometry.dispose(); scalpMaterial.dispose(); bun.geometry.dispose(); bunMaterial.dispose();
      body.material.color.copy(originalColor); body.material.roughness = originalRoughness;
    }
  };
}
