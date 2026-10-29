/* Kassim — cas PAC fictif ; coût d’une seule référence, sans modification du moteur général. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KassimCase=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SCENARIOS=Object.freeze([{label:'Détente',variation:-15},{label:'Stable',variation:0},{label:'Tension',variation:20}].map(Object.freeze));
 const PLANS=Object.freeze([{id:'a',name:'100 % A',shareA:1},{id:'mix',name:'50 % A / 50 % B',shareA:.5},{id:'b',name:'100 % B',shareA:0}].map(Object.freeze));
 function defaults(){return {pacs:3000,variation:20,capacityB:4000,qualifiedB:true,selected:'mix'};}
 function unitPriceA(variation){if(!Number.isFinite(variation)||variation< -30||variation>30)throw new Error('Variation cuivre attendue entre −30 et +30 %.');return 6+4*(1+variation/100);}
 function analyze(input){
  const errors=[];
  if(!input||typeof input!=='object')return {errors:['Paramètres du cas manquants.']};
  if(!Number.isInteger(input.pacs)||input.pacs<1||input.pacs>30000)errors.push('Indiquez un nombre entier de PAC entre 1 et 30 000.');
  if(!Number.isFinite(input.variation)||input.variation< -30||input.variation>30)errors.push('La variation cuivre doit être comprise entre −30 et +30 %.');
  if(!Number.isInteger(input.capacityB)||input.capacityB<0||input.capacityB>200000)errors.push('La capacité B doit être un entier entre 0 et 200 000 pièces par mois.');
  if(typeof input.qualifiedB!=='boolean')errors.push('Confirmez le statut de qualification de B.');
  if(!PLANS.some(p=>p.id===input.selected))errors.push('Choisissez un des trois plans.');
  if(errors.length)return {errors};
  const quantity=input.pacs*4,monthlyPacs=[0,1,2].map(i=>Math.floor(input.pacs/3)+(i<input.pacs%3?1:0)),monthly=monthlyPacs.map(n=>n*4),peak=Math.max(...monthly);
  const plans=PLANS.map(p=>{
   const reasons=[];if(peak*p.shareA>4000)reasons.push('Capacité A dépassée : 4 000 pièces par mois.');
   if(p.shareA<1&&!input.qualifiedB)reasons.push('Fournisseur B non qualifié pour cette référence.');
   if(peak*(1-p.shareA)>input.capacityB)reasons.push('Capacité B dépassée au mois le plus chargé.');
   const feasible=!reasons.length,costAt=v=>quantity*(p.shareA*unitPriceA(v)+(1-p.shareA)*10.15);
   return {...p,feasible,reasons,quantityA:quantity*p.shareA,quantityB:quantity*(1-p.shareA),costs:SCENARIOS.map(s=>feasible?costAt(s.variation):null),selectedCost:feasible?costAt(input.variation):null};
  });
  const feasible=plans.filter(p=>p.feasible),minimums=SCENARIOS.map((_,i)=>feasible.length?Math.min(...feasible.map(p=>p.costs[i])):null);
  plans.forEach(p=>{p.maxRegret=p.feasible?Math.max(...p.costs.map((c,i)=>Math.max(0,c-minimums[i]))):null;});
  const reference=plans[0],selected=plans.find(p=>p.id===input.selected);
  return {errors:[],quantity,monthly,peak,plans,selected,feasibleCount:feasible.length,minimums,delta:reference.feasible&&selected.feasible?selected.selectedCost-reference.selectedCost:null};
 }
 function decisionNote(input,result){
  if(result.errors.length)return 'Note indisponible : '+result.errors.join(' ');
  const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n),p=result.selected;
  return ['KASSIM — CAS PAC FICTIF — PROPOSITION À VALIDER',`${input.pacs} PAC, 4 pièces TUBE-CAS-01 par PAC, ${result.quantity} pièces sur 90 jours.`,`Volumes mensuels : ${result.monthly.join(' / ')} pièces.`, `Plan examiné : ${p.name} (${p.quantityA} pièces A, ${p.quantityB} pièces B).`,p.feasible?`Coût au stress cuivre ${input.variation>0?'+':''}${input.variation} % : ${money(p.selectedCost)}.`:'PLAN NON RÉALISABLE : '+p.reasons.join(' '),...SCENARIOS.map((s,i)=>`${s.label} (${s.variation} %) : ${p.feasible?money(p.costs[i]):'non réalisable'}.`),`Qualification B : ${input.qualifiedB?'confirmée dans cet exemple':'non confirmée'} ; capacité B : ${input.capacityB} pièces/mois ; capacité A : 4000 pièces/mois.`, 'Prix livrés fictifs : A = 6 € + 4 € × (1 + variation cuivre) ; B = 10,15 € fixe sur les 90 jours. Indice contractuel en euros, sans change additionnel.', 'Hypothèse : même niveau d’indice pour tous les achats de la période. Aucun calendrier de révision, stock, coût de financement, qualité, rupture ou changement de source calculé.', 'À confirmer : équivalence technique, clauses signées, capacités datées, stocks et commandes engagées ; aucun ordre envoyé.', 'À mesurer après décision : prix facturés et quantités livrées, coûts supplémentaires et référence validée par Finance. Un écart simulé ne constitue pas un gain réalisé.'].join('\n');
 }
 function mount(){
  const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const integer=n=>new Intl.NumberFormat('fr-FR').format(n),money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n),signed=n=>(n>0?'+':'')+n+' %';
  let input=defaults(),step=1,result;const touched={pacs:false,capacityB:false};
  const colors=['var(--color-accent)','var(--color-scenario-low)','var(--color-scenario-high)'],dashes=['','7 4','2 4'];
  function draw(){
   const box=$('case-chart');if(!box.clientWidth||result?.errors.length)return;
   const width=box.clientWidth,height=300,left=50,right=20,top=24,bottom=44,feasible=result.plans.filter(p=>p.feasible);
   if(!feasible.length){box.innerHTML='<p class="small muted">Aucun plan ne respecte les contraintes. Corrigez les capacités, la qualification ou le programme de production.</p>';return;}
   const cost=(p,v)=>result.quantity*(p.shareA*unitPriceA(v)+(1-p.shareA)*10.15),endpoints=feasible.flatMap(p=>[-30,30].map(v=>cost(p,v))),min=Math.min(...endpoints),max=Math.max(...endpoints),padding=Math.max((max-min)*.15,max*.015),lo=Math.max(0,min-padding),hi=max+padding;
   const x=v=>left+(v+30)/60*(width-left-right),y=v=>height-bottom-(v-lo)/(hi-lo)*(height-top-bottom);
   let svg=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Coût total à 90 jours des plans réalisables selon la variation du cuivre. Axe vertical resserré, en milliers d’euros. Tableau exact sous le graphique.">`;
   for(let i=0;i<=3;i++){const v=lo+(hi-lo)*i/3;svg+=`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--color-rule)"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v/1000)}</text>`;}
   for(const v of (width<420?[-30,0,30]:[-30,-15,0,20,30]))svg+=`<text x="${x(v)}" y="${height-18}" text-anchor="${v===-30?'start':v===30?'end':'middle'}">${signed(v)}</text>`;
   svg+=`<line x1="${x(input.variation)}" x2="${x(input.variation)}" y1="${top}" y2="${height-bottom}" stroke="var(--color-muted)" stroke-dasharray="3 4"/>`;
   result.plans.forEach((p,i)=>{if(!p.feasible)return;svg+=`<path d="M${x(-30)},${y(cost(p,-30))} L${x(30)},${y(cost(p,30))}" fill="none" stroke="${colors[i]}" stroke-width="${p.id===input.selected?3.5:2}" ${dashes[i]?`stroke-dasharray="${dashes[i]}"`:''}/><circle cx="${x(input.variation)}" cy="${y(p.selectedCost)}" r="${p.id===input.selected?5:3.5}" fill="${colors[i]}"><title>${esc(p.name)} : ${money(p.selectedCost)} à ${signed(input.variation)}</title></circle>`;});
   box.innerHTML=svg+'</svg>';
  }
  function render(){
   result=analyze(input);$('case-error').hidden=!result.errors.length||!(touched.pacs||touched.capacityB);$('case-error').textContent=result.errors.join(' ');
   $('case-volume').setAttribute('aria-invalid',String(touched.pacs&&(!Number.isInteger(input.pacs)||input.pacs<1||input.pacs>30000)));$('case-capacity-b').setAttribute('aria-invalid',String(touched.capacityB&&(!Number.isInteger(input.capacityB)||input.capacityB<0||input.capacityB>200000)));
   $('case-heading-volume').textContent=Number.isInteger(input.pacs)&&input.pacs>0?integer(input.pacs):'—';$('case-copy-status').textContent='';$('case-quantity').textContent=result.errors.length?'—':integer(result.quantity);$('case-note').value=decisionNote(input,result);$('case-copy').disabled=!!result.errors.length;$('case-variation-value').textContent=signed(input.variation);
   if(result.errors.length){$('case-plan-buttons').innerHTML='';$('case-constraints').textContent='Aucun montant exploitable avec ces paramètres.';$('case-monthly').textContent='—';$('case-chart').innerHTML='';$('case-results').innerHTML='<tr><td colspan="5">Corrigez les paramètres pour calculer les plans.</td></tr>';$('case-readout').textContent='Calcul indisponible.';$('case-verdict').textContent='Aucune proposition chiffrée tant que les paramètres sont invalides.';return;}
   $('case-monthly').textContent=result.monthly.map(integer).join(' / ')+' pièces';
   $('case-plan-buttons').innerHTML=result.plans.map(p=>`<button type="button" class="case-plan" data-case-plan="${p.id}" aria-pressed="${p.id===input.selected}" ${!p.feasible?'disabled':''}><strong>${p.name}</strong><span>${p.feasible?money(p.selectedCost):'Non réalisable'}</span></button>`).join('');
   $('case-plan-buttons').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{input.selected=b.dataset.casePlan;render();$('case-plan-buttons').querySelector(`[data-case-plan="${input.selected}"]`)?.focus({preventScroll:true});}));
   $('case-results').innerHTML=result.plans.map(p=>`<tr><th scope="row">${p.name}</th>${p.costs.map(c=>`<td class="num">${c===null?'—':money(c)}</td>`).join('')}<td>${p.feasible?'<span class="badge ok">Réalisable</span>':`<span class="badge error">Bloqué</span><p class="small muted">${esc(p.reasons.join(' '))}</p>`}</td></tr>`).join('');
   $('case-readout').textContent='Coûts totaux à '+signed(input.variation)+' de cuivre · même volume pour les trois plans.';
   const p=result.selected;
   $('case-verdict').textContent=!p.feasible?'Plan examiné non réalisable. '+p.reasons.join(' '):`${p.name} : ${money(p.selectedCost)} au stress choisi. ${result.delta===null?'La référence 100 % A est non réalisable ; aucun écart comparatif affiché.':result.delta===0?'Même coût que la référence 100 % A.':`${result.delta>0?'Surcoût':'Coût inférieur de'} ${money(Math.abs(result.delta))}${result.delta>0?' par rapport à':' à'} la référence 100 % A.`} Regret maximal de ${money(p.maxRegret)} parmi les trois scénarios et les seuls plans réalisables comparés. Le choix reste à valider.`;
   $('case-constraints').textContent=`Mois le plus chargé : ${integer(result.peak)} pièces. ${result.feasibleCount} plan(s) réalisable(s). ${input.qualifiedB?'B qualifié dans cet exemple.':'B exclu : qualification non confirmée.'}`;
   $('case-copy-status').textContent='';draw();
  }
  function showStep(next,scroll=false){step=Math.max(1,Math.min(6,next));document.querySelectorAll('[data-case-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.caseStep)===step)));document.querySelectorAll('[data-case-panel]').forEach(p=>p.hidden=Number(p.dataset.casePanel)!==step);$('case-step-count').textContent=step+' / 6';$('case-prev').disabled=step===1;$('case-next').disabled=step===6;draw();if(scroll)$('case-panel-'+step).scrollIntoView({block:'start',behavior:'auto'});}
  document.querySelectorAll('[data-case-step]').forEach(b=>b.addEventListener('click',()=>showStep(Number(b.dataset.caseStep),true)));
  $('case-prev').addEventListener('click',()=>showStep(step-1,true));$('case-next').addEventListener('click',()=>showStep(step+1,true));$('case-open-comparison').addEventListener('click',()=>showStep(4,true));
  for(const [id,key] of [['case-volume','pacs'],['case-capacity-b','capacityB']]){const field=$(id);field.addEventListener('input',()=>{input[key]=Number(field.value);render();});field.addEventListener('blur',()=>{touched[key]=true;input[key]=Number(field.value);render();});}$('case-qualified-b').addEventListener('change',event=>{input.qualifiedB=event.target.checked;render();});
  $('case-variation').addEventListener('input',event=>{input.variation=Number(event.target.value);render();});document.querySelectorAll('[data-case-shock]').forEach(b=>b.addEventListener('click',()=>{input.variation=Number(b.dataset.caseShock);$('case-variation').value=input.variation;render();}));
  $('case-reset').addEventListener('click',()=>{input=defaults();touched.pacs=false;touched.capacityB=false;$('case-volume').value=input.pacs;$('case-capacity-b').value=input.capacityB;$('case-qualified-b').checked=input.qualifiedB;$('case-variation').value=input.variation;render();});
  $('case-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('case-note').value);$('case-copy-status').textContent='Note copiée. Aucune commande ni aucun message envoyé.';}catch(_){$('case-note').focus();$('case-note').select();$('case-copy-status').textContent='Texte sélectionné : utilisez Copier sur votre appareil.';}});
  let frame;new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}).observe($('case-chart'));render();showStep(1);return {render:draw};
 }
 return Object.freeze({defaults,SCENARIOS,PLANS,unitPriceA,analyze,decisionNote,mount});
});
