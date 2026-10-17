import {mountReferenceGallery} from './reference-gallery.mjs';
/** One photo reference pane. No second WebGL context or physical simulation. */
export async function createFullReference(canvas,bytes,seed,shortFactory,actions={}){
 const stage=document.getElementById('reference-photo-stage');
 const gallery=mountReferenceGallery({stage,onApplyProfile:actions.onApplyReferenceProfile,onSelectMode(){gallery.setActive(true);}});
 stage.dataset.source='profiles';gallery.setActive(true);
 return {render(metrics){gallery.render(metrics);},setBody(state){gallery.setBody(state);},snapshot(){return {mode:'profiles',profiles:gallery.snapshot(),fullBody:true,samePixelScale:false,heightSource:'illustrative-profile',originalPreserved:true,originalExtended:false,secondaryWebGL:false};},destroy(){gallery.destroy();}};
}
