#!/usr/bin/env python3
"""Captures du chantier E2 (décor vivant) en VRAI Chromium, aux métriques d'un téléphone :
411 px CSS de largeur de dessin, écran tactile (COARSE), DPR 2.625 -> PS 1.50 en qualité haute.

On démarre une partie, puis on TÉLÉPORTE le joueur (G.p, caméra) dans chaque biome, sur un endroit
choisi par le code du jeu lui-même (decoOf, seuils, WD.lms, WD.core) : aucune position supposée.
Ennemis retirés et joueur invulnérable pour que rien ne masque le décor.

Usage : python3 test/captures-e2.py [bulge.html] [dossier] [qualite: high|mid|low]
"""
import sys, pathlib, json
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'bulge.html').resolve()
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '/root/shots/e2'); OUT.mkdir(parents=True, exist_ok=True)
Q = sys.argv[3] if len(sys.argv) > 3 else 'high'

BOOT = """(q)=>{meta.chaps=meta.chaps||{};for(var k in CHAPS)meta.chaps[k]=1;meta.pend=[];meta.tuto=99;meta.mute=true;meta.q=q;meta.runs=40;
  applyQuality();startGame('bal',false);show(null);
  if(G&&G.gt&&G.gt.on&&typeof tutDone==='function')tutDone();
  window.__HOLD=null;setInterval(function(){try{if(!window.__KEEP)G.en.length=0;G.p.hp=99999;G.p.dead=false;G.banner=null;G.help=0;if(G.gs&&G.gs.subs)G.gs.subs.length=0;
    if(G.state!=='play')G.state='play';var h=window.__HOLD;if(h){G.p.x=h.x;G.p.y=h.y;G.p.vx=G.p.vy=0;G.cx=h.x;G.cy=h.y;G.pcx=G.pcy=null;if(h.dx){h.x+=h.dx;h.y+=h.dy;}}}catch(e){}},8);
  return [QL,PS,W,H,COARSE];}"""

# chaque lieu est calculé DANS la page, par le code du jeu
FIND = r"""(kind)=>{
  const near=(x,y,R)=>{const L=[];for(let cx=Math.floor((x-R)/CH);cx<=Math.floor((x+R)/CH);cx++)for(let cy=Math.floor((y-R)/CH);cy<=Math.floor((y+R)/CH);cy++){const c=getChunk(cx,cy);if(c)L.push(c);}return L;};
  const sites=t=>WD.sites.filter(s=>s.t===t);
  if(kind==='lianes'){for(const s of sites('floral'))for(const c of near(s.x,s.y,1400)){const d=decoOf(c);if(d.v.length>=2){const q=d.v[0];return{x:(q.a.x+q.b.x)/2,y:(q.a.y+q.b.y)/2+40};}}}
  if(kind==='paquets'){let b=null;for(const s of sites('cyber'))for(const c of near(s.x,s.y,1400)){const d=decoOf(c);if(!b||d.pk.length>b.n)b={n:d.pk.length,x:c.x0+256,y:c.y0+256};}return b;}
  if(kind==='vapeur'){let b=null;for(const s of sites('urban'))for(const c of near(s.x,s.y,1400)){const d=decoOf(c);if(!b||d.st.length>b.n)b={n:d.st.length,x:d.st.length?d.st[0].x:c.x0,y:d.st.length?d.st[0].y+60:c.y0};}return b;}
  if(kind==='aurores'){const s=sites('ice')[0];return{x:s.x,y:s.y+300};}
  if(kind==='baleine'){const s=sites('sky')[0];return{x:s.x,y:s.y+300};}
  if(kind==='coeur'){let b=null;for(const c of near(WD.core.x,WD.core.y,2200))for(const it of c.live)if(it.t==='node'){const d=Math.hypot(it.x-WD.core.x,it.y-WD.core.y);if(d>500&&(!b||d<b.d))b={d,x:it.x,y:it.y};}return b;}
  if(kind==='seuil'){const T=seuils();let b=T.find(t=>t.a!=='plains'||t.b!=='plains')||T[0];return b?{x:b.x,y:b.y+30,a:b.a,b:b.b}:null;}
  if(kind==='amer'){for(const L of WD.lms)if(!G.visited[L.t])for(let d=700;d<=2000;d+=100)if(biomeAt(L.x,L.y-d)!==L.t&&G.visited[biomeAt(L.x,L.y-d)])return{x:L.x,y:L.y-d,t:L.t,ou:biomeAt(L.x,L.y-d)};}
  if(kind==='neige'){const s=sites('ice')[0];return{x:s.x-300,y:s.y+420,dx:2.6,dy:-1.2};}
  if(kind==='faune'){for(const s of sites('plains'))for(const c of near(s.x,s.y,900))for(const it of c.live)if(it.t==='moth')return{x:it.x,y:it.y+60,mx:it.x,my:it.y};}
  return null;}"""

SHOTS = ['lianes', 'paquets', 'vapeur', 'aurores', 'coeur', 'seuil', 'amer', 'neige', 'faune', 'baleine']

with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 411, 'height': 823}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PAGE.as_uri())
    pg.wait_for_timeout(1500)
    info = pg.evaluate(BOOT, Q)
    print('QL, PS, W, H, COARSE =', info)
    for k in SHOTS:
        at = pg.evaluate(FIND, k)
        if not at:
            print(f'{k:8s} : AUCUN lieu trouvé — capture impossible'); continue
        pg.evaluate('(h)=>{window.__HOLD=h;}', at)
        if k == 'baleine':   # place l'horloge au milieu d'une traversée : la baleine est au centre de l'écran
            pg.wait_for_timeout(1500)
            ms = pg.evaluate('()=>{const n=Math.floor(G.t/WHP)+1,w=n*WHP+WHP*.47-G.t;return w/60*1000;}')
            pg.wait_for_timeout(max(0, ms - 3000))
        if k == 'faune':     # un ennemi en aggro HORS du champ, à droite : les phalènes filent vers la gauche
            pg.wait_for_timeout(2500)
            pg.evaluate('(h)=>{window.__KEEP=1;G.en.length=0;mkEnemy("pop",h.mx+W/RZ*.5+60,h.my,{aggro:true});const e=G.en[G.en.length-1];e.spawn=0;e.hp=1e9;window.__FEN=setInterval(()=>{e.x=h.mx+W/RZ*.5+60;e.y=h.my;e.vx=e.vy=0;e.spawn=0;e.aggro=true;},4);}', at)
        pg.wait_for_timeout(3000 if k != 'neige' else 2200)
        pg.evaluate('()=>{show(null);G.state="play";}'); pg.wait_for_timeout(400)
        png = OUT / f'e2-{k}-{Q}.png'
        pg.screenshot(path=str(png))
        extra = pg.evaluate('()=>({biome:G.biome,x:Math.round(G.p.x),y:Math.round(G.p.y),vu:Object.keys(G.visited).join(","),marques:MK.filter(m=>m.b&&RT-m.t>=0&&RT-m.t<MKL).length})')
        print(f'{k:8s} : {png}  {json.dumps(at)}  {extra}')
        if k == 'faune':
            pg.evaluate('()=>{clearInterval(window.__FEN);window.__KEEP=0;}')
    if errs:
        print('ERREURS PAGE :', errs[:5])
    br.close()
