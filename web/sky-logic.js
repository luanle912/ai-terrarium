// Pure logic for the sky island (no DOM, no canvas). The page and tests/sky-logic.test.mjs both run this block.
import { tr } from './i18n.js';
const key=(x,y)=>x+','+y;
const N4=[[1,0],[-1,0],[0,1],[0,-1]];
// Per-cell noise from the cell position alone, so the island looks the same on every machine.
const hash=(x,y,s)=>{const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return v-Math.floor(v);};
// LAWN is the grass in front of the office (where outdoor spots go); LAWN_BACK the thin strip behind its two walls.
const LAWN=6,LAWN_BACK=2,WATERFALL_LEN=140,DECOR_TOP=24;

// east-back runs along the pantry's east side, flush with the office's back wall, and holds the restroom block (raised
// to the office floor); east-front, right beside the block's east side, holds the smoking corner; south-left is free.
const outdoorSpots=(W,H)=>[{id:'east-front',x:W+6,y:4,w:4,h:4},{id:'south-left',x:5,y:H+1,w:4,h:3},{id:'east-back',x:W,y:0,w:6,h:7}];
// Land added to the squircle on the north-east, so the restroom block can sit flush with the office's back wall
// (rows -1..0) and the smoking corner can stand beside it (rows 3..10). Every added tile keeps (x+1) - y <= W+6: the
// island's right-most screen corner stays where it was, so the scene frame (sceneFrame) and every pixel west of the
// annex are unchanged. Rows are [y, first x, last x], relative to the office (x from W, y from 0).
const ANNEX_LAND=[[-1,2,4],[0,5,5],[3,8,8],[4,8,9],[5,8,10],[6,8,10],[7,8,10],[8,8,10],[9,8,9],[10,8,8]];
const annexLand=W=>ANNEX_LAND.flatMap(([y,a,b])=>Array.from({length:b-a+1},(_,i)=>[W+a+i,y]));

function buildIsland({W,H,lawn=LAWN,back=LAWN_BACK}){
  const cx=W/2,cy=H/2,x0=-back-3,x1=W+lawn+3,y0=-back-3,y1=H+lawn+3;
  const cells=new Set();
  // A squircle around the office with a few long, low waves: bays and headlands, never one-tile bumps.
  // Its half-width differs per side, so the lawn is wide in front of the office and thin behind the walls.
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const dx=x+0.5-cx,dy=y+0.5-cy,px=dx/(dx<0?W/2+back:W/2+lawn),py=dy/(dy<0?H/2+back:H/2+lawn);
    const a=Math.atan2(py,px),n=Math.pow(px**4+py**4,0.25);
    // +0.05 keeps the deepest bay from eating into the 6-tile lawn at the middle of a side.
    const wave=0.05+0.07*Math.sin(a*2+0.6)+0.05*Math.sin(a*3+2.1)+0.03*Math.sin(a*5+4.0);
    if(n<=1+wave||(x>=-1&&x<=W&&y>=-1&&y<=H))cells.add(key(x,y));
  }
  const pos=k=>k.split(',').map(Number);
  // Distance of every cell to the shore, which sets how deep its underside hangs.
  const shoreOf=set=>{const count=(x,y)=>N4.filter(([a,b])=>set.has(key(x+a,y+b))).length,out=new Map(),queue=[];
    for(const k of set){const[x,y]=pos(k);if(count(x,y)<4){out.set(k,0);queue.push([x,y]);}}
    for(let i=0;i<queue.length;i++){const[x,y]=queue[i],d=out.get(key(x,y));for(const[a,b]of N4){const k=key(x+a,y+b);if(set.has(k)&&!out.has(k)){out.set(k,d+1);queue.push([x+a,y+b]);}}}
    return out;};
  // The annex land keeps the underside of the island it was added to: cells that were there before keep their depth,
  // the added cells hang like any other shore cell. Otherwise the whole south-east underside would grow deeper.
  const before=shoreOf(cells);
  for(const[x,y]of annexLand(W))cells.add(key(x,y));
  const after=shoreOf(cells),shore=new Map([...cells].map(k=>[k,before.has(k)?before.get(k):after.get(k)]));
  const list=[...cells].map(k=>{const[x,y]=pos(k),s=shore.get(k);return{x,y,shore:s,d:8+Math.pow(Math.min(s,11),1.55)*6+Math.floor(hash(x,y,1)*5)};})
    .sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const c of list){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x+1);minY=Math.min(minY,c.y);maxY=Math.max(maxY,c.y+1);}
  const spots=outdoorSpots(W,H);
  const inSpot=(x,y)=>spots.some(s=>x>=s.x&&x<s.x+s.w&&y>=s.y&&y<s.y+s.h);
  const nearOffice=(x,y)=>x>=-1&&x<=W&&y>=-1&&y<=H;
  // The waterfall pours out of a small pond on the east shore; agents bathe at two of its cells.
  const east=list.filter(c=>!cells.has(key(c.x+1,c.y))).sort((a,b)=>b.y-a.y);
  const fall=east[Math.min(2,east.length-1)];
  const pond=new Set();
  for(let dy=-1;dy<=1;dy++)for(let dx=-2;dx<=0;dx++){const x=fall.x+dx,y=fall.y+dy;if(cells.has(key(x,y))&&!nearOffice(x,y)&&!inSpot(x,y))pond.add(key(x,y));}
  const pondSpots=[{x:fall.x-1,y:fall.y},{x:fall.x-1,y:fall.y-1},{x:fall.x-2,y:fall.y},{x:fall.x-1,y:fall.y+1}].filter(s=>pond.has(key(s.x,s.y))).slice(0,2);
  const paths=lawnPaths(W,H,stairs(W,H),pondSpots);
  const decor=[];
  for(const c of list){
    if(nearOffice(c.x,c.y)||inSpot(c.x,c.y)||pond.has(key(c.x,c.y))||paths.cells.has(key(c.x,c.y)))continue;
    const r=hash(c.x,c.y,2);
    // Sparse on purpose: a few trees read as a lawn, dozens read as clutter.
    if(r<0.035)decor.push({x:c.x,y:c.y,kind:'tree'});else if(r<0.06)decor.push({x:c.x,y:c.y,kind:'rock'});else if(r<0.2)decor.push({x:c.x,y:c.y,kind:'flower'});
  }
  return{cells,list,depth:new Map(list.map(c=>[key(c.x,c.y),c.d])),bounds:{minX,maxX,minY,maxY},spots,decor,waterfall:{x:fall.x,y:fall.y},pond:{cells:pond,spots:pondSpots},paths};
}

// ---- garden paths ----
// Stepping-stone paths laid where agents really walk (desire lines): from the foot of each stair flight to the pond
// (the restroom block is reached across the pantry floor, not from the lawn). They run one tile
// clear of the plinth front, so the big front lawn stays whole. Each leg is a list of waypoints that share a row or a
// column; `cells` are the tiles they cover (agents prefer them), `lines` the same legs in world coordinates for drawing,
// starting just past the bottom step instead of at the tile centre under it.
function lawnPaths(W,H,st,pondSpots){
  const e=st.find(s=>s.side==='east'),s=st.find(s=>s.side==='south');
  const bath=pondSpots.reduce((a,b)=>b.y<a.y?b:a),row=H+1,sx=s.x+s.len-1;
  const legs=[
    {at:'south',pts:[[sx,H],[sx,row],[bath.x,row],[bath.x,bath.y-1]]},
    {at:'east',pts:[[e.x,e.y+e.len-1],[e.x,row]]},
    // along the front of the restroom block to the smoking corner's entrance beside it
    {at:'east',pts:[[e.x,e.y],[W+5,e.y]]},
  ];
  const cells=new Set();
  for(const{pts}of legs)for(let i=1;i<pts.length;i++){
    const[a,b]=[pts[i-1],pts[i]],dx=Math.sign(b[0]-a[0]),dy=Math.sign(b[1]-a[1]);
    for(let x=a[0],y=a[1];;x+=dx,y+=dy){cells.add(key(x,y));if(x===b[0]&&y===b[1])break;}
  }
  // A line starts on the lawn just past the bottom step and heads straight for the next tile centre, so a long first
  // run does not drift sideways from the stairs toward the next waypoint.
  const lines=legs.map(({at,pts})=>{
    const[[x,y],[bx,by]]=pts,c=([x,y])=>[x+0.5,y+0.5],next=[x+0.5+Math.sign(bx-x),y+0.5+Math.sign(by-y)];
    const out=[at==='east'?[x+STAIR_RUN+0.25,y+0.5]:[x+0.5,y+STAIR_RUN+0.25],next];
    for(const p of pts.slice(1)){const q=c(p);if(q[0]!==out[out.length-1][0]||q[1]!==out[out.length-1][1])out.push(q);}
    return out;
  });
  const strips=lines.map(smoothLine);
  return{cells,lines,strips,stones:layStones(strips)};
}
// Corner cutting (Chaikin, twice) so a leg's right-angle turns read as soft curves; the end points stay put.
function smoothLine(l){
  let p=l;
  for(let n=0;n<2;n++){const q=[p[0]];for(let i=0;i<p.length-1;i++){const[a,b]=[p[i],p[i+1]];q.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]);}q.push(p[p.length-1]);p=q;}
  return p;
}
// Stepping stones along the smoothed legs. A tile is ~0.65 m, so a stone every 0.95 tile is the usual ~60 cm stride and
// a stone ~0.64 tile across is ~40 cm; the first stone of a leg is a wider landing slab at the foot of the stairs.
// Where a leg runs into another, the stone already laid there is kept. Each stone gets an irregular 8-point outline
// in world coordinates, wider across the walk than along it, from per-stone noise so it is the same on every machine.
const STONE_STEP=0.95;
function layStones(strips){
  const stones=[];
  for(const l of strips){
    const seg=[];let len=0;
    for(let i=1;i<l.length;i++){const d=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);seg.push([len,d]);len+=d;}
    const at=s=>{let i=0;while(i<seg.length-1&&seg[i][0]+seg[i][1]<s)i++;const[s0,d]=seg[i],f=d?Math.min(1,(s-s0)/d):0,a=l[i],b=l[i+1];
      return{x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,tx:(b[0]-a[0])/(d||1),ty:(b[1]-a[1])/(d||1)};};
    // spread the stones evenly from end to end, never wider than a stride, so the last one lands at the end of the leg
    const n=Math.max(1,Math.ceil(len/STONE_STEP)),marks=Array.from({length:n+1},(_,i)=>len*i/n);
    marks.forEach((s,i)=>{const p=at(s);if(!stones.some(o=>Math.hypot(o.x-p.x,o.y-p.y)<0.6))stones.push({...p,first:i===0});});
  }
  for(const st of stones){
    const ra=st.first?0.3:0.24,rb=st.first?0.42:0.32;st.outline=[];
    for(let j=0;j<8;j++){const th=j*Math.PI/4+(hash(st.x*9,st.y*9,20+j)-0.5)*0.35,r=0.88+hash(st.x*9,st.y*9,30+j)*0.24;
      const ca=Math.cos(th)*ra*r,cb=Math.sin(th)*rb*r;st.outline.push([st.x+st.tx*ca-st.ty*cb,st.y+st.ty*ca+st.tx*cb]);}
  }
  return stones.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
}

// Cheapest route between two tiles (Dijkstra). `canStep(a,b)` says whether one step from a to b is allowed and
// `cost(b)` what it costs; with every cost 1 this is a plain shortest route. The frontier is a sorted array: the grid
// is about a thousand cells and routes are only planned when an agent picks a new goal.
const GRASS_COST=2;
function cheapestPath(from,to,canStep,cost){
  const goal=key(to[0],to[1]),start=key(from[0],from[1]);
  const dist=new Map([[start,0]]),prev=new Map([[start,null]]),open=[[0,from]];
  while(open.length){
    const[d,c]=open.shift(),kc=key(c[0],c[1]);
    if(d>dist.get(kc))continue;
    if(kc===goal)break;
    for(const[dx,dy]of N4){
      const n=[c[0]+dx,c[1]+dy],kn=key(n[0],n[1]);
      if(!canStep(c,n))continue;
      const nd=d+cost(n);
      if(dist.has(kn)&&dist.get(kn)<=nd)continue;
      dist.set(kn,nd);prev.set(kn,c);
      let i=open.length;while(i>0&&open[i-1][0]>nd)i--;
      open.splice(i,0,[nd,n]);
    }
  }
  if(!prev.has(goal)||goal===start)return[];
  const out=[];for(let c=to;key(c[0],c[1])!==start;c=prev.get(key(c[0],c[1])))out.unshift(c);
  return out;
}

// ---- walking outside the office ----
// The only ways between the raised office floor and the lawn: two flights of steps, one on the pantry's east edge
// and one on its front edge. `x,y` is the first lawn tile at the foot; `len` tiles wide along the edge.
const stairs=(W,H)=>[{side:'east',x:W,y:7,len:2},{side:'south',x:22,y:H,len:2}];
const inRect=(x,y,W,H)=>x>=0&&x<W&&y>=0&&y<H;
function canCross(a,b,W,H,st){
  const inA=inRect(a[0],a[1],W,H),inB=inRect(b[0],b[1],W,H);
  if(inA===inB)return true;
  const[o,l]=inA?[a,b]:[b,a];
  return st.some(s=>s.side==='east'
    ?o[0]===W-1&&l[0]===W&&o[1]===l[1]&&l[1]>=s.y&&l[1]<s.y+s.len
    :o[1]===H-1&&l[1]===H&&o[0]===l[0]&&l[0]>=s.x&&l[0]<s.x+s.len);
}
// Lawn cells agents can stand on: not water (except the bathing spots), not under a tree or rock.
function lawnWalk(island,W,H){
  const out=new Set(),blocked=new Set(island.decor.filter(d=>d.kind!=='flower').map(d=>key(d.x,d.y))),bath=new Set(island.pond.spots.map(s=>key(s.x,s.y)));
  for(const c of island.list){const k=key(c.x,c.y);if(inRect(c.x,c.y,W,H)||blocked.has(k))continue;if(island.pond.cells.has(k)&&!bath.has(k))continue;out.add(k);}
  return out;
}
const STAIR_RUN=0.6;
function groundZ(x,y,W,H,st,floorZ){
  if(inRect(x,y,W,H))return floorZ;
  for(const s of st){
    if(s.side==='east'&&x>=W&&x<W+STAIR_RUN&&y>=s.y&&y<s.y+s.len)return floorZ*(1-(x-W)/STAIR_RUN);
    if(s.side==='south'&&y>=H&&y<H+STAIR_RUN&&x>=s.x&&x<s.x+s.len)return floorZ*(1-(y-H)/STAIR_RUN);
  }
  return 0;
}

// Logical scene size and origin that fit the whole island: its top, underside, trees and waterfall.
// FH is the height the view is fitted to: the island top plus a little underside; the rest may run off the bottom.
const FOCUS_UNDER=40;
function sceneFrame(island,{W,H,TW,TH,WALL,pad}){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,topY=-Infinity;
  const take=(x,y,z)=>{const sx=(x-y)*TW,sy=(x+y)*TH-z;minX=Math.min(minX,sx);maxX=Math.max(maxX,sx);minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);return sy;};
  for(const c of island.list){topY=Math.max(topY,take(c.x+1,c.y+1,0));take(c.x,c.y,0);take(c.x+1,c.y,0);take(c.x,c.y+1,0);take(c.x+1,c.y+1,-c.d);take(c.x+1,c.y,-c.d);take(c.x,c.y+1,-c.d);}
  for(const d of island.decor)take(d.x+0.5,d.y+0.5,DECOR_TOP);
  take(0,0,WALL+3);take(W,0,WALL+3);take(0,H,WALL+3);
  const f=island.waterfall;take(f.x+1,f.y+0.5,-1-WATERFALL_LEN);
  minX=Math.floor(minX);minY=Math.floor(minY);maxX=Math.ceil(maxX);maxY=Math.ceil(maxY);
  return{LW:maxX-minX+2*pad,LH:maxY-minY+2*pad,OX:pad-minX,OY:pad-minY,FH:Math.ceil(topY+FOCUS_UNDER)-minY+2*pad};
}

// ---- weather ----
const WEATHERS=['clear','cloudy','rain','storm','snow','fog'];
const WEIGHTS={clear:45,cloudy:25,rain:12,storm:5,snow:5,fog:8};
// How strongly each weather drives each effect, 0..1. Blending these is what makes transitions smooth.
const FX={
  clear:{cloud:0.2,rain:0,snow:0,storm:0,fog:0},
  cloudy:{cloud:0.8,rain:0,snow:0,storm:0,fog:0},
  rain:{cloud:0.9,rain:1,snow:0,storm:0,fog:0},
  storm:{cloud:1,rain:1,snow:0,storm:1,fog:0},
  snow:{cloud:0.7,rain:0,snow:1,storm:0,fog:0},
  fog:{cloud:0.5,rain:0,snow:0,storm:0,fog:1}
};
const WINTER=new Set([11,0,1]);
const MIN=60_000;

function pickNextWeather(prev,month,rand){
  const w={...WEIGHTS};
  if(!WINTER.has(month)){w.clear+=w.snow;w.snow=0;}
  if(prev!=='clear')delete w[prev];
  const pool=WEATHERS.filter(k=>w[k]>0),total=pool.reduce((s,k)=>s+w[k],0);
  let r=rand()*total;
  for(const k of pool){r-=w[k];if(r<0)return k;}
  return pool[pool.length-1];
}
const changeDelayMs=r=>20*MIN+r*20*MIN;
const transitionMs=r=>30_000+r*30_000;
function wmoToWeather(code){
  if(!Number.isInteger(code))return null;
  if(code===0||code===1)return'clear';
  if(code===2||code===3)return'cloudy';
  if(code===45||code===48)return'fog';
  if((code>=51&&code<=67)||(code>=80&&code<=82))return'rain';
  if((code>=71&&code<=77)||code===85||code===86)return'snow';
  if(code>=95&&code<=99)return'storm';
  return null;
}
const initialWeather=(type,now)=>({fromFx:{...FX[type]},to:type,t0:now,dur:0,nextAt:now+20*MIN});
function weatherFx(state,now){
  const p=state.dur>0?(now-state.t0)/state.dur:1;
  if(p<=0)return{...state.fromFx};
  if(p>=1)return{...FX[state.to]};
  const s=p*p*(3-2*p),out={};
  for(const k in state.fromFx)out[k]=state.fromFx[k]+(FX[state.to][k]-state.fromFx[k])*s;
  return out;
}
// Starts from whatever mix is on screen right now, so a new change never jumps.
const startTransition=(state,to,now,dur)=>({...state,fromFx:weatherFx(state,now),to,t0:now,dur});
function stepRandom(state,now,month,rand){
  if(now<state.nextAt)return state;
  const next=startTransition(state,pickNextWeather(state.to,month,rand),now,transitionMs(rand()));
  return{...next,nextAt:now+changeDelayMs(rand())};
}
const snowCover=(cover,snow,dtMs)=>Math.max(0,Math.min(1,snow>0?cover+dtMs/(10*MIN)*snow:cover-dtMs/(20*MIN)));
const lightningDelayMs=r=>8000+r*12000;
const lightningFlashMs=r=>120+r*80;
// Brightness of a flash that started at `start`: full at once, then fading out (never a hard on/off blink).
const flashLevel=(now,start,ms)=>now<start||now>=start+ms?0:(1-(now-start)/ms)**2;
// A preview shows a weather for a minute, then returns to whatever the mode had on before the first preview.
const PREVIEW_MS=60_000;
const startPreview=(wx,preview,type,now)=>({wx:startTransition(wx,type,now,3000),preview:{type,until:now+PREVIEW_MS,back:preview?preview.back:wx.to}});
// The lawn's real snow cover builds and melts from the mode's own weather, never from a preview;
// a snow preview only shows a white lawn while it lasts, so nothing is left behind afterwards.
function stepSnow(cover,fx,preview,dtMs){
  const next=snowCover(cover,preview?FX[preview.back].snow:fx.snow,dtMs);
  return{cover:next,shown:preview&&preview.type==='snow'?1:next};
}
function stepPreview(wx,preview,now){
  if(!preview||now<preview.until)return{wx,preview};
  return{wx:startTransition(wx,preview.back,now,5000),preview:null};
}

// ---- settings and real weather ----
const WEATHER_KEY='ai-terrarium.weather',MODES=['random','real','off'];
function loadWeatherSettings(storage){
  const fallback={mode:'random',city:''};
  try{
    const raw=storage&&storage.getItem(WEATHER_KEY);
    if(!raw)return fallback;
    const v=JSON.parse(raw)||{};
    return{mode:MODES.includes(v.mode)?v.mode:'random',city:typeof v.city==='string'?v.city:''};
  }catch(e){return fallback;}
}
function saveWeatherSettings(storage,settings){
  try{storage.setItem(WEATHER_KEY,JSON.stringify({mode:settings.mode,city:settings.city}));return true;}catch(e){return false;}
}
const geocodeUrl=city=>'https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city.trim())+'&count=1&language=vi&format=json';
const forecastUrl=(lat,lon)=>'https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=weather_code';
// Never rejects: every failure comes back as a reason the settings panel can show as-is.
async function fetchRealWeather(city,fetchFn,{timeoutMs=15000}={}){
  const name=(city||'').trim(),unreadable={ok:false,reason:tr('weather.error.unreadable')};
  if(!name)return{ok:false,reason:tr('weather.error.noCity')};
  // A stalled connection (VPN black hole, captive portal) must still end in a reason and the Random fallback.
  const timed=p=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error(tr('weather.error.timeout'))),timeoutMs);Promise.resolve(p).then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});});
  const getJson=async url=>{const res=await timed(fetchFn(url));if(!res.ok)throw new Error('HTTP '+res.status);try{return{body:await timed(res.json())};}catch(e){if(e&&e.message===tr('weather.error.timeout'))throw e;return{body:undefined};}};
  try{
    const geo=(await getJson(geocodeUrl(name))).body;
    if(geo===undefined)return unreadable;
    const place=geo&&Array.isArray(geo.results)&&geo.results[0];
    if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))return{ok:false,reason:tr('weather.error.cityNotFound',{city:name})};
    const now=(await getJson(forecastUrl(place.latitude,place.longitude))).body;
    const code=now&&now.current&&now.current.weather_code,type=wmoToWeather(code);
    if(!type)return unreadable;
    return{ok:true,type,code,place:place.name||name};
  }catch(e){return{ok:false,reason:tr('weather.error.fetchFailed',{detail:e&&e.message?e.message:String(e)})};}
}

// ---- sky colours ----
const hexRgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const rgbHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mixHex=(a,b,p)=>{const A=hexRgb(a),B=hexRgb(b);return rgbHex(A.map((v,i)=>v*(1-p)+B[i]*p));};
const SKY_DAY={zenith:'#2f6fd6',horizon:'#cfe9ff',haze:'#e6f3ff',below:'#bcd9f2',cloud:'#ffffff',cloudShade:'#dfe8f2'};
const SKY_NIGHT={zenith:'#070b1c',horizon:'#1c2747',haze:'#26335a',below:'#0e1630',cloud:'#3a4466',cloudShade:'#2c3554'};
const SKY_WARM={zenith:'#4a5fa8',horizon:'#ffb27a',haze:'#ffd1a1',below:'#c99ab0',cloud:'#ffe0c4',cloudShade:'#e8b8a0'};
const GREY_DAY='#8e9aab',GREY_NIGHT='#2a2f3d';
// df is the day factor (0 night .. 1 day). Warmth peaks halfway through dawn and dusk; cloud cover and storms grey it all.
function skyColors(df,hour,fx){
  const warm=4*df*(1-df),grey=Math.max(0,fx.cloud-0.2)/0.8*0.55+fx.storm*0.3,greyTone=mixHex(GREY_NIGHT,GREY_DAY,df),out={};
  for(const k in SKY_DAY){
    let c=mixHex(SKY_NIGHT[k],SKY_DAY[k],df);
    c=mixHex(c,SKY_WARM[k],warm*(k==='zenith'?0.35:0.7));
    c=mixHex(c,greyTone,Math.min(0.85,grey*(k==='cloud'||k==='cloudShade'?0.6:1)));
    if(fx.storm>0)c=mixHex(c,'#2a2f3a',fx.storm*0.45);
    if(fx.fog>0&&(k==='horizon'||k==='haze'||k==='below'))c=mixHex(c,mixHex(greyTone,'#ffffff',0.4),fx.fog*0.5);
    out[k]=c;
  }
  return out;
}

export const SkyLogic = {annexLand,stepSnow,stairs,canCross,lawnWalk,lawnPaths,cheapestPath,GRASS_COST,groundZ,STAIR_RUN,flashLevel,PREVIEW_MS,startPreview,stepPreview,LAWN_BACK,mixHex,skyColors,WEATHER_KEY,loadWeatherSettings,saveWeatherSettings,geocodeUrl,forecastUrl,fetchRealWeather,LAWN,WATERFALL_LEN,DECOR_TOP,outdoorSpots,buildIsland,sceneFrame,
  WEATHERS,WEIGHTS,FX,pickNextWeather,changeDelayMs,transitionMs,wmoToWeather,initialWeather,weatherFx,startTransition,stepRandom,snowCover,lightningDelayMs,lightningFlashMs};

