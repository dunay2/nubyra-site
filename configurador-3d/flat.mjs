import { VIEW_ZONES, fitText, normalizeText, normalizeNumber } from './layout.mjs';

const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const outline = 'M225 160 L367 102 Q413 144 465 168 L512 240 L559 168 Q611 144 657 102 L799 160 Q783 378 871 546 L790 648 Q752 686 754 748 L774 1156 Q801 1288 830 1418 Q512 1482 194 1418 Q223 1288 250 1156 L270 748 Q272 686 234 648 L153 546 Q241 378 225 160 Z';
const neckFront = 'M367 105 L512 242 L657 105';
const neckBack = 'M367 108 Q512 240 657 108';
function ty(ctx,value,box,max,min,weight=800){const f=fitText(ctx,value,box,{maxFont:max,minFont:min,weight,margin:7});return {text:safe(f.fit?f.text:'REVISAR TEXTO'),size:f.fit?f.fontSize:min,invalid:!f.fit};}
const center=(box)=>box.x+box.width/2;
function mark(ctx, box, text, max=56, min=26, color='#ffffff', weight=800){
 if(!text) return '';
 const fitted=ty(ctx,text,box,max,min,weight);
 return `<text x="${center(box)}" y="${box.y+box.height/2}" font-family="Inter,Arial,sans-serif" font-size="${fitted.size}" font-weight="${weight}" text-anchor="middle" dominant-baseline="middle" fill="${fitted.invalid?'#ff9581':color}" letter-spacing=".5">${fitted.text}</text>`;
}
function bounding(box){return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="10" fill="none" stroke="#aecde2" stroke-width="2" stroke-dasharray="12 11" opacity=".42"/>`;}
export function jerseySVG(state, side, ctx, showSafe = false){
 const front=side==='front', z=VIEW_ZONES[side];
 const sponsor=front?state.sponsorFront:state.sponsorTop;
 const number=normalizeNumber(state.number)||'12';
 const fill=state.base, accent=state.accent, trim=state.trim, ink=state.text;
 const zones=showSafe?Object.values(z).map(bounding).join(''):'';
 const logo=front?`<text x="${center(z.brand)}" y="${z.brand.y+74}" fill="${trim}" font-size="72" font-weight="900" text-anchor="middle">N</text>`:`<text x="${center(z.brand)}" y="${z.brand.y+73}" fill="${accent}" font-size="68" font-weight="900" text-anchor="middle">N</text>`;
 const crestX=front?center(z.crest):0,crestY=front?z.crest.y+z.crest.height/2:0;
 const crest=front?(state.crestDataUrl?`<image href="${safe(state.crestDataUrl)}" x="${z.crest.x+11}" y="${z.crest.y+6}" width="${z.crest.width-22}" height="${z.crest.height-12}" preserveAspectRatio="xMidYMid meet"/>`:`<g transform="translate(${crestX-48} ${crestY-52})"><path d="M48 1 L84 18 L80 75 L48 98 L16 75 L12 18 Z" fill="none" stroke="${accent}" stroke-width="7"/><text x="48" y="60" font-size="34" fill="${trim}" font-weight="900" text-anchor="middle">NC</text></g>`):'';
  const art=front ? [mark(ctx,z.team,normalizeText(state.team),64,25,ink),mark(ctx,z.sponsor,normalizeText(sponsor),51,24,accent),mark(ctx,z.number,number,310,145,ink,900)].join(''):
 [mark(ctx,z.sponsorTop,normalizeText(sponsor),48,22,accent),mark(ctx,z.surname,normalizeText(state.surname),69,24,ink),mark(ctx,z.number,number,350,170,ink,900),mark(ctx,z.sponsorBottom,normalizeText(state.sponsorBottom),46,22,ink)].join('');
 return `<svg class="flat-shirt" role="img" aria-label="Camiseta NUBYRA ${front?'delantera':'espalda'} con personalización" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536">
  <defs><linearGradient id="sheen-${side}" x1="0" x2="1"><stop stop-color="#000" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity=".07"/><stop offset=".58" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
  <pattern id="mesh-${side}" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.7" fill="#fff" opacity=".14"/><circle cx="15" cy="15" r="1" fill="#fff" opacity=".08"/></pattern><clipPath id="cut-${side}"><path d="${outline}"/></clipPath></defs>
  <ellipse cx="512" cy="1480" rx="310" ry="24" fill="#22334a" opacity=".08"/>
  <path d="${outline}" fill="${fill}" stroke="#0b243a" stroke-width="12" stroke-linejoin="round"/>
  <g clip-path="url(#cut-${side})"><path d="M190 520 Q330 880 202 1450 L300 1450 Q435 1030 344 571 Z" fill="${accent}"/><path d="M834 520 Q694 880 822 1450 L724 1450 Q589 1030 680 571 Z" fill="${accent}"/><path d="M204 875 Q252 1210 198 1430 L242 1450 Q300 1210 280 890 Z" fill="${trim}"/><path d="M820 875 Q772 1210 826 1430 L782 1450 Q724 1210 744 890 Z" fill="${trim}"/><rect x="0" y="0" width="1024" height="1536" fill="url(#mesh-${side})"/><rect x="0" y="0" width="1024" height="1536" fill="url(#sheen-${side})"/></g>
  <path d="${front?neckFront:neckBack}" fill="none" stroke="${accent}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M225 160 Q241 405 153 546 M799 160 Q783 405 871 546" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
  <path d="M212 1394 Q512 1463 812 1394" stroke="${trim}" stroke-opacity=".52" fill="none" stroke-width="5"/>
  ${zones}${logo}${crest}${art}
  </svg>`;
}

export function renderFallback(state, {safeZones=false}={}){
 const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
 return `<div class="flat-pair"><div class="flat-card"><span>01 / DELANTERA</span>${jerseySVG(state,'front',ctx,safeZones)}</div><div class="flat-card"><span>02 / ESPALDA</span>${jerseySVG(state,'back',ctx,safeZones)}</div></div>`;
}
