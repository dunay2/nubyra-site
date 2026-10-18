import {GARMENT_CATALOG} from './garment-catalog.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,assessJersey} from './fixed-sizes.mjs';
import {FIT_POLICY_VERSION,JERSEY_LENGTHS,SHORT_RISES} from './pattern-registry.mjs';
export function mountSizingUI(){
 const details=document.createElement('details');details.className='nominal-catalog';
 details.innerHTML='<summary>Fichas fijas · N1/N2 × posiciones 1–3</summary><p class="micro">Propuestas de laboratorio, no tallas industriales aprobadas. Las prendas conservan su patrón al cambiar el cuerpo.</p><table><thead><tr><th>Camiseta</th><th>Pecho</th><th>Cadera</th><th>Largo</th></tr></thead><tbody>'+Object.values(GARMENT_CATALOG).map(g=>`<tr data-nominal="${g.code}"><th>${g.code}</th><td>${g.chestCm}</td><td>${g.hipCm}</td><td>${g.lengthCm}</td></tr>`).join('')+'</tbody></table>';
 document.getElementById('catalog-options').after(details);
 const review=document.createElement('section');review.className='zone-review';review.setAttribute('aria-label','Evaluación por zona');
 review.innerHTML='<p id="nominal-fit-review" class="status-line" role="status"></p><dl id="zone-assessment"></dl><p class="micro">Reglas '+FIT_POLICY_VERSION+' · hipótesis de ensayo; tejido sin calibrar.</p>';
 details.before(review);
 const proposal=document.createElement('section');proposal.className='kit-proposal';proposal.innerHTML='<h3>Propuesta para tus medidas</h3><p id="kit-proposal-summary" role="status"></p><p id="kit-proposal-shorts"></p><button id="apply-kit-proposal" type="button">Proponer equipación</button><p class="micro">Patrones fijos de ensayo. Base, posición y largo; pendiente de validación física.</p>';
 review.before(proposal);const lengths=document.createElement('p');lengths.className='micro';lengths.id='jersey-length-effect';review.prepend(lengths);

 const support=document.createElement('p');support.id='fixed-shorts-status';support.className='status-line';support.setAttribute('role','status');document.querySelector('.shorts-controls').append(support);
 const selector=document.createElement('label');selector.textContent='Base y posición del pantalón';const select=document.createElement('select');select.id='shorts-size';
 for(const g of Object.values(SHORT_SIZES)){const o=document.createElement('option');o.value=g.code;o.textContent=`${g.code} · cintura reposo ${g.waistCm} / cadera ${g.hipCm} cm`;select.append(o);}select.value='N1-2';selector.append(select);document.querySelector('.shorts-controls').prepend(selector);
 const rise=document.createElement('label');rise.textContent='Tiro fijo propuesto';const rs=document.createElement('select');rs.id='shorts-rise';for(const r of SHORT_RISES){const o=document.createElement('option');o.value=r;o.textContent=r+' cm';rs.append(o);}rise.append(rs);document.querySelector('.shorts-controls').append(rise);
 const e=document.getElementById('shorts-length'),replacement=document.createElement('select');replacement.id=e.id;for(const length of SHORT_LENGTHS){const o=document.createElement('option');o.value=length;o.textContent=length+' cm · '+({34:'corto',42:'medio',50:'largo'}[length]);replacement.append(o);}replacement.value='42';e.replaceWith(replacement);
 document.getElementById('shorts-fit-status').textContent='Tiro y largos fijos. Elástico previsto, sin extensión útil validada. Amarre sujeto en cintura; elástico sin calibrar.';
 const trial=document.createElement('div');trial.className='invariance-trial';trial.innerHTML='<p class="micro">Misma prenda, tres cuerpos de ensayo. Cambia solo la altura; la talla queda fijada.</p>'+[145,170,200].map(h=>`<button type="button" data-trial-height="${h}">${h} cm</button>`).join('');
 document.getElementById('height-field').after(trial);
}
export function updateSizingUI(state,frame){
 const a=assessJersey(state),p=state.recommendation.proposal,el=document.getElementById('nominal-fit-review');if(!el)return;
 document.getElementById('kit-proposal-summary').textContent=`Camiseta ${p.code} · pecho ${p.assessment.nominal.chestCm} / cadera ${p.assessment.nominal.hipCm} · largo ${p.lengthCm} cm${p.requiresReview?' · revisar holguras':''}`;
 const sp=frame?.kitProposal?.shorts;document.getElementById('kit-proposal-shorts').textContent=sp?`Pantalón ${sp.code} · cadera ${sp.hipCm} (+${sp.hipEaseCm.toFixed(1)} cm) · largo fijo ${sp.lengthCm} cm · tiro ${sp.riseCm} cm${sp.requiresReview?' · necesita revisión de contacto':''}`:'Calculando propuesta de pantalón…';
 document.getElementById('jersey-length-effect').textContent=`Largo solicitado ${state.desiredLengthCm} cm → corte seleccionado ${state.garmentLengthCm} cm. Cortes: ${JERSEY_LENGTHS.join(' / ')} cm.`;
 el.textContent=`${a.code} · ${a.reason}`;el.classList.toggle('warning',!a.recommendable);
 const zone=document.getElementById('zone-assessment');zone.replaceChildren();for(const [key,z] of Object.entries(a.zones)){
  const row=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd');name.textContent=z.label;
  value.textContent=key==='length'?`${z.garmentCm} cm · ${z.reason}`:`${z.easeCm>=0?'+':''}${z.easeCm.toFixed(1)} cm · ${z.compatible?'dentro del intervalo de ensayo':z.status==='too-small'?'contorno insuficiente':z.status==='excessive-ease'?'exceso de holgura':'holgura insuficiente'}`;
  row.dataset.zone=key;row.dataset.status=z.status;row.append(name,value);zone.append(row);
 }
 document.querySelectorAll('[data-nominal]').forEach(e=>e.classList.toggle('selected',e.dataset.nominal===state.activeConfiguration));
 document.querySelectorAll('[data-garment]').forEach(b=>{const item=state.recommendation.candidates.find(x=>x.code===b.dataset.garment);if(item){b.title=item.assessment.reason;b.dataset.recommended=String(item.code===state.recommendation.recommendedCode);}});
 const s=frame?.outfit?.fixed;if(s){const p=s.nominal,r=s.support,d=s.cloth,fmt=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:1});
  document.getElementById('fixed-shorts-status').textContent=`${p.code} · cintura en reposo ${fmt(p.waistCm)} / cuerpo ${fmt(r.waistCm)} cm · cadera ${fmt(p.hipCm)} cm · tiro ${fmt(p.riseReferenceCm)} cm · largo de corte ${fmt(p.lengthCm)} cm. `+(d?`Cinturilla sujeta: descenso ${fmt(d.waistDriftCm)} cm. Caída vertical visible ${fmt(d.visibleVerticalLengthCm)} cm. Gravedad y contacto activos. `:'Preparando caída física. ')+(r.excessWaistCm>8?'Exceso de cintura recogido por el amarre; revisar talla. ':'')+' Material de ensayo, sin calibración del tejido o elástico.';
 }
 if(frame?.sizeRejection)document.getElementById('fixed-shorts-status').textContent=frame.sizeRejection;
}
