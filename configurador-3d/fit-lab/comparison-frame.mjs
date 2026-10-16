import {CM_PER_UNIT} from './body-surface.mjs';
export const REFERENCE_HEIGHT_CM=170;
/** Fixed 235 cm vertical reference range; equal x/y pixel scale, no body rescaling. */
export function fullBodyFrustum(width,height,{floorY,bodyRadius=1.8}={}){
 if(!(width>0&&height>0&&Number.isFinite(floorY)))throw Error('Invalid comparison viewport');
 const half=Math.max(117.5/CM_PER_UNIT,bodyRadius*1.14*height/width);
 return {half,left:-half*width/height,right:half*width/height,top:half,bottom:-half,targetY:floorY+half*.84,pxPerCm:height/(2*half*CM_PER_UNIT),floorFraction:.92};
}
