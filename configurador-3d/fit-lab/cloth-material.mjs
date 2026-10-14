/** Explicit DEMO spring-network material. SI values are assumptions, not textile calibration. */
export const DEMO_CLOTH=Object.freeze({
 id:'demo-knit-network-v1',arealDensityKgM2:.18,
 distanceComplianceMPerN:.001,bendDistanceComplianceMPerN:30,
 shoulderBendDistanceComplianceMPerN:15,friction:.4,
 stepSeconds:1/480,iterations:6,calibrated:false
});
export function lumpedMasses(positions,triangles,unitMeters,density){
 if(!(unitMeters>0&&density>0))throw Error('Invalid metric scale or fabric density');
 const masses=new Float64Array(positions.length/3);
 let areaM2=0;
 for(const [a,b,c]of triangles){
  const i=a*3,j=b*3,k=c*3;
  const ux=positions[j]-positions[i],uy=positions[j+1]-positions[i+1],uz=positions[j+2]-positions[i+2];
  const vx=positions[k]-positions[i],vy=positions[k+1]-positions[i+1],vz=positions[k+2]-positions[i+2];
  const area=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*.5*unitMeters**2;
  if(!Number.isFinite(area))throw Error('Invalid triangle area');
  areaM2+=area;const mass=area*density/3;
  masses[a]+=mass;masses[b]+=mass;masses[c]+=mass;
 }
 if([...masses].some(m=>!(m>0)))throw Error('A cloth particle has no positive incident area');
 const totalKg=areaM2*density,referenceKg=totalKg/masses.length;
 return {masses,totalKg,areaM2,referenceKg};
}
