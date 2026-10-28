/* Kassim — lots locaux, classement par fournisseur et revue humaine. */
(function(root){'use strict';
 const C=root.KassimDocuments,$=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=(n,currency)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency}).format(n);
 const formatDate=iso=>new Date(iso+'T00:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'});
 function mount(options){
  let documents=[],signals=[],selected='',busy=false,page=0,group='';
  const suppliers=()=>options.getInput().suppliers;
  const supplierName=id=>suppliers().find(s=>s.id===id)?.name??'À classer';
  const selectedDoc=()=>documents.find(d=>d.id===selected);
  function status(message){$('docs-status').textContent=message;}
  function assign(id,bucket){const doc=documents.find(d=>d.id===id);if(!doc)return;doc.bucket=bucket;doc.records?.forEach(r=>{r.supplier=bucket;r.validated=false;});render();status('Document reclassé. Les informations doivent être validées pour le nouveau fournisseur.');}
  function open(id){selected=id;page=0;renderEditor();}
  function renderBoard(){
   const complete=documents.filter(d=>d.status==='ready').length,validated=C.history(documents).length;
   $('docs-count').textContent=`${documents.length} / 30 documents · ${complete} lus · ${validated} lignes validées`;
   $('docs-empty').hidden=documents.length>0;
   $('docs-board').innerHTML=['','A','B','C'].map(bucket=>`<section class="docs-lane" data-bucket="${bucket}" aria-label="Dossier ${esc(supplierName(bucket))}"><div class="docs-lane-head"><h3>${esc(supplierName(bucket))}</h3><span>${documents.filter(d=>d.bucket===bucket).length}</span></div><div class="docs-lane-list">${documents.filter(d=>d.bucket===bucket).map(doc=>`<article class="docs-card" draggable="${doc.status==='ready'}" data-doc="${doc.id}"><button class="docs-card-open" data-open="${doc.id}"><strong>${esc(doc.name)}</strong><span>${doc.status==='loading'?'Lecture en cours…':doc.status==='error'?'Lecture impossible':`${doc.records.length} proposition${doc.records.length>1?'s':''} · ${doc.records.filter(r=>r.validated).length} validée(s)`}</span></button>${doc.error?`<p class="docs-card-error">${esc(doc.error)}</p>`:''}<label class="docs-move-label">Classer<select data-move="${doc.id}" aria-label="Classer ${esc(doc.name)}" ${doc.status!=='ready'?'disabled':''}>${['','A','B','C'].map(id=>`<option value="${id}" ${id===doc.bucket?'selected':''}>${esc(supplierName(id))}</option>`).join('')}</select></label><button class="docs-remove" data-remove="${doc.id}" ${busy?'disabled':''}>Retirer</button></article>`).join('')}</div></section>`).join('');
   $('docs-board').querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.open)));
   $('docs-board').querySelectorAll('[data-move]').forEach(s=>s.addEventListener('change',()=>assign(s.dataset.move,s.value)));
   $('docs-board').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{documents=documents.filter(d=>d.id!==b.dataset.remove);if(selected===b.dataset.remove)selected='';render();}));
   $('docs-board').querySelectorAll('[draggable=true]').forEach(card=>card.addEventListener('dragstart',event=>{event.dataTransfer.setData('application/x-kassim-document',card.dataset.doc);event.dataTransfer.effectAllowed='move';}));
   $('docs-board').querySelectorAll('[data-bucket]').forEach(lane=>{
    lane.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('application/x-kassim-document')){event.preventDefault();lane.classList.add('is-dragover');}});
    lane.addEventListener('dragleave',()=>lane.classList.remove('is-dragover'));
    lane.addEventListener('drop',event=>{const id=event.dataTransfer.getData('application/x-kassim-document');if(id){event.preventDefault();event.stopPropagation();assign(id,lane.dataset.bucket);}});
   });
   $('docs-clear').disabled=busy||!documents.length;$('docs-demo').disabled=busy;$('docs-pick').disabled=busy;$('docs-files').disabled=busy;
  }
  function readRow(row,record){
   row.querySelectorAll('[data-field]').forEach(el=>{const key=el.dataset.field;record[key]=key==='price'?(el.value.trim()===''?null:C.amount(el.value)):el.value.trim();if(key==='price'&&el.value.trim()&&record.price===null)record.price=NaN;});record.validated=false;
  }
  function renderEditor(){
   const doc=selectedDoc();$('docs-review').hidden=!doc;
   if(!doc)return;
   $('docs-review-title').textContent=doc.name;
   $('docs-source-text').textContent=doc.text?.slice(0,16000)||doc.error||'Lecture en cours.';
   $('docs-source-note').textContent=doc.text?.length>16000?'Aperçu limité à 16 000 caractères ; le texte extrait complet reste en mémoire.':'';
   $('docs-notes').textContent=(doc.notes??[]).join(' ');
   const records=doc.records??[],start=page*20,visible=records.slice(start,start+20);
   $('docs-page-info').textContent=records.length?`Lignes ${start+1} à ${Math.min(start+20,records.length)} sur ${records.length}`:'Aucune proposition disponible.';
   $('docs-prev').disabled=page===0;$('docs-next').disabled=start+20>=records.length;$('docs-validate-visible').disabled=!visible.length;
   $('docs-records').innerHTML=visible.map((r,i)=>`<tr data-record="${start+i}"><td><select data-field="supplier" aria-label="Fournisseur ligne ${start+i+1}"><option value="">À confirmer</option>${suppliers().map(s=>`<option value="${s.id}" ${r.supplier===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td><td><input data-field="date" type="date" value="${esc(r.date)}" aria-label="Date applicable ligne ${start+i+1}"></td><td><input data-field="reference" type="text" maxlength="100" value="${esc(r.reference)}" aria-label="Référence ligne ${start+i+1}"></td><td><input data-field="price" type="text" inputmode="decimal" value="${r.price===null?'':esc(r.price)}" aria-label="Prix unitaire ligne ${start+i+1}"></td><td><select data-field="currency" aria-label="Devise ligne ${start+i+1}"><option value="">À confirmer</option>${['EUR','USD'].map(c=>`<option ${r.currency===c?'selected':''}>${c}</option>`).join('')}</select></td><td><select data-field="unit" aria-label="Unité ligne ${start+i+1}"><option value="">À confirmer</option>${[['piece','/ pièce'],['kg','/ kg'],['t','/ tonne']].map(([key,label])=>`<option value="${key}" ${r.unit===key?'selected':''}>${label}</option>`).join('')}</select></td><td><span class="badge ${r.validated?'ok':'demo'}">${r.validated?'Validée':'À confirmer'}</span><div class="docs-record-source">${esc(r.source)}<details><summary>Extrait source</summary><p>${esc(r.excerpt)}</p></details></div><p class="docs-record-error">${esc(r.error??'')}</p></td></tr>`).join('');
   $('docs-records').querySelectorAll('tr').forEach(row=>row.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{readRow(row,records[Number(row.dataset.record)]);const badge=row.querySelector('.badge');badge.textContent='À confirmer';badge.className='badge demo';row.querySelector('.docs-record-error').textContent='';renderHistory();renderBoard();})));
  }
  function validateVisible(){const doc=selectedDoc();if(!doc)return;let accepted=0;
   $('docs-records').querySelectorAll('tr').forEach(row=>{const record=doc.records[Number(row.dataset.record)];readRow(row,record);record.error=C.validateRecord(record).join(' ');record.validated=!record.error;if(record.validated)accepted++;});
   render();status(`${accepted} ligne(s) validée(s) sur la page affichée. Les champs incomplets restent exclus de l’historique.`);
  }
  function renderHistory(){
   const records=C.history(documents),priced=records.filter(r=>r.price!==null),groups=[...new Set(priced.map(r=>[r.reference,r.currency,r.unit].join(' | ')))];
   if(!groups.includes(group))group=groups[0]??'';
   $('docs-history-group').innerHTML=groups.length?groups.map(g=>`<option ${g===group?'selected':''}>${esc(g)}</option>`).join(''):'<option>Aucune série validée</option>';
   $('docs-history-group').disabled=!groups.length;
   $('docs-history-count').textContent=`${records.length} ligne(s) validée(s) · ${groups.length} série(s) comparable(s)`;
   $('docs-history-rows').innerHTML=records.map(r=>`<tr><td>${formatDate(r.date)}</td><td>${esc(supplierName(r.supplier))}</td><td>${esc(r.reference||'Document sans prix')}</td><td class="num">${r.price===null?'—':money(r.price,r.currency)+' / '+esc(r.unit==='piece'?'pièce':r.unit)}</td><td><button class="docs-source-link" data-history-open="${r.documentID}">${esc(r.document)}</button><span class="small muted">${esc(r.source)}</span></td></tr>`).join('')||'<tr><td colspan="5">Confirmez les propositions d’un document pour alimenter l’historique.</td></tr>';
   $('docs-history-rows').querySelectorAll('[data-history-open]').forEach(b=>b.addEventListener('click',()=>{open(b.dataset.historyOpen);$('docs-review').scrollIntoView({behavior:'auto',block:'start'});}));
   drawHistory(priced.filter(r=>[r.reference,r.currency,r.unit].join(' | ')===group));
   $('docs-signals').innerHTML=signals.length?`<h3>Signaux publics associés</h3>${signals.map(s=>`<div class="docs-signal"><strong>${esc(s.supplier?supplierName(s.supplier):'Marché, sans fournisseur précis')}</strong><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a><span class="small muted">Repérage : ${s.seen?new Date(s.seen).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'}):'date non fournie'} · événement et impact à confirmer.</span></div>`).join('')}`:'';
  }
  function drawHistory(records){
   const container=$('docs-history-chart');if(!records.length){container.innerHTML='<p class="docs-history-empty">L’historique apparaîtra ici après validation. Les prix de références, devises ou unités différentes ne sont pas mélangés.</p>';return;}
   const width=Math.max(240,container.clientWidth),height=270,left=62,right=18,top=25,bottom=48;
   const timestamps=records.map(r=>Date.parse(r.date)),minX=Math.min(...timestamps),maxX=Math.max(...timestamps),prices=records.map(r=>r.price),min=Math.min(...prices),max=Math.max(...prices),spread=Math.max(max-min,max*.03,.1),lo=Math.max(0,min-spread*.2),hi=max+spread*.2;
   const x=t=>maxX===minX?(left+width-right)/2:left+(t-minX)/(maxX-minX)*(width-left-right),y=p=>height-bottom-(p-lo)/(hi-lo)*(height-top-bottom);
   let svg=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historique des prix unitaires validés pour ${esc(group)}. Axe vertical resserré. Sources et dates dans le tableau.">`;
   for(let i=0;i<=3;i++){const value=lo+(hi-lo)*i/3;svg+=`<line x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}" stroke="var(--color-rule)"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value)}</text>`;}
   const colors=['var(--color-accent)','var(--color-chart-2)','var(--color-chart-3)'];suppliers().forEach((s,index)=>{const points=records.filter(r=>r.supplier===s.id);if(!points.length)return;svg+=`<path fill="none" stroke="${colors[index]}" stroke-width="2.5" d="${points.map((r,i)=>`${i?'L':'M'}${x(Date.parse(r.date))},${y(r.price)}`).join(' ')}"/>`;points.forEach(r=>svg+=`<circle cx="${x(Date.parse(r.date))}" cy="${y(r.price)}" r="4" fill="${colors[index]}"><title>${esc(s.name)} · ${formatDate(r.date)} · ${money(r.price,r.currency)} · ${esc(r.document)}</title></circle>`);});
   [...new Set(timestamps)].filter((_,i,all)=>i===0||i===all.length-1||(width>=420&&i===Math.floor(all.length/2))).forEach(time=>svg+=`<text x="${x(time)}" y="${height-15}" text-anchor="${time===minX?'start':time===maxX?'end':'middle'}">${formatDate(new Date(time).toISOString().slice(0,10))}</text>`);
   container.innerHTML=svg+'</svg>';
  }
  function render(){renderBoard();renderEditor();renderHistory();}
  async function addFiles(files){
   if(busy){status('Un lot est déjà en cours. Attendez sa fin avant le suivant.');return;}
   const list=[...files];if(!list.length)return;
   const remaining=C.LIMITS.files-documents.length,accepted=list.slice(0,remaining);
   if(!remaining){status('Limite de 30 documents atteinte. Retirez un document avant d’ajouter un autre lot.');return;}
   if(accepted.reduce((n,f)=>n+f.size,0)>C.LIMITS.totalBytes){status('Lot refusé : dépassement de 100 Mo. Réduisez le lot.');return;}
   busy=true;renderBoard();$('docs-progress').hidden=false;$('docs-progress').max=accepted.length;$('docs-progress').value=0;
   for(const [index,file] of accepted.entries()){
    const doc={id:crypto.randomUUID(),name:file.name,bucket:'',status:'loading',records:[],notes:[]};documents.push(doc);if(!selected)selected=doc.id;renderBoard();status(`Lecture ${index+1}/${accepted.length} : ${file.name}`);
    try{const data=await C.read(file,suppliers());if(documents.some(d=>d.id!==doc.id&&d.hash===data.hash))throw new Error('Doublon de contenu : ce document a déjà été lu.');Object.assign(doc,data,{status:'ready'});const ids=[...new Set(data.records.map(r=>r.supplier).filter(Boolean))];if(ids.length===1)doc.bucket=ids[0];}
    catch(error){doc.status='error';doc.error=error.message;}
    $('docs-progress').value=index+1;render();await new Promise(resolve=>setTimeout(resolve,0));
   }
   busy=false;render();$('docs-progress').hidden=true;status(`Lot terminé : ${accepted.length} fichier(s) examiné(s). ${list.length>accepted.length?`${list.length-accepted.length} fichier(s) au-delà de la limite n’ont pas été ajoutés. `:''}Confirmez les propositions avant utilisation.`);
  }
  const zone=$('docs-drop');zone.addEventListener('dragover',event=>{if([...event.dataTransfer.types].includes('Files')){event.preventDefault();zone.classList.add('is-dragover');}});zone.addEventListener('dragleave',()=>zone.classList.remove('is-dragover'));zone.addEventListener('drop',event=>{event.preventDefault();zone.classList.remove('is-dragover');if(event.dataTransfer.files.length)addFiles(event.dataTransfer.files);});
  $('docs-pick').addEventListener('click',()=>$('docs-files').click());$('docs-files').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});
  $('docs-demo').addEventListener('click',async()=>{if(busy)return;if(location.protocol==='file:'||document.documentElement.dataset.preview==='standalone'){status('Les exemples et la lecture PDF nécessitent la version hébergée ou un serveur local.');return;}try{$('docs-demo').disabled=true;status('Préparation des trente documents fictifs…');const manifest=await fetch('assets/example-lot/manifest.json').then(r=>{if(!r.ok)throw new Error('Exemples indisponibles.');return r.json();});const files=[];for(const item of manifest.files){const response=await fetch('assets/example-lot/'+encodeURIComponent(item));if(!response.ok)throw new Error('Exemple indisponible : '+item);files.push(new File([await response.blob()],item));}await addFiles(files);}catch(error){status(error.message);}finally{$('docs-demo').disabled=busy;}});
  $('docs-clear').addEventListener('click',()=>{documents=[];signals=[];selected='';group='';render();status('Espace local vidé. Les fichiers d’origine ne sont pas modifiés.');});
  $('docs-export-history').addEventListener('click',()=>{const data={kind:'kassim_historique_valide',exportedAt:new Date().toISOString(),records:C.history(documents),signals};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='kassim-historique.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);status('Export local demandé. Il contient les lignes validées et leurs références de source, pas les fichiers originaux.');});
  $('docs-validate-visible').addEventListener('click',validateVisible);$('docs-prev').addEventListener('click',()=>{page--;renderEditor();});$('docs-next').addEventListener('click',()=>{page++;renderEditor();});
  $('docs-history-group').addEventListener('change',event=>{group=event.target.value;renderHistory();});
  let frame;new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>renderHistory());}).observe($('docs-history-chart'));
  render();return {render,addFiles,addSignal:signal=>{if(!signals.some(s=>s.url===signal.url&&s.supplier===signal.supplier))signals.push(signal);renderHistory();}};
 }
 root.KassimWorkspace={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
