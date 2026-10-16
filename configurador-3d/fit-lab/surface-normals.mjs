/** Reconcile shading at welded cloth particles, without welding UVs or moving cloth. */
export function createSurfaceNormalReconciler(surfaces, maps) {
  const incidence = new Map();
  for (const mesh of surfaces) {
    const normal = mesh.geometry.getAttribute('normal');
    const map = maps instanceof Map ? maps.get(mesh.name) : maps[mesh.name];
    if (!normal || !map || map.length !== normal.count) {
      throw new Error('Invalid cloth normal map: ' + mesh.name);
    }
    for (let i = 0; i < map.length; i++) {
      const particle = map[i];
      if (!Number.isInteger(particle) || particle < 0) throw new Error('Invalid cloth particle');
      if (!incidence.has(particle)) incidence.set(particle, []);
      incidence.get(particle).push({normal, i});
    }
  }
  const groups = [...incidence.values()].filter(group => group.length > 1);
  // Call after ALL surface computeVertexNormals() calls, not once per panel.
  return function reconcileSurfaceNormals() {
    for (const group of groups) {
      let x = 0, y = 0, z = 0;
      for (const {normal, i} of group) {
        x += normal.getX(i); y += normal.getY(i); z += normal.getZ(i);
      }
      const length = Math.hypot(x, y, z);
      if (length < 1e-12) continue;
      for (const {normal, i} of group) normal.setXYZ(i, x / length, y / length, z / length);
    }
    for (const mesh of surfaces) mesh.geometry.getAttribute('normal').needsUpdate = true;
  };
}
