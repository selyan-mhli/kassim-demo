/* Kassim — lecture locale, propositions de champs et historique validé. Aucun appel IA. */
(function (root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.KassimDocuments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
 'use strict';
 const LIMITS = Object.freeze({ files:30, bytesPerFile:12*1024*1024, totalBytes:100*1024*1024, text:750000, pages:60, rows:500, zipXML:8*1024*1024 });
 const normalize = value => String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function dateISO(value) {
  const text=String(value??'').trim(); let match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match){const fr=text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(fr)match=[text,fr[3],fr[2].padStart(2,'0'),fr[1].padStart(2,'0')];}
  if(!match)return '';
  const result=`${match[1]}-${match[2]}-${match[3]}`, date=new Date(result+'T00:00:00Z');
  return Number(match[1])>=1900&&Number(match[1])<=2100&&!Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===result?result:'';
 }
 function amount(value) {
  let text=String(value??'').replace(/[\s\u00a0\u202f€$]/g,'').replace(/EUR|USD/gi,'');
  if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(text))return null;
  const number=Number(text);return Number.isFinite(number)&&number>=0&&number<1e9?number:null;
 }
 function parseDelimited(text) {
  const first=text.split(/\r?\n/)[0]??'', separator=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
   else if(c===separator&&!quoted){row.push(value);value='';}
   else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';}
   else value+=c;
  }
  if(quoted)throw new Error('CSV : guillemet non fermé.');
  row.push(value);if(row.some(v=>v.trim()))rows.push(row);return rows;
 }
 function supplierID(value,suppliers) {
  const text=normalize(value);if(!text)return '';
  return suppliers.find(s=>text===normalize(s.id)||text===normalize(s.name)||text.includes('fournisseur'+s.id.toLowerCase()))?.id??'';
 }
 function fromRows(rows,suppliers,source='Tableau',excel1904=false) {
  const aliases={date:['date','dateeffet','dateapplicable','datefacture'],reference:['reference','ref','sku','article','piece','item'],price:['prix','prixunitaire','unitprice','price'],currency:['devise','currency'],unit:['unite','unit'],supplier:['fournisseur','supplier','entreprise']};
  const headerIndex=rows.slice(0,20).findIndex(row=>row.some(v=>aliases.price.includes(normalize(v)))&&row.some(v=>aliases.date.includes(normalize(v))));
  if(headerIndex<0)return [];
  const header=rows[headerIndex].map(normalize), column={};Object.entries(aliases).forEach(([key,list])=>column[key]=header.findIndex(v=>list.includes(v)));
  return rows.slice(headerIndex+1,headerIndex+1+LIMITS.rows).filter(row=>row.some(v=>String(v).trim())).map((row,i)=>{
   const cell=key=>column[key]<0?'':String(row[column[key]]??'').trim();let rawDate=cell('date');
   if(/^\d{5}(?:\.\d+)?$/.test(rawDate)){const milliseconds=(Number(rawDate)-(excel1904?24107:25569))*86400000;rawDate=new Date(milliseconds).toISOString().slice(0,10);}
   const currency=/USD|\$/i.test(cell('currency'))?'USD':/EUR|€/i.test(cell('currency'))?'EUR':'';
   const rawUnit=normalize(cell('unit')),unit=['kg','kilogramme'].includes(rawUnit)?'kg':['t','tonne'].includes(rawUnit)?'t':['piece','pc','pcs','unite'].includes(rawUnit)?'piece':'';
   return {supplier:supplierID(cell('supplier'),suppliers),date:dateISO(rawDate),reference:cell('reference').slice(0,100),price:amount(cell('price')),currency,unit,validated:false,source:`${source} · ligne ${headerIndex+i+2}`,excerpt:rows[headerIndex].map((h,j)=>`${h}: ${row[j]??''}`).join(' | ').slice(0,600)};
  });
 }
 function propose(text,suppliers,source='Texte') {
  const dates=[...text.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})\b/g)].map(m=>dateISO(m[0])).filter(Boolean);
  const lines=text.split(/\r?\n/), priceLine=lines.find(line=>/(?:prix|unit price|price).{0,35}\d/i.test(line))??'';
  const found=priceLine.match(/(?:prix(?:\s+unitaire)?|unit price|price)\s*[:=]?\s*([\d\s.,]+)\s*(EUR|USD|€|\$)/i);
  const ref=text.match(/(?:r[ée]f(?:[ée]rence)?|sku|article)\s*[:=]\s*([^\n|;]{1,100})/i);
  const supplier= suppliers.find(s=>text.toLowerCase().includes(s.name.toLowerCase()))?.id??text.match(/fournisseur\s*[:=]?\s*([ABC])\b/i)?.[1]??'';
  const unit=/\/(?:pi[eè]ce|pc|unit[eé])/i.test(priceLine)?'piece':/\/(?:kg|kilogramme)/i.test(priceLine)?'kg':/\/(?:t|tonne)\b/i.test(priceLine)?'t':'';
  return [{supplier,date:dates[0]??'',reference:ref?.[1]?.trim()??'',price:found?amount(found[1]):null,currency:found?(/USD|\$/.test(found[2])?'USD':'EUR'):'',unit,validated:false,source,excerpt:(priceLine||text.slice(0,600)).slice(0,600)}];
 }
 function validateRecord(record) {
  const issues=[];
  if(!['A','B','C'].includes(record.supplier))issues.push('Choisir un fournisseur.');
  if(!dateISO(record.date))issues.push('Confirmer une date valide.');
  if(record.price!==null){
   if(!Number.isFinite(record.price)||record.price<0||record.price>=1e9)issues.push('Prix invalide.');
   if(!String(record.reference??'').trim())issues.push('Référence requise pour un prix.');
   if(!['EUR','USD'].includes(record.currency))issues.push('Confirmer EUR ou USD.');
   if(!['piece','kg','t'].includes(record.unit))issues.push('Confirmer l’unité du prix.');
  }
  return issues;
 }
 function history(documents) {
  return documents.flatMap(doc=>(doc.records??[]).filter(r=>r.validated&&!validateRecord(r).length).map(record=>({...record,document:doc.name,documentID:doc.id}))).sort((a,b)=>a.date.localeCompare(b.date));
 }
 function decodeMIME(text) {
  function decode(value,encoding,charset='utf-8'){
   let bytes;
   if(/base64/i.test(encoding)){const raw=atob(value.replace(/\s/g,''));bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));}
   else if(/quoted-printable/i.test(encoding)){const raw=value.replace(/=\r?\n/g,'').replace(/=([a-f0-9]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));}
   else return value;
   try{return new TextDecoder(charset).decode(bytes);}catch(_){return new TextDecoder().decode(bytes);}
  }
  function walk(part,depth=0){
   if(depth>8)throw new Error('Email : imbrication MIME trop profonde.');
   const split=part.search(/\r?\n\r?\n/);if(split<0)return part;
   const headers=part.slice(0,split).replace(/\r?\n[ \t]+/g,' '),body=part.slice(split).replace(/^\s*\r?\n/,'');
   if(/content-disposition:\s*attachment/i.test(headers))return '';
   const boundary=headers.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
   if(boundary){return body.split('--'+(boundary[1]||boundary[2])).slice(1).filter(p=>!p.startsWith('--')).map(p=>walk(p.trimStart(),depth+1)).join('\n');}
   if(!/content-type:\s*text\/(?:plain|html)/i.test(headers)&&/content-type:/i.test(headers))return '';
   const encoding=headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1]??'';
   const charset=headers.match(/charset\s*=\s*"?([^";\s]+)/i)?.[1]??'utf-8';
   const decoded=decode(body,encoding,charset);
   return /text\/html/i.test(headers)?decoded.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&'):decoded;
  }
  return walk(text).slice(0,LIMITS.text);
 }
 function xml(text) {
  if(text.length>LIMITS.zipXML||/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('XML trop volumineux ou déclaration externe non autorisée.');
  const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('Structure XML illisible.');return doc;
 }
 const elements=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
 async function read(file,suppliers) {
  if(file.size>LIMITS.bytesPerFile)throw new Error('Fichier supérieur à 12 Mo.');
  const extension=file.name.split('.').pop().toLowerCase(),buffer=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
  let text='',records=[],notes=[],pieces=[];
  if(extension==='pdf'){
   if(location.protocol==='file:'||document.documentElement.dataset.preview==='standalone')throw new Error('Lecture PDF : ouvrez la version hébergée ou servez le dossier complet en HTTP local.');
   const pdfjs=await import('./assets/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/vendor/pdf.worker.mjs',document.baseURI).href;
   const task=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,stopAtErrors:true});
   const pdf=await task.promise;
   try{for(let i=1;i<=Math.min(pdf.numPages,LIMITS.pages);i++){
    const page=await pdf.getPage(i),content=await page.getTextContent();let value='';for(const item of content.items){if('str'in item)value+=item.str+(item.hasEOL?'\n':' ');}
    pieces.push({source:`Page ${i}`,text:value});if(pieces.reduce((n,p)=>n+p.text.length,0)>LIMITS.text){notes.push('Texte limité à 750 000 caractères.');break;}
   }if(pdf.numPages>LIMITS.pages)notes.push('Lecture limitée aux 60 premières pages.');}finally{await pdf.destroy();}
   text=pieces.map(p=>p.text).join('\n');
   if(text.trim().length<15)throw new Error('PDF sans texte exploitable : OCR nécessaire pour un scan.');
   const pricePiece=pieces.find(p=>/(?:prix|price).{0,40}\d/i.test(p.text))??pieces[0];records=propose(text,suppliers,`PDF · prix : ${pricePiece.source} ; dates et référence à confirmer`);records[0].excerpt=pricePiece.text.slice(0,600);
  }else if(extension==='docx'||extension==='xlsx'){
   if(!window.JSZip)throw new Error('Le lecteur Office ne s’est pas chargé. Rechargez la page.');
   const zip=await window.JSZip.loadAsync(buffer);const entries=Object.values(zip.files);if(entries.length>1500)throw new Error('Archive Office trop complexe.');
   const readXML=async name=>{const entry=zip.file(name);if(!entry)return null;if(entry._data?.uncompressedSize>LIMITS.zipXML)throw new Error('Partie Office décompressée supérieure à 8 Mo.');return xml(await entry.async('string'));};
   if(extension==='docx'){
    const doc=await readXML('word/document.xml');if(!doc)throw new Error('Ce fichier ne contient pas de document Word lisible.');
    text=elements(doc,'p').map(p=>elements(p,'t').map(t=>t.textContent).join('')).join('\n');records=propose(text,suppliers,'Word · paragraphes');
   }else{
    const shared=await readXML('xl/sharedStrings.xml'),strings=shared?elements(shared,'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')):[];
    const workbook=await readXML('xl/workbook.xml'),date1904=elements(workbook??document,'workbookPr')[0]?.getAttribute('date1904')==='1';
    const sheets=Object.keys(zip.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();if(sheets.length>20)notes.push('Lecture limitée aux 20 premières feuilles.');
    for(const [index,name] of sheets.slice(0,20).entries()){
     const sheet=await readXML(name);const allRows=elements(sheet,'row');if(allRows.length>LIMITS.rows+20)notes.push(`Feuille ${index+1} : lecture limitée à ${LIMITS.rows+20} lignes.`);
     const rows=allRows.slice(0,LIMITS.rows+20).map(row=>{const values=[];elements(row,'c').forEach(cell=>{const col=(cell.getAttribute('r')??'A').replace(/\d/g,'');let n=0;for(const letter of col)n=n*26+letter.charCodeAt(0)-64;if(n>200)return;const type=cell.getAttribute('t'),value=elements(cell,'v')[0]?.textContent??'';values[n-1]=type==='s'?strings[Number(value)]??'':type==='inlineStr'?elements(cell,'t').map(t=>t.textContent).join(''):value;});return Array.from({length:values.length},(_,i)=>values[i]??'');});
     records.push(...fromRows(rows,suppliers,`Excel · feuille ${index+1}`,date1904));text+=`\nFeuille ${index+1}\n`+rows.map(row=>row.join(' | ')).join('\n');if(text.length>LIMITS.text){notes.push('Lecture des feuilles arrêtée après 750 000 caractères.');break;}
    }
    notes.push('Formules non exécutées : valeurs enregistrées dans le classeur uniquement.');
   }
  }else if(['txt','csv','json','eml','md'].includes(extension)){
   if(buffer.byteLength>LIMITS.text*4)throw new Error('Fichier texte trop volumineux pour cette lecture locale.');
   text=new TextDecoder().decode(buffer);
   if(extension==='eml'){text=decodeMIME(text);notes.push('Corps du message lu ; pièces jointes à déposer séparément.');}
   if(extension==='csv')records=fromRows(parseDelimited(text),suppliers,'CSV');
   if(extension==='json'){
    const data=JSON.parse(text),rows=Array.isArray(data)?data:Array.isArray(data?.records)?data.records:[];
    if(rows.length&&rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r))){const keys=[...new Set(rows.flatMap(Object.keys))];records=fromRows([keys,...rows.map(r=>keys.map(k=>r[k]??''))],suppliers,'JSON');}
   }
  }else throw new Error('Format non pris en charge. Utilisez PDF texte, XLSX, DOCX, CSV, JSON, TXT ou EML ; exportez DOC/XLS/MSG dans ces formats.');
  if(text.length>LIMITS.text){text=text.slice(0,LIMITS.text);notes.push('Texte limité à 750 000 caractères.');}
  if(!text.trim())throw new Error('Aucun texte exploitable extrait.');
  if(!records.length)records=propose(text,suppliers);
  if(records.length>LIMITS.rows){records=records.slice(0,LIMITS.rows);notes.push('Propositions limitées à 500 lignes.');}
  return {hash,text,records,notes,extension};
 }
 return Object.freeze({LIMITS,normalize,dateISO,amount,parseDelimited,fromRows,propose,validateRecord,history,decodeMIME,read});
});
