/* =========================================================
   gv.js : LE RÊVE À CONTEMPLER
   décors lointains vivants par biome (couche basse résolution, peu coûteuse),
   belvédères où l'on s'arrête pour regarder, caméra qui respire
   ========================================================= */
const VIEWL={
  plains:['Le vent couche l’herbe lumineuse en vagues lentes. Rien ne presse, ici.','Au loin, des lucioles tracent des chemins que personne n’a jamais pris.'],
  floral:['Les pétales tombent sans jamais toucher le sol. Le jardin retient son souffle.','Une odeur de pluie ancienne flotte entre les corolles géantes.'],
  sea:['Des méduses montent vers une surface qui n’existe pas. Elles montent quand même.','La lumière froide danse sur le sable. Le récif se souvient de chaque nageur.'],
  sky:['Une baleine de nuages passe, lentement, comme une pensée qui s’en va.','Sous tes pieds, l’archipel dérive sur un océan de ciel.'],
  cyber:['Des anneaux de données tournent dans le vide, gardiens d’un calcul sans fin.','La grille bourdonne doucement, comme une ville qui rêve de nombres.'],
  urban:['Les projecteurs cherchent quelque chose dans le ciel. Ils cherchent depuis des siècles.','La pluie de néon lave les rues d’une fête qui ne finit jamais.'],
  ice:['L’aurore ondule au-dessus du glacier, verte, puis violette, puis verte encore.','Le silence ici est si parfait qu’on entend le givre pousser.'],
  core:['Le Noyau respire. Chaque battement fait trembler la lumière rouge.','Même ici, au cœur de la faim, des braises dansent comme des étoiles.']};

/* ---------- belvédères : générés avec le monde ---------- */
function gvWorld(){
  WD.views=[];const S=WD.sites,bySeg={};for(const s of WD.segs)(bySeg[s.e]=bySeg[s.e]||[]).push(s);
  const others=[...WD.alts,...WD.rifts,...WD.lms,...WD.hearts,...(WD.scn||[]),...(WD.hunt||[])],used={};
  WD.edges.forEach(([a,b],ei)=>{const L=bySeg[ei];if(!L||L.length<8||WD.views.length>=12)return;
    for(const [si,k] of [[a,3],[b,L.length-4]]){if(used[si]||S[si].t==='core')continue;const s=L[k];if(!s)continue;let ok=Math.hypot(s.bx,s.by)>700;
      for(const o of others)if(dist2(o.x,o.y,s.bx,s.by)<380*380){ok=false;break;}for(const v of WD.views)if(dist2(v.x,v.y,s.bx,s.by)<1500*1500)ok=false;
      if(ok){used[si]=1;WD.views.push({x:s.bx,y:s.by,b:S[si].t});break;}}});
}
function gvRunStart(){G.gv={k:0,still:0,i:-1,seen:{},calm:1};}
function gvTick(){
  const V=G.gv;if(!V)return;const P=G.p,sp=Math.hypot(P.vx,P.vy),moving=G.inX||G.inY||sp>.9;
  /* caméra qui respire : recule doucement quand tout est calme */
  let fight=false;for(const e of G.en)if(!e.dead&&e.aggro&&dist2(e.x,e.y,P.x,P.y)<700*700){fight=true;break;}
  V.calm=lerp(V.calm,fight||G.arena||G.gx&&G.gx.scene?1:.9,.01);
  let near=-1;for(let i=0;i<WD.views.length;i++){const v=WD.views[i];if(dist2(v.x,v.y,P.x,P.y)<110*110){near=i;break;}}
  if(near>=0&&!moving&&!fight){V.still++;if(V.still>70){V.i=near;V.k=Math.min(1,V.k+.012);}}else{V.still=0;V.k=Math.max(0,V.k-(moving||fight?.06:.02));}
  if(V.k>=1&&!V.seen[V.i]){V.seen[V.i]=1;const v=WD.views[V.i],L=VIEWL[v.b]||VIEWL.plains;meta.views=(meta.views||0)+1;
    gsSay(L[(meta.views+V.i)%L.length],'Belvédère · '+(BIO[v.b]?BIO[v.b].n:''),BIO[v.b]?BIO[v.b].a:COL.cy,1);gsShard(6);P.bub+=3;checkLevel();saveMeta();SFX.evo();}
}
function gvZoom(){const V=G&&G.gv;return V?V.calm*(1-.3*V.k):1;}
function gvCalm(){return G&&G.gv&&G.gv.k>.05;}
function gvHideHUD(){return G&&G.gv&&G.gv.k>.35;}
function gvDrawWorld(){
  const c=ctx,V=G.gv;if(!V)return;
  for(let i=0;i<WD.views.length;i++){const v=WD.views[i];if(!vis(v.x,v.y,140))continue;const B=BIO[v.b]||BIO.plains,p=.5+.5*Math.sin(RT*.04+i),seen=V.seen[i];
    c.globalAlpha=.5;c.fillStyle='rgba(6,3,14,.7)';c.beginPath();c.ellipse(v.x,v.y+6,54,22,0,0,TAU);c.fill();
    c.globalAlpha=seen?.35:.6+.3*p;c.strokeStyle=B.a;c.lineWidth=2;c.beginPath();c.ellipse(v.x,v.y,50,20,0,0,TAU);c.stroke();
    c.beginPath();c.ellipse(v.x,v.y,110,44,0,0,TAU);c.setLineDash([3,9]);c.stroke();c.setLineDash([]);
    if(V.i===i&&V.k>0){c.globalAlpha=1;c.lineWidth=4;c.beginPath();c.ellipse(v.x,v.y,50,20,0,-Math.PI/2,-Math.PI/2+TAU*V.k);c.stroke();}
    if(dist2(v.x,v.y,G.p.x,G.p.y)<320*320&&!(V.k>.3)){c.globalAlpha=.8;c.font='600 12px '+FD;c.textAlign='center';c.fillStyle=B.a;c.fillText(seen?'BELVÉDÈRE ✓':'BELVÉDÈRE',v.x,v.y-38);}
    c.globalAlpha=1;}
}
/* bandes cinéma pendant la contemplation */
function gvDrawScreen(){const V=G&&G.gv;if(!V||V.k<=0)return;const c=ctx,h=H*.09*V.k;c.fillStyle='#000';c.globalAlpha=.85;c.fillRect(0,0,W,h);c.fillRect(0,H-h,W,h);c.globalAlpha=1;}

/* ---------- décors lointains vivants (dessinés dans la couche basse résolution) ---------- */
function vhash(a,b){let h=(a*374761393+b*668265263)^WD.seed;h=(h^(h>>>13))*1274126177;return((h^(h>>>16))>>>0)/4294967296;}
function vcells(f,S,fn){const ox=CAM.x*f,oy=CAM.y*f,x0=Math.floor((ox-W/2-S)/S),x1=Math.floor((ox+W/2+S)/S),y0=Math.floor((oy-H/2-S)/S),y1=Math.floor((oy+H/2+S)/S);
  for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++)fn(cx*S-ox+W/2,cy*S-oy+H/2,vhash(cx,cy),vhash(cy+7,cx-3),cx,cy);}
function rays(a,col){const c=ctx;c.fillStyle=col;for(let i=0;i<5;i++){const x=((i*W/4.2+RT*.25+i*97)%(W*1.4))-W*.2,w=50+30*Math.sin(i*2.1+RT*.004),sw=Math.sin(RT*.003+i)*40;
  c.globalAlpha=a*(.5+.5*Math.sin(RT*.006+i*1.7));c.beginPath();c.moveTo(x,-10);c.lineTo(x+w,-10);c.lineTo(x+w+H*.55+sw,H+10);c.lineTo(x+H*.55+sw,H+10);c.closePath();c.fill();}c.globalAlpha=1;}
const VISTA={
  plains:w=>{rays(.05*w,'#fff6c8');vcells(.35,520,(x,y,r1,r2)=>{if(r1>.55)return;for(let k=0;k<8;k++){const a=RT*.01+k*.8+r2*9,px=x+Math.cos(a*1.3)*60*r1+Math.sin(RT*.02+k)*30,py=y+Math.sin(a)*40;glow(px,py,14,'#d9ff9a',.5*w*(.5+.5*Math.sin(RT*.08+k*2)));}});},
  floral:w=>{rays(.04*w,'#ffd6f4');vcells(.3,600,(x,y,r1,r2)=>{if(r1>.6)return;for(let k=0;k<10;k++){const t=RT*.006+k/10*TAU,rr2=40+k*9;glow(x+Math.cos(t+r2*6)*rr2,y+Math.sin(t+r2*6)*rr2*.6+Math.sin(RT*.01+k)*8,12,k%2?'#ff9be6':'#fff0a8',.45*w);}});},
  sea:w=>{rays(.06*w,'#9fe8ff');const c=ctx;vcells(.25,520,(x,y,r1,r2)=>{if(r1>.7)return;const yy=y-((RT*.25+r2*700)%900)+450,px=x+Math.sin(RT*.01+r2*9)*40,s=26+r1*40,pu=1+.12*Math.sin(RT*.05+r2*20);
    glow(px,yy,s*2.4,'#7fd8ff',.35*w);c.globalAlpha=.5*w;c.fillStyle='#c9f4ff';c.beginPath();c.ellipse(px,yy,s*pu,s*.7/pu,0,Math.PI,TAU);c.fill();
    c.strokeStyle='#9fe8ff';c.lineWidth=3;for(let k=-2;k<=2;k++){c.beginPath();c.moveTo(px+k*s*.3,yy);for(let j=1;j<=5;j++)c.lineTo(px+k*s*.3+Math.sin(RT*.05+j+k)*6,yy+j*s*.35);c.stroke();}c.globalAlpha=1;});},
  sky:w=>{const c=ctx;vcells(.18,850,(x,y,r1,r2)=>{if(r1>.75)return;const dir=r2>.5?1:-1,px=x+(((RT*.35*dir+r2*2000)%1600)+1600)%1600-800,py=y+Math.sin(RT*.004+r2*7)*30,L=220+r1*160;
    c.save();c.translate(px,py);c.scale(dir,1);c.globalAlpha=.3*w;c.fillStyle='#b8d6ff';c.beginPath();c.ellipse(0,0,L*.5,L*.14,0,0,TAU);c.fill();
    c.beginPath();c.moveTo(-L*.45,0);c.lineTo(-L*.7,-L*.12+Math.sin(RT*.03)*10);c.lineTo(-L*.62,0);c.lineTo(-L*.7,L*.1+Math.sin(RT*.03)*10);c.closePath();c.fill();
    c.beginPath();c.moveTo(0,L*.1);c.lineTo(-L*.12,L*.28+Math.sin(RT*.02)*8);c.lineTo(L*.08,L*.12);c.closePath();c.fill();
    c.strokeStyle='#e6f2ff';c.lineWidth=4;c.globalAlpha=.35*w;c.beginPath();c.ellipse(0,0,L*.5,L*.14,0,Math.PI*1.05,TAU*.98);c.stroke();c.globalAlpha=.6*w;for(let k=0;k<7;k++)glow(-L*.3+k*L*.1,L*.04,7,'#dff0ff',.9);c.restore();c.globalAlpha=1;});},
  cyber:w=>{const c=ctx;vcells(.22,700,(x,y,r1,r2)=>{if(r1>.65)return;c.save();c.translate(x,y);c.globalAlpha=.3*w;c.strokeStyle=r2>.5?'#2de2ff':'#ff2d95';c.lineWidth=3;
    for(let k=0;k<3;k++){c.save();c.rotate(RT*.004*(k+1)*(r2>.5?1:-1));c.scale(1,.35+k*.2);c.beginPath();c.arc(0,0,60+k*34+r1*40,0,TAU);c.stroke();c.restore();}c.restore();c.globalAlpha=1;});},
  urban:w=>{const c=ctx;c.fillStyle='#fff3c4';for(let i=0;i<3;i++){const bx=W*(.2+.3*i),a=-Math.PI/2+Math.sin(RT*.004+i*2)*.5;c.globalAlpha=.07*w;c.beginPath();c.moveTo(bx,H+10);c.lineTo(bx+Math.cos(a-.08)*H*1.4,H+Math.sin(a-.08)*H*1.4);c.lineTo(bx+Math.cos(a+.08)*H*1.4,H+Math.sin(a+.08)*H*1.4);c.closePath();c.fill();}c.globalAlpha=1;
    vcells(.15,1300,(x,y,r1,r2)=>{if(r1>.3)return;const px=x+((RT*.2+r2*1500)%1500)-750;c.globalAlpha=.14*w;c.fillStyle='#c7a0ff';c.beginPath();c.ellipse(px,y,120,34,0,0,TAU);c.fill();glow(px+60,y+20,10,'#ff2d95',.9);glow(px-60,y+20,10,'#2de2ff',.9);c.globalAlpha=1;});},
  ice:w=>{const c=ctx;c.globalCompositeOperation='lighter';for(let k=0;k<3;k++){const col=['#6dffb4','#6fd8ff','#b58cff'][k];
    for(const [lw,al] of [[70,.05],[34,.07],[10,.1]]){c.strokeStyle=col;c.globalAlpha=al*w;c.lineWidth=lw;c.beginPath();for(let j=0;j<=12;j++){const x=j/12*W*1.2-W*.1-CAM.x*.03%200,y=H*(.12+k*.09)+Math.sin(j*.7+RT*.01+k*2)*H*.05+Math.sin(j*1.9+RT*.017)*H*.02;j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
    c.globalAlpha=1;rays(.03*w,'#e8f6ff');},
  core:w=>{vcells(.3,650,(x,y,r1,r2)=>{if(r1>.6)return;const p=.5+.5*Math.sin(RT*.03+r2*10);glow(x,y,160+80*p,'#ff3355',.12*w*p);for(let k=0;k<6;k++){const yy=y-((RT*.6+k*60+r2*300)%360);glow(x+Math.sin(RT*.02+k)*30,yy,8,'#ff8a2d',.6*w);}});}};
function drawVista(mix){ctx.globalCompositeOperation='lighter';for(const m of mix){const f=VISTA[m.b];if(f&&m.w>.15)f(m.w);}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
