/* =========================================================
   gv.js : LE RÊVE À CONTEMPLER
   décors lointains vivants par biome (couche basse résolution, peu coûteuse),
   belvédères où l'on s'arrête pour regarder, caméra qui respire
   ========================================================= */
const VIEWL={
  plains:['Le vent couche l’herbe lumineuse en vagues lentes. Rien ne presse, ici.','Au loin, la lumière tombe en rais lents sur l’herbe qui ondule.'],
  floral:['Les pétales tombent sans jamais toucher le sol. Le jardin retient son souffle.','Une odeur de pluie ancienne flotte entre les corolles géantes.'],
  sea:['Des rais de lumière descendent vers un fond que personne n’a jamais touché.','La lumière froide danse sur le sable. Le récif se souvient de chaque nageur.'],
  sky:['Une baleine de nuages passe, lentement, comme une pensée qui s’en va.','Sous tes pieds, l’archipel dérive sur un océan de ciel.'],
  cyber:['Des paquets de données filent le long des lignes, gardiens d’un calcul sans fin.','La grille bourdonne doucement, comme une ville qui rêve de nombres.'],
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
/* Allégé le 01/10/2026 (fluidité d'abord, demande du propriétaire) : lucioles, anneaux de pétales, méduses, poissons du ciel,
   anneaux de données, dirigeables et braises retirés (même famille que les méduses, et 2 à 9 ms par image au canevas logiciel).
   Restent les rais de lumière, les projecteurs et le phare (faisceau étroit seul), une aurore par ruban, les lueurs du Cœur
   posées à l'échelle 1. */
const VISTA={
  plains:w=>{rays(.05*w,'#fff6c8');},
  floral:w=>{rays(.04*w,'#ffd6f4');},
  sea:w=>{rays(.06*w,'#9fe8ff');},
  urban:w=>{const c=ctx,beam=(bx,by,a,L,al)=>{const s=.02;c.globalAlpha=al;c.beginPath();c.moveTo(bx,by);c.lineTo(bx+Math.cos(a-s)*L,by+Math.sin(a-s)*L);c.lineTo(bx+Math.cos(a+s)*L,by+Math.sin(a+s)*L);c.closePath();c.fill();};
    c.fillStyle='#fff3c4';for(let i=0;i<2;i++)beam(W*(.25+.5*i),H+10,-Math.PI/2+Math.sin(RT*.004+i*2)*.5,H*1.4,.06*w);
    /* le phare : la tour du monument de la ville le plus proche, même hors écran, balaie le ciel de deux faisceaux */
    let M=null,md=3200*3200;for(const L of WD.lms)if(L.t==='urban'){const d=dist2(L.x,L.y,CAM.x,CAM.y);if(d<md){md=d;M=L;}}
    if(M){const d=twOff(M.x,M.y,PHH,TWM*2),sx=(M.x+d[0]-CAM.x)*RZ+W/2,sy=(M.y+d[1]-CAM.y)*RZ+H/2,L=Math.min(Math.hypot(sx-W/2,sy-H/2)+Math.max(W,H),3*Math.max(W,H));
      c.fillStyle='#fff6dc';for(let j=0;j<2;j++)beam(sx,sy,RT*.01+j*Math.PI,L,.12*w);glowPx(PS*sx,PS*sy,PS*92,'#fff3c4',.6*w);screenTf();}
    c.globalAlpha=1;},
  ice:w=>{const c=ctx;c.globalCompositeOperation='lighter';c.lineWidth=26;for(let k=0;k<3;k++){c.strokeStyle=['#6dffb4','#6fd8ff','#b58cff'][k];c.globalAlpha=.08*w;c.beginPath();
    for(let j=0;j<=12;j++){const x=j/12*W*1.2-W*.1-CAM.x*.03%200,y=H*(.12+k*.09)+Math.sin(j*.7+RT*.01+k*2)*H*.05+Math.sin(j*1.9+RT*.017)*H*.02;j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
    c.globalAlpha=1;rays(.03*w,'#e8f6ff');},
  core:w=>{vcells(.3,650,(x,y,r1,r2)=>{if(r1>.6)return;const p=.5+.5*Math.sin(RT*.03+r2*10);glowPx(PS*x,PS*y,PS*400,'#ff3355',.12*w*(.4+.6*p));});screenTf();}};
function drawVista(mix){ctx.globalCompositeOperation='lighter';for(const m of mix){const f=VISTA[m.b];if(f&&m.w>.15)f(m.w);}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;}
