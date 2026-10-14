import {normalizeText,normalizeNumber,hexColor,fitText} from '../layout.mjs';
export const DEFAULT_KIT=Object.freeze({base:'#173e64',accent:'#f8c12e',team:'',surname:'',number:'',sponsor:''});
export function normalizeKit(input={}){return {base:hexColor(input.base,DEFAULT_KIT.base),accent:hexColor(input.accent,DEFAULT_KIT.accent),team:normalizeText(input.team,28),surname:normalizeText(input.surname,24),number:normalizeNumber(input.number),sponsor:normalizeText(input.sponsor,32)};}
export function createKitDesign(T){
 let design=normalizeKit(),garment=null,updates=0;
 const make=()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;return {canvas,texture};};
 const front=make(),back=make();
 const contrast=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);return .2126*c[0]+.7152*c[1]+.0722*c[2]>.62?'#102b44':'#ffffff';};
 function text(ctx,value,y,size,maxWidth=354){const box={x:256-maxWidth/2,y,width:maxWidth,height:size*1.45};const f=fitText(ctx,value,box,{minFont:12,maxFont:size,maxLength:32,margin:4,maxTracking:0});if(!f.text)return;ctx.font=`800 ${f.fontSize}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=contrast(design.base);ctx.fillText(f.text,256,y+box.height/2);}
 function paint(item,isFront){const ctx=item.canvas.getContext('2d');ctx.fillStyle=design.base;ctx.fillRect(0,0,512,768);
  ctx.fillStyle=design.accent;for(const x of [0,488])ctx.fillRect(x,0,24,768);ctx.fillRect(0,748,512,20);
  if(isFront){text(ctx,design.team,220,40);text(ctx,design.sponsor,315,24);text(ctx,design.number,380,150,300);}else{text(ctx,design.surname,225,43);text(ctx,design.number,340,192,310);text(ctx,design.team,650,25);}
  item.texture.needsUpdate=true;
 }
 function materialColors(){if(!garment)return;garment.traverse(m=>{if(!m.isMesh)return;const list=Array.isArray(m.material)?m.material:[m.material];for(const mat of list){if(m.name.endsWith('_Front')||m.name.endsWith('_Back'))mat.color.set('#ffffff');else mat.color?.set(m.name.startsWith('trim-')||m.name.includes('_Side_')?design.accent:design.base);}});}
 function update(next){const value=normalizeKit({...design,...next});if(JSON.stringify(value)===JSON.stringify(design)&&updates)return false;design=value;paint(front,true);paint(back,false);materialColors();updates++;return true;}
 function attach(group){garment=group;
  for(const [name,item,reverse] of [['Front',front,false],['Back',back,true]]){
   const mesh=group.getObjectByName('NUBYRA_Test_Jersey_'+name),p=mesh.geometry.attributes.position;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,uv=[];
   for(let i=0;i<p.count;i++){const u=(p.getX(i)-box.min.x)/(box.max.x-box.min.x);uv.push(reverse?1-u:u,(p.getY(i)-box.min.y)/(box.max.y-box.min.y));}
   mesh.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));mesh.material=mesh.material.clone();mesh.material.map=item.texture;mesh.material.color.set('#ffffff');mesh.material.needsUpdate=true;
  }
  materialColors();
 }
 update(design);
 return {attach,update,snapshot:()=>({...design,textureUpdates:updates,textureCount:2}),destroy(){front.texture.dispose();back.texture.dispose();garment=null;}};
}
