/**
 * Closed synthetic dress-form torso: hips, rib cage, shoulders and neck base.
 * One polygon surface supplies rendering, measurement and collision.
 * Shoulder/neck proportions are design assumptions, not inferred measurements.
 */
export const CM_PER_UNIT = 64 / 2.42;
export const BODY_VERSION = 'nubyra.shoulder-torso/1.1';
export const BODY_LAYOUT = Object.freeze({rows: 69, around: 56, chestRow: 29, hipRow: 4});
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = x => Math.exp(-x * x);
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

/** Shape-preserving cubic: prevents overshoot and points at shoulder transitions. */
function profile(knots, y, axis) {
  const n = knots.length;
  if (y <= knots[0][0]) return knots[0][axis];
  if (y >= knots[n - 1][0]) return knots[n - 1][axis];
  let i = 0;
  while (knots[i + 1][0] < y) i++;
  const secant = j => (knots[j + 1][axis] - knots[j][axis]) / (knots[j + 1][0] - knots[j][0]);
  const slope = j => {
    if (j === 0) return secant(0);
    if (j === n - 1) return secant(n - 2);
    const a = secant(j - 1), b = secant(j);
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  const h = knots[i + 1][0] - knots[i][0], t = (y - knots[i][0]) / h;
  return (2*t*t*t - 3*t*t + 1)*knots[i][axis] + (t*t*t - 2*t*t + t)*h*slope(i)
    + (-2*t*t*t + 3*t*t)*knots[i+1][axis] + (t*t*t - t*t)*h*slope(i+1);
}

export function createBody(T) {
  const {rows, around} = BODY_LAYOUT, count = (rows + 1) * (around + 1), indices = [];
  for (let r = 0; r < rows; r++) for (let a = 0; a < around; a++) {
    const i = r * (around + 1) + a, j = i + around + 1;
    indices.push(i, j, i + 1, i + 1, j, j + 1);
  }
  // Closed ends. This is a cropped dress form, not a hollow tube.
  for (let a = 0; a < around; a++) {
    indices.push(count, a, a + 1);
    const top = rows * (around + 1);
    indices.push(count + 1, top + a + 1, top + a);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(new Float32Array((count + 2) * 3), 3));
  geometry.setIndex(indices);
  const body = new T.Mesh(geometry, new T.MeshStandardMaterial({color:0x68adbd, roughness:.8, side:T.FrontSide}));
  body.name = 'NUBYRA · torso continuo hasta hombros';
  body.userData = {...BODY_LAYOUT, fitRole:'body', version:BODY_VERSION};
  return body;
}

export function updateBody(mesh, state) {
  for (const key of ['bodyChestCm','bodyHipCm','bodyHeightCm','frontVolume','sideVolume','backVolume']) {
    if (!Number.isFinite(state[key])) throw Error('Invalid body parameter: ' + key);
  }
  const {rows, around, chestRow, hipRow} = mesh.userData;
  const p = mesh.geometry.getAttribute('position'), scale = state.bodyHeightCm / 160;
  const yFrom = y => 1.2 + (y - 1.2) * scale;
  // Chest/hip rings remain exact; unspecified shoulder dimensions are a neutral preset.
  const breadth = clamp(.745 * Math.pow(state.bodyChestCm / 88, .35), .65, .86);
  const neck = clamp(.203 * Math.pow(state.bodyChestCm / 88, .15), .190, .218);
  let chestWidth, chestFront, chestBack, upper, chestRing, previousRing;
  for (let r = 0; r <= rows; r++) {
    // Raise the measured chest section by 2.4 cm at 160 cm; pelvis/waist sections stay fixed.
    const y0 = r <= chestRow ? -1.16 + .05 * r + .09*smooth((r-16)/(chestRow-16)) : .38 + (1.62 - .38) * (r - chestRow) / (rows - chestRow);
    const ring = [];
    if (r <= chestRow) {
      const t = clamp((r - hipRow) / (chestRow - hipRow));
      const target = lerp(state.bodyHipCm, state.bodyChestCm, t) * (1 - .12 * Math.pow(Math.sin(t * Math.PI), 2));
      const chest = gauss((y0 - .44) / .48), hip = gauss((y0 + 1) / .45);
      for (let a = 0; a < around; a++) {
        const angle = 2 * Math.PI * a / around, c = Math.cos(angle), s = Math.sin(angle);
        const x = c * (.43 + .035 * hip) * (1 + (state.sideVolume - 5) * .045 * chest);
        // Broad rounded anterior mass; no cone or single displaced apex.
        const broad = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(c), 6)), .35);
        const forward = state.frontVolume * .028 * gauss((y0 - .44) / (.34 + state.frontVolume * .014)) * broad * Math.max(0,s);
        const z = s * (.22 + .025 * hip) * (1 + (s < 0 ? (state.backVolume - 5) * .055 * chest : 0)) + forward;
        ring.push([x,z]);
      }
      let perimeter = 0;
      for (let a = 0; a < around; a++) perimeter += Math.hypot(ring[a][0]-ring[(a+1)%around][0], ring[a][1]-ring[(a+1)%around][1]);
      const factor = target / (perimeter * CM_PER_UNIT);
      for (const v of ring) { v[0] *= factor; v[1] *= factor; }
      if (r === chestRow-1) previousRing=ring.map(v=>[...v]);
      if (r === chestRow) {
        chestRing=ring.map(v=>[...v]);
        chestWidth = Math.max(...ring.map(v=>v[0])); chestFront = Math.max(...ring.map(v=>v[1])); chestBack = -Math.min(...ring.map(v=>v[1]));
        upper = [
          [.24+.09*smooth(12/13), Math.max(...previousRing.map(v=>v[0])), Math.max(...previousRing.map(v=>v[1])), -Math.min(...previousRing.map(v=>v[1]))],
          [.38, chestWidth, chestFront, chestBack],
          [.56, chestWidth*.98, chestFront*.91, chestBack*.99],
          [.76, breadth*.92, chestFront*.68, chestBack*.90],
          [.93, breadth, .233, .249],
          [1.08, breadth*.96, .200, .230],
          [1.20, breadth*.81, .184, .216],
          [1.31, breadth*.51, .180, .205],
          [1.41, neck*1.22, .181, .198],
          [1.51, neck*1.04, .172, .182],
          [1.62, neck*.93, .168, .169]
        ];
      }
    } else {
      const width = profile(upper, y0, 1), front = profile(upper,y0,2), back = profile(upper,y0,3);
      for (let a = 0; a < around; a++) {
        const theta = 2*Math.PI*a/around, c=Math.cos(theta), s=Math.sin(theta);
        const x=width*c;
        // Shallow clavicle/scapular transitions, with broad support rather than a pointed chest.
        const clavicle = .009*gauss((y0-1.05)/.10)*Math.pow(Math.sin(2*theta),2);
        const reference=chestRing[a];
        const factor=s>=0?front/chestFront:back/chestBack;
        const inherited=reference[1]*factor;
        const blend=smooth((y0-.38)/.38);
        const scapula=s<0?.012*gauss((y0-.81)/.20)*Math.pow(Math.sin(2*theta),2):0;
        ring.push([x,lerp(inherited,s*(s>=0?front-clavicle:back+scapula),blend)]);
      }
    }
    for(let a=0;a<=around;a++) p.setXYZ(r*(around+1)+a,ring[a%around][0],yFrom(y0),ring[a%around][1]);
  }
  const count=(rows+1)*(around+1);
  p.setXYZ(count,0,yFrom(-1.16),0); p.setXYZ(count+1,0,yFrom(1.62),0);
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();
  // Weld the visual normal at the angular seam without changing measured ring indices.
  const normals=mesh.geometry.getAttribute('normal');
  for(let r=0;r<=rows;r++) {
    const a=r*(around+1),b=a+around;
    const x=normals.getX(a)+normals.getX(b),y=normals.getY(a)+normals.getY(b),z=normals.getZ(a)+normals.getZ(b),d=Math.hypot(x,y,z)||1;
    normals.setXYZ(a,x/d,y/d,z/d);normals.setXYZ(b,x/d,y/d,z/d);
  }
  normals.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();
  Object.assign(mesh.userData,{chestY:p.getY(chestRow*(around+1)),hipY:p.getY(hipRow*(around+1)),shoulderY:yFrom(.93),neckBaseY:yFrom(1.41),shoulderHalfWidth:breadth,neckHalfWidth:neck});
  return mesh;
}

/** Collider interpolates the same polygon rings, including shoulder slope and closed caps. */
export function createCollider(body) {
  const p=body.geometry.getAttribute('position'),{rows,around}=body.userData,ys=[],rings=[];
  for(let r=0;r<=rows;r++) {
    ys.push(p.getY(r*(around+1)));const ring=[];
    for(let a=0;a<around;a++) {const i=r*(around+1)+a,x=p.getX(i),z=p.getZ(i);ring.push({angle:Math.atan2(z,x),x,z});}
    rings.push(ring.sort((a,b)=>a.angle-b.angle));
  }
  function radial(ring,theta) {
    let lo=0,hi=ring.length;while(lo<hi){const m=(lo+hi)>>1;if(ring[m].angle<theta)lo=m+1;else hi=m;}
    const a=ring[(lo-1+ring.length)%ring.length],b=ring[lo%ring.length];
    const dx=b.x-a.x,dz=b.z-a.z,c=Math.cos(theta),s=Math.sin(theta),den=c*dz-s*dx;
    const r=(a.x*b.z-a.z*b.x)/den;
    return [r,-r*(-s*dz-c*dx)/den];
  }
  function sample(y,theta) {
    let lo=0,hi=rows;while(lo<hi){const m=(lo+hi)>>1;if(ys[m]<y)lo=m+1;else hi=m;}
    const i=Math.max(0,Math.min(rows-1,lo-1)),dy=ys[i+1]-ys[i],t=clamp((y-ys[i])/dy);
    const a=radial(rings[i],theta),b=radial(rings[i+1],theta);
    return [lerp(a[0],b[0],t),(b[0]-a[0])/dy,lerp(a[1],b[1],t)];
  }
  const radius=(y,theta)=>sample(y,theta)[0];
  function field(x,y,z) {
    const d=Math.hypot(x,z),theta=d>1e-10?Math.atan2(z,x):0,c=Math.cos(theta),s=Math.sin(theta),[r,ry,rt]=sample(y,theta);
    const nx=c+s*rt/Math.max(d,.05),ny=-ry,nz=s-c*rt/Math.max(d,.05),norm=Math.hypot(nx,ny,nz),side=(d-r)/norm;
    const top=y-ys.at(-1),bottom=ys[0]-y;
    if(top>=side&&top>=bottom)return [top,0,1,0];
    if(bottom>=side)return [bottom,0,-1,0];
    return [side,nx/norm,ny/norm,nz/norm];
  }
  function project(x,y,z,margin) {
    let f=field(x,y,z);if(f[0]>=margin)return null;
    for(let i=0;i<5&&f[0]<margin-1e-7;i++){
      const correction=Math.min(.3,margin-f[0]);x+=f[1]*correction;y+=f[2]*correction;z+=f[3]*correction;f=field(x,y,z);
    }
    return [x,y,z];
  }
  function surfaceHeight(x,z) {
    const d=Math.hypot(x,z),theta=Math.atan2(z,x);
    for(let r=rows-1;r>=0;r--) {
      const r0=radius(ys[r],theta),r1=radius(ys[r+1],theta);
      if(r0>=d&&r1<d)return lerp(ys[r],ys[r+1],clamp((r0-d)/(r0-r1)));
    }
    return d<=radius(ys.at(-1),theta)?ys.at(-1):body.userData.shoulderY;
  }
  return {ys,radius,surfaceHeight,shoulderHalfWidth:body.userData.shoulderHalfWidth,neckHalfWidth:body.userData.neckHalfWidth,
    gap:(x,y,z)=>field(x,y,z)[0],project};
}
export function ringPerimeter(body,row) {
  const {around}=body.userData,p=body.geometry.getAttribute('position');let c=0;
  for(let i=0;i<around;i++){const a=row*(around+1)+i,b=a+1;c+=Math.hypot(p.getX(a)-p.getX(b),p.getZ(a)-p.getZ(b));}
  return c*CM_PER_UNIT;
}
