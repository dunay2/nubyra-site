/** Remove only the known red annotation from the supplied reference bitmap.
 * Canvas dimensions and every pixel outside the mask are preserved. No body
 * reconstruction, stretching or generated legs are involved. */
export function cleanReferenceAnnotation(img){
 if(!img)return;
 const apply=()=>{
  if(img.dataset.annotationRemoved==='true')return;
  try{
   const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   if(canvas.width!==300||canvas.height!==332)return; // This annotation belongs only to this asset.
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
   const pixels=ctx.getImageData(0,0,300,332),data=pixels.data,mask=new Uint8Array(300*332),known=new Uint8Array(mask.length).fill(1);
   for(let y=130;y<173;y++)for(let x=62;x<175;x++){
    const k=(y*300+x)*4,r=data[k],g=data[k+1],b=data[k+2];
    if(r>110&&r>1.4*g&&r>1.35*b)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)mask[(y+dy)*300+x+dx]=1;
   }
   let count=0;for(let i=0;i<mask.length;i++)if(mask[i]){known[i]=0;count++;}
   // Propagate neighbouring source colours inward across the thin annotation.
   for(let pass=0;pass<8;pass++){
    const filled=[];
    for(let y=129;y<174;y++)for(let x=61;x<176;x++){
     const i=y*300+x;if(known[i])continue;let n=0,r=0,g=0,b=0;
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){const j=(y+dy)*300+x+dx;if(known[j]){n++;r+=data[j*4];g+=data[j*4+1];b+=data[j*4+2];}}
     if(n)filled.push([i,r/n,g/n,b/n]);
    }
    if(!filled.length)break;
    for(const [i,r,g,b]of filled){data[i*4]=r;data[i*4+1]=g;data[i*4+2]=b;known[i]=1;}
   }
   ctx.putImageData(pixels,0,0);img.dataset.annotationRemoved='true';img.dataset.repairedPixels=String(count);img.src=canvas.toDataURL('image/png');
  }catch(error){img.dataset.annotationError=error.message;}
 };
 if(img.complete&&img.naturalWidth)apply();else img.addEventListener('load',apply,{once:true});
}
