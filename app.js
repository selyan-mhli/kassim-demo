(function () {
 'use strict';
 const E = window.KassimEngine, R = window.KassimResearch;
 const $ = id => document.getElementById(id);
 const money = n => new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n);
 const euros = n => new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2 }).format(n);
 const integer = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits:0 }).format(n);
 const percent = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits:2 }).format(n) + ' %';
 const signed = n => (n > 0 ? '+' : '') + percent(n);
 const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let input = E.defaults(), selectedPlan = 'robust', analysis, activePage = 'scenarios';
 let loadNote = '';
 const STORAGE_KEY = 'kassim-share-demo-v1';
 try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { const saved = JSON.parse(raw); if (E.validate(saved).length === 0) { input = saved; loadNote = 'Sauvegarde locale chargée.'; } else loadNote = 'Ancienne sauvegarde ignorée : format invalide.'; }
 } catch (_) { loadNote = 'Le stockage local est indisponible ; les calculs restent utilisables.'; }
 function setStatus(id, message) { $(id).textContent = message; }
 function syncControls() {
  ['copper','fx','demand','maxShare'].forEach(k => { $(k).value = input[k]; });
  $('copper-value').textContent = signed(input.copper);
  $('fx-value').textContent = signed(input.fx);
  $('demand-value').textContent = integer(E.BASE.monthlyParts * (1 + input.demand/100)) + ' pièces';
  $('maxShare-value').textContent = percent(input.maxShare);
 }
 function chosen() { return analysis?.plans.find(p => p.id === selectedPlan && p.feasible) || analysis?.plans.find(p => p.feasible); }
 function renderDecision() {
  analysis = E.analyze(input); syncControls();
  const issue = $('model-error'); issue.hidden = false;
  $('export-decision').disabled = !!analysis.errors.length;
  $('export-csv').disabled = !analysis.feasibleCount;
  if (analysis.errors.length) {
   issue.textContent = analysis.errors.join(' '); $('plans-area').hidden = true;
   ['metric-budget','metric-delta','metric-regret'].forEach(id => { $(id).textContent = '—'; }); lab.render(); return;
  }
  if (!analysis.feasibleCount) {
   issue.textContent = 'Aucun plan faisable trouvé sur la grille de 5 %. Cela ne prouve pas une impossibilité avec des parts plus fines. Vérifiez capacités, qualification et concentration ; un solveur continu serait nécessaire pour conclure au-delà de cette grille.';
   $('plans-area').hidden = true;
   ['metric-budget','metric-delta','metric-regret'].forEach(id => { $(id).textContent = '—'; });
   $('metric-delta-note').textContent = 'Pas de comparaison exploitable sur cette grille.'; renderSuppliersPrices(); renderScenarioTable(); lab.render(); return;
  }
  $('plans-area').hidden = false;
  if (!analysis.reference.feasible) issue.textContent = 'Le mix actuel 60 / 30 / 10 ne respecte plus les contraintes. Son coût reste affiché comme contre-factuel ; aucun gain ni regret n’est calculé contre cette référence infaisable.';
  else issue.hidden = true;
  if (!analysis.plans.some(p => p.id === selectedPlan && p.feasible)) selectedPlan = 'robust';
  const p = chosen();
  $('metric-budget').textContent = money(p.costs[1].total);
  const delta = analysis.reference.costs[1].total - p.costs[1].total;
  $('metric-delta').textContent = analysis.reference.feasible ? (delta < -0.5 ? '+' : delta > 0.5 ? '−' : '') + money(Math.abs(delta)) : 'Non comparable';
  $('metric-delta').classList.toggle('positive', analysis.reference.feasible && delta > .5);
  $('metric-delta').classList.toggle('negative', analysis.reference.feasible && delta < -.5);
  $('metric-delta-note').textContent = analysis.reference.feasible ? 'Écart simulé, avant coûts de changement' : 'Mix de référence infaisable sous ces contraintes';
  $('metric-regret').textContent = money(p.maxRegret);
  $('feasible-count').textContent = `${analysis.feasibleCount} allocations faisables sur la grille`;
  $('plan-options').innerHTML = analysis.plans.map(plan => `<button class="plan-choice" data-plan="${plan.id}" aria-pressed="${plan.id === p.id}" ${plan.feasible ? '' : 'disabled'}><strong>${escape(plan.name)}</strong><span>${plan.feasible ? plan.shares.map(v => Math.round(v*100)).join(' / ') + ' % · A / B / C' : 'Référence infaisable'}</span></button>`).join('');
  $('plan-options').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { selectedPlan = btn.dataset.plan; renderDecision(); const next = $('plan-options').querySelector(`[data-plan="${selectedPlan}"]`); next?.focus({preventScroll:true}); }));
  $('allocation').innerHTML = p.shares.map(share => `<span style="width:${share*100}%"></span>`).join('');
  $('mix-list').innerHTML = input.suppliers.map((s,i) => `<div class="mix-row"><span>${escape(s.name)} <span class="muted">· ${s.id}</span></span><strong class="num">${percent(p.shares[i]*100)} <span class="small muted">/ ${integer(p.shares[i]*analysis.quantity)} p.</span></strong></div>`).join('');
  const central = analysis.plans.find(p => p.id === 'central');
  const centralPremium = p.costs[1].total - central.costs[1].total;
  const explanation = p.id === 'current' ? 'Vous examinez le mix de référence, sans réallocation.' : p.id === 'central' ? 'Ce mix minimise le coût du scénario central sur la grille. Il peut coûter davantage dans un autre futur.' : `Ce mix minimise le regret maximal sur les trois scénarios de la grille. Son surcoût central par rapport au minimum est de ${money(Math.max(0,centralPremium))}.`;
  $('decision-explanation').innerHTML = `<strong>${escape(explanation)}</strong><p class="small section-gap">Les sources restent supposées substituables et disponibles. Avant toute décision réelle : engagements de volume, qualification par pièce, délais et coûts de changement à confirmer.</p>`;
  $('plans-table').innerHTML = analysis.plans.map(plan => `<tr class="${p.id===plan.id?'selected':''}"><td><strong>${escape(plan.name)}</strong><br><span class="small muted">${plan.shares.map(v=>Math.round(v*100)).join(' / ')} %</span></td>${plan.costs.map(c=>`<td class="num">${money(c.total)}</td>`).join('')}<td class="num">${plan.feasible?money(plan.maxRegret):'—'}</td><td><span class="badge ${plan.feasible?'ok':'error'}">${plan.feasible?'Faisable':'Hors contraintes'}</span></td></tr>`).join('');
  renderChart(); renderSuppliersPrices(); renderScenarioTable(); lab.render();
 }
 function renderScenarioTable() {
  if (!analysis.paths) return;
  $('scenario-table').innerHTML = `<table class="table"><thead><tr><th>Chemin à M+3</th><th class="num">Cuivre USD/t</th><th class="num">USD pour 1 €</th><th class="num">Besoin mensuel</th></tr></thead><tbody>${analysis.paths.map(path => `<tr><td>${escape(path.name)}</td><td class="num">${signed(path.copper)}</td><td class="num">${signed(path.fx)}</td><td class="num">${integer(analysis.quantity)} p.</td></tr>`).join('')}</tbody></table>`;
 }
 function renderChart() {
  if (activePage !== 'decision' || !analysis?.feasibleCount) return;
  const p = chosen(), container = $('cost-chart');
  const width = Math.max(220, container.clientWidth), height = width < 350 ? 260 : 290;
  const left = 48, right = 12, top = 25, bottom = 34;
  const max = Math.ceil(Math.max(...p.costs.map(c => c.total))/200000)*200000;
  const x = i => left + i/3*(width-left-right), y = v => height-bottom-(v/max)*(height-top-bottom);
  const colors = ['var(--color-chart-2)','var(--color-chart-1)','var(--color-chart-3)'];
  const dash = ['5 4','','2 4'];
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Coût cumulé du plan ${escape(p.name)} pour détente, central et tension. Les montants exacts sont dans le tableau."><title>Coût cumulé conditionnel, en euros</title><text x="0" y="14">k€</text>`;
  for (let i=0;i<=3;i++) { const val=max*i/3; svg+=`<line x1="${left}" x2="${width-right}" y1="${y(val)}" y2="${y(val)}" stroke="var(--color-rule)" stroke-width="1"/><text x="${left-10}" y="${y(val)+4}" text-anchor="end">${integer(val/1000)}</text>`; }
  for(let i=0;i<=3;i++) svg+=`<text x="${x(i)}" y="${height-8}" text-anchor="${i===3?'end':i===0?'start':'middle'}">${i===0?'Départ':'M+'+i}</text>`;
  p.costs.forEach((c,j) => { let sum=0; const points=[0,...c.monthly.map(v=>sum+=v)]; svg+=`<path class="line" d="${points.map((v,i)=>(i?'L':'M')+x(i)+','+y(v)).join(' ')}" stroke="${colors[j]}" ${dash[j]?`stroke-dasharray="${dash[j]}"`:''}/>`; points.slice(1).forEach((v,i)=> { svg+=`<circle cx="${x(i+1)}" cy="${y(v)}" r="3.5" fill="${colors[j]}"><title>${escape(analysis.paths[j].name)} · M+${i+1} · ${money(v)}</title></circle>`; }); });
  container.innerHTML=svg+'</svg>';
  $('chart-summary').textContent=`À 90 jours : détente ${money(p.costs[0].total)}, central ${money(p.costs[1].total)}, tension ${money(p.costs[2].total)}. Chemins hypothétiques, sans intervalle de confiance.`;
 }
 function renderSupplierForm() {
  $('supplier-form').innerHTML=input.suppliers.map((s,i)=>`<tr data-index="${i}"><td><label class="offscreen" for="supplier-name-${i}">Nom fournisseur ${s.id}</label><input id="supplier-name-${i}" data-key="name" type="text" maxlength="80" value="${escape(s.name)}"><div class="small muted">Identifiant ${s.id}</div></td>${[['conversion',s.conversion,0,1000,'any'],['freight',s.freight,0,1000,'any'],['fixedMetal',s.fixedMetal*100,0,100,'any']].map(([k,v,min,max,step])=>`<td><label class="offscreen" for="${k}-${i}">${k==='conversion'?'Conversion en euros par pièce':k==='freight'?'Transport en euros par pièce':'Part cuivre fixée en pourcentage'} · ${s.id}</label><input id="${k}-${i}" data-key="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${v}" required></td>`).join('')}<td><label class="offscreen" for="lag-${i}">Décalage d’indexation en mois · ${s.id}</label><select id="lag-${i}" data-key="lag">${[0,1,2].map(n=>`<option value="${n}" ${n===s.lag?'selected':''}>${n}</option>`).join('')}</select></td><td><label class="offscreen" for="capacity-${i}">Capacité en pièces par mois · ${s.id}</label><input id="capacity-${i}" data-key="capacity" type="number" min="0" max="200000" step="1" value="${s.capacity}" required></td><td><label class="checkline"><input data-key="qualified" type="checkbox" ${s.qualified?'checked':''} aria-label="Fournisseur ${s.id} qualifié"><span class="offscreen">Qualifié</span></label></td></tr>`).join('');
 }
 function supplierDraft() {
  const suppliers=[...$('supplier-form').querySelectorAll('tr')].map((tr,i)=> {
   const s={id:['A','B','C'][i]}; tr.querySelectorAll('[data-key]').forEach(el=> { const k=el.dataset.key; s[k]=k==='qualified'?el.checked:k==='name'?el.value.trim():el.value.trim()===''?NaN:Number(el.value); if(k==='fixedMetal')s[k]/=100; }); return s;
  }); return {...input,suppliers};
 }
 function applySuppliers(showSuccess = true) {
  const draft=supplierDraft(), errors=E.validate(draft); $('supplier-errors').hidden=!errors.length; $('supplier-errors').textContent=errors.join(' ');
  $('supplier-form').querySelectorAll('input[type=number]').forEach(el=>el.setAttribute('aria-invalid',!el.checkValidity()?'true':'false'));
  if(errors.length){setStatus('supplier-status','Paramètres non appliqués. Corrigez les champs indiqués.');return false;}
  input=draft; renderDecision(); if(showSuccess)setStatus('supplier-status','Paramètres appliqués. Les plans ont été recalculés.');return true;
 }
 function renderSuppliersPrices() {
  const path=E.scenarios(input)[1];
  $('unit-prices').innerHTML=input.suppliers.map(s=>`<tr><td>${escape(s.name)} · ${s.id}</td><td class="num">${euros(E.unitCost(s,0,{copper:0,fx:0}))}</td>${[1,2,3].map(t=>`<td class="num">${euros(E.unitCost(s,t,path))}</td>`).join('')}</tr>`).join('');
 }
 function renderFlow(index=0) {
  $('workflow').innerHTML=R.flow.map((n,i)=>`<button class="flow-node" data-flow="${i}" aria-pressed="${index===i}"><div class="flow-step">${i+1} ${i<5?'→':''}</div><strong>${escape(n.title)}</strong><span>${escape(n.subtitle)}</span></button>`).join('');
  const n=R.flow[index]; $('flow-detail').innerHTML=`<h2>${escape(n.title)}</h2><p><strong>Entrée.</strong> ${escape(n.input)}</p><p><strong>Traitement.</strong> ${escape(n.work)}</p><p><strong>Contrôle.</strong> ${escape(n.check)}</p><p class="small muted"><strong>Dans la démo.</strong> ${escape(n.demo)}</p>`;
  $('workflow').querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.flow);renderFlow(i);$('workflow').querySelector(`[data-flow="${i}"]`)?.focus({preventScroll:true});}));
 }
 function navigate() {
  const requested=location.hash.slice(1), valid=['scenarios','cas-pac','documents','veille','projet','decision','fournisseurs','fonctionnement','pilote'];
  if(requested==='content') return;
  activePage=valid.includes(requested)?requested:'scenarios';
  document.querySelectorAll('.page').forEach(page=>{page.hidden=page.id!=='page-'+activePage;});
  document.querySelectorAll('.nav a').forEach(a=>{if(a.hash==='#'+activePage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title='Kassim — '+$('title-'+activePage).textContent;
  requestAnimationFrame(()=>{renderChart();lab.render();workspace.render();news.render();caseStudy.render();});
 }
 function download(name,content,type) {
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 let preparedJSON = '';
 function exportJSON() {
  const report={product:'Kassim',kind:'demonstration_fictive',engineVersion:E.VERSION,exportedAt:new Date().toISOString(),input,base:E.BASE,analysis,selectedPlan,notes:['Aucun cours réel ni prévision de marché.','Allocations à pas de 5 %, contraintes limitées au démonstrateur.','Un écart simulé n’est pas un gain réalisé.','Coûts de stock, financement, qualité et changement exclus.']};
  preparedJSON=JSON.stringify(report,null,2);$('export-text').value=preparedJSON;$('export-dialog').showModal();setStatus('copy-status','');setStatus('export-status','Dossier JSON préparé avec paramètres, scénarios, calculs et limites. Importable dans Fournisseurs.');
 }
 function exportCSV() {
  const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const rows=[['Type','Plan','A %','B %','C %','Detente EUR','Central EUR','Tension EUR','Regret maximal EUR','Faisable']];
  analysis.plans.forEach(p=>rows.push(['DEMONSTRATION FICTIVE',p.name,...p.shares.map(s=>Math.round(s*100)),...p.costs.map(c=>c.total.toFixed(2)),p.feasible?p.maxRegret.toFixed(2):'',p.feasible?'oui':'non']));
  rows.push(['Limite','Ecarts simules avant couts de changement. Aucun cours reel ni gain etabli.']);
  download('kassim-plans-demo.csv','\uFEFF'+rows.map(r=>r.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8');setStatus('export-status','Comparaison CSV préparée. Les paramètres et hypothèses détaillés sont disponibles dans l’export JSON.');
 }
 const caseStudy = window.KassimCase.mount();
 const lab = window.KassimLab.mount({getInput:()=>input,getAnalysis:()=>analysis,getPlan:chosen,onInput:(key,value)=>{input={...input,[key]:value};renderDecision();},onPlan:id=>{selectedPlan=id;renderDecision();}});
 const workspace = window.KassimWorkspace.mount({getInput:()=>input});
 const news = window.KassimNews.mount({getInput:()=>input,onSignal:signal=>workspace.addSignal(signal),onStress:(key,value,article)=>{input={...input,[key]:value};renderDecision();const box=$('lab-news-context');box.hidden=false;box.innerHTML=`<strong>Hypothèse choisie après lecture d’un signal.</strong> <a href="${escape(article.url)}" target="_blank" rel="noopener noreferrer">${escape(article.title)}</a><p class="small">La variation a été choisie par l’utilisateur ; le lien causal avec les prix reste à confirmer.</p>`;}});
 ['copper','fx','demand','maxShare'].forEach(k=>$(k).addEventListener('input',()=>{input[k]=Number($(k).value);renderDecision();}));
 $('reset').addEventListener('click',()=>{$('lab-news-context').hidden=true;input=E.defaults();selectedPlan='robust';renderSupplierForm();$('supplier-errors').hidden=true;setStatus('supplier-status','Valeurs de démonstration rétablies.');renderDecision();setStatus('export-status','Valeurs réinitialisées. La sauvegarde locale précédente reste disponible tant que vous ne la remplacez pas.');});
 $('apply-suppliers').addEventListener('click',()=>applySuppliers());
 $('save').addEventListener('click',()=>{if(!applySuppliers(false))return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(input));setStatus('supplier-status','Paramètres appliqués et sauvegardés dans ce navigateur.');}catch(_){setStatus('supplier-status','Stockage local indisponible. Exportez le dossier JSON pour conserver vos paramètres.');}});
 $('import').addEventListener('click',()=>$('import-file').click());
 $('import-file').addEventListener('change',async()=>{const file=$('import-file').files[0];if(!file)return;try{if(file.size>250000)throw new Error('Fichier trop volumineux : maximum 250 Ko.');const data=JSON.parse(await file.text());const candidate=data&&typeof data==='object'&&Object.prototype.hasOwnProperty.call(data,'input')?data.input:data;const errors=E.validate(candidate);if(errors.length)throw new Error(errors.join(' '));input=structuredClone(candidate);renderSupplierForm();$('supplier-errors').hidden=true;renderDecision();setStatus('supplier-status','Scénario importé et appliqué. Rien n’a été envoyé à un serveur.');}catch(err){$('supplier-errors').hidden=false;$('supplier-errors').textContent='Import refusé : '+err.message;}finally{$('import-file').value='';}});
 $('export-decision').addEventListener('click',exportJSON);$('export-csv').addEventListener('click',exportCSV);
 $('download-json').addEventListener('click',()=>{download('kassim-decision-demo.json',preparedJSON,'application/json');setStatus('copy-status','Téléchargement demandé. Le contenu reste disponible ci-dessus si votre navigateur le bloque.');});
 $('copy-json').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(preparedJSON);setStatus('copy-status','JSON copié.');}catch(_){$('export-text').focus();$('export-text').select();setStatus('copy-status','Contenu sélectionné : utilisez le raccourci Copier de votre appareil.');}});
 window.addEventListener('hashchange',navigate);
 let resizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderChart);}).observe($('cost-chart'));
 renderSupplierForm();renderDecision();renderFlow();
 setStatus('supplier-status',loadNote);navigate();
 document.fonts?.ready.then(()=>{renderChart();lab.render();});
})();
