import {GARMENT_CATALOG} from './garment-catalog.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,assessJersey} from './fixed-sizes.mjs';
export function mountSizingUI(){
 const details=document.createElement('details');details.className='nominal-catalog';details.open=true;
 details.innerHTML='<summary>Medidas fijas de cada camiseta</summary><p class="micro">Propuestas numéricas del laboratorio, pendientes de patronaje. N1/N2 son bases y 1–3 posiciones laterales; no edades ni alturas.</p><table><thead><tr><th>Prenda</th><th>Pecho</th><th>Cadera</th><th>Largo</th></tr></thead><tbody>'+Object.values(GARMENT_CATALOG).map(g=>`<tr data-nominal="${g.code}"><th>${g.code}</th><td>${g.chestCm}</td><td>${g.hipCm}</td><td>${g.lengthCm}</td></tr>`).join('')+'</tbody></table><p class="micro">Todos los contornos y largos en centímetros. El cuerpo no cambia estas medidas.</p>';
 document.getElementById('catalog-options').after(details);
 const review=document.createElement('p');review.id='nominal-fit-review';review.className='status-line';review.setAttribute('role','status');details.before(review);
 const support=document.createElement('p');support.id='fixed-shorts-status';support.className='status-line';support.setAttribute('role','status');document.querySelector('.shorts-controls').append(support);
 const selector=document.createElement('label');selector.textContent='Talla fija del pantalón';const select=document.createElement('select');select.id='shorts-size';
 for(const g of Object.values(SHORT_SIZES)){const o=document.createElement('option');o.value=g.code;o.textContent=`${g.code} · cintura ${g.waistCm} / cadera ${g.hipCm} cm`;select.append(o);}selector.append(select);document.querySelector('.shorts-controls').prepend(selector);
 const e=document.getElementById('shorts-length'),replacement=document.createElement('select');replacement.id=e.id;for(const length of SHORT_LENGTHS){const o=document.createElement('option');o.value=length;o.textContent=length+' cm · '+({34:'corto',42:'medio',50:'largo'}[length]);replacement.append(o);}replacement.value='42';e.replaceWith(replacement);
 document.getElementById('shorts-fit-status').textContent='Tallas y largos fijos. Sin ajuste automático a la rodilla; cintura sin elástico ni cordón en este ensayo.';
}
export function updateSizingUI(state,frame){
 const a=assessJersey(state),el=document.getElementById('nominal-fit-review');if(!el)return;
 el.textContent=`${a.code} · holgura pecho ${a.chestEaseCm.toFixed(1)} cm / cadera ${a.hipEaseCm.toFixed(1)} cm. ${a.reason}`;el.classList.toggle('warning',a.blocked||a.status==='short'||a.excessive);
 document.querySelectorAll('[data-nominal]').forEach(e=>e.classList.toggle('selected',e.dataset.nominal===state.activeConfiguration));
 const s=frame?.outfit?.fixed;if(s){const p=s.nominal,r=s.support;document.getElementById('fixed-shorts-status').textContent=`${p.code} · cintura ${p.waistCm}, cadera ${p.hipCm}, largo ${p.lengthCm} cm. `+(r.status==='unsupported'?'Sin apoyo: cae por gravedad; la cintura supera la cadera.':`Apoyo de cintura: descenso ${r.dropCm.toFixed(1)} cm.`)+' Referencia geométrica, sin simulación del tejido.';}
 if(frame?.sizeRejection)document.getElementById('fixed-shorts-status').textContent=frame.sizeRejection;
}
