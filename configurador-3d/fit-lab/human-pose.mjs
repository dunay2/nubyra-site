/** Bounded shoulder rotation of the existing mesh; applied identically by viewer and Worker. */
export function applyArmPose(positions, source, {degrees=0, scale, shoulderX, shoulderY}) {
  if (!Number.isFinite(degrees) || degrees < 0 || degrees > 25) throw new RangeError('Postura de brazos fuera de 0–25°');
  if (!degrees) return;
  const smooth = v => { const t=Math.max(0,Math.min(1,v)); return t*t*(3-2*t); };
  for (let i=0; i<positions.length; i+=3) {
    const x=source[i], y=source[i+1], side=x<0?-1:1;
    // Excludes trunk, neck and legs; the shoulder transition is continuous.
    const weight=smooth((Math.abs(x)-.16)/.085)*Math.max(smooth((y-1.02)/.09),smooth((Math.abs(x)-.26)/.045));
    if (!weight) continue;
    const angle=-side*degrees*Math.PI/180*weight, c=Math.cos(angle), s=Math.sin(angle);
    const dx=positions[i]-side*shoulderX, dy=positions[i+1]-shoulderY;
    positions[i]=side*shoulderX+c*dx-s*dy;
    positions[i+1]=shoulderY+s*dx+c*dy;
  }
}
