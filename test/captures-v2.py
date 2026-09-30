#!/usr/bin/env python3
"""Captures du chantier V2 (le décor qui mord, VU) en VRAI Chromium, aux métriques du téléphone :
411 px CSS de largeur de dessin, tactile, DPR 2.625 -> PS 1.50 en qualité haute.

La boucle rAF est coupée après le démarrage ; le jeu est ensuite avancé tick par tick (step(), mode window.__SIM
avec window.__SIM_INPUT qui épingle joueur et ennemi) puis rendu (render(0,..)) à l'instant exact voulu.
Le biome n'est jamais forcé : on attend que G.biome bascule (hystérésis). Les lieux sont trouvés par le code du jeu.

Usage : /opt/scrapling-venv/bin/python3 test/captures-v2.py [bulge.html] [dossier]
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'bulge.html').resolve()
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '/root/shots/v2'); OUT.mkdir(parents=True, exist_ok=True)

BOOT = """()=>{meta.chaps=meta.chaps||{};for(var k in CHAPS)meta.chaps[k]=1;meta.pend=[];meta.tuto=99;meta.mute=true;meta.q='high';meta.runs=40;
  applyQuality();startGame('bal',false);show(null);if(G&&G.gt&&G.gt.on&&typeof tutDone==='function')tutDone();return [QL,PS,W,H,COARSE];}"""
FREEZE = """()=>{window.requestAnimationFrame=function(){return 0;};}"""
TOOLS = r"""()=>{window.__SIM=true;window.__T={pin:null};
  window.__SIM_INPUT=function(){G.inX=G.inY=0;G.spawnT=1e9;G.eb=[];G.pb=[];G.p.fireT=1e9;G.p.inv=1e9;G.banner=null;G.help=0;if(G.gt)G.gt.on=false;if(G.gs&&G.gs.subs)G.gs.subs.length=0;if(__T.pin)__T.pin();};
  window.__tp=function(x,y){const P=G.p;P.x=P.px=x;P.y=P.py=y;P.vx=P.vy=0;for(const e of G.en)e.dead=true;G.en=[];G.arena=null;G.cx=G.pcx=x;G.cy=G.pcy=y;};
  window.__steps=function(n,stop){for(let i=0;i<n;i++){step();if(stop&&stop())return i+1;}return n;};
  window.__settle=function(b){for(let i=0;i<400&&G.biome!==b;i++)step();return G.biome===b;};
  window.__calm=function(x,y){return x*x+y*y<(WR-900)**2&&G.hearts.every(h=>dist2(h.x,h.y,x,y)>1100*1100)&&dist2(WD.core.x,WD.core.y,x,y)>1300*1300;};
  window.__foe=function(t,x,y){const e=mkEnemy(t,x,y,{noElite:true,spawn:0,aggro:true});e.cd=1e9;e.hp=e.mhp=100;return e;};
  window.__edge=function(b){for(let j=4;j<NG-4;j++)for(let i=4;i<NG-4;i++){if(!wallAt(i,j))continue;const x=G0+(i+.5)*WC,y=G0+(j+.5)*WC;if(x*x+y*y>(WR-400)**2)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let ok=wallAt(i,j)&&wallAt(i-dy,j+dx)&&wallAt(i+dy,j-dx);for(let k=1;k<=6&&ok;k++)for(let s=-1;s<=1;s++)if(wallAt(i-dx*k+s*dy,j-dy*k+s*dx))ok=false;
      if(!ok)continue;const ex=x-dx*WC*1.5,ey=y-dy*WC*1.5;if(biomeAt(ex,ey)!==b||biomeAt(x,y)!==b||biomeAt(x-dx*WC*5,y-dy*WC*5)!==b)continue;
      if(!__calm(ex,ey)||pointHit(ex,ey,40)||pointHit(x-dx*WC*4,y-dy*WC*4,30))continue;return {x:ex,y:ey,dx,dy};}}return null;};
  window.__draw=function(){for(let i=0;i<60;i++)render(0,16.7);};return true;}"""

# gueule : ennemis dans le rayon, joueur au bord ; renvoie l'ouverture ou l'événement
BLOOM = r"""()=>{let it=null;for(let cx=-14;cx<=14&&!it;cx++)for(let cy=-14;cy<=14&&!it;cy++){const c=getChunk(cx,cy);if(!c)continue;
    for(const q of c.live)if(q.t==='bloom'&&__calm(q.x,q.y)&&biomeAt(q.x,q.y)==='floral'&&biomeAt(q.x+200,q.y)==='floral'&&!wallNear(q.x,q.y,120)){it=q;break;}}
  if(!it)return null;__T.it=it;__tp(it.x+110,it.y+60);const bi=__settle('floral');
  const E=[__foe('pop',it.x-30,it.y-10),__foe('mite',it.x+25,it.y+35),__foe('spread',it.x-10,it.y+45)];E.forEach(e=>{e.hp=e.mhp=1e9;});__T.E=E;__T.E0=E.map(e=>[e.x,e.y]);
  __T.pin=()=>{const P=G.p;P.x=P.px=it.x+110;P.y=P.py=it.y+60;P.vx=P.vy=0;__T.E.forEach((e,i)=>{if(!e.dead){e.x=__T.E0[i][0];e.y=__T.E0[i][1];e.vx=e.vy=0;e.cd=1e9;}});};
  __steps(300,()=>bloomOpen(it,G.t)===0);__steps(300,()=>bloomOpen(it,G.t)>=.9);return {biome:G.biome,settled:bi,open:bloomOpen(it,G.t),t:G.t};}"""
BITE = r"""()=>{const it=__T.it;const n=__steps(80,()=>G.dec.bite.some(q=>q.it===it&&q.t===G.t));return {biome:G.biome,t:G.t,bite:G.dec.bite.filter(q=>q.it===it).map(q=>q.t),hp:__T.E.map(e=>Math.round(e.hp/e.mhp*100))};}"""
CAR = r"""()=>{let it=null;for(let cx=-14;cx<=14&&!it;cx++)for(let cy=-14;cy<=14&&!it;cy++){const c=getChunk(cx,cy);if(!c)continue;
    for(const q of c.live)if(q.t==='car'&&__calm(q.x+(q.vert?0:CH/2),q.y+(q.vert?CH/2:0))&&[0,.25,.5,.75,1].every(f=>{const x=q.vert?q.x:q.x+f*CH,y=q.vert?q.y+f*CH:q.y;return biomeAt(x,y)==='urban';})){it=q;break;}}
  if(!it)return null;const P=G.p,ox=it.vert?110:0,oy=it.vert?0:110;let c0=carAt(it,G.t);__tp(c0[0]+ox,c0[1]+oy);
  __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox;P.y=P.py=c[1]+oy;P.vx=P.vy=0;};const bi=__settle('urban');
  /* ennemi posé là où la voiture sera dans 25 ticks (carAt : le rebouclage de la voie est respecté) */
  const dx=it.vert?0:Math.sign(it.spd),dy=it.vert?Math.sign(it.spd):0;let c=carAt(it,G.t+25);const ex=c[0],ey=c[1],e=__foe('pop',ex,ey),h0=e.hp;
  __T.pin=()=>{const c=carAt(it,G.t);P.x=P.px=c[0]+ox-dx*40;P.y=P.py=c[1]+oy-dy*40;P.vx=P.vy=0;if(e.hp>=h0){e.x=ex;e.y=ey;e.vx=e.vy=0;e.cd=1e9;}};
  const n=__steps(80,()=>e.hp<h0);__steps(5);return {biome:G.biome,settled:bi,n,hit:e.hp<h0,car:G.dec.car.map(q=>q.t),t:G.t};}"""
FALL = r"""()=>{const E=__edge('sky');if(!E)return null;__tp(E.x-E.dx*200,E.y-E.dy*200);const bi=__settle("sky");const P=G.p;
  const px=E.x-E.dx*120-E.dy*7,py=E.y-E.dy*120+E.dx*7;__tp(px,py);__T.pin=()=>{P.x=P.px=px;P.y=P.py=py;P.vx=P.vy=0;};const bi2=__settle("sky");
  const e=__foe('pop',E.x,E.y),f=__foe('spread',E.x-E.dy*40,E.y+E.dx*40);G.p.sk[0]={id:'shock',l:1,cd:0};gcUse(0);
  const n=__steps(60,()=>e.fall>0&&e.fall<=12);return {at:biomeAt(G.p.x,G.p.y),E,biome:G.biome,settled:bi2,n,fall:e.fall,fall2:f.fall||0,t:G.t};}"""

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 411, 'height': 823}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PAGE.as_uri()); pg.wait_for_timeout(1500)
    print('QL, PS, W, H, COARSE =', pg.evaluate(BOOT)); pg.wait_for_timeout(800)
    pg.evaluate(FREEZE); pg.wait_for_timeout(300); pg.evaluate(TOOLS)
    def shot(name, js):
        r = pg.evaluate(js); pg.evaluate('()=>__draw()'); pg.wait_for_timeout(120)
        f = OUT / (name + '.png'); pg.screenshot(path=str(f)); print(f'{name:14s} {r}  -> {f}')
    shot('a-gueule-ouverte', BLOOM)
    shot('b-morsure', BITE)
    shot('b2-morsure+6', '()=>{__steps(6);return {t:G.t};}')
    shot('c-choc-voiture', CAR)
    shot('d-chute', FALL)
    shot('d2-chute+6', '()=>{__steps(6);return {t:G.t,n:G.dec.fall.length};}')
    print('erreurs de page :', errs or 'aucune')
    br.close()
