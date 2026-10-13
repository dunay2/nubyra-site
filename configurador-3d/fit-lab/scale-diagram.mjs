/**
 * Proyección 2D dinámica y determinista.
 *
 * MISMA ESCALA VERTICAL (px/cm) para altura del cuerpo y largo de prenda.
 * Anchura y profundidad solo son aproximaciones elípticas sintéticas;
 * NO existe una morfología única determinada por contorno pecho/cadera/altura.
 * El punto de hombro está supuesto al 82% de altura de referencia.
 */
import {getBodyProfile} from './fit-drape.mjs';
export const DIAGRAM_SCALE=1.26; // px / cm: no cambia entre variantes ni cuerpo
export const SHOULDER_HEIGHT_RATIO=.82; // estimación gráfica, no antropometría
export const GROUND_Y=286;
export function estimatedEllipseHalfWidthCm(circumferenceCm,depthRatio=.55){
  const c=Number(circumferenceCm);
  if(!(c>0&&depthRatio>0))throw Error('Contorno elíptico inválido');
  const factor=Math.PI*(3*(1+depthRatio)-
    Math.sqrt((3+depthRatio)*(1+3*depthRatio)));
  return c/factor;
}
const fmt=n=>Math.round(n*10)/10;
const f=n=>fmt(n);
export function createScaleSilhouettes(input){
 const H=Math.max(125,Math.min(190,Number(input.bodyHeightCm)||160));
 const chest=Math.max(65,Math.min(120,Number(input.bodyChestCm)||88));
 const hip=Math.max(70,Math.min(130,Number(input.bodyHipCm)||96));
 const length=Math.max(48,Math.min(84,Number(input.garmentLengthCm)||64));
 const lift=Math.max(0,Math.min(20,Number(input.estimatedFrontHemLiftCm)||0));
 const profile=getBodyProfile(input.bodyProfile);
 const ratio=profile.code==='lateral'?.44:profile.code==='thorax'?.68:.57;
 const chestA=estimatedEllipseHalfWidthCm(chest,ratio)*DIAGRAM_SCALE;
 const hipA=estimatedEllipseHalfWidthCm(hip,.61)*DIAGRAM_SCALE;
 const px=DIAGRAM_SCALE, ground=GROUND_Y;
 const headTop=ground-H*px, shoulder=ground-H*SHOULDER_HEIGHT_RATIO*px;
 const chestY=shoulder+17,hipY=ground-H*.53*px;
 const nominalHem=shoulder+length*px;
 const liftedHem=nominalHem-lift*px;
 const fcx=94,scx=237;
 const shoulderHalf=chestA*.93,waistHalf=(chestA+hipA)*.41;
 const midY=(chestY+hipY)*.55;
 const torsoFront=[
  'M',f(fcx-shoulderHalf),f(shoulder),
  'C',f(fcx-shoulderHalf-3),f(chestY),
    f(fcx-chestA),f(chestY+9),f(fcx-waistHalf),f(midY),
  'Q',f(fcx-hipA),f(hipY-12),f(fcx-hipA),f(hipY),
  'L',f(fcx-hipA*.80),f(ground-46),
  'L',f(fcx-hipA*.73),f(ground),
  'L',f(fcx-hipA*.12),f(ground),
  'L',f(fcx),f(hipY+35),
  'L',f(fcx+hipA*.12),f(ground),
  'L',f(fcx+hipA*.72),f(ground),
  'L',f(fcx+hipA*.81),f(ground-46),
  'L',f(fcx+hipA),f(hipY),
  'Q',f(fcx+hipA),f(hipY-12),f(fcx+waistHalf),f(midY),
  'C',f(fcx+chestA),f(chestY+9),f(fcx+shoulderHalf+3),f(chestY),
    f(fcx+shoulderHalf),f(shoulder),
  'Z'
 ].join(' ');
 const garmentWidth=estimatedEllipseHalfWidthCm(
  Number(input.garmentChestCm)||102,ratio)*DIAGRAM_SCALE;
 const hipGarmentWidth=estimatedEllipseHalfWidthCm(
  Number(input.garmentHipCm)||110,.61)*DIAGRAM_SCALE;
 const garmentFront=[
  'M',f(fcx-garmentWidth*.89),f(shoulder),
  'L',f(fcx-garmentWidth),f(chestY),
  'Q',f(fcx-garmentWidth*.88),f(midY),f(fcx-hipGarmentWidth),f(liftedHem),
  'Q',f(fcx),f(liftedHem-1),f(fcx+hipGarmentWidth),f(liftedHem),
  'Q',f(fcx+garmentWidth*.88),f(midY),f(fcx+garmentWidth),f(chestY),
  'L',f(fcx+garmentWidth*.89),f(shoulder),
  'Z'
 ].join(' ');
 const chestHalfDepth=estimatedEllipseHalfWidthCm(chest,ratio)*ratio;
 // En perfiles frontales la profundidad dorsal es referencia fija.
 const backCm=profile.code==='thorax'?.46*2*chestHalfDepth:6.8;
 const frontCm=Math.max(6.5,2*chestHalfDepth-backCm);
 const backX=scx-backCm*px,frontX=scx+frontCm*px;
 const hipHalfDepth=estimatedEllipseHalfWidthCm(hip,.61)*.61;
 const hipBackX=scx-hipHalfDepth*.95*px,hipFrontX=scx+hipHalfDepth*1.05*px;
 const torsoSide=[
  'M',f(backX),f(shoulder),
  'Q',f(backX-2),f(chestY),f(backX),f(midY),
  'Q',f(hipBackX),f(hipY-5),f(hipBackX),f(hipY),
  'L',f(scx-hipHalfDepth*.5*px),f(ground),
  'L',f(scx+hipHalfDepth*.55*px),f(ground),
  'L',f(hipFrontX),f(hipY),
  'Q',f(frontX-8),f(midY),f(frontX),f(chestY),
  'Q',f(frontX+2),f(shoulder+4),f(scx+3),f(shoulder),
  'Z'
 ].join(' ');
 const garmentBackX=scx-Math.max(8,backCm+3)*px;
 const frontGarmentProjection=Number(input.frontProjectionUnits)||0;
 // La proyección adicional proviene de una simulación 3D no calibrada en cm.
 const garmentFrontX=Math.max(
  scx+estimatedEllipseHalfWidthCm(Number(input.garmentChestCm)||102,ratio)*ratio*px,
  frontX+2
 )+Math.max(0,Math.min(8,frontGarmentProjection*8));
 const sideGarment=[
  'M',f(garmentBackX),f(shoulder),
  'Q',f(garmentBackX-1),f(chestY),f(garmentBackX),f(nominalHem),
  'L',f(garmentFrontX-6),f(liftedHem),
  'Q',f(garmentFrontX+2),f(midY),f(garmentFrontX),f(chestY),
  'Q',f(garmentFrontX),f(shoulder+5),f(scx+3),f(shoulder),
  'Z'
 ].join(' ');
 const nominalShirtBackY=Math.min(GROUND_Y+.001,nominalHem);
 return {
  bodyFront:torsoFront,shirtFront:garmentFront,
  bodySide:torsoSide,shirtSide:sideGarment,
  headFront:{cx:fcx,cy:headTop+H*.055*px,r:H*.053*px},
  headSide:{cx:scx,cy:headTop+H*.055*px,r:H*.053*px},
  shoulderY:shoulder,groundY:ground,
  nominalHemY:nominalShirtBackY,frontHemY:liftedHem,
  nominalLengthCm:length,estimatedFrontHemLiftCm:lift,
  estimatedFrontCoverageCm:Math.max(0,length-lift),
  bodyHeightCm:H,scalePxPerCm:px,bodyProfile:profile.code,
  notes:'Escala vertical 1.26 px/cm, hombro estimado al 82% de altura. Anchura y perfil sintéticos. Subida del bajo ilustrativa, NO fitting validado.'
 };
}
