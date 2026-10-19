/** Dress the sleeveless rest mesh with clearance at the arms, then lower them.
 * This changes only the initialization path, never the final body or rest pattern.
 * The pose sweep stays inside the existing 360 fixed physical substeps.
 */
export const DRESSING_POSE_VERSION='sleeveless-dressing/1.0';
export const DRESSING_POSE=Object.freeze({startStep:100,endStep:260,updateEvery:4});
export function dressingArmAngle(targetDegrees,completedSteps){
 if(!Number.isFinite(targetDegrees)||targetDegrees<0||targetDegrees>25)throw Error('Invalid dressing arm angle');
 if(!Number.isFinite(completedSteps)||completedSteps<0)throw Error('Invalid dressing step');
 const {startStep,endStep,updateEvery}=DRESSING_POSE;
 const step=Math.floor(completedSteps/updateEvery)*updateEvery;
 const t=Math.max(0,Math.min(1,(step-startStep)/(endStep-startStep)));
 return targetDegrees*t;
}
