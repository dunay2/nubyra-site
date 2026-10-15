/** User-provided reference image. Replacement remains in the browser only. */
export function bindPhotoReference(root=document){
 const image=root.getElementById('reference-photo'),file=root.getElementById('reference-file'),button=root.getElementById('change-reference'),reset=root.getElementById('reset-reference'),status=root.getElementById('reference-photo-status'),metadata=root.getElementById('reference-metadata');
 const original=image.getAttribute('src');let localURL=null,request=0;
 function release(){if(localURL)URL.revokeObjectURL(localURL);localURL=null;}
 async function choose(){const item=file.files?.[0];if(!item)return;const version=++request;
  if(!['image/jpeg','image/png','image/webp'].includes(item.type)||item.size>5*1024*1024){status.textContent='Usa JPG, PNG o WebP de hasta 5 MB.';file.value='';return;}
  const url=URL.createObjectURL(item),probe=new Image();probe.src=url;
  try{await probe.decode();if(probe.naturalWidth*probe.naturalHeight>24000000)throw Error('La imagen supera 24 megapíxeles.');if(version!==request){URL.revokeObjectURL(url);return;}release();localURL=url;image.src=url;metadata.hidden=true;reset.hidden=false;status.textContent='Foto local. No se sube ni modifica las medidas del ensayo.';}
  catch(error){URL.revokeObjectURL(url);if(version===request)status.textContent=error.message||'No se pudo abrir la imagen.';}
  file.value='';
 }
 function restore(){request++;release();image.src=original;metadata.hidden=false;reset.hidden=true;status.textContent='Foto aportada: guía visual, sin escala 3D ni medidas verificadas.';}
 const open=()=>file.click();button.addEventListener('click',open);file.addEventListener('change',choose);reset.addEventListener('click',restore);
 return {snapshot:()=>({source:localURL?'local':'user-supplied',verified:false,uploaded:false}),destroy(){request++;release();button.removeEventListener('click',open);file.removeEventListener('change',choose);reset.removeEventListener('click',restore);}};
}
