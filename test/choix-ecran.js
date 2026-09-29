'use strict';
/* Mesure REELLE (chromium) du panneau de choix de l'autel sur telephone.
   Charge le vrai shell_head.html, remplit #evoCards avec le balisage de renderEvo (g4.js) et les
   choix que produit le VRAI openAltar (gc.js, harnais vm), puis mesure chaque page dans chromium.
   node test/choix-ecran.js [--w=411] [--h=740]      (outil de verification, pas appele par headless.js :
   il exige chromium) */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const ARG=k=>{const a=process.argv.find(x=>x.startsWith('--'+k+'='));return a?a.split('=')[1]:null;};
const W=+(ARG('w')||411),H=+(ARG('h')||787);   /* 787 de fenetre = 700 px visibles en headless (87 px d'interface) : S22 a 411 px de large ≈ 786 px visibles */
const PG=JSON.parse(cp.execFileSync(process.execPath,[path.join(__dirname,'competences.js'),'--pages'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').pop()),pages=PG.pages;
const head=fs.readFileSync(path.join(ROOT,'shell_head.html'),'utf8').replace(/<script>\s*$/,'');
const card=(ch,i)=>'<button class="card" data-i="'+i+'"><span class="key">'+(i+1)+'</span><span class="ic">'+ch.ic+'</span><span class="cat">'+ch.c+'</span><span class="nm">'+ch.n+'</span><span class="ds">'+ch.d+'</span></button>';
const js=`const PG=${JSON.stringify(PG)},P=PG.pages;const out=[];for(const pg of P){document.getElementById('evoT').textContent='Autel d’Iris';document.getElementById('evoS').textContent=PG.sub[out.length];
document.getElementById('evoCards').innerHTML=pg.map(${card.toString()}).join('');const ov=document.getElementById('ov-evo');ov.classList.add('on');
const inn=ov.querySelector('.in'),r=inn.getBoundingClientRect(),cs=[...document.querySelectorAll('#evoCards .card')].map(c=>{const b=c.getBoundingClientRect(),d=c.querySelector('.ds');return{h:Math.round(b.height),bot:Math.round(b.bottom),r:Math.round(b.right),dsL:Math.round(d.getBoundingClientRect().height/parseFloat(getComputedStyle(d).lineHeight))};});
out.push({n:pg.length,scrollH:ov.scrollHeight,clientH:ov.clientHeight,cards:cs});}
document.body.setAttribute('data-mes',JSON.stringify(out));`;
const html=head+'</script><script>window.addEventListener("load",()=>{'+js+'});</script></body></html>';
const f='/root/shots/choix-ecran.html';fs.writeFileSync(f,html);
const dom=cp.execFileSync('chromium',['--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--window-size='+W+','+H,'--virtual-time-budget=4000','--dump-dom','file://'+f],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
const m=JSON.parse(/data-mes="([^"]*)"/.exec(dom)[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
let ok=true;m.forEach((p,i)=>{const fit=p.scrollH<=p.clientH;ok=ok&&fit;console.log('page '+(i+1)+' : '+p.n+' cartes, hauteur '+p.scrollH+' px pour '+p.clientH+' px visibles '+(fit?'-> TIENT':'-> DEBORDE')+' | cartes '+p.cards.map(c=>c.h+'px/'+c.dsL+'l').join(' '));});
console.log(ok?'OK : chaque page tient sans defiler a '+W+'x'+H:'ECHEC : au moins une page deborde a '+W+'x'+H);process.exit(ok?0:1);
