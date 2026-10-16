import * as T from 'three';
import {MeshBVH, acceleratedRaycast} from 'three-mesh-bvh';

export const APPEARANCE_VERSION = 'human-appearance/1.1';
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
    const theta = Math.atan2(p.x, dz);
    return 1.594 + .036 * (r > 1e-8 ? dz / r : 1) + .011 * Math.sin(theta) ** 2
      - .006 * Math.exp(-(((theta + .15) / .34) ** 2)) + .0030 * Math.sin(3 * theta) + .0011 * Math.sin(17 * theta + .4);
  };
  const vertex = id => {
    const p = new T.Vector3().fromArray(base, id * 3);
    return { p, n: new T.Vector3().fromBufferAttribute(sourceNormal, id), d: p.y - hairline(p) };
  };
  const positions = [], normals = [], colors = [];
  function append(v) {
    const theta = Math.atan2(v.p.x, v.p.z - centerZ);
    const strand = .5 + .5 * Math.cos(theta * 37 + v.p.y * 24);
    const n = v.n.clone().normalize(), p = v.p.clone().addScaledVector(n, .0012 + .0035 * Math.min(1, Math.max(0, v.d / .025)) + .0005 * strand);
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
  const scalpMaterial = new T.MeshStandardMaterial({ color: HAIR_COLOR, roughness: .62, metalness: 0, vertexColors: true });
  const scalp = new T.Mesh(scalpGeometry, scalpMaterial); scalp.name = 'avatar-hair-scalp';
  const {locks, tail} = createGatheredHair(base, sourceIndex, centerZ, backZ, hairline);
  const group = new T.Group(); group.name = 'avatar-hair'; group.add(scalp, locks, tail); body.add(group);
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
    snapshot: () => ({ version: APPEARANCE_VERSION, skinColor: SKIN_COLOR, hairColor: HAIR_COLOR, hairStyle: 'short-ponytail', hairMeshes: 3, scalpLocks: 56, tailLocks: 14, scalpTriangles: positions.length / 9, renderOnly: true, collisionGeometryChanged: false }),
    destroy() {
      if (destroyed) return;
      destroyed = true; body.remove(group);
      for (const mesh of [scalp, locks, tail]) { mesh.geometry.dispose(); mesh.material.dispose(); }
      body.material.color.copy(originalColor); body.material.roughness = originalRoughness;
    }
  };
}


/** Deterministic swept locks on the real scalp; no hair collider or per-frame rebuild. */
function createGatheredHair(base, sourceIndex, centerZ, backZ, hairline) {
  const source = new T.BufferGeometry();
  source.setAttribute('position', new T.Float32BufferAttribute(base.slice(), 3));
  const headIndices = [];
  for (let i = 0; i < sourceIndex.count; i += 3) {
    const a = sourceIndex.getX(i), b = sourceIndex.getX(i + 1), c = sourceIndex.getX(i + 2);
    if (Math.min(base[a * 3 + 1], base[b * 3 + 1], base[c * 3 + 1]) > 1.54) headIndices.push(a, b, c);
  }
  source.setIndex(headIndices);
  source.boundsTree = new MeshBVH(source, {maxLeafTris: 8});
  const sourceMaterial = new T.MeshBasicMaterial({side: T.DoubleSide});
  const head = new T.Mesh(source, sourceMaterial);
  head.raycast = acceleratedRaycast;
  head.updateMatrixWorld(true);
  const center = new T.Vector3(0, 1.610, centerZ);
  const ray = new T.Raycaster(), direction = new T.Vector3();
  ray.firstHitOnly = true;
  function onScalp(p, offset) {
    direction.subVectors(p, center).normalize();
    ray.set(center, direction); ray.far = .3;
    const hit = ray.intersectObject(head, false)[0];
    if (!hit) throw new Error('Cannot fit hair lock to approved scalp');
    return hit.point.clone().addScaledVector(direction, offset);
  }
  const scalp = {positions: [], normals: [], colors: [], indices: []};
  const ponytail = {positions: [], normals: [], colors: [], indices: []};
  const tie = new T.Vector3(0, 1.642, backZ - .011);
  try {
    for (let i = 0; i < 48; i++) {
      const theta = -Math.PI + (i + .5 + .17 * Math.sin(i * 2.399)) * 2 * Math.PI / 48;
      const root = new T.Vector3(.075 * Math.sin(theta), 0, centerZ + .10 * Math.cos(theta));
      root.y = hairline(root);
      // Solve on the actual scalp, not on the auxiliary ellipse. The previous
      // projected roots started under the cap and were only visible at the crown.
      for (let iteration = 0; iteration < 8; iteration++) {
        const surface = onScalp(root, 0);
        const error = hairline(surface) - surface.y;
        root.y += error;
        if (Math.abs(error) < .00005) break;
      }
      root.copy(onScalp(root, 0));
      const crown = new T.Vector3(root.x * .64 + .017 * Math.max(0, Math.cos(theta)), 1.731 + .005 * Math.sin(i * 1.7), centerZ + .012);
      const rear = new T.Vector3(root.x * .35, 1.705, backZ - .020);
      const target = tie.clone(); target.x = .009 * Math.sin(theta);
      const curve = new T.CubicBezierCurve3(root, crown, rear, target);
      const points = Array.from({length: 25}, (_, j) => {
        const t = j / 24;
        return onScalp(curve.getPoint(t), .0048 + .009 * Math.sin(Math.PI * t) + .003 * t);
      });
      addLock(scalp, points, .0018 + .0010 * Math.sin(i * 2.4) ** 2, .0008, .86 + .17 * Math.sin(i * 2.17) ** 2, center, true);
    }
    // Fine temple locks break the solid helmet-like edge. All points stay on
    // the real head; tapered ends sit in front of the ear, never on the jersey.
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const theta = side * (.87 + .09 * i);
      const root = new T.Vector3(.075 * Math.sin(theta), 1.660 + .002 * i, centerZ + .10 * Math.cos(theta));
      const end = new T.Vector3(.080 * side, 1.570 + .005 * i, centerZ + .045);
      const curve = new T.CubicBezierCurve3(root,
        new T.Vector3(.064 * side, 1.653, centerZ + .087),
        new T.Vector3(.084 * side, 1.605, centerZ + .055), end);
      const points = Array.from({length: 23}, (_, j) => onScalp(curve.getPoint(j / 22), .006 + .002 * Math.sin(j / 22 * Math.PI)));
      addLock(scalp, points, .0011 + i * .00012, .00055, .90 + .04 * i, center, false);
    }
    for (let i = 0; i < 14; i++) {
      const theta = i * Math.PI * 2 / 14;
      const dx = Math.cos(theta), dz = Math.sin(theta);
      const curve = new T.CubicBezierCurve3(
        new T.Vector3(.009 * dx, tie.y + .008 * dz, tie.z),
        new T.Vector3(.020 * dx, 1.690 + .008 * dz, backZ - .060),
        new T.Vector3(.018 * dx, 1.554, backZ - .099 + .014 * dz),
        new T.Vector3(.008 * dx + .004 * Math.sin(i), 1.503 + .025 * (i % 4) / 3, backZ - .051 + .008 * dz)
      );
      addLock(ponytail, curve.getPoints(28), .0065, .0042, .83 + .22 * Math.sin(i * 1.74) ** 2, center, false);
    }
  } finally {
    source.boundsTree = null; source.dispose(); sourceMaterial.dispose();
  }
  function mesh(data, name) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(data.colors, 3));
    geometry.setIndex(data.indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const result = new T.Mesh(geometry, new T.MeshStandardMaterial({color: '#412e21', roughness: .65, metalness: 0, vertexColors: true}));
    result.name = name; return result;
  }
  return {locks: mesh(scalp, 'avatar-hair-swept-locks'), tail: mesh(ponytail, 'avatar-hair-ponytail')};
}

/** Flattened tapered lock, six samples around each cross-section. */
function addLock(out, points, width, depth, shade, center, scalp) {
  const sides = 6, start = out.positions.length / 3;
  for (let j = 0; j < points.length; j++) {
    const t = j / (points.length - 1), p = points[j];
    const tangent = points[Math.min(j + 1, points.length - 1)].clone().sub(points[Math.max(0, j - 1)]).normalize();
    const normal = scalp ? p.clone().sub(center) : new T.Vector3(0, 0, -1);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    if (normal.lengthSq() < .1) normal.set(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
    const side = tangent.clone().cross(normal).normalize();
    const taper = scalp ? .22 + .78 * Math.sin(Math.PI * t) ** .40 : Math.max(.04, (1 - t) ** .42);
    for (let k = 0; k <= sides; k++) {
      const angle = k * 2 * Math.PI / sides, c = Math.cos(angle), s = Math.sin(angle);
      const v = p.clone().addScaledVector(side, c * width * taper).addScaledVector(normal, s * depth * taper);
      const n = side.clone().multiplyScalar(c / width).addScaledVector(normal, s / depth).normalize();
      out.positions.push(v.x, v.y, v.z); out.normals.push(n.x, n.y, n.z);
      const color = shade * (1 + .025 * Math.cos(t * 28 + k)); out.colors.push(color, color, color);
    }
  }
  for (let j = 0; j < points.length - 1; j++) for (let k = 0; k < sides; k++) {
    const a = start + j * (sides + 1) + k, b = a + sides + 1;
    out.indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
}
