/* Kassim — veille publique sourcée ; aucune inférence automatique de prix. */
(function(root){'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const TOPICS={copper:{label:'Cuivre',query:'copper (price OR supply OR mining OR smelter) sourcelang:english'},aluminium:{label:'Aluminium',query:'(aluminium OR aluminum) (price OR supply OR smelter) sourcelang:english'},energy:{label:'Énergie industrielle',query:'"industrial energy" (price OR supply OR tariff) sourcelang:english'},heatpump:{label:'Pompes à chaleur',query:'"heat pump" (manufacturing OR supply OR market OR demand) sourcelang:english'}};
 function safeURL(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch(_){return '';}}
 function seenDate(value){const match=String(value??'').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);if(!match)return '';const expected=`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`,date=new Date(expected);return Number.isNaN(date.valueOf())||date.toISOString().replace('.000Z','Z')!==expected?'':date.toISOString();}
 function mount(options){
  let articles=[],selected=null,loading=false;const cache=new Map();
  function render(){
   $('news-fetch').disabled=loading;$('news-fetch').setAttribute('aria-busy',String(loading));$('news-fetch').textContent=loading?'Recherche…':'Actualiser la veille';$('news-topic').disabled=loading;
   $('news-empty').hidden=articles.length>0;
   $('news-list').innerHTML=articles.map((a,index)=>`<article class="news-article"><div class="news-article-meta"><span>${esc(TOPICS[a.topic].label)}</span><span>${esc(a.domain)}</span></div><h2><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h2><p class="small muted">${a.manual?'Source ajoutée manuellement':a.seen?'Repéré par GDELT le '+new Date(a.seen).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'Date de repérage non fournie'} · publication et événement à vérifier dans la source.</p><div class="news-article-actions"><label class="field" for="news-supplier-${index}">Associer à<select id="news-supplier-${index}"><option value="">Marché, sans fournisseur précis</option>${options.getInput().suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><button class="btn" data-news-link="${index}">Conserver le signal</button><button class="btn" data-news-test="${index}">Tester un scénario</button></div><p class="news-link-status" id="news-link-status-${index}" role="status"></p></article>`).join('');
   $('news-list').querySelectorAll('[data-news-link]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.newsLink),supplier=$('news-supplier-'+index).value;options.onSignal({...articles[index],supplier});$('news-link-status-'+index).textContent='Signal conservé dans Documents et historique. Son impact reste à confirmer.';}));
   $('news-list').querySelectorAll('[data-news-test]').forEach(button=>button.addEventListener('click',()=>{
    selected=articles[Number(button.dataset.newsTest)];$('news-stress').hidden=false;$('news-stress-title').textContent=selected.title;$('news-stress-value').value=options.getInput().copper;$('news-stress-metric').value='copper';$('news-stress-value').min=-30;$('news-stress-value').max=30;$('news-stress').scrollIntoView({behavior:'auto',block:'center'});
   }));
  }
  async function load(){
   if(loading)return;const topic=$('news-topic').value,previous=cache.get(topic);
   if(previous&&Date.now()-previous.at<15*60*1000){articles=previous.articles;render();$('news-status').textContent='Résultats de cette session réutilisés (moins de 15 minutes).';return;}
   loading=true;render();$('news-status').textContent='Recherche de titres publics sur les sept derniers jours…';
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
   try{
    const params=new URLSearchParams({query:TOPICS[topic].query,mode:'ArtList',format:'json',maxrecords:'15',timespan:'7d',sort:'HybridRel'});
    const response=await fetch('https://api.gdeltproject.org/api/v2/doc/doc?'+params,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(`Service de veille indisponible (${response.status}).`);
    const text=await response.text();let data;try{data=JSON.parse(text);}catch(_){throw new Error('Le service de veille n’a pas retourné une liste exploitable.');}
    if(!Array.isArray(data.articles))throw new Error('Réponse de veille incomplète. Aucun résultat inventé.');
    const urls=new Set();articles=data.articles.flatMap(item=>{const url=safeURL(item.url);if(!url||urls.has(url))return [];urls.add(url);const words=String(item.title??'').trim().split(/\s+/);return [{title:words.slice(0,18).join(' ')+(words.length>18?'…':''),url,domain:new URL(url).hostname,seen:seenDate(item.seendate),retrievedAt:new Date().toISOString(),topic}];});
    cache.set(topic,{at:Date.now(),articles});$('news-status').textContent=`${articles.length} titre(s) repéré(s). La présence d’un article ne prouve ni son exactitude ni un effet sur vos contrats.`;
   }catch(error){articles=[];$('news-status').textContent=error.name==='AbortError'?'Le service de veille n’a pas répondu dans les 20 secondes. Vous pouvez réessayer plus tard.':error instanceof TypeError?'Connexion au service de veille impossible. Réessayez plus tard ou ajoutez une source publique ci-dessous.':error.message;}
   finally{clearTimeout(timeout);loading=false;render();}
  }
  $('news-fetch').addEventListener('click',load);
  $('news-manual-add').addEventListener('click',()=>{
   const url=safeURL($('news-manual-url').value.trim()),title=$('news-manual-title').value.trim();
   if(!url||title.length<5){$('news-manual-status').textContent='Indiquez un lien HTTP(S) public valide et un titre d’au moins cinq caractères.';return;}
   const words=title.split(/\s+/);articles=[{title:words.slice(0,18).join(' ')+(words.length>18?'…':''),url,domain:new URL(url).hostname,seen:'',retrievedAt:new Date().toISOString(),topic:$('news-topic').value,manual:true},...articles.filter(a=>a.url!==url)];
   render();$('news-manual-status').textContent='Source ajoutée dans cette session. Son contenu et son impact restent à vérifier ; aucun lien n’a été consulté automatiquement.';
  });
  $('news-stress-metric').addEventListener('change',()=>{const key=$('news-stress-metric').value;$('news-stress-value').min=key==='fx'?-15:-30;$('news-stress-value').max=key==='fx'?15:30;$('news-stress-value').value=options.getInput()[key];});
  $('news-stress-apply').addEventListener('click',()=>{
   const field=$('news-stress-value'),value=Number(field.value),key=$('news-stress-metric').value;
   if(!field.value.trim()||!field.checkValidity()||!Number.isFinite(value)){$('news-stress-status').textContent='Indiquez une variation valide dans la plage affichée.';field.setAttribute('aria-invalid','true');return;}
   field.setAttribute('aria-invalid','false');options.onStress(key,value,selected);$('news-stress-status').textContent='Hypothèse appliquée à votre demande. Aucune variation n’a été déduite automatiquement de l’article.';location.hash='scenarios';
  });
  render();return {render};
 }
 const api={mount,safeURL,seenDate};if(typeof module==='object'&&module.exports)module.exports=api;else root.KassimNews=api;
})(typeof globalThis!=='undefined'?globalThis:this);
