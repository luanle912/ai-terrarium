"use strict";
const h=React.createElement;
// Shared by both settings panels. A change reloads the page so tables built at load time pick up the new language;
// when the choice could not be saved (storage blocked) it travels in ?lang= instead.
function switchLanguage(code){
  const r=I18n.setLang(code);
  if(r==='saved'){location.reload();return;}
  if(r){const u=new URL(location.href);u.searchParams.set('lang',code);location.href=u.href;}
}
function languagePicker(){
  return h('label',null,tr('settings.language'),
    h('select',{'aria-label':tr('settings.language'),value:I18n.lang,onChange:e=>switchLanguage(e.target.value)},
      I18n.LANGS.map(([code,name])=>h('option',{key:code,value:code,lang:code},name))));
}

const W=27,H=14,TW=16,TH=8,WALL=56;
// The scene is framed by the island around the office (6 tiles of lawn), not by the office alone.
const ISLAND=SkyLogic.buildIsland({W,H,lawn:SkyLogic.LAWN,back:SkyLogic.LAWN_BACK});
// The office stands on a plinth FLOOR_Z above the lawn, so P (everything in the office: floor, walls, people, bubbles,
// clicks) is lifted by it, while PG is the bare lawn level used for trees, the waterfall and the plinth itself.
const FLOOR_Z=8;
const {LW,LH,OX,OY,FH}=SkyLogic.sceneFrame(ISLAND,{W,H,TW,TH,WALL:WALL+FLOOR_Z,pad:16});
const PG=(x,y,z=0)=>[OX+(x-y)*TW, OY+(x+y)*TH-z];
const P=(x,y,z=0)=>PG(x,y,z+FLOOR_Z);
// Agents can step down the stairs onto the lawn, so a person stands at the ground height of wherever they are.
const STAIRS=SkyLogic.stairs(W,H),LAWN_WALK=SkyLogic.lawnWalk(ISLAND,W,H);
// The restroom block beside the pantry is raised to the office floor too.
const PA=(x,y,z=0)=>PG(x,y,z+(RestroomLogic.onFloor(WC,x,y)?FLOOR_Z:SkyLogic.groundZ(x,y,W,H,STAIRS,FLOOR_Z)));
// The smoking corner fills the east-front outdoor spot, right beside the restroom block's east side, at the end of the
// garden path that runs along the block's front. Only its planted trough (which faces the block) is taken off the
// walkable lawn: seats, the ash bin and the posts are thin enough to step past, and an agent's own spot must stay
// walkable to path from it. Its pad is entered only through the entrance (SMOKE.shut, added to EDGE
// below), so nobody climbs over the bench back on the way in from the stairs.
const SMOKE=SmokeLogic.layout(ISLAND.spots.find(s=>s.id==='east-front'));
SMOKE.blocked.forEach(k=>LAWN_WALK.delete(k));
// The restroom block fills the east-back spot along the pantry's east side, on the office floor level: its tiles are
// floor, not lawn, and bfs reaches them only across the pantry (RestroomLogic.step), never from the grass.
const WC=RestroomLogic.layout(ISLAND.spots.find(s=>s.id==='east-back'),WALL),WC_WALK=new Set(WC.walk);
WC.floor.forEach(k=>LAWN_WALK.delete(k));
// Paving walks like the garden path: smokers stay on their pad.
const PAVED=new Set(SMOKE.paved);
// The office dogs live on the lawn in front of and beside the office, never in the pond, the smoking corner or the restroom.
const DOG_ROAM=DogLogic.roamCells(LAWN_WALK,{W,H,pond:ISLAND.pond.cells,avoid:ISLAND.spots.filter(s=>s.id==='east-back'||s.id==='east-front')});
// They run across the stone paths and past the stairs but never lie, sit, sniff or sleep on them (the stairs' foot and
// the tile beyond it stay free). At night they curl up at the foot of the tree at (33,8), a quiet corner of the east
// lawn away from both paths and still in view at 1×.
const DOG_CLEAR=new Set(ISLAND.paths.cells);
STAIRS.forEach(s=>{for(let i=0;i<s.len;i++)for(let o=0;o<2;o++)DOG_CLEAR.add(s.side==='east'?(s.x+o)+','+(s.y+i):(s.x+i)+','+(s.y+o));});
const DOG_PLACES={W,H,roam:DOG_ROAM,roamList:[...DOG_ROAM].map(k=>k.split(',').map(Number)),clear:DOG_CLEAR,den:DogLogic.denCells(DOG_ROAM,[33,8],DOG_CLEAR),drink:DogLogic.drinkSpots(DOG_ROAM,ISLAND.pond.cells,DOG_CLEAR)};
const REAL_WEATHER_EVERY_MS=15*60_000;
const WEATHER_LABEL={clear:tr('weather.label.clear'),cloudy:tr('weather.label.cloudy'),rain:tr('weather.label.rain'),storm:tr('weather.label.storm'),snow:tr('weather.label.snow'),fog:tr('weather.label.fog')};
const WEATHER_PREVIEW=[['clear',tr('weather.preview.clear')],['cloudy',tr('weather.preview.cloudy')],['rain',tr('weather.preview.rain')],['storm',tr('weather.preview.storm')],['snow',tr('weather.preview.snow')],['fog',tr('weather.preview.fog')]];
const ZONES=[{zx:0,zy:0},{zx:10,zy:0},{zx:0,zy:8},{zx:10,zy:8}];
const DESKS=[]; ZONES.forEach((z,zi)=>[[1,1],[5,1],[1,4],[5,4]].forEach(([dx,dy])=>DESKS.push({gx:z.zx+dx,gy:z.zy+dy,zone:zi})));
const BLOCK=new Set(); DESKS.forEach(d=>{BLOCK.add(d.gx+','+d.gy);BLOCK.add((d.gx+1)+','+d.gy);}); ['8,0','9,0','8,13','19,13','18,0','26,13'].forEach(k=>BLOCK.add(k));
// Pantry furniture: the kitchen wall (row 0), the island (row 3), the tables by the bench and the sky-view bar.
for(let x=20;x<W;x++)BLOCK.add(x+',0'); for(let x=22;x<=25;x++){BLOCK.add(x+',2');BLOCK.add(x+',3');} for(let x=23;x<=25;x++)BLOCK.add(x+',5');
const IDLE_SPOTS=[
 // kitchen wall: fridge, espresso, grinder, sink, microwave, drinkfridge
 {act:'fridge',tile:[21,1],pt:[20.8,1.0],front:false},
 {act:'coffee',tile:[21,1],pt:[21.7,1.0],front:false},{act:'coffee',tile:[22,1],pt:[22.5,1.0],front:false},
 {act:'water',tile:[23,1],pt:[23.4,1.0],front:false},{act:'microwave',tile:[24,1],pt:[24.9,1.0],front:false},
 {act:'snack',tile:[25,1],pt:[25.2,1.0],front:false},
 // island bar stools (4 stools facing kitchen)
 {act:'table',tile:[21,4],pt:[22.1,3.95],stool:2,front:false},{act:'table',tile:[22,4],pt:[22.9,3.95],stool:2,front:false},
 {act:'table',tile:[23,4],pt:[23.7,3.95],stool:2,front:false},{act:'table',tile:[24,4],pt:[24.5,3.95],stool:2,front:false},
 // booth cafe tables (3 tables with chairs)
 {act:'meal',tile:[22,10],pt:[22.1,10.2],stool:1,front:false},{act:'meal',tile:[22,11],pt:[22.1,11.4],stool:1,front:false},
 {act:'meal',tile:[22,12],pt:[22.1,12.6],stool:1,front:false},
 // game corner: arcades and foosball
 {act:'sky',tile:[25,11],pt:[25.1,10.5],front:false},{act:'sky',tile:[26,11],pt:[25.9,10.5],front:false},
 {act:'stretch',tile:[24,13],pt:[24.6,12.0],front:true},{act:'stretch',tile:[25,13],pt:[25.4,12.3],front:true},
 // lounge: coffeetable, armchair, sofa area
 {act:'phone',tile:[24,8],pt:[23.5,7.3],front:true},{act:'phone',tile:[26,8],pt:[26.0,7.3],front:true},
 {act:'stretch',tile:[22,6],pt:[22.8,6.0],front:true},{act:'phone',tile:[23,13],pt:[24.0,13.2],front:true},
 // the smoking corner out on the lawn
 ...SMOKE.spots,
 // the restroom by the pantry: a short visit, then on to another spot (goalFor)
 ...WC.spots,
 // bathing in the pond out on the lawn, reached down the pantry stairs
 ...ISLAND.pond.spots.map(s=>({act:'bath',tile:[s.x,s.y],pt:[s.x+0.5,s.y+0.5],front:true}))];
const ACT_TXT={table:tr('office.act.table'),meal:tr('office.act.meal'),sky:tr('office.act.sky'),coffee:tr('office.act.coffee'),fridge:tr('office.act.fridge'),water:tr('office.act.water'),microwave:tr('office.act.microwave'),snack:tr('office.act.snack'),smoke:tr('office.act.smoke'),wc:tr('office.act.wc'),phone:tr('office.act.phone'),stretch:tr('office.act.stretch'),bath:tr('office.act.bath')};
const SEGS=[], EDGE=new Set();
const addV=(zi,X,y)=>{SEGS.push({zi,v:true,X,y});EDGE.add((X-1)+','+y+'|'+X+','+y);EDGE.add(X+','+y+'|'+(X-1)+','+y);};
const addH=(zi,Y,x)=>{SEGS.push({zi,v:false,Y,x});EDGE.add(x+','+(Y-1)+'|'+x+','+Y);EDGE.add(x+','+Y+'|'+x+','+(Y-1));};
ZONES.forEach((z,zi)=>{const Y=z.zy===0?6:8;
  (z.zx===0?[8]:[10,18]).forEach(X=>{for(let y=z.zy;y<=z.zy+5;y++)if(y!==z.zy+3)addV(zi,X,y);});
  for(let x=z.zx;x<=z.zx+7;x++)if(x!==z.zx+3&&x!==z.zx+4)addH(zi,Y,x);
});
for(let y=0;y<H;y++)if(y!==6&&y!==7)addV(4,20,y);
SMOKE.shut.forEach(e=>EDGE.add(e));
const zoneAt=(x,y)=>{if(x>=20)return 4;for(let i=0;i<4;i++){const z=ZONES[i];if(x>=z.zx&&x<=z.zx+7&&y>=z.zy&&y<=z.zy+5)return i;}return -1;};
const mix=(a,b,p)=>{if(!a||a[0]!=='#')return b;const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16),f=(s)=>Math.round(((A>>s)&255)*(1-p)+((B>>s)&255)*p);return'#'+((1<<24)+(f(16)<<16)+(f(8)<<8)+f(0)).toString(16).slice(1);};
const DOOR={tile:[0,7],pt:[-0.9,7]};
const DEPT_PAL=['#3e8ed0','#e5484d','#46a758','#8e4ec6','#f5a524','#12a594','#e93d82','#5b5bd6'];
const SIM_DEPTS=[['newera-web','WEB'],['api-gateway','API'],['mobile-app','MOB'],['infra-tf','INF']];
const colOf=i=>DESKS[i].zone;

const THEMES={
  night:{label:'Night shift',bg:'#0b0e14',fa:'#1b2233',fb:'#1f2740',wl:'#262f48',wr:'#2e3856',trim:'#3d4970',glass:'#16294a',glassHi:'#2f5d9a',door:'#151a27',board:'#d9dee8',dt:'#7a5a40',dl:'#5c4330',dr:'#4a3626',mon:'#15161c',on:'#5ef2ff',off:'#262d3d',chair:'#3b4058',kb:'#2b2f3c',plant:'#3fa36b',pot:'#a5573b',stroke:null,shadow:'rgba(0,0,0,0.45)'},
  day:{label:'Sunny studio',bg:'#f4ead8',fa:'#d8b689',fb:'#d1ad7e',wl:'#f3e7d3',wr:'#eadbc2',trim:'#cdb796',glass:'#a9dbff',glassHi:'#e2f4ff',door:'#9a6b45',board:'#ffffff',dt:'#fbf7ee',dl:'#ddd2bf',dr:'#c9bca6',mon:'#3a3a46',on:'#8be0b4',off:'#55596a',chair:'#e07a5f',kb:'#cfc6b4',plant:'#4caf6a',pot:'#d0743c',stroke:null,shadow:'rgba(80,50,20,0.25)'},
  blueprint:{label:'Blueprint',bg:'#eef1f6',fa:'#ffffff',fb:'#f6f8fb',wl:'#e3e8f0',wr:'#d9e0eb',trim:'#b9c4d6',glass:'#ffffff',glassHi:'#ffffff',door:'#c9d3e3',board:'#ffffff',dt:'#ffffff',dl:'#e9edf4',dr:'#dde3ec',mon:'#ffffff',on:'#2f5bff',off:'#e3e8f0',chair:'#ffffff',kb:'#ffffff',plant:'#ffffff',pot:'#ffffff',stroke:'#7d8aa3',shadow:'rgba(47,91,255,0.15)'}
};
function dayFactor(){const d=new Date(),t=d.getHours()+d.getMinutes()/60;if(t<5)return 0;if(t<6.5)return(1-Math.cos((t-5)/1.5*Math.PI))/2;if(t<16.5)return 1;if(t<18)return(1+Math.cos((t-16.5)/1.5*Math.PI))/2;return 0;}
function lerpHex(a,b,t){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);const r=Math.round(((pa>>16)&255)*(1-t)+((pb>>16)&255)*t),g=Math.round(((pa>>8)&255)*(1-t)+((pb>>8)&255)*t),bl=Math.round((pa&255)*(1-t)+(pb&255)*t);return'#'+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);}
function lerpTheme(f){const n=THEMES.night,d=THEMES.day,o={_day:f};for(const k in n){if(k==='label')o[k]=f>0.5?d[k]:n[k];else if(k==='stroke')o[k]=null;else if(k==='shadow'){const pa=n[k].match(/[\d.]+/g).map(Number),pb=d[k].match(/[\d.]+/g).map(Number);o[k]='rgba('+pa.map((v,i)=>{const r=v*(1-f)+pb[i]*f;return i<3?Math.round(r):Math.round(r*100)/100;}).join(',')+')'}else if(typeof n[k]==='string'&&n[k][0]==='#')o[k]=lerpHex(n[k],d[k],f);else o[k]=n[k];}return o;}
// ---- People: the parts that differ from one look to the next (PeopleLogic.look) ----
// Every function takes the scene's 1px rect R and the agent's look L. Men and women are told apart by silhouette
// (hair past the shoulders, a bun or a ponytail, an A-line skirt; short hair, a beard, a collar and tie), not by
// single pixels, so they still read at the world view's level of detail.
const LOOK_TIE='#e8d27a',LOOK_CLIP='#e93d82',LOOK_LIPS='#c0405a',LOOK_BLUSH='#e0707a',LOOK_GOLD='#ffd166';
const LOOK=a=>a.look||(a.look=PeopleLogic.look(a.sid||a.id));
const hairTones=L=>[L.hair,shade(L.hair,-26),shade(L.hair,28)];
const capOf=sh=>shade(sh,-45);
const PERSON={
  // Standing, facing front. The face spans sx-3..sx+2, rows hy..hy+5.
  hairFront(R,L,sx,hy,sh){const[hr,hrD,hrL]=hairTones(L);
    switch(L.hairStyle){
      case 'long':case 'wavy':R(sx-3,hy-1,6,2,hr);R(sx-4,hy,1,9,hr);R(sx+3,hy,1,9,hrD);R(sx-3,hy+1,2,1,hr);R(sx+2,hy+1,1,2,hrD);R(sx-2,hy-1,2,1,hrL);
        if(L.hairStyle==='wavy'){R(sx-5,hy+3,1,2,hr);R(sx-5,hy+7,1,2,hr);R(sx+4,hy+5,1,2,hrD);}break;
      case 'bob':R(sx-3,hy-1,6,2,hr);R(sx-4,hy,1,7,hr);R(sx+3,hy,1,7,hrD);R(sx-5,hy+1,1,5,hr);R(sx+4,hy+1,1,5,hrD);R(sx-3,hy+1,5,1,hr);R(sx+2,hy+1,1,1,hrD);R(sx-2,hy-1,2,1,hrL);R(sx+1,hy,1,1,LOOK_CLIP);break;
      case 'ponytail':R(sx-3,hy-1,6,2,hr);R(sx-3,hy+1,1,1,hr);R(sx+2,hy+1,1,1,hrD);R(sx+3,hy,1,1,LOOK_TIE);R(sx+3,hy+1,1,4,hrD);R(sx+4,hy+2,1,4,hrD);R(sx-2,hy-1,2,1,hrL);break;
      case 'bun':R(sx-3,hy-1,6,2,hr);R(sx-3,hy+1,1,2,hr);R(sx+2,hy+1,1,2,hrD);R(sx-2,hy-3,4,2,hr);R(sx-1,hy-4,2,1,hr);R(sx-1,hy-3,1,1,hrL);break;
      case 'side':R(sx-3,hy-1,6,2,hr);R(sx-3,hy+1,3,1,hr);R(sx+2,hy+1,1,1,hrD);R(sx-3,hy-1,2,1,hrL);R(sx-1,hy-1,1,1,hrD);break;
      case 'quiff':R(sx-3,hy-1,6,2,hr);R(sx-2,hy-2,5,1,hr);R(sx-1,hy-3,3,1,hrL);R(sx-3,hy+1,1,1,hr);R(sx+2,hy+1,1,1,hrD);break;
      case 'buzz':R(sx-3,hy-1,6,1,hr);R(sx-3,hy,6,1,mix(hr,L.skin,0.45));break;
      case 'curly':R(sx-4,hy-1,8,2,hr);R(sx-3,hy-2,2,1,hr);R(sx,hy-2,2,1,hr);R(sx-4,hy+1,1,1,hr);R(sx+3,hy+1,1,1,hrD);R(sx-2,hy-1,1,1,hrL);R(sx+1,hy-1,1,1,hrL);break;
      case 'cap':{const c=capOf(sh);R(sx-3,hy+1,1,1,hr);R(sx+2,hy+1,1,1,hrD);R(sx-3,hy-2,6,2,c);R(sx-4,hy,8,1,shade(c,-15));R(sx-1,hy-2,2,1,shade(c,45));break;}
      default:R(sx-3,hy-1,6,2,hr);R(sx-3,hy+1,1,2,hr);R(sx+2,hy+1,1,1,hrD);R(sx-2,hy-1,2,1,hrL);}
  },
  // Standing, seen from behind: the back of the head; long hair falls over the upper back.
  hairBack(R,L,sx,hy,sh,sk){const[hr,hrD,hrL]=hairTones(L),st=L.hairStyle,ears=()=>{R(sx-4,hy+2,1,2,sk);R(sx+3,hy+2,1,2,sk);};
    if(st==='long'||st==='wavy'){R(sx-3,hy-1,6,1,hr);R(sx-4,hy,8,9,hr);R(sx+2,hy,2,9,hrD);R(sx-2,hy-1,2,1,hrL);
      if(st==='wavy'){R(sx-4,hy+9,1,1,hr);R(sx-1,hy+9,2,1,hr);R(sx+3,hy+9,1,1,hrD);}return;}
    if(st==='bob'){R(sx-3,hy-1,6,1,hr);R(sx-4,hy,8,7,hr);R(sx-5,hy+1,10,5,hr);R(sx+2,hy,2,7,hrD);R(sx+4,hy+1,1,5,hrD);R(sx-2,hy-1,2,1,hrL);R(sx+1,hy,1,1,LOOK_CLIP);return;}
    if(st==='curly'){R(sx-4,hy-1,8,6,hr);R(sx+2,hy-1,2,6,hrD);R(sx-3,hy-2,2,1,hr);R(sx,hy-2,2,1,hr);return;}
    if(st==='buzz'){R(sx-3,hy-1,6,3,hr);R(sx-3,hy+2,6,3,mix(hr,sk,0.45));ears();return;}
    R(sx-3,hy-1,6,6,hr);R(sx+1,hy-1,2,6,hrD);ears();
    if(st==='ponytail'){R(sx-1,hy+1,2,1,LOOK_TIE);R(sx-1,hy+2,2,6,hrD);R(sx,hy+8,1,1,hrD);}
    else if(st==='bun'){R(sx-2,hy-3,4,2,hr);R(sx-1,hy-4,2,1,hr);R(sx-1,hy-3,1,1,hrL);}
    else if(st==='quiff')R(sx-2,hy-2,4,1,hr);
    else if(st==='cap'){const c=capOf(sh);R(sx-3,hy-2,6,3,c);R(sx-1,hy+1,2,1,shade(c,-25));}
  },
  // Eyes, mouth, cheeks, beard (standing, facing front; drawn after the hair).
  face(R,L,sx,hy,sk,skD,blink,talk,glasses){const[hr,hrD]=hairTones(L),open='#7a3b2a';
    if(glasses){R(sx-3,hy+3,2,1,'#1a1a1a');R(sx+1,hy+3,2,1,'#1a1a1a');R(sx-1,hy+3,2,1,'#555');}
    else{R(sx-2,hy+3,1,1,blink?skD:'#1a1a1a');R(sx+1,hy+3,1,1,blink?skD:'#1a1a1a');}
    if(L.gender==='f'){R(sx-3,hy+4,1,1,mix(sk,LOOK_BLUSH,0.4));R(sx+2,hy+4,1,1,mix(skD,LOOK_BLUSH,0.3));R(sx-1,hy+5,2,1,talk?open:mix(sk,LOOK_LIPS,0.6));
      if(L.acc==='earrings'){R(sx-4,hy+4,1,1,LOOK_GOLD);R(sx+3,hy+4,1,1,shade(LOOK_GOLD,-40));}return;}
    R(sx-3,hy+4,1,1,shade(sk,-10));
    if(L.beard==='stubble'){R(sx-3,hy+4,6,2,mix(sk,hr,0.32));R(sx+2,hy+4,1,2,mix(skD,hr,0.32));}
    else if(L.beard==='full'){R(sx-3,hy+4,6,2,hr);R(sx+2,hy+4,1,2,hrD);R(sx-2,hy+6,4,1,hr);}
    else if(L.beard==='moustache')R(sx-2,hy+4,4,1,hr);
    R(sx-1,hy+5,2,1,talk?open:L.beard==='full'?shade(hr,-30):skD);
  },
  // The top over the plain torso (sx-4..sx+3, rows by-11..by-5). Returns the sleeve colour for the arms.
  top(R,L,sx,by,sh,sk,skD,front){const shD=shade(sh,-30),shL=shade(sh,30),ly=L.layer;
    if(ly&&!front){R(sx-4,by-11,8,7,ly);R(sx+2,by-11,2,7,shade(ly,-28));R(sx-4,by-11,1,7,shade(ly,20));return ly;}
    if(ly){R(sx-4,by-11,2,7,ly);R(sx+2,by-11,2,7,shade(ly,-28));R(sx-4,by-11,1,7,shade(ly,20));R(sx-2,by-11,1,2,shade(ly,14));R(sx+1,by-11,1,2,shade(ly,-40));}
    if(!front)return ly||sh;
    switch(L.top){
      case 'shirt':{const tie=mix(sh,'#1a1a2a',0.65);R(sx-2,by-11,1,1,'#f4f4f4');R(sx+1,by-11,1,1,'#f4f4f4');R(sx-1,by-11,2,1,tie);R(sx-1,by-10,2,3,tie);R(sx-1,by-7,1,1,tie);break;}
      case 'hoodie':R(sx-3,by-12,6,1,shD);R(sx-2,by-10,1,2,'#eeeeee');R(sx+1,by-10,1,2,'#eeeeee');R(sx-3,by-7,6,1,shD);break;
      case 'jacket':R(sx-1,by-11,2,1,'#f4f4f4');break;
      case 'blouse':R(sx-2,by-11,4,1,sk);R(sx-1,by-10,2,1,sk);R(sx-3,by-11,1,1,shL);R(sx+2,by-11,1,1,shL);break;
      case 'cardigan':R(sx-1,by-11,2,1,sk);R(sx-2,by-9,1,1,shade(ly,45));R(sx-2,by-7,1,1,shade(ly,45));break;
      case 'dress':R(sx-2,by-11,4,1,sk);R(sx-4,by-7,8,1,shade(sh,-55));break;
      default:R(sx-1,by-11,2,1,skD);if(L.gender==='f')R(sx-2,by-9,2,1,shL);}
    return ly||sh;
  },
  // Legs: trousers with a belt, or an A-line skirt with bare legs. l2 lifts the right foot (tapping).
  legs(R,L,sx,by,sh,l1,l2,front){const sk=L.skin,shoe=L.shoes;
    if(L.bottom!=='skirt'){const p=L.legs||'#2d3142';R(sx-3,by-4,2,4,p);R(sx+1,by-4,2,4,shade(p,-15));R(sx-3,by-1,2,1,shoe);R(sx+1,by-1-l2,2,1,shoe);
      if(front)R(sx-4,by-6,8,1,shade(p,-20));return;}
    const c=L.legs||sh,cD=shade(c,-28);
    R(sx-2,by-3+l1,1,2-l1,sk);R(sx+1,by-3+l2,1,2-l2,shade(sk,-20));R(sx-3,by-1,2,1,shoe);R(sx+1,by-1-l2,2,1,shoe);
    R(sx-4,by-6,8,2,c);R(sx-5,by-4,10,2,c);R(sx+2,by-6,2,2,cD);R(sx+2,by-4,3,2,cD);R(sx-5,by-3,7,1,shade(c,-12));
  },
  // On a stool or a chair: thighs forward, shins down.
  legsSit(R,L,sx,by,sh){const sk=L.skin,shoe=L.shoes;
    if(L.bottom!=='skirt'){const p=L.legs||'#2d3142';R(sx-3,by-5,2,3,p);R(sx+1,by-5,2,3,shade(p,-15));R(sx-3,by-2,2,5,p);R(sx+1,by-2,2,5,shade(p,-15));}
    else{const c=L.legs||sh;R(sx-2,by-2,1,5,sk);R(sx+1,by-2,1,5,shade(sk,-20));R(sx-4,by-5,8,3,c);R(sx+1,by-5,3,3,shade(c,-28));}
    R(sx-3,by+3,2,1,shoe);R(sx+1,by+3,2,1,shoe);
  },
  // At the desk, seen from behind (8×8 head at hy): what shows over the chair back.
  hairSeat(R,L,sx,hy,sh,sk){const[hr,hrD,hrL]=hairTones(L),st=L.hairStyle,ears=()=>{R(sx-5,hy+3,1,2,sk);R(sx+4,hy+3,1,2,sk);};
    if(st==='buzz'){const b=mix(hr,sk,0.4);R(sx-4,hy,8,8,b);R(sx+1,hy,3,8,shade(b,-14));R(sx-4,hy,8,2,hr);ears();return;}
    R(sx-4,hy,8,8,hr);R(sx+1,hy,3,8,hrD);R(sx-3,hy+1,2,1,hrL);
    if(st==='long'||st==='wavy'){R(sx-5,hy+2,1,9,hr);R(sx+4,hy+2,1,9,hrD);R(sx-4,hy+8,8,4,hr);R(sx+1,hy+8,3,4,hrD);
      if(st==='wavy'){R(sx-3,hy+12,2,1,hr);R(sx+1,hy+12,2,1,hrD);R(sx-6,hy+5,1,2,hr);}return;}
    if(st==='bob'){R(sx-5,hy+2,1,6,hr);R(sx+4,hy+2,1,6,hrD);R(sx-4,hy+8,8,1,hr);R(sx+1,hy+8,3,1,hrD);R(sx+2,hy+1,1,1,LOOK_CLIP);return;}
    if(st==='curly'){R(sx-5,hy+1,10,6,hr);R(sx+1,hy+1,4,6,hrD);R(sx-4,hy-1,2,1,hr);R(sx-1,hy-1,2,1,hr);R(sx+2,hy-1,2,1,hrD);return;}
    ears();
    if(st==='ponytail'){R(sx-1,hy+6,2,1,LOOK_TIE);R(sx-1,hy+7,2,5,hrD);R(sx-1,hy+12,1,1,hrD);}
    else if(st==='bun'){R(sx-2,hy-2,4,2,hr);R(sx-1,hy-3,2,1,hr);R(sx-2,hy-2,1,1,hrL);}
    else if(st==='quiff'){R(sx-3,hy-1,6,1,hr);R(sx-1,hy-2,3,1,hrL);}
    else if(st==='cap'){const c=capOf(sh);R(sx-4,hy,8,3,c);R(sx+1,hy,3,3,shade(c,-15));R(sx-1,hy+3,2,1,shade(c,-25));}
  },
  // At the desk, turned to the right (talking to a visitor, asking for approval): profile with the beard.
  hairProfile(R,L,sx,hy,sh,sk){const[hr]=hairTones(L),hrD=shade(hr,-26),st=L.hairStyle;
    R(sx-4,hy,8,8,hr);R(sx+1,hy+2,3,5,sk);R(sx+3,hy+3,1,1,'#1a1a1a');R(sx+1,hy,3,2,shade(hr,-12));
    if(st==='long'||st==='wavy'){R(sx-5,hy+2,1,9,hr);R(sx-4,hy+8,5,4,hr);}
    else if(st==='bob'){R(sx-5,hy+2,1,6,hr);R(sx-4,hy+8,4,1,hr);}
    else{R(sx-5,hy+3,1,2,sk);
      if(st==='ponytail'){R(sx-5,hy+2,1,1,LOOK_TIE);R(sx-6,hy+3,1,5,hrD);}
      else if(st==='bun')R(sx-6,hy+1,2,3,hr);
      else if(st==='cap'){const c=capOf(sh);R(sx-4,hy,8,2,c);R(sx+2,hy+2,4,1,shade(c,-15));}}
    if(L.gender==='f'){R(sx+3,hy+6,1,1,mix(sk,LOOK_LIPS,0.6));if(L.acc==='earrings')R(sx-1,hy+5,1,1,LOOK_GOLD);}
    else if(L.beard==='full'){R(sx,hy+5,4,2,hr);R(sx+3,hy+6,1,1,shade(hr,-30));}
    else if(L.beard==='stubble')R(sx+1,hy+5,3,2,mix(sk,hr,0.32));
    else if(L.beard==='moustache')R(sx+2,hy+5,2,1,hr);
  },
  // In the pond: wet hair and the beard above the water line (face at sx-3..sx+2, rows y0-11..y0-6).
  hairBath(R,L,sx,y0,sk){const[hr,hrD]=hairTones(L),st=L.hairStyle;
    R(sx-3,y0-12,6,2,hr);
    if(st==='long'||st==='wavy'){R(sx-4,y0-11,1,7,hr);R(sx+3,y0-11,1,7,hrD);}
    else if(st==='bob'){R(sx-4,y0-11,1,5,hr);R(sx+3,y0-11,1,5,hrD);}
    else if(st==='bun')R(sx-2,y0-14,3,2,hr);
    else if(st==='ponytail')R(sx+3,y0-11,1,4,hrD);
    else if(st==='quiff')R(sx-2,y0-13,4,1,hr);
    if(L.gender==='f')R(sx-1,y0-6,2,1,mix(sk,LOOK_LIPS,0.6));
    else if(L.beard==='full'){R(sx-3,y0-7,6,2,hr);R(sx-2,y0-5,4,1,hr);}
    else if(L.beard==='stubble')R(sx-3,y0-7,6,2,mix(sk,hr,0.32));
    else if(L.beard==='moustache')R(sx-2,y0-7,4,1,hr);
  },
};
const SHIRT=['#e5484d','#3e8ed0','#46a758','#f5a524','#8e4ec6','#12a594','#e93d82','#5b5bd6','#ff8b3d','#2f9ab8','#9b7b4f','#6a7bd8'];
const TOOLS=[['Read','Header.tsx'],['Edit','routes.ts'],['Bash','npm test'],['Grep','useSession'],['Write','CHANGELOG.md'],['Bash','git diff'],['Glob','**/*.test.ts'],['WebFetch','docs.anthropic.com'],['TodoWrite','4 tasks'],['Edit','package.json'],['Bash','tsc --noEmit'],['Read','schema.prisma']];
const TALK=tr('office.sim.talkTopics');
const PERM=['Bash: rm -rf dist','Bash: git push','Write: .env','Bash: npm publish'];
const ERRS=['test failed (3)','ENOENT config.json','tsc: 2 errors','exit code 1'];
const ST={working:[tr('office.status.working'),'#3e8ed0'],thinking:[tr('office.status.thinking'),'#5b8def'],talking:[tr('office.status.talking'),'#12a594'],waiting:[tr('office.status.waiting'),'#8e4ec6'],permission:[tr('office.status.permission'),'#f5a524'],error:[tr('office.status.error'),'#e5484d'],idle:[tr('office.status.idle'),'#8b8fa3'],done:[tr('office.status.done'),'#46a758'],entering:[tr('office.status.entering'),'#8b8fa3'],leaving:[tr('office.status.leaving'),'#8b8fa3']};
const ICON={
  permission:['..#..','..#..','..#..','.....','..#..'], error:['#...#','.#.#.','..#..','.#.#.','#...#'],
  done:['....#','...#.','#.#..','.#...','.....'], idle:['####.','..#..','.#...','####.','.....'],
  waiting:['#####','.###.','..#..','.###.','#####'], talking:['#####','#...#','#####','.#...','....#']
};
const shade=(hh,p)=>{if(!hh||hh[0]!=='#'||hh.length!==7)return hh;const n=parseInt(hh.slice(1),16),c=v=>Math.max(0,Math.min(255,v));return'#'+((1<<24)+(c((n>>16)+p)<<16)+(c(((n>>8)&255)+p)<<8)+c((n&255)+p)).toString(16).slice(1);};
// Màu của bàn trống: khử bão hoà rồi chỉnh độ sáng. Tính sẵn bằng màu thay cho ctx.filter — filter trên canvas
// bắt Chrome dựng một layer riêng cho từng lệnh vẽ và kéo cả trang xuống ~1 FPS.
const greyHex=(hh,sat,bri)=>{if(!hh||hh[0]!=='#'||hh.length!==7)return hh;const n=parseInt(hh.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255,l=0.299*r+0.587*g+0.114*b,c=v=>Math.max(0,Math.min(255,Math.round((v+(l-v)*sat)*bri)));return'#'+((1<<24)+(c(r)<<16)+(c(g)<<8)+c(b)).toString(16).slice(1);};
const VACANT_CACHE=new Map();
const vacantTheme=th=>{const key=JSON.stringify(th);let v=VACANT_CACHE.get(key);if(v)return v;const sat=th.stroke?0.9:0.85,bri=th.stroke?1.08:0.7;v={};for(const k in th)v[k]=typeof th[k]==='string'?greyHex(th[k],sat,bri):th[k];v._metal=greyHex(th.stroke?'#ffffff':'#2d3142',sat,bri);v._mouse=greyHex(th.stroke?'#ffffff':'#d9dbe2',sat,bri);if(VACANT_CACHE.size>64)VACANT_CACHE.clear();VACANT_CACHE.set(key,v);return v;};
const FONT={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110','·':'000000010000000','/':'001001010100100','%':'101001010100101','-':'000000111000000','_':'000000000000111','.':'000000000000010'};
// Rows of a 3×5 FONT letter for the restroom's sign and floor paint, plus Ữ and Ả with their marks above (7 rows).
const RESTROOM_GLYPH=ch=>{if(ch==='\u1EEE')return['.##.','##..','#.##','#.#.','#.#.','#.#.','###.'];if(ch==='\u1EA2')return['##.','.#.','.#.','#.#','###','#.#','#.#'];
  const f=FONT[ch];if(!f)return[];const r=[];for(let i=0;i<5;i++)r.push(f.slice(i*3,i*3+3).replace(/1/g,'#').replace(/0/g,'.'));return r;};
function text3(ctx,str,x,y,col){ctx.fillStyle=col;x=Math.round(x);y=Math.round(y);[...String(str).toUpperCase()].forEach((ch,i)=>{const f=FONT[ch];if(!f)return;for(let b=0;b<15;b++)if(f[b]==='1')ctx.fillRect(x+i*4+(b%3),y+Math.floor(b/3),1,1);});}
const pick=a=>a[Math.floor(Math.random()*a.length)];
const rnd=(a,b)=>a+Math.random()*(b-a);
const clock=()=>new Date().toTimeString().slice(0,8);
const fmtK=n=>n>=1000?(n/1000).toFixed(1)+'k':String(n);
const shortOf=s=>(s||'???').replace(/[^a-z0-9]/gi,'').slice(0,3).toUpperCase()||'S';
const cwdKey=s=>{if(!s||s==='—')return null;const p=s.replace(/\/+$/,'').split('/');const last=p[p.length-1];if(last==='scratchpad'||s.includes('/tmp/claude-')){const m=s.match(/tmp\/claude-\d+\/-([^/]+)/);if(m){const parts=m[1].split('-');return parts[parts.length-1]||null;}return null;}return last||null;};

function bfs(from,to){
  // Office floor cells avoid furniture; lawn cells come from the island's walkable set; the two only meet at the stairs.
  // Out on the lawn grass costs more than the garden path, so agents keep to the path unless it is a long way round.
  // The restroom block is floor like the office: walked from the pantry beside it, never stepped onto from the lawn.
  const key=p=>p[0]+','+p[1], inside=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
  const ok=(x,y)=>{const k=x+','+y;return inside(x,y)?!BLOCK.has(k):WC.floorSet.has(k)?WC_WALK.has(k):LAWN_WALK.has(k);};
  const canStep=(c,n)=>{if(EDGE.has(key(c)+'|'+key(n)))return false;const s=RestroomLogic.step(WC,c,n,inside);
    if(s===false||(s===null&&!SkyLogic.canCross(c,n,W,H,STAIRS)))return false;return ok(n[0],n[1])||(n[0]===to[0]&&n[1]===to[1]);};
  return SkyLogic.cheapestPath(from,to,canStep,n=>inside(n[0],n[1])||WC.floorSet.has(key(n))||ISLAND.paths.cells.has(key(n))||PAVED.has(key(n))?1:SkyLogic.GRASS_COST);
}

class ClaudeOffice extends React.Component{
  constructor(props){
    super(props);
    const params=new URLSearchParams(location.search);
    // Over https the page never reads ?server=: a crafted link must not point a hosted page at another host.
    const secure=location.protocol==='https:';
    const srv=params.get('server')||location.host||'localhost:4317';
    const ep=secure?location.origin+'/events':srv.includes('/events')?srv:(srv.startsWith('http')?srv:('http://'+srv))+'/events';
    // Reading localStorage itself can throw (blocked site data), so the storage handle is fetched defensively too.
    try{this.storage=window.localStorage;}catch(e){this.storage=null;}
    const ws=SkyLogic.loadWeatherSettings(this.storage);
    this.state={sel:null,paused:false,tick:0,live:'off',
      dataSource:'live',endpoint:ep,asOthers:false,agentCount:6,speed:1,bubbleMode:this.loadBubbleMode(),autoApprove:false,showSettings:false,
      weatherMode:ws.mode,city:ws.city,cityDraft:ws.city,realStatus:{state:'idle',text:''}};
    this.dogWorld={...DOG_PLACES,agents:[],hour:12,snow:0,calm:false,now:0,rand:Math.random};this.dogs=DogLogic.create(this.dogWorld);this.dogSprites=new Map();
    this.agents=[];this.seq=0;this.bubbleEls={};this.usedLooks=0;this.last=0;this.seasonKey='default';this.goneSids=new Set();this.depts=new Map();
    this.setCanvas=el=>{this.canvas=el;};
    this.setStage=el=>{this.stageEl=el;};
    this.setBack=el=>{this.backCanvas=el;};this.setFront=el=>{this.frontCanvas=el;};this.setWrap=el=>{this.wrapEl=el;};
    // Weather: this.wx is the SkyLogic transition state; snow (lawn cover) and flash (lightning) are 0..1.
    this.wx={...SkyLogic.initialWeather('clear',Date.now()),nextAt:Date.now()+SkyLogic.changeDelayMs(Math.random())};
    this.snow=0;this.snowShown=0;this.flash=0;this.flashStart=0;this.flashMs=0;this.nextFlashAt=0;this.preview=null;this.lastSky=Date.now();
    this.reducedMq=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
    // Phones (narrow, or a phone on its side) get a compact header: one row of controls plus one sideways-scrolling strip,
    // so the island keeps the height. render() runs every 300 ms (uiTimer), so it simply reads the query each time.
    this.narrowMq=window.matchMedia?window.matchMedia('(max-width: 640px), (max-height: 520px)'):null;
    // Camera: drag pans, wheel/trackpad pinch zooms about the cursor, two fingers pinch-zoom (CameraLogic). kZoom is the zoom the canvas resolution
    // follows; it catches up 150 ms after the last wheel tick so the island bitmap is not re-baked on every tick.
    this.cam={z:1,tx:0,ty:0};this.kZoom=1;this.drag=null;this.dragged=false;
    this.onClick=e=>{if(this.dragged){this.dragged=false;return;}const a=this.hit(e);this.setState({sel:a?a.id:null});};
    this.onMove=e=>{if(this.drag)return;const a=this.hit(e);e.currentTarget.style.cursor=a?'pointer':'grab';this.hoverId=a?a.id:null;};
    this.onLeave=()=>{this.hoverId=null;};
    this.bubbleMem=new Map();
    // Only the island and the open sky react; panels, buttons and the settings form keep their own wheel and clicks.
    this.onScene=e=>e.target===this.stageEl||e.target===this.backCanvas||(this.wrapEl&&this.wrapEl.contains(e.target));
    this.onWheel=e=>{if(!this.onScene(e)||!e.deltaY)return;e.preventDefault();
      const r=this.stageEl.getBoundingClientRect(),b=this.camBox();if(!b)return;
      this.setCam(CameraLogic.zoomAt(this.cam,e.clientX-r.left,e.clientY-r.top,CameraLogic.wheelFactor(e),b));};
    // Every pointer down on the scene is tracked (stage px). With a second finger down the one-finger drag stops and
    // the view follows CameraLogic.pinch until a finger lifts; the finger left behind does nothing until a new touch.
    this.pts=new Map();this.pinchAt=null;
    this.stagePt=e=>{const r=this.stageEl.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    this.onDown=e=>{if(e.button!==0||!this.onScene(e))return;this.dragged=false;
      if(e.isPrimary)this.pts.clear();
      this.pts.set(e.pointerId,this.stagePt(e));
      if(this.pts.size===2){const ids=[...this.pts.keys()];this.pinchAt={cam:this.cam,ids,a:this.pts.get(ids[0]),b:this.pts.get(ids[1])};this.drag=null;
        for(const id of ids)try{this.stageEl.setPointerCapture(id);}catch(_){}return;}
      if(this.pts.size>2)return;
      this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx:this.cam.tx,ty:this.cam.ty,on:false};};
    this.onDrag=e=>{if(this.pts.has(e.pointerId))this.pts.set(e.pointerId,this.stagePt(e));
      const p=this.pinchAt;
      if(p){if(!p.ids.includes(e.pointerId))return;const b=this.camBox();if(!b)return;this.dragged=true;
        this.setCam(CameraLogic.pinch(p.cam,p.a,p.b,this.pts.get(p.ids[0]),this.pts.get(p.ids[1]),b));return;}
      const d=this.drag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;
      if(!d.on){if(!CameraLogic.isDrag(dx,dy))return;d.on=true;try{this.stageEl.setPointerCapture(d.id);}catch(_){}this.setDragCursor('grabbing');}
      const b=this.camBox(),[ox,oy]=CameraLogic.dragOffset(dx,dy);if(b)this.setCam(CameraLogic.panBy({z:this.cam.z,tx:d.tx,ty:d.ty},ox,oy,b));};
    this.onUp=e=>{this.pts.delete(e.pointerId);
      const p=this.pinchAt;if(p&&p.ids.includes(e.pointerId)){this.pinchAt=null;setTimeout(()=>{this.dragged=false;},0);return;}
      const d=this.drag;if(!d||e.pointerId!==d.id)return;this.drag=null;
      if(d.on){this.dragged=true;setTimeout(()=>{this.dragged=false;},0);this.setDragCursor('grab');}};
    this.setDragCursor=c=>{for(const el of[this.canvas,this.backCanvas])if(el)el.style.cursor=c;};
  }

  componentDidMount(){
    this.boot();
    const st=this.stageEl;if(st){st.addEventListener('wheel',this.onWheel,{passive:false});st.addEventListener('pointerdown',this.onDown);
      st.addEventListener('pointermove',this.onDrag);st.addEventListener('pointerup',this.onUp);st.addEventListener('pointercancel',this.onUp);
      // A resized window changes the fitted layout; pull the view back inside the new limits.
      if(window.ResizeObserver){this.ro=new ResizeObserver(()=>{const b=this.camBox();if(b)this.setCam(CameraLogic.clamp(this.cam,b));});this.ro.observe(st);}}
    this.simTimer=setInterval(()=>this.simTick(),250);
    this.uiTimer=setInterval(()=>{if(performance.now()-(this.lastFrame||0)>200)this.frame(performance.now());this.setState(s=>({tick:s.tick+1}));},300);
    this.last=performance.now();
    setTimeout(()=>this.frame(performance.now()),0);
    const loop=t=>{this.lastFrame=performance.now();this.frame(t);this.raf=requestAnimationFrame(loop);};
    this.raf=requestAnimationFrame(loop);
    window.__sky={preview:type=>this.previewWeather(type),state:()=>({to:this.wx.to,fx:SkyLogic.weatherFx(this.wx,Date.now()),snow:this.snow,snowShown:this.snowShown,flash:this.flash})};
    window.__dogs={dogs:this.dogs,world:this.dogWorld};
    if(this.state.weatherMode==='real')this.refreshReal();
    this.realTimer=setInterval(()=>{if(this.state.weatherMode==='real')this.refreshReal();},REAL_WEATHER_EVERY_MS);
  }
  componentWillUnmount(){const st=this.stageEl;if(st){st.removeEventListener('wheel',this.onWheel);st.removeEventListener('pointerdown',this.onDown);st.removeEventListener('pointermove',this.onDrag);st.removeEventListener('pointerup',this.onUp);st.removeEventListener('pointercancel',this.onUp);}
    this.ro&&this.ro.disconnect();clearTimeout(this.kTimer);clearInterval(this.simTimer);clearInterval(this.uiTimer);clearInterval(this.realTimer);cancelAnimationFrame(this.raf);this.es&&this.es.close();
    clearInterval(this.previewTimer);clearTimeout(this.joinTimer);clearTimeout(this.armTimer);clearTimeout(this.wcTimer);this.world&&this.world.es&&this.world.es.close();if(this.onWorldKey)window.removeEventListener('keydown',this.onWorldKey);
    if(this.world){clearTimeout(this.world.probeTimer);clearTimeout(this.world.meTimer);clearTimeout(this.world.waitTimer);}
    if(this.onWorldVisible)document.removeEventListener('visibilitychange',this.onWorldVisible);}
  // ---- weather settings ----
  setWeather(patch){
    this.setState(patch,()=>{
      SkyLogic.saveWeatherSettings(this.storage,{mode:this.state.weatherMode,city:this.state.city});
      if(this.state.weatherMode==='real'&&(patch.weatherMode==='real'||'city'in patch))this.refreshReal();
      if(this.state.weatherMode!=='real')this.setState({realStatus:{state:'idle',text:''}});
    });
  }
  async refreshReal(){
    const city=this.state.city,seq=(this.realSeq=(this.realSeq||0)+1);
    this.setState({realStatus:{state:'loading',text:tr('weather.status.loading')}});
    const r=await SkyLogic.fetchRealWeather(city,url=>fetch(url));
    if(seq!==this.realSeq||this.state.weatherMode!=='real')return;// a newer request or a mode change won
    if(r.ok){
      if(this.preview)this.preview={...this.preview,back:r.type};// the real weather takes over when the preview ends
      else if(this.wx.to!==r.type)this.wx=SkyLogic.startTransition(this.wx,r.type,Date.now(),SkyLogic.transitionMs(Math.random()));
      this.setState({realStatus:{state:'ok',text:tr('weather.status.following',{place:r.place,weather:WEATHER_LABEL[r.type]})}});
    }else this.setState({realStatus:{state:'error',text:tr('weather.status.fallback',{reason:r.reason})}});
  }
  // Called every frame: Random steps its schedule, Off settles on clear, Real follows refreshReal (or Random while it fails).
  stepWeather(now){
    const mode=this.state.weatherMode;
    if(mode==='random'||(mode==='real'&&this.state.realStatus.state==='error'))this.wx=SkyLogic.stepRandom(this.wx,now,new Date(now).getMonth(),Math.random);
    else if(mode==='off'&&this.wx.to!=='clear')this.wx=SkyLogic.startTransition(this.wx,'clear',now,SkyLogic.transitionMs(Math.random()));
  }
  componentDidUpdate(_,ps){
    if(ps.dataSource!==this.state.dataSource||ps.endpoint!==this.state.endpoint||ps.asOthers!==this.state.asOthers){this.startSource();return;}
    if(!this.isLive&&ps.agentCount!==this.state.agentCount){
      const n=this.state.agentCount, live=this.agents.filter(a=>!a.leaving&&!a.parent);
      for(let i=live.length;i<n;i++)this.addAgent({});
      live.slice(n).forEach(a=>this.leave(a));
    }
  }
  get isLive(){return this.state.dataSource==='live';}
  get speed(){return this.state.speed||1;}
  get season(){return this.seasonKey&&this.seasonKey!=='default'?this.seasonKey:(window.SeasonTree?window.SeasonTree.seasonFor():'default');}
  get treeOn(){return this.season!=='default';}
  get theme(){const f=dayFactor();if(f<=0)return Object.assign({_day:0},THEMES.night);if(f>=1)return Object.assign({_day:1},THEMES.day);return lerpTheme(f);}

  startSource(){
    this.es&&this.es.close();this.es=null;this.agents=[];this.goneSids=new Set();this.depts=new Map();this.firstSnap=true;
    this.stopOthers();
    if(this.isLive){
      const url=this.state.endpoint||'http://localhost:4317/events';
      this.setState({live:'connecting',sel:null});
      try{
        const es=new EventSource(url);this.es=es;
        es.onopen=()=>this.setState({live:'ok'});
        es.onerror=()=>this.setState({live:'error'});
        es.onmessage=e=>{if(this.state.asOthers)return;try{this.syncLive(JSON.parse(e.data));this.state.live!=='ok'&&this.setState({live:'ok'});}catch(err){}};
      }catch(e){this.setState({live:'error'});}
      if(this.state.asOthers)this.pollOthers();
    }else{
      this.setState({live:'off',sel:null});
      const n=this.state.agentCount;for(let i=0;i<n;i++)this.addAgent({seated:true});
    }
  }

  // "Xem như người khác": the island is fed from the same public view the hub would get (Kín or Cơ bản) instead of the
  // full local stream, so the owner sees exactly what others see. Polled once a second; stale answers are dropped.
  stopOthers(){clearInterval(this.othersTimer);this.othersTimer=null;this.othersGen=(this.othersGen||0)+1;this.raw=new Map();this.noUsage=false;}
  pollOthers(){
    const gen=this.othersGen;this.noUsage=true;// the hub view carries no 5H / 7D usage, so the wall bars go off like in the world
    const tick=()=>fetch('/api/public-preview',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{
      if(gen!==this.othersGen||!d||!d.view||!Array.isArray(d.view.sessions))return;
      const ss=WorldLogic.clientSessions(d.view.sessions);
      this.raw=new Map(ss.map(x=>[x.id,x]));
      this.syncLive({sessions:ss});
      const sh=d.share==='co-ban'?'co-ban':'kin';
      if(this.state.othersShare!==sh)this.setState({othersShare:sh});});
    tick();this.othersTimer=setInterval(tick,1000);
  }

  dept(key,label){
    if(!this.depts.has(key))this.depts.set(key,{key,label:label||shortOf(key),color:DEPT_PAL[this.depts.size%DEPT_PAL.length],n:0});
    return this.depts.get(key);
  }
  colOwners(){
    const cnt=[0,1,2,3].map(()=>Object.create(null));// keys are project names, possibly other people's ("__proto__")
    this.agents.forEach(a=>{if(a.gone||a.leaving)return;const c=colOf(a.desk);if(c<4)cnt[c][a.dept]=(cnt[c][a.dept]||0)+1;});
    return cnt.map(o=>{let best=null,b=0;for(const k in o)if(o[k]>b){b=o[k];best=k;}return best;});
  }
  freeDeskFor(dk){
    const used=new Set(this.agents.map(a=>a.desk)), own=this.colOwners();
    const free=DESKS.map((_,i)=>i).filter(i=>!used.has(i));
    return free.find(i=>own[colOf(i)]===dk) ?? free.find(i=>own[colOf(i)]==null) ?? free[0] ?? -1;
  }
  freeDesk(){const used=new Set(this.agents.map(a=>a.desk));for(let i=0;i<DESKS.length;i++)if(!used.has(i))return i;return -1;}

  addAgent({seated,parent,live,deptKey}){
    let dk;
    if(parent)dk=parent.dept;
    else if(live){const p=live.parentId&&this.agents.find(x=>x.sid===live.parentId);const own=live.project||cwdKey(live.cwd)||live.name;dk=p?p.dept:(own?this.dept(own):this.dept(tr('office.dept.other'),tr('office.dept.otherShort'))).key;}
    else{dk=deptKey;if(!dk){const c=SIM_DEPTS.map(([k,l])=>[this.dept(k,l),this.agents.filter(a=>a.dept===k&&!a.leaving&&!a.parent).length]);const min=Math.min(...c.map(x=>x[1]));const pool=c.filter(x=>x[1]<=min+1);dk=pick(pool)[0].key;}}
    const Dp=this.dept(dk);
    const desk=parent?parent.desk:this.freeDeskFor(dk);if(desk<0)return null;
    const num=parent?0:++Dp.n;
    const d=DESKS[desk],id=++this.seq,now=Date.now();
    // Man or woman and the whole look come from the session id (PeopleLogic), so a reload never changes anyone.
    const sid=live?live.id:'sess_'+Math.random().toString(36).slice(2,10),look=PeopleLogic.look(sid);
    const a={id,desk,parent:parent?parent.id:null,
      dept:dk,name:live?(live.name||dk)+(parent||live.parentId?' · sub-agent':''):(parent?parent.short.toLowerCase()+'-subagent':dk+' #'+num),
      short:parent?parent.short.slice(0,3)+'·':Dp.label+(num||''),
      gender:look.gender,look,skin:look.skin,hair:look.hair,acc:look.acc,pants:look.legs,shirt:Dp.color,
      sid,
      model:live?(live.model||'—'):(Math.random()<0.6?'claude-sonnet':'claude-opus'),
      cwd:live?(live.cwd||'—'):'~/code/'+dk,
      status:(seated&&!parent)?'working':'entering',tool:pick(TOOLS),msg:'',target:null,
      tokens:Math.floor(rnd(2000,40000)),hist:[],until:now+rnd(500,4000),
      jobs:parent?Math.floor(rnd(2,5)):0,leaving:false,sleeping:false,
      x:(seated&&!parent)?d.gx+1:DOOR.pt[0],y:(seated&&!parent)?d.gy+1.45:DOOR.pt[1],path:[],goalKey:(seated&&!parent)?'seat':null,moving:false,dirFront:true,seated:!parent&&!!seated,
      idleSpot:null,stool:false,actNow:null};
    this.agents.push(a);
    this.log(a,parent?tr('office.log.spawnedBy',{parent:parent.short}):(seated?tr('office.log.running'):tr('office.log.sessionStarted')));
    return a;
  }
  log(a,text){a.hist.unshift({t:clock(),text});if(a.hist.length>7)a.hist.pop();}
  byId(id){return this.agents.find(a=>a.id===id);}
  leave(a){if(a.leaving)return;a.leaving=true;a.status='leaving';this.log(a,tr('office.log.sessionEnded'));}
  setWork(a){a.status='working';a.target=null;a.tool=pick(TOOLS);a.until=Date.now()+rnd(2500,6500)/this.speed;this.log(a,a.tool[0]+' · '+a.tool[1]);}

  simTick(){
    if(this.state.paused||this.isLive)return;
    const now=Date.now(),sp=this.speed;
    for(const a of [...this.agents]){
      if(a.leaving)continue;
      if(a.status==='working')a.tokens+=Math.floor(rnd(20,120));
      if(a.status==='entering'){if(a.seated)this.setWork(a);continue;}
      if(a.waitSub){const s=this.byId(a.waitSub);if(!s||s.leaving){a.waitSub=null;this.log(a,tr('office.log.subagentReturned'));this.setWork(a);}continue;}
      if(now<a.until)continue;
      const s=a.status;
      if(s==='talking'||s==='waiting'){this.log(a,tr('office.log.backToDesk'));this.setWork(a);continue;}
      if(s==='permission'){this.log(a,this.state.autoApprove?tr('office.log.autoApproved'):tr('office.log.approvalTimedOut'));this.setWork(a);continue;}
      if(s==='error'){this.log(a,tr('office.log.fixAndRetry'));this.setWork(a);continue;}
      if(a.parent){
        if(s==='done'){this.leave(a);continue;}
        if(--a.jobs<=0){a.status='done';a.until=now+2200/sp;this.log(a,tr('office.log.doneReportTo',{parent:(this.byId(a.parent)||{}).short}));continue;}
      }
      const all=this.agents.filter(o=>o!==a&&!o.leaving&&o.status!=='entering'), mates=all.filter(o=>o.dept===a.dept);
      const others=mates.length&&Math.random()<0.55?mates:all;
      const r=Math.random();
      if(r<0.36)this.setWork(a);
      else if(r<0.48){a.status='thinking';a.until=now+rnd(2000,4000)/sp;}
      else if(r<0.61&&others.length&&!a.parent){const t=pick(others);a.status='talking';a.target=t.id;a.msg=pick(TALK);a.until=now+rnd(7000,10000)/sp;this.log(a,tr('office.log.visitDesk',{name:t.short,topic:a.msg}));}
      else if(r<0.68&&others.length&&!a.parent){const t=pick(others);a.status='waiting';a.target=t.id;a.msg=tr('office.sim.waitOutput',{name:t.short});a.until=now+rnd(8000,12000)/sp;this.log(a,tr('office.log.goWait',{name:t.short}));}
      else if(r<0.75){a.status='permission';a.msg=pick(PERM);a.until=now+(this.state.autoApprove?2500:14000)/sp;this.log(a,tr('office.log.askPermission',{request:a.msg}));}
      else if(r<0.81){a.status='error';a.msg=pick(ERRS);a.until=now+2600/sp;this.log(a,tr('office.log.error',{error:a.msg}));}
      else if(r<0.87){a.status='idle';a.until=now+rnd(9000,15000)/sp;}
      else if(r<0.92){a.status='done';a.until=now+2500/sp;this.log(a,tr('office.log.taskDone'));}
      else if(!a.parent&&this.agents.filter(o=>o.parent&&!o.leaving).length<3&&this.freeDesk()>=0)this.spawnSub(a);
      else this.setWork(a);
    }
  }
  spawnSub(a){
    const sub=this.addAgent({parent:a});if(!sub)return this.setWork(a);
    a.status='waiting';a.target=sub.id;a.waitSub=sub.id;a.msg=tr('office.sim.waitSubagent',{name:sub.short});a.tool=['Task','spawn sub-agent'];
    this.log(a,'Task → spawn sub-agent');
  }

  syncLive(snap){if(snap.usage)this.usage=snap.usage;if(snap.version)this.serverVersion=snap.version;
    const list=((snap&&snap.sessions)||[]).slice().sort((a,b)=>(!a.parentId?0:1)-(!b.parentId?0:1));
    const seen=new Set();
    for(const s of list){
      seen.add(s.id);
      if(this.goneSids.has(s.id)){seen.add(s.id);continue;}
      let a=this.agents.find(x=>x.sid===s.id&&!x.leaving);
      if(!a){if(this.agents.some(x=>x.sid===s.id&&x.leaving)){seen.add(s.id);continue;}
        let par=null;if(s.parentId){par=this.agents.find(x=>x.sid===s.parentId&&!x.leaving);}
        a=this.addAgent({seated:this.firstSnap&&!par,parent:par,live:s});if(!a)continue;
        if(this.firstSnap&&par){const d=DESKS[par.desk];a.x=d.gx+2.45;a.y=d.gy+0.55;a.moving=false;a.path=[];a.goalKey='sub'+a.parent+'-0';}
      }
      if(s.parentId){const p=this.agents.find(x=>x.sid===s.parentId);if(p){a.parent=p.id;if(a.desk!==p.desk){a.desk=p.desk;a.goalKey=null;}}}
      a.status=ST[s.status]?s.status:'working';a.tool=[s.tool||'',s.detail||''];a.msg=s.detail||'';
      a.tokens=s.tokens||0;a.model=s.model||a.model;a.cwd=s.cwd||a.cwd;a.name=s.name||a.name;
      a.liveHist=s.recent||null;
      const t=s.waitingOn&&this.agents.find(x=>x.sid===s.waitingOn);
      a.target=t?t.id:null;
      if(a.status==='talking'&&s.talkingTo){const tgt=this.agents.find(x=>!x.leaving&&(x.name===s.talkingTo||x.short===s.talkingTo||x.sid===s.talkingTo));if(tgt)a.target=tgt.id;}
      if(a.status==='waiting'&&!a.target)a.status='working';
      if(a.parent&&s.status==='done'){if(!a.doneAt)a.doneAt=Date.now();else if(Date.now()-a.doneAt>3000)this.leave(a);}else a.doneAt=0;
    }
    this.agents.forEach(a=>{if(!seen.has(a.sid))this.leave(a);});
    for(const sid of this.goneSids)if(!seen.has(sid))this.goneSids.delete(sid);
    this.firstSnap=false;
  }

  goalFor(a){
    if(a.leaving)return{key:'exit',tile:DOOR.tile,pt:DOOR.pt};
    if(a.parent){
      const p=this.byId(a.parent),d=DESKS[p?p.desk:a.desk];
      const subs=this.agents.filter(o=>!o.leaving&&o.parent===a.parent);
      const slot=Math.max(0,subs.indexOf(a));
      const baseSpots=[[[d.gx+2,d.gy],[d.gx+2.45,d.gy+0.55]],[[d.gx+2,d.gy+1.2],[d.gx+2.45,d.gy+1.7]],[[d.gx+0.8,d.gy+2.2],[d.gx+1.3,d.gy+2.6]],[[d.gx+2,d.gy+2.2],[d.gx+2.45,d.gy+2.7]],[[d.gx-0.2,d.gy+2.2],[d.gx+0.3,d.gy+2.6]]];
      const si=slot%baseSpots.length,row=Math.floor(slot/baseSpots.length);
      const s=baseSpots[si];
      return{key:'sub'+a.parent+'-'+slot,tile:[s[0][0],s[0][1]+row*1.2],pt:[s[1][0],s[1][1]+row*1.2]};
    }
    const t=(a.status==='talking'||a.status==='waiting')&&a.target&&this.byId(a.target);
    if(t&&!t.leaving&&t.parent!==a.id){
      const d=DESKS[t.desk];
      const visitors=this.agents.filter(o=>!o.leaving&&o.target===t.id&&(o.status==='talking'||o.status==='waiting')&&o.parent!==t.id);
      const slot=Math.max(0,visitors.indexOf(a))%3;
      const spots=[[[d.gx+2,d.gy],[d.gx+2.45,d.gy+0.55]],[[d.gx+2,d.gy+1],[d.gx+2.45,d.gy+1.5]],[[d.gx+2,d.gy+2],[d.gx+2.4,d.gy+2.3]]];
      return{key:'visit'+t.id+'-'+slot,tile:spots[slot][0],pt:spots[slot][1]};
    }
    const d=DESKS[a.desk];
    if(a.status!=='idle'){a.idleSpot=null;a.wcDone=false;}
    else if(!a.leaving){
      const taken=new Set(this.agents.filter(o=>o!==a&&!o.leaving&&o.status==='idle'&&o.idleSpot!=null).map(o=>o.idleSpot));
      // A restroom visit is short: once it is over the person moves on, and does not go back while still idle.
      if(a.idleSpot!=null&&IDLE_SPOTS[a.idleSpot].act==='wc'&&RestroomLogic.visit(a.wcT||0)==='done'){a.idleSpot=null;a.wcDone=true;}
      // Men use WC NAM and women WC NỮ (RestroomLogic.roomOf); about one idle choice in four is a free stall there.
      if(a.idleSpot==null||taken.has(a.idleSpot)){const free=IDLE_SPOTS.map((_,i)=>i).filter(i=>!taken.has(i));
        a.idleSpot=RestroomLogic.pickIdle(IDLE_SPOTS,free,a.wcDone?null:RestroomLogic.roomOf(a),Math.random);}
      if(a.idleSpot!=null){const sp=IDLE_SPOTS[a.idleSpot];
        // After the stall comes the vanity: same visit, so the visit clock keeps running (keepWc).
        if(sp.act==='wc'&&RestroomLogic.visit(a.wcT||0)==='wash')return{key:'wash'+a.idleSpot,tile:sp.wash.tile,pt:sp.wash.pt,spot:sp,keepWc:true};
        return{key:'idle'+a.idleSpot,tile:sp.tile,pt:sp.pt,stool:sp.stool||0,spot:sp};}
    }
    if(a.status==='idle')return{key:'sleep',tile:[d.gx,d.gy+1],pt:[d.gx+0.75,d.gy+0.62]};
    return{key:'seat',tile:[d.gx,d.gy+1],pt:[d.gx+1,d.gy+1.45]};
  }
  updateAgent(a,dt){
    if(a.status!=='idle'&&a.sleeping){
      const d=DESKS[a.desk];a.sleeping=false;a.x=d.gx+1;a.y=d.gy+1.45;a.seated=true;a.moving=false;a.path=[];a.goalKey='seat';
    }
    if(a.sleeping)return;
    const g=this.goalFor(a);
    if(g.key!==a.goalKey){
      a.goalKey=g.key;a.seated=false;a.sleeping=false;a.stool=false;a.actNow=null;a.wcIn=false;if(!g.keepWc)a.wcT=0;
      // Out on the lawn or in the restroom block an agent paths from where it stands; anywhere else (e.g. just in
      // through the door) it starts inside.
      const fx=Math.floor(a.x),fy=Math.floor(a.y),fk=fx+','+fy;
      const cur=(LAWN_WALK.has(fk)||WC.floorSet.has(fk))&&fx>=0&&fy>=0?[fx,fy]:[Math.min(W-1,Math.max(0,fx)),Math.min(H-1,Math.max(0,fy))];
      a.path=bfs(cur,g.tile).map(p=>[p[0]+0.5,p[1]+0.5]).concat([g.pt]);
      if(g.key==='seat'&&a.path.length>1)a.path.splice(a.path.length-2,1);
    }
    if(a.path.length){
      a.moving=true;let step=2.6*this.speed*dt;
      while(step>0&&a.path.length){
        const[tx,ty]=a.path[0],dx=tx-a.x,dy=ty-a.y,dist=Math.hypot(dx,dy);
        if(dist>0.001)a.dirFront=(dx+dy)>0.0001?true:((dx+dy)<-0.0001?false:a.dirFront);
        if(dist<=step){a.x=tx;a.y=ty;a.path.shift();step-=dist;}else{a.x+=dx/dist*step;a.y+=dy/dist*step;step=0;}
      }
      if(!a.path.length){a.moving=false;if(g.key==='seat')a.seated=true;if(g.key==='sleep')a.sleeping=true;if(g.stool)a.stool=g.stool;if(g.key==='exit')a.gone=true;a.dirFront=g.spot?g.spot.front:false;if(g.spot)a.actNow=g.spot.act;}
    }
    // At a stall or the vanity: count the visit along (RestroomLogic.visit); while inside the stall, the person is not drawn.
    else if(a.actNow==='wc'){a.wcT=(a.wcT||0)+dt*this.speed;a.wcIn=RestroomLogic.visit(a.wcT)==='inside';}
  }

  frame(ts){
    if(this.world)return this.worldFrame(ts);
    const dt=Math.min(0.05,(ts-this.last)/1000);this.last=ts;
    if(!this.state.paused){this.agents.forEach(a=>this.updateAgent(a,dt));this.stepDogs(dt);
      if(this.agents.some(a=>a.gone)){const goneA=this.agents.filter(a=>a.gone);goneA.forEach(a=>this.goneSids.add(a.sid));const goneIds=goneA.map(a=>a.id);this.agents=this.agents.filter(a=>!a.gone);if(goneIds.includes(this.state.sel))this.setState({sel:null});}}
    this.env=this.envNow();
    this.draw(ts/1000);
    this.drawSky(ts/1000);
    for(const a of this.agents){const el=this.bubbleEls[a.id];if(!el)continue;const[sx,sy]=this.headPos(a);el.style.left=Math.min(92,Math.max(8,sx/LW*100))+'%';el.style.top=((sy-12)/LH*100)+'%';}
  }
  // Preview buttons show a weather within 3 s for a minute, then the mode's own weather returns
  // (a snow preview shows a white lawn only while it lasts, see SkyLogic.stepSnow).
  previewWeather(type){
    if(!SkyLogic.FX[type])return;
    const r=SkyLogic.startPreview(this.wx,this.preview,type,Date.now());this.wx=r.wx;this.preview=r.preview;
  }
  // Everything the sky, the island and the office need to agree on for this frame.
  envNow(){
    const now=Date.now(),d=new Date(),dtMs=Math.min(5000,now-this.lastSky);this.lastSky=now;
    if(this.preview){const r=SkyLogic.stepPreview(this.wx,this.preview,now);this.wx=r.wx;this.preview=r.preview;}
    else this.stepWeather(now);
    const reduced=!!(this.reducedMq&&this.reducedMq.matches),fx=SkyLogic.weatherFx(this.wx,now),df=dayFactor();
    {const sn=SkyLogic.stepSnow(this.snow,fx,this.preview,dtMs);this.snow=sn.cover;this.snowShown=sn.shown;}
    if(fx.storm>0.5&&!reduced){if(now>=this.nextFlashAt){this.flashStart=now;this.flashMs=SkyLogic.lightningFlashMs(Math.random());this.nextFlashAt=now+SkyLogic.lightningDelayMs(Math.random());}}
    else this.nextFlashAt=now+2000;
    this.flash=reduced?0:SkyLogic.flashLevel(now,this.flashStart||0,this.flashMs||0);
    const hour=d.getHours()+d.getMinutes()/60;
    return{df,hour,fx,reduced,flash:this.flash,col:SkyLogic.skyColors(df,hour,fx)};
  }
  // The sky fills the whole stage behind the scene canvas; rain, snow, fog and a near cloud go over it.
  drawSky(t){
    const st=this.stageEl,env=this.env;if(!st||!env)return;
    const w=st.clientWidth,hh=st.clientHeight,dpr=window.devicePixelRatio||1,b=this.camBox();
    // Clouds follow the island camera (zoom and pan), each layer by its depth.
    const skyEnv=b?{...env,view:CameraLogic.skyView(this.cam,b)}:env;
    for(const[cv,fn]of[[this.backCanvas,SkyRender.drawBack],[this.frontCanvas,SkyRender.drawFront]]){
      if(!cv)continue;const bw=Math.round(w*dpr),bh=Math.round(hh*dpr);if(cv.width!==bw||cv.height!==bh){cv.width=bw;cv.height=bh;}
      const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,hh);fn(ctx,w,hh,t,skyEnv);
    }
    // The island bobs a few pixels; moving the wrapper (not a transform) keeps bubbles, clicks and layering intact.
    if(this.wrapEl){const top=env.reduced?0:Math.round(Math.sin(t*0.7)*3);if(this.wrapTop!==top){this.wrapTop=top;this.wrapEl.style.top=top+'px';}}
  }
  // The wrapper's place and focus box on the stage, in stage pixels (layout, before the camera transform).
  camBox(){const st=this.stageEl,w=this.wrapEl;if(!st||!w)return null;
    return{stageW:st.clientWidth,stageH:st.clientHeight,ox:w.offsetLeft,oy:w.offsetTop-(this.wrapTop||0),cw:w.offsetWidth,ch:w.offsetHeight*FH/LH};}
  setCam(cam){if(cam.z===this.cam.z&&cam.tx===this.cam.tx&&cam.ty===this.cam.ty)return;this.cam=cam;const w=this.wrapEl;
    if(w){w.style.transform=cam.z===1&&!cam.tx&&!cam.ty?'':'translate('+cam.tx+'px,'+cam.ty+'px) scale('+cam.z+')';w.style.setProperty('--cam-inv',String(1/cam.z));
      // will-change only while the camera moves: Chrome keeps a will-change layer at the scale it was first painted
      // at, so left on it upscales the bubbles' text into a blur once zoomed. At rest the layer is re-painted sharp.
      w.style.willChange='transform';clearTimeout(this.wcTimer);this.wcTimer=setTimeout(()=>{if(this.wrapEl)this.wrapEl.style.willChange='';},200);}
    if(cam.z!==this.kZoom){clearTimeout(this.kTimer);this.kTimer=setTimeout(()=>{this.kZoom=this.cam.z;},150);}}
  headPos(a){if(a.stool&&!a.moving){const[sx,sy]=PA(a.x,a.y);return[sx,sy-(a.stool===2?30:25)];}if(a.sleeping){const[hx,hy]=P(a.x-0.45,a.y,4);return[hx,hy];}const[sx,sy]=PA(a.x,a.y);if(a.actNow==="bath"&&!a.moving)return[sx,sy-11];return[sx,sy-(a.seated?23:21)];}

  renderK(){return CameraLogic.renderScale(this.canvas.clientWidth,window.devicePixelRatio||1,this.kZoom,LW);}
  draw(t){
    const c=this.canvas;if(!c)return;const ctx=c.getContext('2d'),th=this.theme,env=this.env;
    const df=th._day!=null?th._day:1;
    // Draw at the screen's own resolution so edges stay sharp when the canvas is shown large. k is not rounded:
    // with the island-sized scene a whole-number k would make the browser shrink the bitmap and drop pixel rows.
    // Zoomed in, the resolution follows the zoom (CameraLogic.renderScale); past 4× the browser scales it up pixelated.
    const k=this.renderK();
    if(this.k!==k){this.k=k;c.width=Math.round(LW*k);c.height=Math.round(LH*k);}
    ctx.setTransform(k,0,0,k,0,0);
    ctx.imageSmoothingEnabled=false;ctx.globalAlpha=1;ctx.clearRect(0,0,LW,LH);
    // The island is baked once per resolution / light level / snow level and stamped under the office.
    const snow=this.snowShown||0,ic=this.islandCache,dfB=Math.round(df*10),snB=Math.round(snow*10);
    if(!ic||ic.k!==k||ic.df!==dfB||ic.sn!==snB)this.islandCache={img:SkyRender.renderIsland(ISLAND,{LW,LH,OX,OY},k,{df:dfB/10,snow:snB/10}),k,df:dfB,sn:snB};
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(this.islandCache.img,0,0);ctx.restore();
    SkyRender.drawPond(ctx,ISLAND,PG,t,df);
    SkyRender.drawWaterfall(ctx,ISLAND,PG,t,SkyLogic.WATERFALL_LEN,df);
    const poly=(pts,fill,stroke)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(Math.round(p[0]),Math.round(p[1])):ctx.moveTo(Math.round(p[0]),Math.round(p[1])));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}const s=stroke===undefined?th.stroke:stroke;if(s){ctx.strokeStyle=s;ctx.lineWidth=1;ctx.stroke();}};
    {// The plinth: a soft shadow on the lawn around it, then its two visible stone faces and a lit top lip.
      const WT_=0.35,stone=SkyRender.night('#b9b2a3',df);
      [[0.5,0.07],[0.25,0.1]].forEach(([b,a])=>{const sh='rgba(0,0,0,'+a+')';poly([PG(-WT_,H),PG(W,H),PG(W+b,H+b),PG(-WT_,H+b)],sh,null);poly([PG(W,-WT_),PG(W+b,-WT_),PG(W+b,H+b),PG(W,H)],sh,null);});
      poly([PG(-WT_,H,0),PG(W,H,0),PG(W,H,FLOOR_Z),PG(-WT_,H,FLOOR_Z)],shade(stone,-18),null);
      poly([PG(W,-WT_,0),PG(W,H,0),PG(W,H,FLOOR_Z),PG(W,-WT_,FLOOR_Z)],shade(stone,-40),null);
      poly([PG(-WT_,H,FLOOR_Z-1),PG(W,H,FLOOR_Z-1),PG(W,H,FLOOR_Z),PG(-WT_,H,FLOOR_Z)],shade(stone,12),null);
      poly([PG(W,-WT_,FLOOR_Z-1),PG(W,H,FLOOR_Z-1),PG(W,H,FLOOR_Z),PG(W,-WT_,FLOOR_Z)],shade(stone,-10),null);
      for(let x=2;x<W;x+=4)poly([PG(x,H,1),PG(x+0.06,H,1),PG(x+0.06,H,FLOOR_Z-1),PG(x,H,FLOOR_Z-1)],shade(stone,-32),null);
      for(let y=2;y<H;y+=4)poly([PG(W,y,1),PG(W,y+0.06,1),PG(W,y+0.06,FLOOR_Z-1),PG(W,y,FLOOR_Z-1)],shade(stone,-52),null);
      // Stairs down from the pantry: the floor, two stone steps, then the lawn (back step first so the front one overlaps it).
      // Each step is a stone box; on the east flight steps march out along +x, on the front flight along +y.
      const run=SkyLogic.STAIR_RUN/3;
      const step=(x0,x1,y0,y1,zt,top)=>{
        poly([PG(x0,y1,0),PG(x1,y1,0),PG(x1,y1,zt),PG(x0,y1,zt)],shade(top,-20),null);
        poly([PG(x1,y0,0),PG(x1,y1,0),PG(x1,y1,zt),PG(x1,y0,zt)],shade(top,-38),null);
        poly([PG(x0,y0,zt),PG(x1,y0,zt),PG(x1,y1,zt),PG(x0,y1,zt)],top,null);
      };
      for(const s of STAIRS)for(let i=0;i<2;i++){
        const zt=FLOOR_Z*(1-(i+1)/3),top=shade(stone,8-i*4),a=i*run,b=a+run;
        if(s.side==='east')step(W+a,W+b,s.y,s.y+s.len,zt,top);else step(s.x,s.x+s.len,H+a,H+b,zt,top);
      }
    }
    const box=(x,y,w,hh,z0,z1,top,l,r)=>{poly([P(x,y+hh,z0),P(x+w,y+hh,z0),P(x+w,y+hh,z1),P(x,y+hh,z1)],l||shade(top,-22));poly([P(x+w,y,z0),P(x+w,y+hh,z0),P(x+w,y+hh,z1),P(x+w,y,z1)],r||shade(top,-38));poly([P(x,y,z1),P(x+w,y,z1),P(x+w,y+hh,z1),P(x,y+hh,z1)],top);};
    const rect=(x,y,w,hh,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.round(x),Math.round(y),w,hh);};
    const G={ctx,poly,box,rect,th,t,df};
    // Walls are WT tiles thick so their cut edges show; openings sit RD deep in the wall.
    const WT=0.35,ZT=WALL+3,RD=0.18;
    const clipTo=pts=>{ctx.save();ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(Math.round(p[0]),Math.round(p[1])):ctx.moveTo(Math.round(p[0]),Math.round(p[1])));ctx.closePath();ctx.clip();};
    poly([P(0,0,0),P(W,0,0),P(W,0,WALL),P(0,0,WALL)],th.wr);
    poly([P(0,0,0),P(0,H,0),P(0,H,WALL),P(0,0,WALL)],th.wl);
    poly([P(0,0,WALL),P(W,0,WALL),P(W,0,WALL+3),P(0,0,WALL+3)],th.trim);
    poly([P(0,0,WALL),P(0,H,WALL),P(0,H,WALL+3),P(0,0,WALL+3)],th.trim);
    poly([P(0,0,0),P(W,0,0),P(W,0,4),P(0,0,4)],th.trim);poly([P(0,0,0),P(0,H,0),P(0,H,4),P(0,0,4)],th.trim);
    poly([P(-WT,-WT,ZT),P(W,-WT,ZT),P(W,0,ZT),P(0,0,ZT)],shade(th.trim,18),null);
    poly([P(-WT,-WT,ZT),P(0,0,ZT),P(0,H,ZT),P(-WT,H,ZT)],shade(th.trim,18),null);
    poly([P(W,-WT,0),P(W,0,0),P(W,0,ZT),P(W,-WT,ZT)],shade(th.wr,-34),null);
    poly([P(-WT,H,0),P(0,H,0),P(0,H,ZT),P(-WT,H,ZT)],shade(th.wl,-20),null);
    {const OD=window.OfficeDecor;if(OD)[1.6,4.8,11.6,14.8].forEach(x=>OD.F.window(OD.kit(ctx,...P(x,0)),t,{night:df<0.5}));}
    {const OD=window.OfficeDecor,u=this.usage||[];
      const u5h=u.find(x=>x.kind==='five_hour')||{pct:null,resets:''};
      const u7d=u.find(x=>x.kind==='seven_day')||{pct:null,resets:''};
      const rMin=r=>{if(!r)return 0;const d=new Date(r)-Date.now();return Math.max(0,d/60000);};
      if(OD&&OD.drawUsageBoard&&!this.noUsage){const[bx,by]=P(0,4.9,50);// hub islands and the public preview carry no usage
        OD.drawUsageBoard(ctx,bx,by,{h5:u5h.pct==null?null:u5h.pct/100,d7:u7d.pct==null?null:u7d.pct/100,r5:rMin(u5h.resets),r7:rMin(u7d.resets),variant:'led',night:df<0.5},t,'left');
      }
    }
    [[1.3,2.5,18,'#c9cfdc'],[2.8,4.2,18,'#c9cfdc']].forEach(([a,b,z,col])=>{ctx.globalAlpha=0.3;poly([P(0,a,z),P(0,b,z),P(0,b,z+0.5),P(0,a,z+0.5)],col,null);ctx.globalAlpha=1;});
    box(0,9.6,0.28,2.4,20,22,shade(th.trim,-10));
    ['#e5484d','#3e8ed0','#f5a524','#46a758','#8e4ec6','#12a594','#e8e2d6','#5b5bd6'].forEach((col,k)=>{const hh=[8,6,9,7,8,5,7,9][k];box(0.03,9.68+k*0.27,0.2,0.2,22,22+hh,col);});
    {const[cx,cy]=P(0,12.8,42);
      ctx.fillStyle='#1a1c24';ctx.beginPath();ctx.ellipse(cx,cy,8,9,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f6f4ee';ctx.beginPath();ctx.ellipse(cx,cy,6,7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#8b93a7';[[0,-6],[5,0],[0,6],[-5,0]].forEach(([dx,dy])=>ctx.fillRect(cx+dx,cy+dy,1,1));
      const d=new Date(),mA=d.getMinutes()/60*Math.PI*2-Math.PI/2,hA=(d.getHours()%12+d.getMinutes()/60)/12*Math.PI*2-Math.PI/2,sA=d.getSeconds()/60*Math.PI*2-Math.PI/2;
      ctx.strokeStyle='#2d3142';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(hA)*3,cy+Math.sin(hA)*3.5);ctx.stroke();
      ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(mA)*4.5,cy+Math.sin(mA)*5);ctx.stroke();
      ctx.strokeStyle='#e5484d';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sA)*5,cy+Math.sin(sA)*5.5);ctx.stroke();}
    {const OD=window.OfficeDecor;if(OD)OD.F.door(OD.kit(ctx,...P(0,5.5)),t);}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      poly([P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],(x+y)%2?th.fa:th.fb,th.stroke?'#dfe5ef':null);
      if(df>0.2){ctx.globalAlpha=df;poly([P(x,y+0.5),P(x+1,y+0.5),P(x+1,y+0.52),P(x,y+0.52)],shade(th.fa,-18),null);ctx.globalAlpha=1;}
      if(df<0.8&&(x*7+y*3)%5===0){ctx.globalAlpha=1-df;const[px,py]=P(x+0.5,y+0.5);rect(px,py,1,1,shade(th.fa,14));ctx.globalAlpha=1;}
    }
    {const own=this.colOwners();
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const zi=zoneAt(x,y);let col;
        if(zi===4){// pantry: light washable tiles on the kitchen side, warm wood planks where people sit
          if(y>=9){col=y%2?lerpHex('#3a2d2b','#c99862',df):lerpHex('#332725','#c18f59',df);poly([P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],col,th.stroke?'#dfe5ef':null);
            const sm=shade(col,-16),jx=x+(y%2?0.3:0.7);poly([P(x,y+0.5),P(x+1,y+0.5),P(x+1,y+0.53),P(x,y+0.53)],sm,null);poly([P(jx,y),P(jx+0.03,y),P(jx+0.03,y+0.5),P(jx,y+0.5)],sm,null);continue;}
          col=(x+y)%2?lerpHex('#2e2d3a','#ebe7dd',df):lerpHex('#282734','#dfdace',df);}
        else if(zi<0)col=mix((x+y)%2?th.fa:th.fb,'#000000',th.stroke?0.03:0.14);
        else{const dk=own[zi];if(!dk){col=mix((x+y)%2?th.fa:th.fb,'#000000',th.stroke?0.06:0.24);poly([P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],col,th.stroke?'#dfe5ef':null);continue;}col=mix((x+y)%2?th.fa:th.fb,this.depts.get(dk).color,th.stroke?0.14:df<0.5?0.3:0.34);}
        poly([P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],col,th.stroke?'#dfe5ef':null);}
      ctx.strokeStyle=th.stroke?'#c9d3e3':(df>0.5?'#c9a77a':'#3a4462');ctx.lineWidth=1;
      [[9,0,9,H],[0,7,20,7],[19,0,19,H]].forEach(([a,b,c,d])=>{const L=Math.max(c-a,d-b)*2;for(let k=0;k<L;k+=2){const p0=P(a+(c-a)*k/L,b+(d-b)*k/L),p1=P(a+(c-a)*(k+0.8)/L,b+(d-b)*(k+0.8)/L);ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke();}});
      // Soft contact shadow where the walls meet the floor.
      [[0.45,0.06],[0.22,0.1]].forEach(([b,a])=>{const sh='rgba(0,0,0,'+a+')';poly([P(0,0),P(W,0),P(W,b),P(b,b)],sh,null);poly([P(0,0),P(b,b),P(b,H),P(0,H)],sh,null);});
      // Floor paint: (a,b,c,d) is the text's reading and downward direction on screen; (x,y) is its top-left corner on the floor.
      const paint=(x,y,txt,col,s,m)=>{const[px,py]=P(x,y);ctx.save();ctx.translate(Math.round(px),Math.round(py));ctx.transform(...m,0,0);ctx.scale(s,s);ctx.globalAlpha=th.stroke?0.7:0.6;text3(ctx,txt,0,0,col);ctx.restore();ctx.globalAlpha=1;};
      const ALONG_X=[1,0.5,-1,0.5],ALONG_Y=[1,-0.5,1,0.5];
      // Department names run along the zone's middle aisle (between the two desk columns), the only floor strip no desk hides.
      // All names share one size, so they are capped at MAXC characters: a longer name drops its leading words first
      // (core-payment-merchant → MERCHANT) so sibling projects stay distinguishable, then is cut.
      const MAXC=12,FS=2;
      ZONES.forEach((z,zi)=>{const dk=own[zi];
        // Phòng chưa có session nào: in EMPTY bằng màu xám thay cho tên phòng.
        if(!dk){const name='EMPTY',len=(name.length*4-1)*FS/16;paint(z.zx+3.12,z.zy+3+len/2,name,th.stroke?'#9aa3b5':df>0.5?shade(th.fa,-45):shade(th.fa,30),FS,ALONG_Y);return;}
        const col=this.depts.get(dk).color;
        let name=dk.toUpperCase();while(name.length>MAXC&&/[-_.]/.test(name))name=name.replace(/^[^-_.]*[-_.]/,'');name=name.slice(0,MAXC);
        const len=(name.length*4-1)*FS/16;
        paint(z.zx+3.12,z.zy+3+len/2,name,df>0.5?shade(col,-80):shade(col,10),FS,ALONG_Y);});
      paint(21.3,13.2,'PANTRY',df>0.5?'#8a5a2a':'#a8763e',2.5,ALONG_X);
    }
    poly([P(0.05,6.4),P(0.9,6.4),P(0.9,7.6),P(0.05,7.6)],lerpHex('#3a2f55','#b5523b',df),null);
    [1.6,4.8,11.6,14.8].forEach(x=>{ctx.globalAlpha=0.07+(0.22-0.07)*df;poly([P(x+0.3,0.05),P(x+2.1,0.05),P(x+2.6,1.6),P(x+0.8,1.6)],lerpHex('#7fb2ff','#fff3c4',df),null);ctx.globalAlpha=1;});
    if(window.SeasonTree)this.seasonKey=window.SeasonTree.seasonFor(new Date());
    const items=[];
    {const OD=window.OfficeDecor;
    DESKS.forEach((d,i)=>{const owner=this.agents.find(a=>a.desk===i&&!a.leaving&&!a.parent);
      OD.deskWorkstation(ctx,P,d,owner,t,()=>this.drawPerson(G,owner)).forEach(it=>items.push(it));});}
    {const own=this.colOwners();SEGS.forEach(sg=>items.push({z:sg.v?sg.X+sg.y+0.5:sg.x+0.5+sg.Y,f:()=>this.drawSeg(G,sg,own)}));}
    this.pantryItems(G,items);
    this.smokingItems(G,items,snow);
    this.restroomItems(G,items,snow);
    // All front-facing island trees become event trees when treeOn is active
    {const frontTrees=ISLAND.decor.filter(d=>d.kind==='tree'&&d.x>=0&&d.y>=0);
    const ST_=window.SeasonTree;
    frontTrees.forEach(d=>{if(this.treeOn&&ST_){items.push({z:d.x+d.y+0.5,f:()=>{const[px,py]=PG(d.x+0.5,d.y+0.5,0);ctx.save();ctx.translate(Math.round(px),Math.round(py));ST_.drawSeasonTree(ctx,0,0,this.season,t);ctx.restore();}});}else{items.push({z:d.x+d.y+0.5,f:()=>SkyRender.drawTree(ctx,PG,d,dfB/10,snB/10)});}});}
    [[8.5,13.5],[19.5,13.5],[18.5,0.5]].forEach(([x,y])=>items.push({z:x+y,f:()=>{box(x-0.2,y-0.2,0.4,0.4,0,7,th.pot);const[px,py]=P(x,y,7);[[-5,-8,10,8,0],[-3,-14,6,6,1],[-7,-5,4,4,1],[3,-6,4,4,0],[-1,-17,3,4,0]].forEach(([a,b,w,hh,v])=>rect(px+a,py+b,w,hh,v?shade(th.plant,-25):th.plant));}}));
    items.push({z:9,f:()=>{box(8.55,0.05,0.9,0.4,0,42,shade(th.trim,-5));[10,20,30,40].forEach(z=>box(8.58,0.06,0.84,0.38,z,z+1,shade(th.trim,-30)));
      [[12,'#e5484d','#3e8ed0','#f5a524'],[22,'#46a758','#e8e2d6','#8e4ec6'],[32,'#12a594','#5b5bd6','#e93d82']].forEach(([z,...cs])=>cs.forEach((col,k)=>box(8.65+k*0.24,0.12,0.16,0.28,z,z+7-(k%2)*2,col)));}});

    this.dogs.forEach(d=>items.push({z:d.x+d.y,f:()=>this.drawDog(G,d,t,dfB,snB)}));
    this.agents.forEach(a=>{if(a.sleeping){const d=DESKS[a.desk];items.push({z:d.gx+d.gy+0.5,f:()=>this.drawSleeper(G,a)});items.push({z:d.gx+d.gy+2,f:()=>{const[hx,hy]=this.headPos(a);for(let k=0;k<3;k++){const p=(t*0.5+k*0.33)%1;ctx.globalAlpha=Math.min(1,(1-p)*1.4);text3(ctx,'Z',hx-2+p*8+Math.sin(p*6)*2,hy-4-p*22,th.stroke?'#33415c':'#e6e9ef');ctx.globalAlpha=1;}}});}else if(!a.seated&&!a.wcIn){items.push({z:a.x+a.y+(a.stool?0.1:0),f:()=>this.drawPerson(G,a)});}});
    items.sort((p,q)=>p.z-q.z).forEach(it=>it.f());
    // A storm darkens the island and office; source-atop only tints what is already drawn, never the sky behind.
    if(env&&env.fx.storm>0){ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(10,15,30,'+(0.18*env.fx.storm)+')';ctx.fillRect(0,0,LW,LH);ctx.restore();}
  }

  drawSeg(G,sg,own){
    if(sg.zi===4)return;
    const{ctx,box,th}=G, dk=sg.zi<4?own[sg.zi]:null, col=sg.zi===4?'#a8763e':dk?this.depts.get(dk).color:shade(th.trim,10), base=th.stroke?'#ffffff':shade(th.trim,-20);
    const[x,y,w,hh]=sg.v?[sg.X-0.06,sg.y,0.12,1]:[sg.x,sg.Y-0.06,1,0.12];
    box(x,y,w,hh,0,4,base);
    ctx.globalAlpha=th.stroke?0.5:0.3;box(sg.v?x+0.02:x,sg.v?y:y+0.02,sg.v?0.08:1,sg.v?1:0.08,4,11,'#bfe3ff','#9fd3ff','#7fbbea');ctx.globalAlpha=1;
    box(x,y,w,hh,11,12.5,col);
  }
  // The pantry is screened from the office by a concrete planter: bamboo rising over a bed of leafy plants.
  drawPlanter(G,sg){
    const{box,rect,th,df}=G,y=sg.y,S=th.stroke;
    box(19.72,y,0.56,1,0,10,S?'#ffffff':lerpHex('#454b5c','#c2beb3',df));
    if(S)return;
    box(19.8,y+(y===0||y===8?0.06:0),0.4,1-(y===0||y===8?0.06:0)-(y===5||y===13?0.06:0),9.5,10,'#4a3527');
    const g=th.plant,gD=shade(g,-30),gL=shade(g,25),bam=mix(g,'#c9d46a',0.5),n=k=>((y*7+k*5)%9)/9;
    for(let k=0;k<4;k++){const yy=y+0.14+k*0.24,xx=19.84+((y*3+k)%4)*0.1,top=34+Math.round(n(k)*16);
      const[bx,b0]=P(xx,yy,10),b1=P(xx,yy,top)[1];rect(bx,b1,1,b0-b1,k%2?bam:shade(bam,-28));
      for(let z=16;z<top-2;z+=7)rect(bx,P(xx,yy,z)[1],1,1,shade(bam,-50));
      for(let z=top-20;z<=top+1;z+=3){const ly=P(xx,yy,z)[1],c=(z+k)%3?g:gL;if(((z>>1)+k)%2){rect(bx+1,ly,3,1,c);rect(bx+3,ly+1,2,1,gD);}else{rect(bx-3,ly,3,1,c);rect(bx-4,ly+1,2,1,gD);}}}
    const[px,py]=P(20,y+0.5,10);
    [[-8,-5,6,5,gD],[-4,-8,7,7,g],[2,-6,6,6,gL],[-1,-11,4,4,g],[5,-9,4,4,gD]].forEach(([a,b,w,hh,c])=>rect(px+a,py+b,w,hh,c));
    if(y%2===0){rect(px-6,py-17,2,9,gD);rect(px-9,py-20,5,5,gL);rect(px+4,py-15,2,7,g);rect(px+4,py-19,5,5,g);}
  }
  pantryItems(G,items){
    const{ctx,th,t,df}=G,PI=window.PantryItems;
    if(!PI)return;
    const isNight=df<0.5;
    const Z=PI.depths(PI.LAYOUT);
    PI.LAYOUT.forEach(([name,rx,ry,rz],i)=>{
      const it=PI.I[name];if(!it)return;
      const ox=20+rx,oy=ry;
      items.push({z:Z[i],f:()=>{
        const[sx,sy]=P(ox,oy);
        const k=PI.kit(ctx,sx,sy-rz);
        if(!it.flat&&!it.wall&&name!=='pendant'&&rz===0&&name!=='planter')k.shadow(0,0,it.size[0],it.size[1],0.22);
        it.draw(k,t,{night:isNight});
      }});
    });
  }
  // Smoking corner beside the restroom block (SmokeLogic.layout): a stone pad, a planted trough screening it from the
  // block, a bench under a vine-covered cantilever pergola, an ash bin, and a light, an extinguisher and a sign by the
  // entrance. It all stands on the grass, so it is drawn with PG (P is lifted by the plinth) and its colours go through
  // night() and the snow cover like the rest of the island.
  smokingItems(G,items,snow){
    const{ctx,poly,df}=G,X=SMOKE.x,Y=SMOKE.y,Z=X+Y,N=c=>SkyRender.night(c,df),SN=(c,k)=>N(mix(c,'#eef3f7',snow*k));
    const gbox=(x,y,w,hh,z0,z1,top,l,r)=>{poly([PG(x,y+hh,z0),PG(x+w,y+hh,z0),PG(x+w,y+hh,z1),PG(x,y+hh,z1)],l||shade(top,-22),null);poly([PG(x+w,y,z0),PG(x+w,y+hh,z0),PG(x+w,y+hh,z1),PG(x+w,y,z1)],r||shade(top,-38),null);poly([PG(x,y,z1),PG(x+w,y,z1),PG(x+w,y+hh,z1),PG(x,y+hh,z1)],top,null);};
    const R=(x,y,w,hh,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,hh);};
    const wood=N('#a8763e'),metal=N('#3d4350'),leaf=SN('#3e9a45',0.45),leafL=SN('#57b85a',0.6),leafD=N('#2f7a36');
    // A rounded pixel shrub: lit on top, its right third in shade like every other box in the scene.
    const bush=(x,y,z,r)=>{const[cx,cy]=PG(x,y,z);for(let dy=-r;dy<=r;dy++){const w=Math.round(Math.sqrt(r*r-dy*dy)*1.2),c=dy<-r*0.45?leafL:leaf;R(cx-w,cy+dy,w*2,1,c);R(cx+Math.round(w*0.3),cy+dy,Math.round(w*0.7),1,leafD);}
      R(cx-Math.round(r*0.5),cy-Math.round(r*0.3),2,1,leafL);R(cx-1,cy+Math.round(r*0.2),2,1,leafL);};
    // Stone pavers, not grass: a dropped cigarette must land on something that cannot catch fire.
    items.push({z:-1,f:()=>{gbox(X,Y,4,4,0,0.6,SN('#a39c90',0.8));
      for(let y=0;y<4;y+=0.5)for(let x=0;x<4;x+=0.5)poly([PG(X+x+0.04,Y+y+0.04,0.6),PG(X+x+0.46,Y+y+0.04,0.6),PG(X+x+0.46,Y+y+0.46,0.6),PG(X+x+0.04,Y+y+0.46,0.6)],SN((x+y)*2%2?'#c9c3b8':'#bdb6aa',0.8),null);
      // after dark the entrance light leaves a warm pool on the stones, under everyone standing there
      if(df<0.6){const[lx,ly]=PG(X+0.4,Y+3.8,0.6);ctx.globalAlpha=0.22*(1-df/0.6);ctx.fillStyle='#ffd98a';ctx.beginPath();ctx.ellipse(lx,ly,18,9,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}});
    // The planted trough on the side facing the restroom block, about 1.2 m tall: it screens the view and breaks the drift of
    // smoke. One item per tile so it sorts between people on the lawn behind it and people in the corner.
    [0,1,2].forEach(r=>items.push({z:Z+1.8+r,f:()=>{const y0=Y+(r===0?0.1:r),y1=Y+(r===2?2.9:r+1);
      gbox(X+0.1,y0,0.45,y1-y0,0,5,SN('#b9b2a3',0.6));
      bush(X+0.3,Y+r+0.2,11,r===0?5:6);bush(X+0.36,Y+r+0.62,10,7);if(r===2)bush(X+0.33,Y+2.82,8,5);}}));
    // Slatted bench with a backrest across the back of the corner, facing the lawn.
    items.push({z:Z+2,f:()=>{const bw=N('#c79a5e');
      [1.45,2.5,3.55].forEach(x=>gbox(X+x,Y+0.2,0.08,0.36,0,5.8,metal));
      gbox(X+1.3,Y+0.12,2.5,0.5,5.8,7,SN('#c79a5e',0.7),shade(bw,-25),shade(bw,-40));
      for(let k=1;k<4;k++)poly([PG(X+1.3,Y+0.12+k*0.125,7),PG(X+3.8,Y+0.12+k*0.125,7),PG(X+3.8,Y+0.13+k*0.125,7),PG(X+1.3,Y+0.13+k*0.125,7)],shade(bw,-30),null);
      gbox(X+1.3,Y+0.06,2.5,0.06,7,13,bw,shade(bw,-25),shade(bw,-40));}});
    // The pergola only roofs the bench (1.2 tiles deep) and is drawn before anyone in the corner. Deeper, its front beam
    // would cross the people on the bench; at this depth every beam and rafter projects above their heads, so drawing
    // it first never hides a face, and the floating status badges stay on top of it.
    // Posts: two at the back, one at the front on the pantry side; the front-right corner is held by a knee brace, since
    // a post there would stand right in front of the end seat. A back post sorts by its own near corner: a dog sitting
    // on the lawn just behind it (y = Y-1) must be drawn first, and nobody on the bench stands in its column.
    [1.0,3.83].forEach(x=>items.push({z:X+x+Y+0.12,f:()=>gbox(X+x,Y,0.12,0.12,0,38,wood)}));
    items.push({z:Z+2.08,f:()=>{gbox(X+1.0,Y+1.0,0.12,0.12,0,38,wood);
      // a trellis between the two pantry-side posts, with the vine climbing it and both posts
      const tx=X+1.06,bar=(y0,y1,z0,z1)=>poly([PG(tx,y0,z0),PG(tx,y1,z1),PG(tx,y1,z1+1),PG(tx,y0,z0+1)],shade(wood,-12),null);
      for(let z=8;z<36;z+=7)bar(Y+0.12,Y+1.0,z,z);
      for(const y of[Y+0.4,Y+0.72])poly([PG(tx,y,0),PG(tx,y+0.05,0),PG(tx,y+0.05,36),PG(tx,y,36)],shade(wood,-12),null);
      for(const[x,y]of[[X+1.06,Y+0.06],[X+1.06,Y+1.06]])for(let z=4;z<38;z+=4){const[vx,vy]=PG(x,y,z);R(vx-2+((z>>2)%2)*2,vy-2,3,2,(z>>2)%3?leaf:leafD);}
      for(const[y,z,r]of[[0.35,14,3],[0.6,24,4],[0.3,31,3],[0.8,9,3]])bush(tx,Y+y,z,r);}});
    items.push({z:Z+2.1,f:()=>{
      gbox(X+0.9,Y,3.15,0.1,36,38,wood);gbox(X+0.9,Y+1.0,3.15,0.1,36,38,wood);
      {const bx=X+3.89,brace=(y0,z0,y1,z1)=>poly([PG(bx,y0,z0),PG(bx,y1,z1),PG(bx,y1,z1+1.5),PG(bx,y0,z0+1.5)],shade(wood,-20),null);brace(Y+0.12,27,Y+0.75,36);}
      // three rafters between the two outer ones, all overhanging the beams a little
      for(const x of[1.0,1.75,2.5,3.25,3.85])gbox(X+x,Y-0.15,0.07,1.4,38,39.2,SN('#b98a52',0.7),shade(wood,-10),shade(wood,-25));
      // the vine spreads over the back beam and the pantry side of the roof
      for(const[x,y,r]of[[1.2,0.05,4],[1.8,-0.05,5],[2.5,0.1,4],[3.2,-0.05,5],[3.85,0.3,4],[1.05,0.65,4],[1.15,1.1,4]]){
        bush(X+x,Y+y,40.5,r);const[vx,vy]=PG(X+x,Y+y,39.2);if(r>4){R(vx-2,vy+2,1,4,leafD);R(vx+3,vy+1,1,3,leafD);}}}});
    // Free-standing stainless ash bin with a sand top, between the two standing places.
    items.push({z:Z+4.1,f:()=>{gbox(X+2.15,Y+1.45,0.26,0.26,0,9,N('#c9d3e3'),N('#9aa6bd'),N('#7d889c'));gbox(X+2.18,Y+1.48,0.2,0.2,9,9.4,N('#d9cbb5'));
      const[bx,by]=PG(X+2.28,Y+1.58,9.4);R(bx-1,by,2,1,N('#f3efe2'));R(bx+1,by-1,1,1,N('#f3efe2'));}});
    // By the entrance: an extinguisher on the trough's end and a low bollard light that glows warm after dark.
    items.push({z:Z+4.05,f:()=>{gbox(X+0.18,Y+2.9,0.14,0.1,1,8,N('#e5484d'),N('#b8373b'),N('#9a2e31'));{const[ex,ey]=PG(X+0.25,Y+3.0,8);R(ex-1,ey-1,2,1,'#1a1a1a');}
      gbox(X+0.1,Y+3.62,0.14,0.14,0,9,metal);const glow=df<0.6;gbox(X+0.08,Y+3.6,0.18,0.18,9,10.5,glow?'#ffd98a':N('#e8e2d6'),glow?'#f5c46a':undefined,glow?'#e8b25a':undefined);gbox(X+0.06,Y+3.58,0.22,0.22,10.5,11.2,metal);}});
    // Designated-area sign: a green plate with the smoking pictogram (no words needed), lying in the plane y = const.
    // It stands on the front edge just past the entrance, clear of the lawn tree beyond the pad's far corner.
    items.push({z:Z+5.85,f:()=>{gbox(X+2.08,Y+3.72,0.06,0.06,0,13,metal);
      poly([PG(X+1.75,Y+3.7,13),PG(X+2.4,Y+3.7,13),PG(X+2.4,Y+3.7,19.5),PG(X+1.75,Y+3.7,19.5)],N('#1f8a4c'),null);
      const[sx,sy]=PG(X+1.75,Y+3.7,19.5);ctx.save();ctx.translate(Math.round(sx),Math.round(sy));ctx.transform(1,0.5,0,1,0,0);
      ctx.fillStyle=N('#ffffff');ctx.fillRect(2,4,6,1);ctx.fillRect(3,2,1,1);ctx.fillRect(4,1,1,1);ctx.fillRect(5,2,1,1);ctx.fillStyle='#ff9a3d';ctx.fillRect(8,4,1,1);ctx.restore();}});
  }
  // The restroom block beside the pantry (RestroomLogic.layout, spec "Bản 3"): an open-top block on the office floor
  // level that continues the office. Nothing here has a look of its own: the back wall is a full office wall, the front
  // and east walls are office walls at 70 % (the front one with two doorways and swing doors in the office door's colours), the walls between rooms are
  // office walls 32 px high, the floors are the pantry's tiles and planks, the fixtures are drawn with the pantry's kit
  // and colours (cabinets, worktop, steel sinks, white pots, the bar stool), the bench is the smoking corner's, small
  // pictogram plaques mark the doors and the lobby name is painted on the floor like PANTRY. The two muted accents (dusty
  // blue men, dusty pink women) are only on the stall panels and the pictograms. Slab, floor and back wall are drawn at once
  // (nothing on the block stands behind them); everything else goes into `items` by depth, walls one tile at a time so
  // people sort in front of and behind them.
  restroomItems(G,items,snow){
    const{ctx,poly,th,t,df}=G,L=WC,X=L.x0,Y=L.y0,X1=L.x1,Y1=L.y1,F=L.front,HT=L.heights,PI=window.PantryItems;
    if(!PI)return;
    const K=PI.kit(ctx,...P(0,0)),{box,fL,fR,top,R}=K,night=df<0.5;
    const ACC={m:L.rooms.m.accent,f:L.rooms.f.accent},WHITE='#f6f4ee',STEEL='#c9d3e3',WOOD='#a8763e',WORK='#efe9dc';
    const cap=shade(th.trim,18),glow=df<0.6?1-df/0.6:0;
    // stall doors are shut, with a red light, while someone is inside (RestroomLogic.visit 'inside')
    const occupied=new Set();for(const a of this.agents)if(a.wcIn&&a.idleSpot!=null&&IDLE_SPOTS[a.idleSpot])occupied.add(IDLE_SPOTS[a.idleSpot].stall);
    // a pantry item drawn at a floor position, with the soft contact shadow pantryItems gives it
    const item=(name,x,y)=>{const it=PI.I[name],k=PI.kit(ctx,...P(x,y));k.shadow(0,0,it.size[0],it.size[1],0.22);it.draw(k,t,{night});};

    // ---- at once: the plinth (office stone), the east stairs again (they stand in front of it), floors, rug ----
    {const WT_=0.35,stone=SkyRender.night('#b9b2a3',df);
      [[0.5,0.07],[0.25,0.1]].forEach(([b,a])=>{const sh='rgba(0,0,0,'+a+')';poly([PG(X+b,Y1),PG(X1,Y1),PG(X1+b,Y1+b),PG(X+b,Y1+b)],sh,null);poly([PG(X1,Y-WT_),PG(X1+b,Y-WT_),PG(X1+b,Y1+b),PG(X1,Y1)],sh,null);});
      poly([PG(X,Y1,0),PG(X1,Y1,0),PG(X1,Y1,FLOOR_Z),PG(X,Y1,FLOOR_Z)],shade(stone,-18),null);
      poly([PG(X1,Y-WT_,0),PG(X1,Y1,0),PG(X1,Y1,FLOOR_Z),PG(X1,Y-WT_,FLOOR_Z)],shade(stone,-40),null);
      poly([PG(X,Y1,FLOOR_Z-1),PG(X1,Y1,FLOOR_Z-1),PG(X1,Y1,FLOOR_Z),PG(X,Y1,FLOOR_Z)],shade(stone,12),null);
      poly([PG(X1,Y-WT_,FLOOR_Z-1),PG(X1,Y1,FLOOR_Z-1),PG(X1,Y1,FLOOR_Z),PG(X1,Y-WT_,FLOOR_Z)],shade(stone,-10),null);
      for(let x=30;x<X1;x+=4)poly([PG(x,Y1,1),PG(x+0.06,Y1,1),PG(x+0.06,Y1,FLOOR_Z-1),PG(x,Y1,FLOOR_Z-1)],shade(stone,-32),null);
      for(let y=2;y<Y1;y+=4)poly([PG(X1,y,1),PG(X1,y+0.06,1),PG(X1,y+0.06,FLOOR_Z-1),PG(X1,y,FLOOR_Z-1)],shade(stone,-52),null);
      // the east flight of stairs, exactly as the plinth draws it, so its steps stay in front of the slab's face
      const run=SkyLogic.STAIR_RUN/3;
      for(const s of STAIRS)if(s.side==='east')for(let i=0;i<2;i++){const zt=FLOOR_Z*(1-(i+1)/3),tp=shade(stone,8-i*4),x0=W+i*run,x1=x0+run,y0=s.y,y1=s.y+s.len;
        poly([PG(x0,y1,0),PG(x1,y1,0),PG(x1,y1,zt),PG(x0,y1,zt)],shade(tp,-20),null);poly([PG(x1,y0,0),PG(x1,y1,0),PG(x1,y1,zt),PG(x1,y0,zt)],shade(tp,-38),null);poly([PG(x0,y0,zt),PG(x1,y0,zt),PG(x1,y1,zt),PG(x0,y1,zt)],tp,null);}
}
    for(let y=Y;y<Y1;y++)for(let x=X;x<X1;x++){
      if(y>=F){// lobby: the pantry's warm planks with their seams and staggered joints
        const col=y%2?lerpHex('#3a2d2b','#c99862',df):lerpHex('#332725','#c18f59',df);poly([P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],col,null);
        const sm=shade(col,-16),jx=x+(y%2?0.3:0.7);poly([P(x,y+0.5),P(x+1,y+0.5),P(x+1,y+0.53),P(x,y+0.53)],sm,null);poly([P(jx,y),P(jx+0.03,y),P(jx+0.03,y+0.5),P(jx,y+0.5)],sm,null);continue;}
      // rooms: the pantry kitchen's light washable tiles
      poly([P(x,y),P(x+1,y),P(x+1,y+1),P(x,y+1)],(x+y)%2?lerpHex('#2e2d3a','#ebe7dd',df):lerpHex('#282734','#dfdace',df),null);}
    // soft contact shadow where the walls meet the floor, as in the office
    [[0.45,0.06],[0.22,0.1]].forEach(([b,a])=>{const sh='rgba(0,0,0,'+a+')';poly([P(X,Y),P(X1,Y),P(X1,Y+b),P(X,Y+b)],sh,null);
      for(const wx of[L.walls.pantry.x+L.walls.pantry.t,L.walls.split.x+L.walls.split.t])poly([P(wx,Y),P(wx+b,Y),P(wx+b,F),P(wx,F)],sh,null);});
    // the lobby's name painted on its planks along the walkway, in the same paint as PANTRY
    {const[lx,ly]=L.lobby.label;this.restroomPaint(ctx,P(lx,ly),tr('office.wc.lobby'),df>0.5?'#8a5a2a':'#a8763e',2);}

    // ---- the back wall, exactly the office's: wall, skirting, top band and cap, cut end ----
    {const WT=0.35,ZT=WALL+3;
      poly([P(X,Y,0),P(X1,Y,0),P(X1,Y,WALL),P(X,Y,WALL)],th.wr,null);
      poly([P(X,Y,WALL),P(X1,Y,WALL),P(X1,Y,ZT),P(X,Y,ZT)],th.trim,null);
      poly([P(X,Y,0),P(X1,Y,0),P(X1,Y,4),P(X,Y,4)],th.trim,null);
      poly([P(X,Y-WT,ZT),P(X1,Y-WT,ZT),P(X1,Y,ZT),P(X,Y,ZT)],cap,null);
      poly([P(X1,Y-WT,0),P(X1,Y,0),P(X1,Y,ZT),P(X1,Y-WT,ZT)],shade(th.wr,-34),null);
      // hand dryer in the men's room corner, above the plant
      const[dx]=L.dryerM;box(dx-0.12,Y,0.24,0.14,17,24,WHITE,'#e3ddd0','#d6cfbf');fL(dx-0.04,dx+0.04,Y+0.14,17,17.6,'#8b93a7');}

    // ---- solid room walls (office walls: wall colour, skirting, top band, cap), one tile at a time ----
    const wallX=(x0,w,ya,yb,h)=>{box(x0,ya,w,yb-ya,0,h-2,th.trim,shade(th.wl,-20),th.wl);box(x0,ya,w,yb-ya,h-2,h,cap,th.trim,th.trim);fR(x0+w,ya,yb,0,4,th.trim);};
    const deco={};const put=(x,y,f)=>{const k=x+','+Math.min(F-1,Math.floor(y));(deco[k]=deco[k]||[]).push(f);};
    // a mirror on a room wall's east face: a thin trim frame round glass that catches the light like the office windows
    const mirror=(x,ya,yb,za,zb)=>{fR(x,ya,yb,za,zb,th.trim);fR(x,ya+0.05,yb-0.05,za+1.2,zb-1.2,th.glass);
      for(let s=ya+0.2;s<yb-0.25;s+=0.55)poly([P(x,s,zb-2.5),P(x,s+0.1,zb-2.5),P(x,s+0.28,za+2.5),P(x,s+0.18,za+2.5)],th.glassHi,null);};
    const dryer=(x,y)=>{box(x,y-0.12,0.13,0.24,17,24,WHITE,'#e3ddd0','#d6cfbf');fR(x+0.13,y-0.05,y+0.05,17.3,18,'#8b93a7');};
    {const v=L.vanities.m;put(X,v.y1,()=>mirror(v.x0,v.y0+0.05,v.y1-0.05,18,32));}
    {const v=L.vanities.f;put(X+3,v.y1,()=>mirror(v.x0,v.y0+0.05,v.y1-0.05,18,32));put(X+3,v.dryer,()=>dryer(v.x0,v.dryer));}
    {const m=L.makeup;put(X+3,m.y1,()=>mirror(m.x0,m.y0+0.08,m.y1-0.08,18,30));}
    // urinals on the pantry wall, with solid modesty screens in the wall colour
    L.urinals.forEach(u=>put(X,u,()=>{const x=L.walls.pantry.x+L.walls.pantry.t;box(x,u-0.18,0.28,0.36,7,18,WHITE,'#e3ddd0','#d6cfbf');fR(x+0.28,u-0.11,u+0.11,9,15.5,'#d9dbe2');box(x,u-0.03,0.06,0.06,18,24,STEEL);}));
    for(const[wx,wt]of[[L.walls.pantry.x,L.walls.pantry.t],[L.walls.split.x,L.walls.split.t]])for(let y=Y;y<F;y++){const k=Math.round(wx===X?X:X+3)+','+y;
      items.push({z:wx+y+0.3,f:()=>{wallX(wx,wt,y,y+1,HT.room);(deco[k]||[]).forEach(f=>f());}});}
    L.screens.forEach(s=>items.push({z:X+s+0.5,f:()=>{const x=L.walls.pantry.x+L.walls.pantry.t;box(x,s-0.02,0.38,0.04,6,22,cap,th.wr,shade(th.wr,-34));}}));
    // ---- the front wall (with the two doorways) and the women's room's east wall: office walls at 70 % height, drawn
    // like the back wall (wall colour, skirting, top band, cap). The office itself is open on its front and east, so
    // these are the only outer walls that face the camera; they are solid, and a little of the rooms shows over them.
    const fw=L.walls.front,ew=L.walls.east,OH=HT.outer,ZT=OH+3,DH=HT.door;
    const frontPiece=(xa,xb,z0)=>{box(xa,fw.y,xb-xa,fw.t,z0,OH,th.trim,th.wr,shade(th.wr,-34));box(xa,fw.y,xb-xa,fw.t,OH,ZT,cap,th.trim,th.trim);
      if(z0===0)fL(xa,xb,fw.y+fw.t,0,4,th.trim);};
    // a pixel pictogram lying in the wall plane y (one font pixel per screen pixel), from its top-left corner
    const picto=(x,y,z,rows,col)=>{const[px,py]=P(x,y,z),c=ctx;c.save();c.translate(Math.round(px),Math.round(py));c.transform(1,0.5,0,1,0,0);c.fillStyle=col;
      rows.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='#')c.fillRect(i,j,1,1);});c.restore();};
    const PICTO={m:['..#..','.....','.###.','#.#.#','..#..','.#.#.','.#.#.'],f:['..#..','.....','.###.','#.#.#','.###.','#####','.#.#.']};
    // Door signs: a small white plaque with a trim frame on the wall just west of each doorway, at eye level, carrying the
    // room's pictogram in its accent colour (no words: a real door sign is about this size).
    const plaque=(d)=>{const x0=d.x0-0.52,x1=d.x0-0.1,y=fw.y+fw.t+0.003;fL(x0,x1,y,19,29,th.trim);fL(x0+0.04,x1-0.04,y,20,28,WHITE);picto(x0+0.07,y,27.5,PICTO[d.room],ACC[d.room]);};
    const solid=[];for(let x=X;x<ew.x;x=Math.floor(x)+1)if(!L.doors.some(d=>x>=d.x0&&x<d.x1))solid.push([x,Math.min(Math.floor(x)+1,ew.x)]);
    for(const[xa,xb]of solid)items.push({z:xa+0.5+F,f:()=>{frontPiece(xa,xb,0);for(const d of L.doors)if(d.x0>xa&&d.x0<=xb)plaque(d);}});
    const tiles=[[ew.y0,Y+1]];for(let y=Y+1;y<F;y++)tiles.push([y,y+1]);tiles[tiles.length-1][1]=ew.y1;
    for(const[ya,yb]of tiles)items.push({z:X1+Math.max(ya,Y)+0.4,f:()=>{
      box(ew.x,ya,ew.t,yb-ya,0,OH,th.trim,shade(th.wl,-20),th.wl);box(ew.x,ya,ew.t,yb-ya,OH,ZT,cap,th.trim,th.trim);fR(X1,ya,yb,0,4,th.trim);}});
    // Swing doors (RestroomLogic.doorSwing): a leaf in the office door's colours (frame, panel, small window, kick
    // panel) with a steel push plate on each face, hung on the west jamb; shut, or swung about 70° away from whoever
    // is in the doorway. The lintel above is part of the wall.
    const swing=RestroomLogic.doorSwing(L,this.agents.filter(a=>!a.gone));
    L.doors.forEach((d,i)=>items.push({z:(d.x0+d.x1)/2+F,f:()=>{
      // the lintel and the frame round the opening; a leaf pushed into the room is behind them, one pushed out in front
      const s=swing[i],frame=()=>{frontPiece(d.x0,d.x1,DH);
        fL(d.x0,d.x0+0.06,fw.y+fw.t+0.002,0,DH,'#5c4330');fL(d.x1-0.06,d.x1,fw.y+fw.t+0.002,0,DH,'#5c4330');fL(d.x0,d.x1,fw.y+fw.t+0.002,DH-1.5,DH,'#5c4330');};
      if(s>=0)frame();
      const a=s?1.22:0,hx=d.x0+0.07,hy=d.y,w=(d.x1-d.x0)-0.14,ux=Math.cos(a),uy=s*Math.sin(a);
      const Q=(u,z)=>K.P(hx+ux*u,hy+uy*u,z),rect=(u0,u1,z0,z1,c)=>K.poly([Q(u0,z0),Q(u1,z0),Q(u1,z1),Q(u0,z1)],c);
      const tone=c=>s<0?shade(c,-14):c;
      rect(0,w,0.5,DH-1.5,tone('#5c4330'));rect(0.04,w-0.04,1.5,DH-2.5,tone('#8a5a3a'));
      rect(0.18,w-0.18,3,DH*0.3,tone('#7a4f2f'));rect(0.25,w-0.25,DH*0.6,DH*0.85,tone('#9fd3ff'));rect(0.28,0.4,DH*0.64,DH*0.8,tone('#cfeaff'));
      rect(w-0.2,w-0.1,DH*0.4,DH*0.56,tone(STEEL));
      if(s<0)frame();}}));

    // ---- stalls: solid accent panels raised off the floor, wall-hung toilets, doors swung inward or shut ----
    L.stalls.forEach((s,i)=>{const acc=ACC[s.room],room=L.rooms[s.room],first=!i||L.stalls[i-1].room!==s.room;
      items.push({z:s.x0+s.y1+0.1,f:()=>{
        const cx=(s.x0+s.x1)/2,y0=s.y0,y1=s.y1,zb=HT.stallFoot,zt=HT.stall,shut=occupied.has(i),pc=shade(acc,30);
        fL(cx-0.09,cx+0.09,y0+0.005,19,23,'#e6e9ef');fL(cx-0.02,cx+0.02,y0+0.01,20,22,STEEL);
        box(cx-0.17,y0,0.34,0.44,6,11,WHITE,'#e3ddd0','#d6cfbf');top(cx-0.13,y0+0.06,0.26,0.34,11.01,'#e8e2d6');
        if(s.room==='f'){box(s.x0+0.08,y0+0.8,0.15,0.15,0,5,STEEL);box(s.x0+0.07,y0+0.79,0.17,0.17,5,6,'#aab4c6');}
        const panel=x=>{box(x,y0,0.05,y1-y0,zb,zt,pc);box(x,y1-0.06,0.05,0.05,0,zb,STEEL);};
        if(first)panel(s.x0);
        const hx=s.x0+0.1,dw=(s.x1-s.x0)-0.2;
        if(!shut){const ex=hx+dw*Math.cos(1.42),ey=y1-dw*Math.sin(1.42);
          K.poly([K.P(hx,y1,zb),K.P(ex,ey,zb),K.P(ex,ey,zt),K.P(hx,y1,zt)],shade(acc,-6));K.poly([K.P(hx,y1,zt),K.P(ex,ey,zt),K.P(ex+0.04,ey+0.02,zt),K.P(hx+0.04,y1,zt)],pc);}
        panel(Math.min(s.x1,room.x1-0.08)-0.05);
        box(s.x0,y1-0.04,0.1,0.04,zb,zt,pc);box(s.x1-0.1,y1-0.04,0.1,0.04,zb,zt,pc);
        if(shut){box(hx,y1-0.035,dw,0.03,zb,zt,pc,shade(acc,12));fL(s.x1-0.22,s.x1-0.17,y1+0.001,15,16,STEEL);}
        fL(s.x1-0.09,s.x1-0.04,y1+0.002,20,22,shut?'#e5484d':'#46a758');}});});

    // ---- vanities: the pantry's base cabinet and worktop turned to face the room, steel sinks, chrome taps ----
    ['m','f'].forEach(r=>{const v=L.vanities[r];
      // sorted just after the room-wall tiles it stands against, and before anyone washing at it
      items.push({z:(r==='m'?L.walls.pantry.x:L.walls.split.x)+F-1+0.4,f:()=>{const len=v.y1-v.y0,w=v.x1-v.x0;
        box(v.x0+0.04,v.y0+0.04,w-0.06,len-0.08,0,2,'#2d1c10');box(v.x0,v.y0,w-0.02,len,2,12.5,WOOD,'#8a5f30','#74501f');
        const n=Math.round(len/0.6),dh=len/n;
        for(let i=0;i<n;i++){const y=v.y0+i*dh;fR(v.x1-0.02,y+0.04,y+dh-0.04,3,11.6,shade(WOOD,10));fR(v.x1-0.02,y+0.08,y+dh-0.08,4,10.6,shade(WOOD,-10));fR(v.x1-0.02,y+0.1,y+dh-0.1,4.4,10.2,shade(WOOD,4));fR(v.x1-0.02,y+0.12,y+0.16,8.6,9.6,'#e0b23a');}
        box(v.x0-0.02,v.y0-0.03,w+0.04,len+0.06,12.5,14,WORK,'#d6cfbf','#bfb7a6');
        v.basins.forEach(b=>{top(v.x0+0.12,b-0.24,w-0.2,0.48,14.02,'#aab4c6');top(v.x0+0.16,b-0.19,w-0.28,0.38,14.03,'#6b768c');box(v.x0+0.03,b-0.03,0.06,0.06,14,19,STEEL);box(v.x0+0.03,b-0.03,0.18,0.05,18,19,STEEL);});}});});
    {const[bx,by]=L.bin;items.push({z:bx+by,f:()=>{box(bx-0.1,by-0.1,0.2,0.2,0,6,STEEL,'#aab4c6','#8f9ab0');box(bx-0.1,by-0.1,0.2,0.2,6,6.8,'#aab4c6');}});}
    {const v=L.vanities.f;items.push({z:v.x0+0.2+v.dryer,f:()=>{box(v.x0+0.07,v.dryer-0.09,0.18,0.18,0,6,STEEL,'#aab4c6','#8f9ab0');box(v.x0+0.07,v.dryer-0.09,0.18,0.18,6,6.8,'#aab4c6');}});}

    // ---- the makeup counter (the pantry's worktop on a small cabinet) and the pantry's bar stool ----
    {const m=L.makeup;items.push({z:X+3+m.y1-0.2,f:()=>{box(m.x0,m.y0,m.x1-m.x0,m.y1-m.y0,0,12,WOOD,'#8a5f30','#74501f');box(m.x0-0.02,m.y0-0.02,m.x1-m.x0+0.04,m.y1-m.y0+0.04,12,13.5,WORK,'#d6cfbf','#bfb7a6');}});
      const[sx,sy]=m.stool;items.push({z:sx+sy,f:()=>item('stool',sx-0.2,sy-0.2)});}

    // ---- plants: the pantry's white pot plant ----
    for(const[px,py]of[L.plants.m,L.plants.f,L.plants.lobby])items.push({z:px+py,f:()=>item('potplant',px-0.25,py-0.25)});

    // ---- lobby: the smoking corner's slatted bench, a hand-sanitiser stand, a sign post like the door plaques ----
    {const b=L.lobby.bench;items.push({z:(b.x0+b.x1)/2+b.y1,f:()=>{const bw='#c79a5e',metal='#3d4350';
      for(const lx of[b.x0+0.15,b.x1-0.23])box(lx,b.y0+0.05,0.08,b.y1-b.y0-0.1,0,5.8,metal);
      box(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0,5.8,7,bw,shade(bw,-25),shade(bw,-40));
      for(let k=1;k<3;k++)top(b.x0,b.y0+k*(b.y1-b.y0)/3,b.x1-b.x0,0.01,7.01,shade(bw,-30));}});}
    {const[sx,sy]=L.lobby.sanitizer;items.push({z:sx+sy+0.2,f:()=>{box(sx-0.09,sy-0.09,0.18,0.18,0,1,STEEL);box(sx-0.02,sy-0.02,0.04,0.04,1,20,STEEL);
      box(sx-0.08,sy-0.07,0.16,0.14,20,27,WHITE,'#e3ddd0','#d6cfbf');fL(sx-0.05,sx+0.05,sy+0.07,22,25,'#46a758');box(sx-0.06,sy-0.02,0.12,0.12,13,14,'#aab4c6');}});}
    {const[tx,ty]=L.lobby.totem;items.push({z:tx+ty,f:()=>{box(tx-0.03,ty-0.03,0.06,0.06,0,20,STEEL);box(tx-0.4,ty-0.03,0.8,0.06,19,29,th.trim);
      fL(tx-0.36,tx+0.36,ty+0.031,20,28,WHITE);picto(tx-0.34,ty+0.032,27.5,PICTO.m,ACC.m);picto(tx+0.04,ty+0.032,27.5,PICTO.f,ACC.f);}});}
  }
  // Words painted on the floor like PANTRY (in the office's floor paint): reading along +x, `s` px per font pixel.
  // A label in another language may have letters the 3×5 font lacks (CJK, Í…): it is then painted with fillText, in the
  // same floor plane and size.
  restroomPaint(ctx,[px,py],txt,col,s){
    ctx.save();ctx.translate(Math.round(px),Math.round(py));ctx.transform(1,0.5,-1,0.5,0,0);ctx.scale(s,s);ctx.globalAlpha=0.6;ctx.fillStyle=col;
    if(![...txt].every(ch=>ch===' '||RESTROOM_GLYPH(ch).length)){ctx.font="bold 6px 'JetBrains Mono',sans-serif";ctx.textBaseline='top';ctx.fillText(txt,0,-1);
      ctx.restore();ctx.globalAlpha=1;return;}
    let x=0;for(const ch of txt){if(ch===' '){x+=3;continue;}const g=RESTROOM_GLYPH(ch),up=g.length>5?g.length-5:0;
      g.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='#')ctx.fillRect(x+i,j-up,1,1);});x+=(ch==='\u1EEE'?4:3)+1;}
    ctx.restore();ctx.globalAlpha=1;
  }
  drawDesk(G,d,i){
    const{ctx,poly,box,rect,t,df}=G,{gx,gy}=d,owner=this.agents.find(a=>a.desk===i&&!a.leaving&&!a.parent);
    const at=owner&&owner.seated,st=owner&&owner.status;
    // Bàn chưa ai nhận (khác bàn có chủ đang ra pantry): dọn trống, ghế đẩy vào, vẽ bằng bảng màu xám tối.
    const vacant=!owner,co=vacant?-0.2:0,th=vacant?vacantTheme(G.th):G.th;
    let scr=th.off;
    if(at)scr={error:'#e5484d',permission:'#f5a524',done:'#46a758',idle:shade(th.off,10)}[st]||(df<0.5?'#0f2233':th.stroke?'#2f5bff':'#203040');
    if(at&&df<0.7&&st!=='idle'){ctx.globalAlpha=0.16*(1-df);poly([P(gx+0.3,gy+0.9),P(gx+1.7,gy+0.9),P(gx+1.7,gy+2),P(gx+0.3,gy+2)],scr==='#0f2233'?th.on:scr,null);ctx.globalAlpha=1;}
    const metal=vacant?th._metal:th.stroke?'#ffffff':'#2d3142';
    box(gx+0.92,gy+1.36+co,0.16,0.16,0,3,metal);
    [[-0.22,0],[0.22,0],[0,-0.2],[0,0.22]].forEach(([dx,dy])=>{const[wx,wy]=P(gx+1+dx,gy+1.44+co+dy);rect(wx-1,wy-1,2,2,th.stroke||'#1a1a1a');});
    box(gx+0.66,gy+1.18+co,0.68,0.5,3,6,th.chair);
    if(!at){box(gx+0.97,gy+1.62+co,0.06,0.06,3,7,metal);box(gx+0.7,gy+1.6+co,0.6,0.09,7,13,th.chair);}
    [[0.1,0.15],[1.82,0.15]].forEach(([x,y])=>box(gx+x,gy+y,0.08,0.08,0,9,th.dl));
    box(gx+1.35,gy+0.2,0.55,0.66,0,9,th.dt,th.dl,th.dr);
    poly([P(gx+1.45,gy+0.86,6),P(gx+1.8,gy+0.86,6),P(gx+1.8,gy+0.86,6.8),P(gx+1.45,gy+0.86,6.8)],shade(th.dl,-30),null);
    poly([P(gx+1.45,gy+0.86,2.5),P(gx+1.8,gy+0.86,2.5),P(gx+1.8,gy+0.86,3.3),P(gx+1.45,gy+0.86,3.3)],shade(th.dl,-30),null);
    box(gx+0.1,gy+0.8,0.08,0.08,0,9,th.dl);
    box(gx+0.05,gy+0.12,1.9,0.78,9,11,th.dt,th.dl,th.dr);
    if(!vacant){
    box(gx+0.18,gy+0.3,0.34,0.42,11,12,'#fbfbf7','#dcdcd4','#c9c9c0');
    box(gx+0.22,gy+0.26,0.34,0.42,12,12.6,'#ffffff','#e4e4dc','#d0d0c8');
    [0,1,2].forEach(k=>poly([P(gx+0.27,gy+0.36+k*0.09,12.6),P(gx+0.5,gy+0.36+k*0.09,12.6),P(gx+0.5,gy+0.38+k*0.09,12.6),P(gx+0.27,gy+0.38+k*0.09,12.6)],'#b9c4d6',null));
    const acc=i%3;
    if(acc===0){box(gx+0.12,gy+0.74,0.06,0.06,11,22,metal);box(gx+0.06,gy+0.66,0.22,0.16,21,24,'#ffd166');if(df<0.7&&at){ctx.globalAlpha=0.12*(1-df);poly([P(gx,gy+0.4,11),P(gx+0.6,gy+0.4,11),P(gx+0.6,gy+0.9,11),P(gx,gy+0.9,11)],'#ffd166',null);ctx.globalAlpha=1;}}
    else if(acc===1){box(gx+0.6,gy+0.18,0.14,0.14,11,14,th.pot);const[cx,cy]=P(gx+0.67,gy+0.25,14);rect(cx-1,cy-5,3,5,th.plant);rect(cx-3,cy-3,2,2,th.plant);}
    else{box(gx+0.6,gy+0.2,0.06,0.2,11,17,metal);poly([P(gx+0.66,gy+0.22,12),P(gx+0.66,gy+0.38,12),P(gx+0.66,gy+0.38,16),P(gx+0.66,gy+0.22,16)],'#9fd3ff',null);}
    }
    box(gx+0.85,gy+0.24,0.3,0.2,11,12,metal);box(gx+0.96,gy+0.28,0.08,0.06,12,15,metal);
    box(gx+0.6,gy+0.2,0.8,0.12,14,28,th.mon);
    const S=(x0,x1,z0,z1,col)=>poly([P(gx+x0,gy+0.33,z0),P(gx+x1,gy+0.33,z0),P(gx+x1,gy+0.33,z1),P(gx+x0,gy+0.33,z1)],col,null);
    S(0.65,1.35,16,27,scr);
    if(at&&st==='working'){const ph=Math.floor(t*5+i),cols=th.stroke?['#ffffff','#bcd0ff','#ffffff','#bcd0ff']:['#ff79c6','#8be9fd','#f1fa8c','#50fa7b'];
      for(let k=0;k<4;k++){const ind=((ph+k)%3)*0.06,w=0.14+((ph*3+k*7)%5)*0.06;S(0.7+ind,0.7+ind+w,25-k*2.3,25.8-k*2.3,cols[(ph+k)%4]);}}
    else if(at&&st==='thinking'){if(Math.floor(t*2)%2)S(0.72,0.78,22,24,'#e6e9ef');}
    else if(at&&(st==='permission'||st==='error')){S(0.96,1.04,19,25,'#ffffff');S(0.96,1.04,17,18.2,'#ffffff');}
    else if(at&&st==='done'){S(0.85,0.9,20,22,'#ffffff');S(0.9,0.98,19,20.5,'#ffffff');S(0.98,1.15,20,24,'#ffffff');}
    else if(at&&st==='idle'){const p=(t*0.25+i*0.13)%1;S(0.68+p*0.6,0.72+p*0.6,18+((i*5+Math.floor(t))%7),19+((i*5+Math.floor(t))%7),'#8b93a7');}
    box(gx+0.68,gy+0.58,0.6,0.18,11,12,th.kb);
    for(let k=0;k<6;k++)for(let r=0;r<2;r++){const[kx,ky]=P(gx+0.73+k*0.09,gy+0.62+r*0.07,12);const hot=at&&st==='working'&&((Math.floor(t*12)+k*3+r)%7===0);rect(kx,ky,1,1,hot?'#ffffff':shade(th.kb,20));}
    box(gx+1.36,gy+0.6,0.08,0.13,11,12.5,vacant?th._mouse:th.stroke?'#ffffff':'#d9dbe2');
    const mug=['#e5484d','#3e8ed0','#f5a524','#46a758','#8e4ec6','#ffffff'][i%6];
    if(!vacant)box(gx+1.62,gy+0.34,0.16,0.16,11,15.5,mug);
    if(at&&(st==='working'||st==='thinking'))for(let k=0;k<2;k++){const ph=(t*0.9+k*0.5+i*0.1)%1;const[sx,sy]=P(gx+1.7,gy+0.42,17+ph*9);ctx.globalAlpha=0.7*(1-ph);rect(sx+(Math.floor(ph*4)%2),sy,1,2,'#e6e9ef');ctx.globalAlpha=1;}
  }

  actArms(R,act,sx,by,t,sh,shD,sk){
    const ph=Math.floor(t*2)%2, L=()=>{R(sx-5,by-11,1,5,shD);R(sx-5,by-6,1,1,sk);};
    if(act==='coffee'){L();R(sx+4,by-14-ph,1,5,shD);R(sx+4,by-15-ph,1,1,sk);}
    else if(act==='fridge'){L();R(sx+4,by-11,3,1,shD);R(sx+7,by-11,1,1,sk);}
    else if(act==='water'){L();const up=Math.floor(t*0.7)%3===0;R(sx+4,by-11,1,up?2:4,shD);R(sx+3,by-(up?14:9),2,3,'#ffffff');}
    else if(act==='snack'||act==='vending'){L();R(sx+4,by-10,3,1,shD);R(sx+7,by-10-(Math.floor(t*3)%2),1,1,sk);}
    else if(act==='microwave'){L();R(sx+4,by-13,1,5,shD);R(sx+4,by-14,1,1,sk);}
    else if(act==='phone'){R(sx-5,by-11,1,4,shD);R(sx+4,by-11,1,4,shD);R(sx-4,by-8,8,1,sk);R(sx-1,by-11,3,4,'#1a1a1a');R(sx,by-10,1,2,ph?'#5ef2ff':'#8be0b4');}
    else if(act==='smoke'){// every few seconds the hand comes up for a slow drag; the rest of the time it rests at the waist
      L();if(SmokeLogic.cycle(t).drag){R(sx+4,by-13,1,3,shD);R(sx+2,by-14,2,1,sk);R(sx,by-13,2,1,'#f3efe2');}
      else{R(sx+4,by-11,1,4,shD);R(sx+4,by-7,1,1,sk);R(sx+5,by-8,2,1,'#f3efe2');}}
    else if(act==='stretch'){const p=Math.floor(t*1.5)%2;R(sx-6,by-17+p*2,2,7,sh);R(sx+4,by-17+(1-p)*2,2,7,sh);R(sx-6,by-18+p*2,2,1,sk);R(sx+4,by-18+(1-p)*2,2,1,sk);}
    else L();
  }

  drawPerson(G,a){
    const{ctx,poly,box,rect,th,t}=G;
    if(a.sleeping)return this.drawSleeper(G,a);
    let[sx,sy]=a.seated?P(a.x,a.y,11.5):PA(a.x,a.y);sx=Math.round(sx);sy=Math.round(sy);
    if(a.status==='error'&&!a.moving&&!a.seated)sx+=Math.floor(t*16)%2?1:-1;
    if(this.state.sel===a.id){const r=0.45+Math.sin(t*5)*0.05;poly([PA(a.x-r,a.y-r),PA(a.x+r,a.y-r),PA(a.x+r,a.y+r),PA(a.x-r,a.y+r)],null,'#ffd166');}
    if(a.status==='idle'&&!a.moving&&a.actNow==='bath'){// only head and shoulders above the water, ripples around
      const R=rect,bob=Math.round(Math.sin(t*2+a.id)*0.6),y0=sy+1+bob;
      for(let k=0;k<2;k++){const p=(t*0.5+k*0.5+a.id*0.13)%1;ctx.strokeStyle='rgba(255,255,255,'+(0.55*(1-p))+')';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(sx,sy+1,5+p*6,2+p*2.5,0,0,Math.PI*2);ctx.stroke();}
      R(sx-4,y0-5,8,4,a.shirt);R(sx+2,y0-5,2,4,shade(a.shirt,-30));
      R(sx-3,y0-11,6,6,a.skin);R(sx+2,y0-11,1,6,shade(a.skin,-25));PERSON.hairBath(R,LOOK(a),sx,y0,a.skin);
      R(sx-2,y0-8,1,1,'#1a1a1a');R(sx+1,y0-8,1,1,'#1a1a1a');
      ctx.fillStyle='rgba(120,190,240,0.55)';ctx.beginPath();ctx.ellipse(sx,y0-1,6,2,0,0,Math.PI*2);ctx.fill();
      if(a.parent){R(sx-3,y0-13,6,1,'#ffd166');}
      return;
    }
    if(!a.seated){ctx.fillStyle=th.shadow;ctx.beginPath();ctx.ellipse(sx,sy,6,3,0,0,Math.PI*2);ctx.fill();}
    const R=rect,sh=a.shirt,shD=shade(sh,-30),shL=shade(sh,30),sk=a.skin,skD=shade(sk,-25),L=LOOK(a),st=a.status;
    if(a.seated){
      const skey=st==='working'&&a.tool&&a.tool[0]==='Bash'?'terminal':st==='talking'?'visitor':st==='waiting'?'subagent':st;
      if(skey==='reading'){sx+=1;sy-=1;}if(skey==='thinking'||skey==='terminal'){sx-=1;sy+=1;}
      if(skey==='error')sx+=Math.floor(t*16)%2?1:-1;
      const ph=Math.floor(t*8)%2;
      const pre=[],post=[];
      if(skey==='working'){post.push(()=>{R(sx+5,sy-10,2,3,shD);R(sx+7,sy-11,4,2,sh);R(sx+11,sy-11-ph,2,2,sk);});pre.push(()=>{R(sx+8,sy-13,3,2,shD);R(sx+11,sy-13+ph,2,2,skD);});}
      else if(skey==='reading'){post.push(()=>{R(sx+5,sy-10,2,3,shD);R(sx+7,sy-10,5,2,sh);R(sx+12,sy-10,2,2,sk);});}
      else if(skey==='terminal'){const up=Math.floor(t*0.6)%3===0;post.push(()=>{R(sx+5,sy-10,2,3,shD);R(sx+7,sy-10,4,2,sh);R(sx+11,sy-10,2,2,sk);
        R(sx-7,sy-11,2,4,sh);R(sx-7,sy-(up?17:14),2,4,sh);R(sx-8,sy-(up?20:17),2,2,sk);R(sx-10,sy-(up?22:19),3,4,'#c0392b');R(sx-11,sy-(up?21:18),1,2,'#c0392b');
        if(!up)for(let k=0;k<2;k++){const p=(t*0.9+k*0.5)%1;ctx.globalAlpha=0.7*(1-p);R(sx-9+(k%2),sy-21-p*7,1,2,'#e6e9ef');ctx.globalAlpha=1;}});}
      else if(skey==='thinking'){post.push(()=>{R(sx+5,sy-15,2,5,shD);R(sx+4,sy-19,2,4,sh);R(sx+3,sy-20,2,2,sk);R(sx-6,sy-10,1,5,shD);});}
      else if(skey==='permission'){const w=Math.floor(t*3)%2;post.push(()=>{R(sx+5,sy-22-w,2,12+w,sh);R(sx+5,sy-24-w,2,2,sk);R(sx+4,sy-25-w,1,2,sk);R(sx-6,sy-10,1,5,shD);});}
      else if(skey==='error'){post.push(()=>{R(sx-7,sy-18,2,8,sh);R(sx+5,sy-18,2,8,shD);R(sx-6,sy-21,2,3,sk);R(sx+4,sy-21,2,3,sk);
        for(let k=0;k<3;k++){const p=(t*0.8+k*0.33)%1;ctx.globalAlpha=0.6*(1-p);R(sx-2+k*2+Math.round(Math.sin(p*7)*1.5),sy-24-p*9,2,2,'#aab2c5');ctx.globalAlpha=1;}});}
      else if(skey==='done'){const b=Math.floor(t*4)%2;post.push(()=>{R(sx-8,sy-23-b,2,13,sh);R(sx+6,sy-23-b,2,13,shD);R(sx-9,sy-25-b,2,2,sk);R(sx+7,sy-25-b,2,2,sk);});}
      else if(skey==='visitor'){const g=Math.floor(t*2)%2;post.push(()=>{R(sx+5,sy-10,2,3,shD);R(sx+7,sy-12-g,3,2,sh);R(sx+10,sy-13-g,2,2,sk);R(sx-6,sy-10,1,5,shD);});}
      else if(skey==='subagent'){post.push(()=>{R(sx-5,sy-8,10,2,shL);R(sx-6,sy-10,1,4,shD);R(sx+5,sy-10,1,4,shD);});}
      else{post.push(()=>{R(sx-6,sy-10,1,5,shD);R(sx+5,sy-10,1,5,shD);});}
      pre.forEach(f=>f());
      R(sx-5,sy-11,10,11,sh);R(sx+2,sy-11,3,11,shD);R(sx-5,sy-11,10,1,shL);R(sx-1,sy-10,1,9,shD);
      R(sx-1,sy-13,3,2,skD);
      const hy=sy-21+(skey==='reading'?1:0);
      if(skey==='visitor'||skey==='permission')PERSON.hairProfile(R,L,sx,hy,sh,sk);
      else PERSON.hairSeat(R,L,sx,hy,sh,sk);
      post.forEach(f=>f());
      if(a.parent){R(sx-3,hy-1,6,2,'#ffd166');R(sx,hy-4,1,3,'#ffd166');R(sx-1,hy-5,3,1,'#ffffff');}
      const ix=sx+4,iy=sy-36;
      const _icon=(bg,pat)=>{R(ix-1,iy-1,7,7,bg);R(ix+1,iy+6,3,1,bg);R(ix+2,iy+7,1,1,bg);pat.forEach((row,ry)=>[...row].forEach((ch,rx)=>{if(ch==='#')R(ix+rx,iy+ry,1,1,'#ffffff');}));};
      if(skey==='thinking'){R(ix-4,iy+1,13,7,'#ffffff');R(ix-5,iy+2,15,5,'#ffffff');R(ix-2,iy+9,2,2,'#ffffff');R(ix-4,iy+12,1,1,'#ffffff');const n=Math.floor(t*3)%4;for(let k=0;k<3;k++)R(ix-1+k*4,iy+4,2,2,k<n?'#8e4ec6':'#d6c7ea');}
      else if(skey==='permission'&&Math.floor(t*3)%2)_icon('#f5a524',['..#..','..#..','..#..','.....','..#..']);
      else if(skey==='error')_icon('#e5484d',['#...#','.#.#.','..#..','.#.#.','#...#']);
      else if(skey==='done'){_icon('#46a758',['....#','...#.','#.#..','.#...','.....',]);
        const cc=['#e5484d','#ffd166','#46a758','#3e8ed0','#e93d82'];for(let k=0;k<12;k++){const p=(t*0.6+k*0.083)%1;R(sx-18+((k*11)%36),sy-34+p*36,1+(k%2),1,cc[k%5]);}}
      else if(skey==='subagent'){const r=Math.floor(t*1.2)%4;_icon('#c9a227',['#####','.###.','..#..','.###.','#####']);if(r===1||r===3)R(ix+2,iy+2,1,1,'#ffd166');}
    }else{
      const sit=a.stool&&!a.moving;
      const walk=a.moving?Math.floor(t*9+a.id)%2:0,tap=st==='waiting'&&!a.moving?Math.floor(t*5)%2:0,by=sy-(a.moving&&walk?1:0)-(sit?(a.stool===2?9:4):0);
      const l1=walk?1:0,l2=walk?0:(tap?1:0);
      R(sx-4,by-11,8,7,sh);R(sx+2,by-11,2,7,shD);R(sx-4,by-11,1,7,shL);
      // the top (collar and tie, hoodie, open jacket or cardigan, blouse, dress) and its sleeve colour for the arms
      const slv=PERSON.top(R,L,sx,by,sh,sk,skD,a.dirFront),slvD=shade(slv,-30);
      if(sit)PERSON.legsSit(R,L,sx,by,sh);else PERSON.legs(R,L,sx,by,sh,l1,l2,a.dirFront);
      const sw=a.moving?(walk?1:-1):0,wave=st==='talking'&&!a.moving?Math.floor(t*4)%2:0,up=st==='done'&&!a.moving;
      const act=!a.moving&&st==='idle'?a.actNow:null;
      const tp=t+a.id*1.37;// per-person phase, so a group of smokers never moves in step
      if(act&&(!sit||act==='smoke')){this.actArms(R,act,sx,by,act==='smoke'?tp:t,slv,slvD,sk);}
      else if(up){R(sx-6,by-17,2,7,slv);R(sx+4,by-17,2,7,slv);R(sx-6,by-18,2,2,sk);R(sx+4,by-18,2,2,sk);}
      else{R(sx-5,by-11+sw,1,5,slvD);R(sx-5,by-6+sw,1,1,sk);
        if(st==='waiting'&&!a.moving){R(sx+4,by-10,1,3,slvD);R(sx+3,by-7,1,1,sk);}
        else{R(sx+4,by-11-sw-(wave?3:0),1,5,slvD);R(sx+4,by-6-sw-(wave?3:0),1,1,sk);}}
      R(sx-1,by-12,2,1,skD);
      const hy=by-18;
      R(sx-3,hy,6,6,sk);R(sx+2,hy,1,6,skD);
      if(a.dirFront){
        PERSON.hairFront(R,L,sx,hy,sh);
        const blink=((t+a.id*0.71)%3.2)<0.12;
        PERSON.face(R,L,sx,hy,sk,skD,blink,st==='talking'&&!a.moving&&Math.floor(t*6)%2,a.acc==='glasses');
      }else PERSON.hairBack(R,L,sx,hy,sh,sk);
      if(a.acc==='headset'){R(sx-3,hy-2,6,1,'#1a1a1a');R(sx-4,hy+1,1,3,'#1a1a1a');R(sx+3,hy+1,1,3,'#1a1a1a');}
      if(act==='smoke'){// ember at the cigarette tip (brighter during a drag), a thin wisp rising off it, a puff after each drag
        const{drag,exhale}=SmokeLogic.cycle(tp),[ex,ey]=drag?[sx-1,by-13]:[sx+7,by-8],reduced=this.env&&this.env.reduced;
        if(G.df<0.6){ctx.globalAlpha=0.35*(1-G.df/0.6);R(ex-1,ey,3,1,'#ff9a3d');R(ex,ey-1,1,3,'#ff9a3d');ctx.globalAlpha=1;}
        R(ex,ey,1,1,drag?'#ffb347':'#e5484d');
        if(!reduced){
          for(let k=0;k<3;k++){const p=(tp*0.3+k/3)%1,s=p>0.55?2:1;ctx.globalAlpha=0.5*(1-p);R(ex+p*5+Math.sin(tp*1.3+k*2.1)*1.2,ey-2-p*14,s,s,'#dfe3ea');}
          if(exhale!==null){const p=exhale;ctx.globalAlpha=0.45*(1-p);R(sx+1+p*5,by-14-p*7,2+Math.round(p*3),2,'#e6e9ef');}
          ctx.globalAlpha=1;}
      }
      if(st==='idle'&&!a.moving&&a.actNow==='table'){R(sx+4,by-9,2,3,'#ffffff');R(sx+6,by-8,1,1,'#ffffff');if(Math.floor(t*2+a.id)%2)R(sx+4,by-12,1,2,'#c9cfdc');}
      if(a.parent){R(sx-3,hy-2,6,2,'#ffd166');R(sx,hy-5,1,3,'#ffd166');R(sx-1,hy-6,3,1,'#ffffff');}
      if(st==='talking'&&!a.moving){for(let k=0;k<3;k++){if((Math.floor(t*4)+k)%3===0)continue;R(sx-8-k*2,hy+2-k,1,1+k,'#ffffff');}}
      if(th.stroke){ctx.strokeStyle='#33415c';ctx.strokeRect(sx-4.5,hy-1.5,9,19);}
    }
    if(!a.seated){
    const[hx,hy]=this.headPos(a),col=(ST[st]||ST.working)[1];
    if(st==='thinking'){const n=Math.floor(t*3)%4;R(hx-6,hy-8,13,6,'#ffffff');R(hx-7,hy-7,15,4,'#ffffff');R(hx-2,hy-1,2,2,'#ffffff');for(let k=0;k<3;k++)R(hx-4+k*4,hy-6,2,2,k<n?'#5b8def':'#c8d2e6');}
    else if(st==='idle'&&!a.actNow){for(let k=0;k<2;k++){const p=(t*0.6+k*0.5)%1;ctx.globalAlpha=1-p;text3(ctx,'Z',hx+2+p*6,hy-6-p*12,th.stroke?'#33415c':'#e6e9ef');ctx.globalAlpha=1;}}
    else if(st==='done'){const cc=['#e5484d','#ffd166','#46a758','#3e8ed0','#e93d82'];for(let k=0;k<7;k++){const p=(t*0.8+k*0.17)%1;R(hx-9+((k*7+a.id*3)%18),hy-14+p*16,1,1,cc[k%5]);}R(hx-4,hy-9,9,9,col);ICON.done.forEach((row,ry)=>[...row].forEach((ch,rx)=>{if(ch==='#')R(hx-2+rx,hy-7+ry,1,1,'#ffffff');}));}
    else if(ICON[st]&&st!=='talking'&&!(st==='permission'&&Math.floor(t*3)%2)){
      R(hx-4,hy-9,9,9,col);R(hx-1,hy,3,1,col);ICON[st].forEach((row,ry)=>[...row].forEach((ch,rx)=>{if(ch==='#')R(hx-2+rx,hy-7+ry,1,1,'#ffffff');}));
    }
    }
  }

  stepDogs(dt){
    const w=this.dogWorld,now=new Date();
    w.now+=dt;w.hour=now.getHours()+now.getMinutes()/60;w.snow=this.snowShown||0;w.calm=!!(this.env&&this.env.reduced);
    // People out on the lawn (down the stairs, bathing in the pond) are who the dogs run over to greet.
    // `act` is what they are doing, or the idle spot they are walking to, so a smoker is left alone on the way too.
    // People going to or at the restroom are left out altogether: the dogs leave them be.
    w.agents=this.agents.filter(a=>(a.x>=W||a.y>=H)&&!a.wcIn&&LAWN_WALK.has(Math.floor(a.x)+','+Math.floor(a.y)))
      .map(a=>({id:a.id,x:a.x,y:a.y,act:a.actNow||(a.status==='idle'&&a.idleSpot!=null&&IDLE_SPOTS[a.idleSpot]?IDLE_SPOTS[a.idleSpot].act:null)})).filter(a=>a.act!=='wc');
    DogLogic.step(this.dogs,w,dt);
  }
  // A dog's frame baked once per light level and snow level (like the island), then stamped with one drawImage.
  dogSprite(breed,name,dfB,snB){
    const k=breed+'/'+name+'/'+dfB+'/'+snB,hit=this.dogSprites.get(k);if(hit)return hit;
    if(this.dogSprites.size>300)this.dogSprites.clear();
    const f=DogSprites.frame(breed,name),pal=DogSprites.BREEDS[breed].pal,cv=document.createElement('canvas');
    cv.width=f.w;cv.height=f.h;const c=cv.getContext('2d'),top=new Array(f.w).fill(-1);
    f.rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!=='.'&&top[x]<0)top[x]=y;}));
    f.rows.forEach((row,y)=>[...row].forEach((ch,x)=>{
      if(ch==='.')return;let col=pal[ch];
      // Snow settles on whatever faces the sky: the top pixel of each column (back, head, ears, tail).
      if(snB>=3&&top[x]===y)col=SkyRender.mix(col,'#eef3f7',snB/10*0.75);
      c.fillStyle=SkyRender.mix(col,'#0d1322',DogLogic.nightMix(dfB/10));c.fillRect(x,y,1,1);
    }));
    this.dogSprites.set(k,cv);return cv;
  }
  drawDog(G,d,t,dfB,snB){
    const{ctx,th,rect}=G,p=DogLogic.pose(d,t),f=DogSprites.frame(d.breed,p.frame),img=this.dogSprite(d.breed,p.frame,dfB,snB);
    let[sx,sy]=PG(d.x,d.y);sx=Math.round(sx);sy=Math.round(sy);
    const top=sy-f.h-p.dy,dir=p.flip?-1:1,nose=sx+dir*(f.w-f.ax-1);
    ctx.fillStyle=th.shadow;ctx.beginPath();ctx.ellipse(sx,sy,Math.ceil(f.w/2)-1,2,0,0,Math.PI*2);ctx.fill();
    // Mirroring is a transform on one drawImage; column ax lands on sx either way.
    if(p.flip){ctx.save();ctx.translate(sx+1,0);ctx.scale(-1,1);ctx.drawImage(img,-f.ax,top);ctx.restore();}
    else ctx.drawImage(img,sx-f.ax,top);
    if(d.act==='drink'&&!d.path.length)for(let k=0;k<2;k++){const q=(t*0.7+k*0.5+d.id*0.3)%1;ctx.strokeStyle='rgba(255,255,255,'+(0.5*(1-q))+')';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(nose+dir*2,sy,2+q*4,1+q*2,0,0,Math.PI*2);ctx.stroke();}
    if(d.act==='sleep'){const q=(t*0.3+d.id*0.33)%1;ctx.globalAlpha=Math.min(1,(1-q)*1.5)*0.85;text3(ctx,'Z',sx+dir*3+q*5,top-2-q*12,'#e6e9ef');ctx.globalAlpha=1;}
    // Sitting down by a person: one small heart floats up and fades.
    if(d.act==='sit'&&d.greet!=null){const q=(this.dogWorld.now-(d.since||0))/2.5;if(q<1){ctx.globalAlpha=1-q*q;const hx=nose-dir*3-2,hy=Math.round(top-4-q*8);
      [[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[2,3]].forEach(([a,b])=>rect(hx+a,hy+b,1,1,'#e93d82'));ctx.globalAlpha=1;}}
  }
  drawSleeper(G,a){
    const{ctx,poly,box,rect,th,t}=G,d=DESKS[a.desk],x=d.gx,y=d.gy;
    poly([P(x+0.08,y+0.3,0.5),P(x+1.32,y+0.3,0.5),P(x+1.32,y+1.12,0.5),P(x+0.08,y+1.12,0.5)],th.stroke?'#ffffff':'#d9c27a');
    for(let k=1;k<8;k++)poly([P(x+0.08,y+0.3+k*0.1,0.5),P(x+1.32,y+0.3+k*0.1,0.5),P(x+1.32,y+0.31+k*0.1,0.5),P(x+0.08,y+0.31+k*0.1,0.5)],th.stroke?'#dfe5ef':'#b89f5a',null);
    poly([P(x+0.08,y+1.12,0.5),P(x+1.32,y+1.12,0.5),P(x+1.32,y+1.12,0),P(x+0.08,y+1.12,0)],th.stroke?'#c9d3e3':'#a68b45',null);
    const br=Math.sin(t*2.2+a.id)*0.4;
    box(x+0.14,y+0.42,0.26,0.4,0.5,2.5,'#f6f4ee');
    box(x+0.2,y+0.5,0.2,0.24,2.5,6,a.skin);
    box(x+0.18,y+0.48,0.12,0.28,2.5,6.5,a.hair);
    // long hair fans out over the pillow; a bun or a ponytail sits at the back of the head
    const hs=LOOK(a).hairStyle;
    if(hs==='long'||hs==='wavy'||hs==='bob')box(x+0.09,y+0.44,0.11,hs==='bob'?0.32:0.38,0.5,hs==='bob'?4:3,a.hair);
    else if(hs==='bun')box(x+0.12,y+0.56,0.07,0.12,4,6.5,a.hair);
    else if(hs==='ponytail')box(x+0.08,y+0.58,0.11,0.08,0.5,2.5,shade(a.hair,-26));
    if(a.parent)box(x+0.18,y+0.48,0.08,0.28,6.5,7,'#ffd166');
    box(x+0.4,y+0.44,0.34,0.36,0.5,4.5+br,a.shirt);
    const bl=shade(a.shirt,-50)===a.shirt?'#5b8def':['#3e8ed0','#e5484d','#46a758','#8e4ec6'][a.id%4];
    box(x+0.6,y+0.4,0.62,0.44,0.5,4+br*0.6,bl);
    [0.75,0.92,1.09].forEach(k=>poly([P(x+k,y+0.4,4+br*0.6),P(x+k+0.05,y+0.4,4+br*0.6),P(x+k+0.05,y+0.84,4+br*0.6),P(x+k,y+0.84,4+br*0.6)],shade(bl,40),null));
    box(x+1.2,y+0.5,0.08,0.1,0.5,2,'#141414');box(x+1.2,y+0.66,0.08,0.1,0.5,2,'#141414');
  }

  hit(e){
    const r=e.currentTarget.getBoundingClientRect(),lx=(e.clientX-r.left)/r.width*LW,ly=(e.clientY-r.top)/r.height*LH;
    let best=null,bd=1e9;
    for(const a of this.agents){const[sx,sy]=a.sleeping?P(a.x,a.y,-4):a.seated?P(a.x,a.y,11.5):PA(a.x,a.y);const hw=a.sleeping?14:7;if(lx>sx-hw&&lx<sx+hw&&ly>sy-(a.sleeping?10:a.seated?30:24)&&ly<sy+(a.sleeping?8:3)){const d=Math.abs(lx-sx)+Math.abs(ly-sy+10);if(d<bd){bd=d;best=a;}}}
    return best;
  }
  loadBubbleMode(){try{const v=this.storage&&this.storage.getItem(BubbleLogic.STORAGE_KEY);return BubbleLogic.MODES.includes(v)?v:'speech';}catch(e){return 'speech';}}
  setBubbleMode(m){if(!BubbleLogic.MODES.includes(m))return;this.setState({bubbleMode:m});try{this.storage&&this.storage.setItem(BubbleLogic.STORAGE_KEY,m);}catch(e){}}
  bubbleText(a){
    const t=a.target&&this.byId(a.target);
    switch(a.status){
      case 'working':return a.tool[0]+' '+a.tool[1];
      case 'thinking':return tr('bubble.thinking');
      case 'permission':return tr('bubble.needsApproval',{msg:a.msg});
      case 'error':return tr('bubble.error',{msg:a.msg});
      case 'talking':return '→ '+(t?t.name:'?')+': '+a.msg;
      case 'waiting':return a.waitSub?tr('bubble.waitingSub',{name:t?t.name:''}):tr('bubble.waiting',{name:t?t.name:'?'});
      case 'done':return tr('bubble.done');
      case 'entering':return a.parent?tr('bubble.subEntering'):tr('bubble.newSession');
      case 'idle':return ({bath:'💦 ',smoke:'🚬 ',wc:'🚻 ',sky:'☁️ ',microwave:'🍱 ',meal:'🍪 ',snack:'🍪 '}[a.actNow]||'☕ ')+(ACT_TXT[a.actNow]||tr('bubble.pantryBreak'));
      case 'leaving':return tr('bubble.leaving');
      default:return null;
    }
  }

  render(){
    if(this.world)return this.renderWorld();
    const{sel,paused,live,dataSource,endpoint,bubbleMode,autoApprove,agentCount,speed,showSettings}=this.state;
    const isLive=dataSource==='live',isSim=!isLive,ls=live,others=isLive&&this.state.asOthers;
    const cnt=k=>this.agents.filter(a=>!a.leaving&&k.includes(a.status)).length;
    const seasonInfo=window.SeasonTree&&this.treeOn?window.SeasonTree.SEASONS[this.seasonKey]:null;
    const summary=[[tr('summary.working'),['working'],'#3e8ed0'],[tr('summary.thinking'),['thinking'],'#5b8def'],[tr('summary.talking'),['talking','waiting'],'#12a594'],[tr('summary.permission'),['permission'],'#f5a524'],[tr('summary.error'),['error'],'#e5484d'],[tr('summary.idle'),['idle','done'],'#8b8fa3'],[tr('summary.subagent'),null,'#ffd166']]
      .map(([label,ks,color])=>({label,color,n:ks?cnt(ks):this.agents.filter(a=>a.parent&&!a.leaving).length}));
    const deptList=[...this.depts.values()].map(Dp=>({label:Dp.key,short:Dp.label,color:Dp.color,n:this.agents.filter(a=>a.dept===Dp.key&&!a.leaving).length})).filter(d=>d.n>0);
    const s=sel&&this.byId(sel);
    const par=s&&s.parent&&this.byId(s.parent);
    const selDept=s?this.depts.get(s.dept):null;
    const selData=s?{name:s.name,short:s.short,sid:s.sid,color:s.shirt,statusLabel:(ST[s.status]||ST.working)[0],statusColor:(ST[s.status]||ST.working)[1],
      activity:this.bubbleText(s)||'—',cwd:s.cwd,model:s.model,tokens:fmtK(s.tokens),role:par?tr('detail.role.sub',{parent:par.short}):tr('detail.role.main'),
      dept:s.dept,deptColor:selDept?selDept.color:'#8b8fa3',
      canApprove:!isLive&&s.status==='permission',hist:(s.liveHist||s.hist).slice(0,7)}:null;
    const srcLabel=isLive?(ls==='ok'?'LIVE · ~/.claude':ls==='error'?tr('source.live.lost'):tr('source.live.connecting')):tr('source.sim');
    const srcColor=isLive?(ls==='ok'?'#46a758':ls==='error'?'#e5484d':'#f5a524'):'#ffd166';
    // Approval, errors, the selected and the hovered agent always show their bubble. "Gọn" (compact) also keeps the
    // bubbles of agents at work, while agents on a break speak a line when they change activity and fade (BubbleLogic).
    const shown=this.agents.filter(a=>!a.gone);
    const pinnedOf=a=>sel===a.id||this.hoverId===a.id||a.status==='permission'||a.status==='error';
    const busy=a=>BubbleLogic.BUSY.has(a.status);
    const talk=BubbleLogic.step(this.bubbleMem,shown.map(a=>({id:a.id,status:a.status,tool:a.tool,actNow:a.actNow,target:a.target,pinned:pinnedOf(a)||busy(a)})),performance.now());
    const bubbles=others?[]:shown.map(a=>{
      const v=pinnedOf(a)||bubbleMode==='always'||(bubbleMode==='speech'&&busy(a))?'show':bubbleMode==='speech'?talk.get(a.id):null;
      const txt=v?this.bubbleText(a):null;
      if(!txt)return null;
      const[sx,sy]=this.headPos(a),c=(ST[a.status]||ST.working)[1];
      return h('div',{key:a.id,ref:el=>{if(el)this.bubbleEls[a.id]=el;else delete this.bubbleEls[a.id];},
        style:{opacity:v==='fade'?0:1,transition:'opacity '+BubbleLogic.FADE_MS+'ms',position:'absolute',left:Math.min(92,Math.max(8,sx/LW*100))+'%',top:((sy-12)/LH*100)+'%',transform:'translate(-50%,-100%) scale(calc(var(--cam-inv,1) * var(--bubble-k,1)))',transformOrigin:'50% 100%',display:'flex',alignItems:'center',gap:5,padding:'3px 6px',background:'#ffffff',color:'#14161c',border:'2px solid '+c,boxShadow:'2px 2px 0 rgba(0,0,0,0.35)',font:"500 10px/1.2 'JetBrains Mono',monospace",whiteSpace:'nowrap',maxWidth:'var(--bubble-w,240px)',overflow:'hidden',textOverflow:'ellipsis'}},
        h('b',{style:{color:c,fontFamily:"'Pixelify Sans',monospace",fontSize:11}},a.name),
        h('span',{style:{overflow:'hidden',textOverflow:'ellipsis'}},txt));
    });

    const pad={paddingLeft:'max(16px, env(safe-area-inset-left, 0px))',paddingRight:'max(16px, env(safe-area-inset-right, 0px))'};

    const hdrCtl={padding:'4px 10px',fontSize:11};
    const narrow=!!(this.narrowMq&&this.narrowMq.matches);
    const logo=h('div',{style:{fontFamily:"'Pixelify Sans',monospace",fontSize:20,fontWeight:700,letterSpacing:'0.02em',color:'#ffffff'}},'CLAUDE CO.');
    const seasonChip=seasonInfo&&h('div',{className:'chip',style:{borderColor:seasonInfo.accent,gap:6}},
      h('span',{style:{width:8,height:8,borderRadius:'50%',background:seasonInfo.accent,display:'inline-block',boxShadow:'0 0 4px '+seasonInfo.accent}}),
      h('span',{style:{color:seasonInfo.accent,fontWeight:600}},seasonInfo.label)
    );
    const summaryChips=summary.map((c,i)=>h('div',{key:i,className:'chip'},
      h('span',{style:{width:8,height:8,background:c.color,display:'inline-block'}}),
      h('span',null,c.label),
      h('strong',{style:{color:'#ffffff'}},c.n)
    ));
    const deptLabel=h('span',{style:{fontSize:10,color:'#5d6578'}},tr('header.depts'));
    const deptChips=deptList.map((d,i)=>h('div',{key:i,style:{display:'flex',alignItems:'center',gap:6,padding:'2px 8px 2px 2px',background:'var(--surface)',border:'1px solid #232a39'}},
      h('span',{style:{padding:'1px 5px',background:d.color,color:'#ffffff',fontFamily:"'Pixelify Sans',monospace",fontWeight:600,fontSize:11}},d.short),
      h('span',{style:{color:'#c9cfdc',whiteSpace:'nowrap'}},d.label),
      h('strong',{style:{color:'#ffffff'}},d.n)
    ));
    const srcPill=label=>h('div',{style:{display:'flex',alignItems:'center',gap:8,border:'2px solid var(--border)',background:'var(--surface)',...hdrCtl}},
      h('span',{style:{width:8,height:8,background:srcColor,display:'inline-block'}}),
      h('span',{style:{color:'var(--fg)',fontWeight:600,whiteSpace:narrow?'nowrap':undefined}},label)
    );
    const pauseBtn=label=>h('button',{className:'btn',title:narrow?(paused?tr('header.resume'):tr('header.pause')):undefined,style:hdrCtl,onClick:()=>this.setState(p=>({paused:!p.paused}))},label);
    const addBtn=label=>isSim&&h('button',{className:'btn btn-accent',title:narrow?tr('header.addSession'):undefined,style:hdrCtl,onClick:()=>{const a=this.addAgent({});if(a)this.setState({sel:a.id});}},label);

    // Phone: one fixed-height row (logo, source, pause, add) and one strip of status and department chips that
    // scrolls sideways instead of wrapping, so the header never pushes the island down. A phone on its side is wide but
    // short, so there the strip sits inside the row between the logo and the controls.
    const strip=flex=>h('div',{key:'strip',className:'hscroll',style:{display:'flex',alignItems:'center',gap:6,fontSize:11,flex,overflowX:'auto',whiteSpace:'nowrap',minWidth:0}},
      seasonChip,this.worldChip(),summaryChips,deptList.length>0&&h('span',{style:{width:4,flex:'none'}}),deptList.length>0&&deptLabel,deptChips
    );
    const oneRow=narrow&&window.innerWidth>640;
    const top=narrow?[
      h('header',{key:'hdr',style:{display:'flex',alignItems:'center',gap:8,height:30,flex:'none',minWidth:0}},
        h('div',{title:tr('header.logoTitle'),style:{flex:'none'}},logo),
        oneRow?strip('1 1 0'):h('div',{style:{flex:'1 1 0',minWidth:0}}),
        srcPill(isLive?(ls==='ok'?'LIVE':ls==='error'?tr('source.short.lost'):tr('source.short.connecting')):tr('source.sim')),
        pauseBtn(paused?'▶':'❚❚'),
        addBtn('+')
      ),
      !oneRow&&strip('none')
    ]:[
      h('header',{key:'hdr',style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 16px'}},
        h('div',{title:tr('header.logoTitle'),style:{display:'flex',alignItems:'baseline',gap:8,flex:'none'}},
          logo,
          this.serverVersion&&h('span',{style:{fontSize:10,color:'var(--muted)',fontFamily:"'JetBrains Mono',monospace",opacity:0.6}},'v'+this.serverVersion)
        ),
        h('div',{style:{display:'flex',flexWrap:'wrap',gap:6,fontSize:11,alignItems:'center',flex:'1 1 360px',minWidth:0}},
          seasonChip,
          this.worldChip(),
          summaryChips
        ),
        h('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,flex:'none'}},
          srcPill(srcLabel),
          pauseBtn(paused?'▶ '+tr('header.resume'):'❚❚ '+tr('header.pause')),
          addBtn(tr('header.addSessionBtn'))
        )
      ),
      deptList.length>0&&h('div',{key:'depts',style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:6,fontSize:11}},
        deptLabel,
        deptChips
      )
    ];

    return h('div',{className:'app',style:{display:'flex',flexDirection:'column',gap:narrow?6:8,paddingTop:narrow?8:12,paddingBottom:narrow?8:12,boxSizing:'border-box',overflow:'hidden',background:'var(--bg)',...pad}},

      top,

      isLive&&ls==='error'&&h('div',{style:{display:'flex',flexDirection:'column',gap:8,padding:'14px 16px',border:'2px solid #e5484d',background:'#2a1418',fontSize:12,lineHeight:1.6,color:'#ffd7d9'}},
        h('strong',{style:{color:'#ffffff',fontSize:13}},tr('server.needed.title')),
        h('span',null,tr('server.needed.body')),
        h('code',{style:{display:'block',background:'var(--bg)',padding:'8px 10px',color:'#ffd166',fontSize:11,whiteSpace:'pre-wrap',userSelect:'all'}},'npx claude-office@latest\n# or: node claude-office-server.js'),
        h('span',{style:{color:'var(--muted)'}},tr('server.needed.streams',{endpoint})),
        h('span',{style:{color:'var(--muted)',fontSize:11}},tr('server.needed.tip'))
      ),

      h('div',{ref:this.setStage,style:{position:'relative',flex:'1 1 0',minHeight:0,border:'3px solid #232a39',overflow:'hidden',containerType:'size',display:'flex',alignItems:'center',justifyContent:'center'}},
        h('canvas',{ref:this.setBack,style:{position:'absolute',inset:0,cursor:'grab',touchAction:'none',width:'100%',height:'100%',zIndex:0,display:'block'}}),
        // The view is fitted to the island top (FH tall), not the whole scene: the deep underside may run off the bottom.
        h('div',{ref:this.setWrap,style:{position:'relative',alignSelf:'flex-start',transformOrigin:'0 0',touchAction:'none',userSelect:'none',width:'min(100cqw, calc(100cqh * '+LW+' / '+FH+'))',aspectRatio:LW+' / '+LH,marginTop:'calc((100cqh - min(100cqw * '+FH+' / '+LW+', 100cqh)) / 2)'}},
          h('canvas',{ref:this.setCanvas,width:LW,height:LH,onClick:this.onClick,onMouseMove:this.onMove,onMouseLeave:this.onLeave,style:{position:'relative',zIndex:1,width:'100%',height:'auto',display:'block',imageRendering:'pixelated',touchAction:'none'}}),
          h('div',{style:{position:'absolute',inset:0,pointerEvents:'none',zIndex:3}},bubbles)
        ),
        h('canvas',{ref:this.setFront,style:{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:2,pointerEvents:'none',display:'block'}}),

        // As others see it the panel carries only what the hub gets: no name, folder, activity text or history.
        selData&&others&&(()=>{const raw=this.raw.get(s.sid)||{},fl=(l,v,k)=>h('div',{key:k,style:{display:'flex',flexDirection:'column',gap:2,minWidth:0}},h('span',{style:{fontSize:10,color:'var(--muted)'}},l),h('span',{style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},v));
          return h('div',{style:{position:'absolute',zIndex:10,top:12,right:12,width:300,maxWidth:'calc(100% - 24px)',boxSizing:'border-box',background:'var(--surface)',border:'3px solid var(--fg)',boxShadow:'6px 6px 0 rgba(0,0,0,0.45)',padding:14,display:'flex',flexDirection:'column',gap:12,fontSize:12}},
            h('div',{style:{display:'flex',alignItems:'center',gap:10}},
              h('div',{style:{width:34,height:34,background:selData.deptColor,color:'#ffffff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Pixelify Sans',monospace",fontSize:13,fontWeight:700,flex:'none'}},selData.short),
              h('div',{style:{flex:1,minWidth:0,fontFamily:"'Pixelify Sans',monospace",fontSize:17,fontWeight:600,color:'#ffffff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},selData.dept),
              h('button',{className:'btn',onClick:()=>this.setState({sel:null}),style:{width:28,height:28,padding:0,flex:'none'}},'×')),
            h('div',{style:{padding:10,background:'var(--bg)',borderLeft:'4px solid '+selData.statusColor}},h('span',{style:{fontWeight:600,color:selData.statusColor}},selData.statusLabel)),
            h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'10px 14px'}},
              fl(tr('detail.field.kind'),({shell:tr('detail.kind.shell'),edit:tr('detail.kind.edit'),read:tr('detail.kind.read'),web:tr('detail.kind.web'),agent:tr('detail.kind.agent'),mcp:tr('detail.kind.mcp'),other:tr('detail.kind.other')})[raw.kind]||'—','kind'),
              fl(tr('detail.field.dept'),selData.dept,'dept'),
              raw.tool?fl(tr('detail.field.tool'),String(raw.tool).slice(0,32),'tool'):null,
              raw.model?fl(tr('detail.field.model'),String(raw.model).slice(0,48),'model'):null,
              fl(tr('detail.field.role'),selData.role,'role')));})(),
        selData&&!others&&h('div',{style:{position:'absolute',zIndex:10,top:12,right:12,width:300,maxWidth:'calc(100% - 24px)',maxHeight:'calc(100% - 68px)',overflowY:'auto',boxSizing:'border-box',background:'var(--surface)',border:'3px solid var(--fg)',boxShadow:'6px 6px 0 rgba(0,0,0,0.45)',padding:14,display:'flex',flexDirection:'column',gap:12,fontSize:12}},
          h('div',{style:{display:'flex',alignItems:'center',gap:10}},
            h('div',{style:{width:34,height:34,background:selData.deptColor,color:'#ffffff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Pixelify Sans',monospace",fontSize:13,fontWeight:700,flex:'none'}},selData.short),
            h('div',{style:{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2}},
              h('div',{style:{fontFamily:"'Pixelify Sans',monospace",fontSize:17,fontWeight:600,color:'#ffffff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},selData.name),
              h('div',{style:{fontSize:10,color:'var(--muted)'}},selData.sid)
            ),
            h('button',{className:'btn',onClick:()=>this.setState({sel:null}),style:{width:28,height:28,padding:0,flex:'none'}},'×')
          ),
          h('div',{style:{display:'flex',flexDirection:'column',gap:4,padding:10,background:'var(--bg)',borderLeft:'4px solid '+selData.statusColor}},
            h('span',{style:{fontWeight:600,color:selData.statusColor}},selData.statusLabel),
            h('span',{style:{color:'var(--fg)',wordBreak:'break-all'}},selData.activity)
          ),
          selData.canApprove&&h('div',{style:{display:'flex',gap:8}},
            h('button',{onClick:()=>{if(s){this.log(s,tr('detail.log.allowed',{msg:s.msg}));s.status='working';s.tool=[s.msg.split(':')[0],s.msg.split(':')[1]||''];s.until=Date.now()+3000/this.speed;this.forceUpdate();}},style:{flex:1,border:'2px solid #46a758',background:'#46a758',color:'#06140a',padding:9,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}},tr('detail.allow')),
            h('button',{className:'btn',onClick:()=>{if(s){this.log(s,tr('detail.log.denied',{msg:s.msg}));s.status='error';s.msg=tr('detail.msg.userDenied');s.until=Date.now()+2000/this.speed;this.forceUpdate();}},style:{flex:1,padding:9}},tr('detail.deny'))
          ),
          h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'10px 14px'}},
            [[tr('detail.field.cwd'),selData.cwd],[tr('detail.field.model'),selData.model],[tr('detail.field.tokens'),selData.tokens],[tr('detail.field.role'),selData.role]].map(([label,val],i)=>
              h('div',{key:i,style:{display:'flex',flexDirection:'column',gap:2,minWidth:0}},
                h('span',{style:{fontSize:10,color:'var(--muted)'}},label),
                h('span',{style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},val)
              )
            ),
            h('div',{key:'dept',style:{display:'flex',flexDirection:'column',gap:2,minWidth:0,gridColumn:'1 / -1'}},
              h('span',{style:{fontSize:10,color:'var(--muted)'}},tr('detail.field.deptByCwd')),
              h('span',{style:{display:'flex',alignItems:'center',gap:6}},
                h('span',{style:{width:8,height:8,background:selData.deptColor,display:'inline-block'}}),
                selData.dept
              )
            )
          ),
          h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
            h('span',{style:{fontSize:10,color:'var(--muted)'}},tr('detail.field.recent')),
            selData.hist.map((hh,i)=>h('div',{key:i,style:{display:'flex',gap:8,lineHeight:1.45}},
              h('span',{style:{color:'#5d6578',flex:'none'}},hh.t),
              h('span',{style:{color:'#c9cfdc',wordBreak:'break-word'}},hh.text)
            ))
          )
        ),

        h('button',{className:'settings-toggle','aria-label':tr('settings.title'),title:tr('settings.toggleTitle'),onClick:()=>this.setState(p=>({showSettings:!p.showSettings}))},'⚙'),

        others&&h('div',{role:'status',style:{position:'absolute',zIndex:5,left:10,top:10,padding:'3px 8px',background:'var(--surface)',border:'2px solid #f5a524',fontSize:11,color:'var(--fg)'}},
          tr('settings.viewingAsOthers',{level:this.state.othersShare==='co-ban'?tr('settings.othersLevel.basic'):tr('settings.othersLevel.private')})),

        showSettings&&h('div',{className:'settings-panel'},
          h('div',{style:{fontFamily:"'Pixelify Sans',monospace",fontSize:14,fontWeight:600,color:'#ffffff',marginBottom:4}},tr('settings.title')),
          languagePicker(),
          h('label',null,tr('settings.dataSource'),
            h('select',{value:dataSource,onChange:e=>this.setState({dataSource:e.target.value})},
              h('option',{value:'sim'},tr('settings.dataSource.sim')),
              h('option',{value:'live'},tr('settings.dataSource.live'))
            )
          ),
          isLive&&h('label',null,tr('settings.endpoint'),
            h('input',{type:'text',value:endpoint,onChange:e=>this.setState({endpoint:e.target.value})})
          ),
          isLive&&h('label',{title:tr('settings.asOthers.title')},tr('settings.asOthers'),
            h('input',{type:'checkbox',checked:!!this.state.asOthers,onChange:e=>this.setState({asOthers:e.target.checked,sel:null})})
          ),
          isLive&&this.worldJoinSection(),
          isSim&&h('label',null,tr('settings.agentCount',{n:agentCount}),
            h('input',{type:'range',min:1,max:16,value:agentCount,onChange:e=>this.setState({agentCount:+e.target.value})})
          ),
          h('label',null,tr('settings.speed',{speed:speed.toFixed(2)}),
            h('input',{type:'range',min:0.5,max:3,step:0.25,value:speed,onChange:e=>this.setState({speed:+e.target.value})})
          ),
          h('label',{title:tr('settings.bubbles.title')},tr('settings.bubbleText'),
            h('select',{value:bubbleMode,onChange:e=>this.setBubbleMode(e.target.value)},
              BubbleLogic.MODES.map(m=>h('option',{key:m,value:m},{speech:tr('settings.bubbles.speech'),always:tr('settings.bubbles.always'),off:tr('settings.bubbles.off')}[m])))
          ),
          h('div',{style:{borderTop:'1px solid var(--border)',margin:'2px 0'}}),
          h('label',null,tr('settings.weather'),
            h('select',{'aria-label':tr('settings.weather.mode'),value:this.state.weatherMode,onChange:e=>this.setWeather({weatherMode:e.target.value})},
              h('option',{value:'random'},tr('settings.weather.random')),
              h('option',{value:'real'},tr('settings.weather.real')),
              h('option',{value:'off'},tr('settings.weather.off'))
            )
          ),
          this.state.weatherMode==='real'&&h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
            h('div',{style:{display:'flex',gap:6}},
              h('input',{type:'text','aria-label':tr('settings.weather.city'),placeholder:tr('settings.weather.cityPlaceholder'),value:this.state.cityDraft,style:{flex:1,maxWidth:'none'},
                onChange:e=>this.setState({cityDraft:e.target.value}),onKeyDown:e=>{if(e.key==='Enter')this.setWeather({city:this.state.cityDraft.trim()});}}),
              h('button',{className:'btn',style:{padding:'4px 8px',fontSize:11},onClick:()=>this.setWeather({city:this.state.cityDraft.trim()})},tr('settings.weather.update'))
            ),
            this.state.realStatus.text&&h('span',{role:'status',style:{fontSize:11,lineHeight:1.4,color:this.state.realStatus.state==='error'?'#ff9b9e':this.state.realStatus.state==='ok'?'#8fd69a':'var(--muted)'}},this.state.realStatus.text),
            h('span',{style:{fontSize:10,color:'var(--muted)',lineHeight:1.4}},tr('settings.weather.privacyNote'))
          ),
          h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
            h('span',null,tr('settings.weather.current',{label:WEATHER_LABEL[this.wx.to]})),
            h('div',{style:{display:'flex',flexWrap:'wrap',gap:4}},
              WEATHER_PREVIEW.map(([type,label])=>h('button',{key:type,className:'btn',title:tr('settings.weather.previewTitle',{label:WEATHER_LABEL[type]}),style:{padding:'3px 7px',fontSize:11},onClick:()=>this.previewWeather(type)},label))
            )
          ),
          isSim&&h('label',null,tr('settings.autoApprove'),
            h('input',{type:'checkbox',checked:autoApprove,onChange:e=>this.setState({autoApprove:e.target.checked})})
          )
        )
      )
    );
  }
}

