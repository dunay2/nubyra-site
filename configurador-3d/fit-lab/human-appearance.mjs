import * as T from 'three';
import {MeshBVH, acceleratedRaycast} from 'three-mesh-bvh';

export const APPEARANCE_VERSION = 'human-appearance/3.2';
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
    const c=r>1e-8?dz/r:1;
    return 1.610 + .046*Math.max(0,c) - .061*Math.max(0,-c) + .007*Math.sin(theta)**2
      - .004*Math.exp(-(((theta+.18)/.32)**2)) + .0016*Math.sin(2*theta) + .0005*Math.sin(17*theta+.4)
      - .060*Math.exp(-(((Math.abs(theta)-1.03)/.20)**2));
  };
  // A shared continuous envelope supports the locks: no dark air gaps or
  // basket-like openings between raised ribbons when the head is viewed closely.
  const hairVolume = p => {
    const theta = Math.atan2(p.x, p.z - centerZ);
    const t = Math.max(0, Math.min(1, (p.y - hairline(p)) / .055));
    const sweep=.5+.5*Math.sin(theta+.45);
    return .0016 + (.006 + .005*sweep) * t*t*(3-2*t);
  };
  const vertex = id => {
    const p = new T.Vector3().fromArray(base, id * 3);
    return { p, n: new T.Vector3().fromBufferAttribute(sourceNormal, id), d: p.y - hairline(p) };
  };
  const positions = [], normals = [], colors = [];
  function append(v) {
    const theta = Math.atan2(v.p.x, v.p.z - centerZ);
    const strand = .5 + .5 * Math.sin(theta * 3 + v.p.y * 13);
    const n = v.n.clone().normalize(), radial = v.p.clone().sub(new T.Vector3(0, 1.610, centerZ)).normalize();
    const p = v.p.clone().addScaledVector(radial, hairVolume(v.p));
    positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
    const shade = .94 + .06 * strand; colors.push(shade, shade, shade);
  }
  function midpoint(a,b){
    const linear=a.p.clone().lerp(b.p,.5),na=a.n.clone().normalize(),nb=b.n.clone().normalize();
    const pa=linear.clone().addScaledVector(na,-linear.clone().sub(a.p).dot(na));
    const pb=linear.clone().addScaledVector(nb,-linear.clone().sub(b.p).dot(nb));
    const p=linear.clone().lerp(pa.add(pb).multiplyScalar(.5),.75);
    if(a.d===0&&b.d===0)p.y=hairline(p);
    return {p,n:na.add(nb).normalize(),d:Math.max(0,p.y-hairline(p))};
  }
  function smoothTriangle(a,b,c,depth=2){if(depth===0){append(a);append(b);append(c);return;}const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);for(const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])smoothTriangle(...t,depth-1);}
  for (let i = 0; i < sourceIndex.count; i += 3) {
    const ids = [sourceIndex.getX(i), sourceIndex.getX(i + 1), sourceIndex.getX(i + 2)];
    if (ids.every(id => base[id * 3 + 1] < 1.49)) continue;
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
      if (area > 1e-16) smoothTriangle(a,b,c);
    }
  }
  if (!positions.length) throw Error('No se pudo construir la superficie del pelo');
  const scalpGeometry = new T.BufferGeometry();
  scalpGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  scalpGeometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  scalpGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  scalpGeometry.computeBoundingBox(); scalpGeometry.computeBoundingSphere();
  const scalpMaterial = new T.MeshStandardMaterial({ color: HAIR_COLOR, roughness: .86, metalness: 0, vertexColors: true });
  const scalp = new T.Mesh(scalpGeometry, scalpMaterial); scalp.name = 'avatar-hair-scalp';
  const {locks, tail} = createGatheredHair(base, sourceIndex, centerZ, backZ, hairline, hairVolume);
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
    snapshot: () => ({ version: APPEARANCE_VERSION, skinColor: SKIN_COLOR, hairColor: HAIR_COLOR, hairStyle: 'gathered-natural-ponytail', hairMeshes: 3, scalpLocks: 340, tailLocks: 24, scalpTriangles: positions.length / 9, hairTie:true, growthDirection:'regional-gather-to-occiput', renderOnly: true, collisionGeometryChanged: false }),
    destroy() {
      if (destroyed) return;
      destroyed = true; body.remove(group);
      for (const mesh of [scalp, locks, tail]) { mesh.geometry.dispose(); mesh.material.dispose(); }
      body.material.color.copy(originalColor); body.material.roughness = originalRoughness;
    }
  };
}


/** Deterministic swept locks on the real scalp; no hair collider or per-frame rebuild. */
function createGatheredHair(base, sourceIndex, centerZ, backZ, hairline, hairVolume) {
  const source = new T.BufferGeometry();
  source.setAttribute('position', new T.Float32BufferAttribute(base.slice(), 3));
  const headIndices = [];
  for (let i = 0; i < sourceIndex.count; i += 3) {
    const a = sourceIndex.getX(i), b = sourceIndex.getX(i + 1), c = sourceIndex.getX(i + 2);
    if (Math.min(base[a * 3 + 1], base[b * 3 + 1], base[c * 3 + 1]) > 1.45) headIndices.push(a, b, c);
  }
  source.setIndex(headIndices);source.computeVertexNormals();
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
    // Tangent-plane interpolation smooths the low-poly scalp for hair only.
    const ids=[hit.face.a,hit.face.b,hit.face.c],pos=source.attributes.position,norm=source.attributes.normal;
    const verts=ids.map(i=>new T.Vector3().fromBufferAttribute(pos,i));
    const w=new T.Triangle(...verts).getBarycoord(hit.point,new T.Vector3());
    const smooth=new T.Vector3();
    for(let k=0;k<3;k++){const n=new T.Vector3().fromBufferAttribute(norm,ids[k]).normalize();smooth.addScaledVector(hit.point.clone().addScaledVector(n,-hit.point.clone().sub(verts[k]).dot(n)),w.getComponent(k));}
    return hit.point.clone().lerp(smooth,.75).addScaledVector(direction,offset);
  }
  const scalp = {positions: [], normals: [], colors: [], indices: []};
  const ponytail = {positions: [], normals: [], colors: [], indices: []};
  const tieSurface=onScalp(new T.Vector3(0,1.617,backZ-.020),0);
  const tie=tieSurface.clone().addScaledVector(tieSurface.clone().sub(center).normalize(),hairVolume(tieSurface)+.002);
  try {
    for (let i = 0; i < 320; i++) {
      const theta = -Math.PI + (i + .5 + .34 * Math.sin(i * 2.399)) * 2 * Math.PI / 320;
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
      // Forehead strands sweep back; temple/nape strands converge towards the tie.
      const front=Math.max(0,Math.cos(theta)),part=.010*Math.sin(theta+.25);
      const crown=new T.Vector3(root.x*.76+part,Math.max(root.y+.012,tie.y)+.048*front,root.z-.040*front);
      const rear=new T.Vector3(root.x*.30,tie.y+.044*front,backZ-.018);
      const target=tie.clone();target.x+=.003*Math.sin(theta);
      const curve=new T.CubicBezierCurve3(root,crown,rear,target);
      const points = Array.from({length: 25}, (_, j) => {
        const t = j / 24;
        const surface = onScalp(curve.getPoint(t), 0);
        return surface.clone().addScaledVector(surface.clone().sub(center).normalize(), hairVolume(surface) + .0010 + .0003 * Math.sin(Math.PI * t));
      });
      addLock(scalp, points, .00030 + .00034 * Math.sin(i * 2.4) ** 2, .00016, .92 + .10 * Math.sin(i * 2.17) ** 2, center, true);
    }
    // Fine temple locks break the solid helmet-like edge. All points stay on
    // the real head; tapered ends sit in front of the ear, never on the jersey.
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const theta = side * (.87 + .09 * i);
      const root = new T.Vector3(.075 * Math.sin(theta), 1.660 + .002 * i, centerZ + .10 * Math.cos(theta));
      const end = new T.Vector3(.080 * side, 1.588 + .007 * i, centerZ + .045);
      const curve = new T.CubicBezierCurve3(root,
        new T.Vector3(.064 * side, 1.653, centerZ + .087),
        new T.Vector3(.084 * side, 1.605, centerZ + .055), end);
      const points = Array.from({length: 23}, (_, j) => onScalp(curve.getPoint(j / 22), .006 + .002 * Math.sin(j / 22 * Math.PI)));
      addLock(scalp, points, .0011 + i * .00012, .00055, .90 + .04 * i, center, false);
    }
    // Small tapered hairs soften the forehead boundary without adding a fringe.
    for (let i = 0; i < 12; i++) {
      const theta = -.72 + 1.44 * i / 11;
      const root = new T.Vector3(.075 * Math.sin(theta), 0, centerZ + .10 * Math.cos(theta));
      root.y = hairline(root);
      for (let j = 0; j < 8; j++) { const p = onScalp(root, 0); root.y += hairline(p) - p.y; }
      root.copy(onScalp(root, 0));
      const end = root.clone(); end.y -= .003 + .002 * Math.sin(i * 2.1) ** 2; end.x += .0015 * Math.sin(i);
      const start = root.clone(); start.y += .009;
      const curve = new T.CubicBezierCurve3(start, start.clone().add(new T.Vector3(.002, -.002, 0)), root, end);
      const points = curve.getPoints(16).map(p => { const surface = onScalp(p, 0); return surface.clone().addScaledVector(surface.clone().sub(center).normalize(), hairVolume(surface) + .0008); });
      addLock(scalp, points, .00055, .00025, .91 + .04 * Math.sin(i) ** 2, center, false);
    }
    // Anchored compact tie and curved, gravity-led tapered tail.
    for (let i = 0; i < 24; i++) {
      const theta=i*Math.PI*2/24,dx=Math.cos(theta),dy=Math.sin(theta),phase=i*2.399;
      const origin=new T.Vector3(tie.x+.006*dx,tie.y+.006*dy,tie.z+.003);
      const curve=new T.CubicBezierCurve3(origin,
        new T.Vector3(tie.x+.012*dx,tie.y-.026,tie.z-.035),
        new T.Vector3(tie.x+.018+.027*dx,tie.y-.098,tie.z-.052+.012*dy),
        new T.Vector3(tie.x+.013*dx+.010*Math.sin(phase),tie.y-.136+.020*Math.sin(phase)**2,tie.z-.028+.010*dy));
      const points=curve.getPoints(36).map((p,j)=>{const t=j/36;p.x+=.002*Math.sin(t*8+phase)*Math.sin(Math.PI*t);return p;});
      addLock(ponytail,points,.0052,.0032,.92+.12*Math.sin(phase)**2,center,false);
    }
    const band=new T.TorusGeometry(.010,.0018,6,20);band.translate(tie.x,tie.y,tie.z-.003);
    const start=ponytail.positions.length/3,p=band.attributes.position,n=band.attributes.normal;
    for(let i=0;i<p.count;i++){ponytail.positions.push(p.getX(i),p.getY(i),p.getZ(i));ponytail.normals.push(n.getX(i),n.getY(i),n.getZ(i));ponytail.colors.push(.43,.43,.43);}
    for(const i of band.index.array)ponytail.indices.push(start+i);band.dispose();
  } finally {
    source.boundsTree = null; source.dispose(); sourceMaterial.dispose();
  }
  function mesh(data, name) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(data.colors, 3));
    geometry.setIndex(data.indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const result = new T.Mesh(geometry, new T.MeshStandardMaterial({color: HAIR_COLOR, roughness: .86, metalness: 0, vertexColors: true}));
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
    const taper = scalp ? .02 + .98 * Math.sin(Math.PI * t) ** .65 : Math.max(.04, (1 - t) ** .42);
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
