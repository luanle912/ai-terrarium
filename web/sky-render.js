// Drawing for the sky island: the island itself (pre-rendered once per resolution), trees and the waterfall.
(function(){
'use strict';
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const toHex=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,p)=>{const A=hex(a),B=hex(b);return toHex(A.map((v,i)=>v*(1-p)+B[i]*p));};
const hash=(x,y,s)=>{const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return v-Math.floor(v);};
// Night pulls every island colour toward the same deep blue the office uses after dark.
const night=(c,df)=>mix(c,'#0d1322',(1-df)*0.6);
const SNOW='#eef3f7';
// Depth bands of the underside: [from z, to z, colour], top to bottom.
const BANDS=[[0,-6,'#8a5a36'],[-6,-26,'#6f4a32'],[-26,-60,'#7a7a84'],[-60,-1e9,'#5f6070']];
// The pond's water surface sits this far below the grass.
const WATER_Z=-3;

function drawTree(ctx,P,d,df,snow){
  const[px,py]=P(d.x+0.5,d.y+0.5,0),x=Math.round(px),y=Math.round(py);
  const leaf=night(mix('#3e9a45',SNOW,snow*0.5),df),top=night(mix('#57b85a',SNOW,snow*0.6),df);
  ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(x-5,y-1,10,2);
  ctx.fillStyle=night('#6b4a2a',df);ctx.fillRect(x-1,y-10,2,10);
  ctx.fillStyle=leaf;ctx.fillRect(x-5,y-19,10,9);ctx.fillStyle=mix(leaf,'#000000',0.18);ctx.fillRect(x+1,y-19,4,9);
  ctx.fillStyle=top;ctx.fillRect(x-3,y-22,6,3);
}

// The island as one image the size of the scene canvas; only trees behind the walls are baked in,
// trees in front are drawn with the office so desks and walls overlap them correctly.
function renderIsland(island,frame,k,env){
  const {LW,LH,OX,OY}=frame,TW=16,TH=8,df=env.df,snow=env.snow;
  const cv=document.createElement('canvas');cv.width=Math.round(LW*k);cv.height=Math.round(LH*k);
  const ctx=cv.getContext('2d');ctx.setTransform(k,0,0,k,0,0);
  const P=(x,y,z=0)=>[OX+(x-y)*TW,OY+(x+y)*TH-z];
  const poly=(pts,c)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=c;ctx.fill();};
  const dep=(x,y)=>island.depth.get(x+','+y)||0,has=(x,y)=>island.cells.has(x+','+y),inPond=(x,y)=>island.pond.cells.has(x+','+y);
  for(const c of island.list){
    const{x,y,d}=c,jit=(hash(x,y,3)-0.5)*14;
    // a side face shows wherever this column hangs lower than its front neighbour
    const fromL=-dep(x,y+1),fromR=-dep(x+1,y);
    for(const[z0,z1,col]of BANDS){
      const top=Math.min(z0,0),bot=Math.max(z1,-d);if(bot>=top)continue;
      const base=night(mix(col,jit>0?'#ffffff':'#000000',Math.abs(jit)/100),df);
      const lt=Math.min(top,fromL),rt=Math.min(top,fromR);
      if(lt>bot)poly([P(x,y+1,lt),P(x+1,y+1,lt),P(x+1,y+1,bot),P(x,y+1,bot)],mix(base,'#000000',0.12));
      if(rt>bot)poly([P(x+1,y,rt),P(x+1,y+1,rt),P(x+1,y+1,bot),P(x+1,y,bot)],mix(base,'#000000',0.3));
    }
    if(inPond(x,y)){
      // The pond is sunk WATER_Z below the grass: the far banks show as earth walls, the water fills the hollow.
      if(!inPond(x-1,y))poly([P(x,y,0),P(x,y+1,0),P(x,y+1,WATER_Z),P(x,y,WATER_Z)],night('#6f4a32',df));
      if(!inPond(x,y-1))poly([P(x,y,0),P(x+1,y,0),P(x+1,y,WATER_Z),P(x,y,WATER_Z)],night('#5f3f2a',df));
      poly([P(x,y,WATER_Z),P(x+1,y,WATER_Z),P(x+1,y+1,WATER_Z),P(x,y+1,WATER_Z)],night(mix(inPond(x-1,y)&&inPond(x,y-1)?'#3f96d4':'#4aa3df',SNOW,snow*0.6),df));
    }else{
      const grass=(x+y)%2?'#62b14e':'#58a645';
      poly([P(x,y,0),P(x+1,y,0),P(x+1,y+1,0),P(x,y+1,0)],night(mix(grass,SNOW,snow*0.85),df));
    }
    if(!has(x,y+1))poly([P(x,y+1,0),P(x+1,y+1,0),P(x+1,y+1,-2),P(x,y+1,-2)],night(mix('#3f7f33',SNOW,snow*0.7),df));
    if(!has(x+1,y))poly([P(x+1,y,0),P(x+1,y+1,0),P(x+1,y+1,-2),P(x+1,y,-2)],night(mix('#356c2b',SNOW,snow*0.7),df));
  }
  // A ring of rim stones around the pond, open only where the water spills over the shore into the waterfall.
  {const f=island.waterfall,R=0.13,stones=[];
    for(const k of island.pond.cells){const[x,y]=k.split(',').map(Number);
      if(!inPond(x-1,y))stones.push([x-R,y,R*2,1]);
      if(!inPond(x,y-1))stones.push([x,y-R,1,R*2]);
      if(!inPond(x+1,y)&&!(x===f.x&&y===f.y))stones.push([x+1-R,y,R*2,1]);
      if(!inPond(x,y+1))stones.push([x,y+1-R,1,R*2]);}
    stones.sort((a,b)=>(a[0]+a[2]/2+a[1]+a[3]/2)-(b[0]+b[2]/2+b[1]+b[3]/2));
    for(const[sx,sy,w,hh]of stones){
      // each edge is laid as two stones with a small gap, so the rim reads as stonework
      const along=w>hh,n=2;
      for(let i=0;i<n;i++){
        const a=i/n+0.02,b=(i+1)/n-0.02,x0=along?sx+w*a:sx,x1=along?sx+w*b:sx+w,y0=along?sy:sy+hh*a,y1=along?sy+hh:sy+hh*b;
        const top=night(mix(hash(x0*7,y0*7,8)>0.5?'#c9c3b8':'#b8b1a5',SNOW,snow*0.8),df),zt=2.5;
        poly([P(x0,y1,0),P(x1,y1,0),P(x1,y1,zt),P(x0,y1,zt)],mix(top,'#000000',0.22));
        poly([P(x1,y0,0),P(x1,y1,0),P(x1,y1,zt),P(x1,y0,zt)],mix(top,'#000000',0.38));
        poly([P(x0,y0,zt),P(x1,y0,zt),P(x1,y1,zt),P(x0,y1,zt)],top);
      }
    }
  }
  // Garden paths (SkyLogic.lawnPaths): a faint worn strip in the grass where feet go, and flat stepping stones on it
  // that sit 1 px proud of the grass.
  if(island.paths){
    // The worn strip is stroked in the ground plane: with the iso projection as the canvas transform a round-capped
    // line becomes a band lying on the lawn, joins and ends included.
    ctx.save();ctx.setTransform(k*TW,k*TH,-k*TW,k*TH,k*OX,k*OY);
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=0.62;ctx.globalAlpha=0.3;ctx.strokeStyle=night(mix('#a8955a',SNOW,snow*0.6),df);
    for(const l of island.paths.strips){ctx.beginPath();l.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
    ctx.restore();
    for(const st of island.paths.stones){
      const top=night(mix(hash(st.x*5,st.y*5,11)>0.5?'#c9c3b8':'#bdb6aa',SNOW,snow*0.55),df);
      poly(st.outline.map(([x,y])=>P(x,y,0)),mix(top,'#000000',0.32));
      poly(st.outline.map(([x,y])=>P(x,y,1)),top);
    }
  }
  // vines hanging from the front shore
  ctx.fillStyle=night('#3f7f33',df);
  island.list.forEach((c,i)=>{if(has(c.x,c.y+1)||hash(c.x,c.y,4)>0.35)return;const[vx,vy]=P(c.x+0.5,c.y+1,-2);ctx.fillRect(Math.round(vx),Math.round(vy),1,Math.round(5+hash(c.x,c.y,5)*12));});
  for(const d of island.decor){
    const[px,py]=P(d.x+0.5,d.y+0.5,0),x=Math.round(px),y=Math.round(py);
    if(d.kind==='rock'){ctx.fillStyle=night('#8f8f99',df);ctx.fillRect(x-3,y-3,6,3);ctx.fillStyle=night(mix('#a8a8b2',SNOW,snow),df);ctx.fillRect(x-2,y-4,3,1);}
    else if(d.kind==='flower'){ctx.fillStyle=night(['#ffd166','#ff8fab','#ffffff'][(d.x+d.y+99)%3],df);ctx.fillRect(x,y-1,1,1);}
    else if(d.x<0||d.y<0)drawTree(ctx,P,d,df,snow);
  }
  return cv;
}

// Slow glints moving over the pond surface (drawn every frame over the baked island).
function drawPond(ctx,island,P,t,df){
  for(const k of island.pond.cells){const[x,y]=k.split(',').map(Number);
    for(let j=0;j<2;j++){const p=(t*0.25+hash(x,y,7+j))%1,[gx,gy]=P(x+0.2+hash(x,y,9+j)*0.6,y+0.2+p*0.6,WATER_Z);ctx.globalAlpha=(0.25+0.45*df)*Math.sin(p*Math.PI);ctx.fillStyle='#ffffff';ctx.fillRect(Math.round(gx),Math.round(gy),2,1);}
  }
  ctx.globalAlpha=1;
}

// The waterfall is a sheet of water lying in the plane of the island's east cliff face (x = const), so it slants with
// the cliff instead of being a flat screen-space strip: it pours over the pond's lip, runs down the face, then falls on.
function drawWaterfall(ctx,island,P,t,len,df){
  const f=island.waterfall,X=f.x+1,y0=f.y+0.15,y1=f.y+0.85,top=WATER_Z,bot=-(island.depth.get(f.x+','+f.y)||40)-len;
  const quad=(ya,yb,za,zb)=>{const a=P(X,ya,za),b=P(X,yb,za),c=P(X,yb,zb),d=P(X,ya,zb);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();ctx.fill();};
  const ty=P(X,y0,top)[1],by=P(X,y0,bot)[1];
  // colours follow the island's light, so the fall does not glow at night
  const g=ctx.createLinearGradient(0,ty,0,by);g.addColorStop(0,rgba(night('#6eb9f5',df),0.95));g.addColorStop(0.6,rgba(night('#96cdfa',df),0.75));g.addColorStop(1,rgba(night('#dceeff',df),0));
  ctx.fillStyle=g;quad(y0,y1,top,bot);
  // darker edges give the sheet thickness; light streaks slide down it
  ctx.fillStyle=rgba(night('#3c82c8',df),0.35);quad(y0,y0+0.07,top,bot*0.7);quad(y1-0.07,y1,top,bot*0.7);
  for(let i=0;i<9;i++){const ya=y0+0.06+(y1-y0-0.16)*((i*0.37)%1),p=(t*0.55+i*0.11)%1,za=top-(top-bot)*p;ctx.fillStyle=rgba(night('#ffffff',df),0.75*(1-p));quad(ya,ya+0.05,za,za-14);}
  // foam where the pond spills over the lip
  ctx.fillStyle=rgba(night('#ffffff',df),0.6+0.3*df);quad(y0-0.05,y1+0.05,top+0.8,top-1.6);
}

// ---- sky behind the island and weather in front of it (both drawn in CSS px over the whole stage) ----
const rgba=(hexc,a)=>{const[r,g,b]=hex(hexc);return'rgba('+r+','+g+','+b+','+a+')';};
// ---- drifting mist: soft wisps stamped from a few pre-rendered sprites ----
const MIST_W=256,MIST_H=96,MIST_VARIANTS=3,mistBase=[],mistTinted=new Map();
// White alpha-only wisp: overlapping soft ellipses, densest in the middle, frayed at the ends.
function mistShape(v){
  const c=document.createElement('canvas');c.width=MIST_W;c.height=MIST_H;const g=c.getContext('2d'),n=7;
  for(let i=0;i<n;i++){
    const u=(i+0.5)/n,bump=Math.sin(Math.PI*u),cx=MIST_W*(0.1+0.8*u)+(hash(i,v,11)-0.5)*24,cy=MIST_H*(0.55+(hash(i,v,12)-0.5)*0.3);
    const rx=MIST_W*(0.09+0.08*hash(i,v,13))*(0.7+0.6*bump),ry=MIST_H*(0.16+0.22*bump*(0.5+0.5*hash(i,v,14)));
    g.save();g.translate(cx,cy);g.scale(rx/ry,1);
    const rg=g.createRadialGradient(0,0,0,0,0,ry);rg.addColorStop(0,'rgba(255,255,255,0.8)');rg.addColorStop(0.55,'rgba(255,255,255,0.42)');rg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=rg;g.beginPath();g.arc(0,0,ry,0,7);g.fill();g.restore();
  }
  return c;
}
// Tinting per draw would be costly, so tinted sprites are cached per colour. Colours are snapped to steps of 4 per
// channel (invisible in soft mist): weather blends shift them every frame and would otherwise churn the cache.
const snapColor=c=>toHex(hex(c).map(v=>Math.round(v/4)*4));
function mistSprite(v,rawColor){
  const color=snapColor(rawColor),key=v+color,hit=mistTinted.get(key);if(hit)return hit;
  if(mistTinted.size>160)mistTinted.clear();
  const base=mistBase[v]||(mistBase[v]=mistShape(v)),c=document.createElement('canvas');c.width=MIST_W;c.height=MIST_H;
  const g=c.getContext('2d');g.drawImage(base,0,0);g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,MIST_W,MIST_H);
  mistTinted.set(key,c);return c;
}
// One wisp: an optional shaded copy sits a little lower to give the mist some body.
function mistWisp(ctx,x,y,cw,ch,v,lit,shade,a){
  if(a<=0.01)return;
  if(shade){ctx.globalAlpha=a*0.35;ctx.drawImage(mistSprite(v,shade),x,y+ch*0.14,cw,ch);}
  ctx.globalAlpha=a;ctx.drawImage(mistSprite(v,lit),x,y,cw,ch);ctx.globalAlpha=1;
}
// The cloud sea stacks ~180 big overlapping wisps, so it is painted into a low-res layer and scaled up once. The blit
// fills its whole strip, so sparser mist (sky rows, front wisps, fog banks) is cheaper drawn directly.
// A layer is sized to the whole stage, so zooming and panning never reallocate it; each frame clears and blits only
// the strip from y0 (CSS px) down to the bottom, where its content lies.
const MIST_SCALE=0.5,mistLayers=new Map();
function mistLayer(name,w,h,y0){
  const lw=Math.max(1,Math.ceil(w*MIST_SCALE)),lh=Math.max(1,Math.ceil(h*MIST_SCALE)),sy=Math.min(lh,Math.floor(y0*MIST_SCALE));
  let c=mistLayers.get(name);if(!c){c=document.createElement('canvas');mistLayers.set(name,c);}
  if(c.width!==lw||c.height!==lh){c.width=lw;c.height=lh;}
  const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,sy,lw,lh-sy);g.setTransform(MIST_SCALE,0,0,MIST_SCALE,0,0);
  return g;
}
function blitMist(ctx,g,w,y0){
  const c=g.canvas,sy=Math.min(c.height,Math.floor(y0*MIST_SCALE));if(sy>=c.height)return;
  ctx.imageSmoothingEnabled=true;ctx.drawImage(c,0,sy,c.width,c.height-sy,0,sy/MIST_SCALE,w,(c.height-sy)/MIST_SCALE);
}
// ---- camera: sky layers zoom and pan with the island, each by its depth ----
// v is a view {z, ax, ay} (CameraLogic.skyView/parallax): a layer point p is drawn at (ax, ay) + z · p.
const NO_VIEW={z:1,ax:0,ay:0};
const layerView=(view,k)=>view&&globalThis.CameraLogic?CameraLogic.parallax(view,k):NO_VIEW;
function inView(ctx,v,draw){
  if(v===NO_VIEW){draw();return;}
  ctx.save();ctx.translate(v.ax,v.ay);ctx.scale(v.z,v.z);draw();ctx.restore();
}
// The stage's x range in a layer's own coordinates, to skip wisps that are off screen.
const visibleX=(v,w)=>[-v.ax/v.z,(w-v.ax)/v.z];
// Wisps are spread over a band much wider than the stage, so panning never shows an empty edge or a wisp wrapping
// around on screen: an island narrower than a wide stage pans by its side gap plus 10 %, up to about 0.6 of the width.
// Positions live in the layer, so they move with the camera instead of sticking to the screen.
const BAND_X0=-0.75,BAND_W=2.5;
// Count for a band of wisps that used to span w+avg, keeping the same density over the wider band.
const bandCount=(n,w,avg)=>Math.round(n*(BAND_W*w+avg)/(w+avg));
// One band of mist at depth d (0 far at the horizon .. 1 near): far bands are thin, hazy and slow.
// cover scales how much of the band's width the wisps fill, so the count follows the screen width.
// withShade=false drops the shaded copy, for the far sea bands where it is lost in the haze and would double the draws.
function mistRow(ctx,w,y,d,t,seed,cover,col,S,speedK,alpha,withShade=true,v=NO_VIEW){
  const s=(0.25+d*1.3)*S,lit=mix(col.cloud,col.haze,(1-d)*0.4),shade=withShade?mix(col.cloudShade,col.haze,(1-d)*0.7):null,maxW=300*s,span=BAND_W*w+maxW;
  const count=Math.min(150,Math.ceil(span/(210*s)*cover)),[vx0,vx1]=visibleX(v,w);
  for(let i=0;i<count;i++){
    const cw=(150+hash(i,seed,1)*150)*s,ch=cw*(0.2+0.12*hash(i,seed,4)),speed=(3+2.5*hash(i,seed,5))*s*speedK;
    const x=BAND_X0*w-maxW+((hash(i,seed,2)*span+t*speed)%span),bob=Math.sin(t*0.25*speedK+i*1.9+seed)*2*s;
    if(x+cw<vx0||x>vx1)continue;
    const breath=0.7+0.3*(0.5+0.5*Math.sin(t*0.15*speedK+hash(i,seed,6)*6.28));
    mistWisp(ctx,x,y-ch*0.5+bob,cw,ch,Math.floor(hash(i,seed,3)*MIST_VARIANTS),lit,shade,alpha*breath);
  }
}
function farIsland(ctx,x,y,sc,col){
  const top=mix('#58a645',col.haze,0.72),under=mix('#6f707c',col.haze,0.78);
  ctx.fillStyle=under;ctx.beginPath();ctx.moveTo(x-22*sc,y);ctx.lineTo(x+22*sc,y);ctx.lineTo(x+6*sc,y+20*sc);ctx.lineTo(x-2*sc,y+30*sc);ctx.lineTo(x-10*sc,y+16*sc);ctx.closePath();ctx.fill();
  ctx.fillStyle=top;ctx.beginPath();ctx.moveTo(x-22*sc,y);ctx.lineTo(x,y-7*sc);ctx.lineTo(x+22*sc,y);ctx.lineTo(x,y+7*sc);ctx.closePath();ctx.fill();
}
// env: {df, hour, fx:{cloud,rain,snow,storm,fog}, col: SkyLogic.skyColors(...), reduced, view?: island camera view}
// The gradient, sun, moon and stars stay put; clouds, far islands and birds follow the camera by depth.
function drawBack(ctx,w,h,t,env){
  const{df,hour,fx,col,view}=env,hy=h*0.5,S=Math.max(0.6,h/800),speedK=env.reduced?0.5:1;
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,col.zenith);g.addColorStop(0.46,col.horizon);g.addColorStop(0.5,col.haze);g.addColorStop(1,col.below);
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  // Lightning lights up the sky behind the island only, brightest high up, never the office or the whole view.
  if(env.flash>0){const lg=ctx.createLinearGradient(0,0,0,hy);lg.addColorStop(0,'rgba(235,240,255,'+(0.3*env.flash)+')');lg.addColorStop(1,'rgba(235,240,255,0)');ctx.fillStyle=lg;ctx.fillRect(0,0,w,hy);}
  if(df<0.95){// stars and moon
    const a=(1-df)*(1-fx.cloud*0.85);
    for(let i=0;i<140;i++){const tw=0.55+0.45*Math.sin(t*(env.reduced?0.5:1.6)+i*1.7);ctx.globalAlpha=a*tw;ctx.fillStyle='#ffffff';ctx.fillRect(Math.round(hash(i,1,6)*w),Math.round(hash(i,2,6)*hy*0.92),i%9?1:2,i%9?1:2);}
    ctx.globalAlpha=(1-df)*(1-fx.cloud*0.6);const mx=w*0.8,my=h*0.15,r=11*S;
    ctx.fillStyle='#f3f0d0';ctx.beginPath();ctx.arc(mx,my,r,0,7);ctx.fill();ctx.fillStyle=col.zenith;ctx.beginPath();ctx.arc(mx+r*0.45,my-r*0.3,r*0.92,0,7);ctx.fill();ctx.globalAlpha=1;
  }
  if(df>0.05){// sun arcs across the sky with the hour
    const p=Math.max(0,Math.min(1,(hour-6)/12)),sx=w*(0.12+0.76*p),sy=hy*(0.9-0.75*Math.sin(Math.PI*p)),a=df*(1-fx.cloud*0.75);
    const sg=ctx.createRadialGradient(sx,sy,2,sx,sy,80*S);sg.addColorStop(0,'rgba(255,248,215,'+(0.85*a)+')');sg.addColorStop(1,'rgba(255,248,215,0)');ctx.fillStyle=sg;ctx.fillRect(sx-80*S,sy-80*S,160*S,160*S);
    ctx.globalAlpha=a;ctx.fillStyle='#fffbe0';ctx.beginPath();ctx.arc(sx,sy,9*S,0,7);ctx.fill();ctx.globalAlpha=1;
  }
  for(let r=0;r<3;r++){const d=r/3,v=layerView(view,0.1+0.25*d);inView(ctx,v,()=>mistRow(ctx,w,hy*(0.18+d*0.62),d*0.5,t,10+r*17,0.3+fx.cloud*0.9,col,S*0.8,speedK,0.55+fx.cloud*0.35,true,v));}
  inView(ctx,layerView(view,0.2),()=>{
    [[0.07,0.97,0.8],[0.24,1.01,0.55],[0.78,0.98,0.7],[0.93,1.02,0.45]].forEach(([fx_,fy,sc],i)=>farIsland(ctx,w*fx_,hy*fy+Math.sin(t*0.4+i)*1.5*S,sc*S,col));
    // Wider than the stage so a pan never shows where the horizon haze ends.
    const hb=ctx.createLinearGradient(0,hy-18*S,0,hy+18*S);hb.addColorStop(0,rgba(col.haze,0));hb.addColorStop(0.5,rgba(col.haze,0.9));hb.addColorStop(1,rgba(col.haze,0));ctx.fillStyle=hb;ctx.fillRect(-w,hy-18*S,3*w,36*S);
  });
  // Sea bands deepen toward the viewer, from 0.3 at the horizon to 1 (moving with the island) at the bottom.
  const rows=Array.from({length:9},(_,r)=>{const d=(r+1)/9;return{d,y:hy+4*S+(h-hy)*d*d,v:layerView(view,0.3+0.7*d)};});
  // Dragging the island up on a tall stage lifts the sea; more near bands fill down to the bottom of the screen.
  const near=layerView(view,1),bottom=(h-near.ay)/near.z;
  for(let y=rows[8].y+80*S;y-60*S<bottom&&rows.length<16;y+=80*S)rows.push({d:1,y,v:near});
  // The low-res layer only needs the strip the bands reach on screen; a wisp reaches about 51·s above its band.
  const seaTop=Math.max(0,Math.min(h,...rows.map(o=>o.v.ay+o.v.z*(o.y-51*(0.25+o.d*1.3)*S)))),sea=mistLayer('sea',w,h,seaTop);
  rows.forEach((o,r)=>inView(sea,o.v,()=>mistRow(sea,w,o.y,o.d,t,100+r*29,1.1+fx.cloud*0.6,col,S,speedK,0.65+0.35*o.d,o.d>=0.35,o.v)));
  blitMist(ctx,sea,w,seaTop);
  if(df>0.3&&fx.rain<0.3)inView(ctx,layerView(view,0.3),()=>{for(let i=0;i<3;i++){const bx=BAND_X0*w+((t*9*speedK+i*16)%(BAND_W*w)),by=hy*0.5+i*5*S+Math.sin(t*2+i)*2,f=Math.floor(t*5+i)%2;ctx.fillStyle=rgba('#35507a',df);ctx.fillRect(bx,by,1,1);ctx.fillRect(bx-2,by-f,2,1);ctx.fillRect(bx+1,by-f,2,1);}});
}
// env adds flash (0..1, already 0 when reduced motion is on)
function drawFront(ctx,w,h,t,env){
  const{fx,col,view}=env,S=Math.max(0.6,h/800),many=env.reduced?0.4:1,speedK=env.reduced?0.5:1;
  // A near bank of mist sweeps past in front of the island, a little nearer than it, so it zooms a little more.
  inView(ctx,layerView(view,1.15),()=>{
    const span=BAND_W*w+800*S,nx=BAND_X0*w-400*S+((t*22*speedK)%span);
    for(let j=0;j<3;j++)mistWisp(ctx,nx+j*140*S,h*0.8+j*10*S+Math.sin(t*0.3*speedK+j)*3*S,(340-70*j)*S,(90-14*j)*S,j,col.cloud,col.cloudShade,0.55-0.1*j);
  });
  // Thin wisps drift across the island itself and move with it; they stay faint (the bubbles sit under this canvas)
  // and come and go.
  const vo=layerView(view,1),[ox0,ox1]=visibleX(vo,w);
  inView(ctx,vo,()=>{
    const nOver=bandCount((3+fx.cloud*4)*(env.reduced?0.6:1),w,530*S);
    for(let i=0;i<nOver;i++){
      const cw=(380+hash(i,31,1)*300)*S,ch=cw*0.18,ospan=BAND_W*w+cw,x=BAND_X0*w-cw+((hash(i,31,2)*ospan+t*(6+hash(i,31,3)*7)*S*speedK)%ospan);
      if(x+cw<ox0||x>ox1)continue;
      const y=h*(0.25+0.45*hash(i,31,4))+Math.sin(t*0.2*speedK+i*1.3)*5*S,fade=0.5+0.5*Math.sin(t*0.09*speedK+hash(i,31,5)*6.28);
      mistWisp(ctx,x,y-ch*0.5,cw,ch,i%MIST_VARIANTS,col.cloud,null,(0.48+0.15*fx.cloud)*fade);
    }
  });
  const nRain=Math.round(260*fx.rain*many);
  if(nRain){ctx.fillStyle=rgba('#d7e6ff',0.35+0.25*env.df);for(let i=0;i<nRain;i++){const x=(hash(i,7,1)*w+t*60)%w,y=(hash(i,8,1)*h+t*(700+hash(i,9,1)*200))%h;ctx.fillRect(Math.round(x),Math.round(y),1,Math.round(9*S));}}
  const nSnow=Math.round(180*fx.snow*many);
  if(nSnow){ctx.fillStyle='rgba(255,255,255,0.9)';for(let i=0;i<nSnow;i++){const x=(hash(i,3,2)*w+Math.sin(t*0.8+i)*14*S+t*8)%w,y=(hash(i,4,2)*h+t*(36+hash(i,5,2)*30)*S)%h,sz=hash(i,6,2)>0.7?3:2;ctx.fillRect(Math.round(x),Math.round(y),sz,sz);}}
  if(fx.fog>0){
    const fg=ctx.createLinearGradient(0,0,0,h);fg.addColorStop(0,rgba(col.haze,0.12*fx.fog));fg.addColorStop(1,rgba(col.haze,0.32*fx.fog));ctx.fillStyle=fg;ctx.fillRect(0,0,w,h);
    // Fog banks roll across the whole view at different heights and speeds.
    const nBank=bandCount(12*fx.fog*(env.reduced?0.6:1),w,600*S),vf=layerView(view,0.8),[fx0,fx1]=visibleX(vf,w);
    inView(ctx,vf,()=>{
      for(let i=0;i<nBank;i++){
        const cw=(420+hash(i,21,1)*360)*S,ch=cw*0.22,fspan=BAND_W*w+cw,x=BAND_X0*w-cw+((hash(i,21,2)*fspan+t*(8+hash(i,21,3)*12)*S*speedK)%fspan);
        if(x+cw<fx0||x>fx1)continue;
        const y=h*(0.1+0.85*hash(i,21,4))+Math.sin(t*0.2*speedK+i)*4*S,breath=0.6+0.4*Math.sin(t*0.12*speedK+i*2.3);
        mistWisp(ctx,x,y-ch*0.5,cw,ch,i%MIST_VARIANTS,col.haze,null,0.4*fx.fog*breath);
      }
    });
  }
}

// ---- transition clouds (world mode): two pixel cloud banks close over the view and part again ----
// Each bank is a solid body of cloud colour with a ragged leading edge of stacked pixel puffs (lit top rim, shaded
// underside, stepped round tips, like block clouds), a shaded back row peeking out ahead of it for depth, and a soft
// fringe of the sky's own mist so the bank belongs to the same weather. The edge is painted once per size and colour
// into a small canvas at one canvas px per art px, then stamped with smoothing off, so a frame costs a few blits.
const CURTAINS=new Map();
function curtainEdge(seed,wa,ha,lit,shade,rim){
  const key=seed+'|'+wa+'|'+ha+'|'+lit+shade+rim;let c=CURTAINS.get(key);if(c)return c;
  // Six edges a frame (three per bank); evicting the oldest keeps the set in use when the colours drift.
  if(CURTAINS.size>=18)CURTAINS.delete(CURTAINS.keys().next().value);
  c=document.createElement('canvas');c.width=wa;c.height=ha;const g=c.getContext('2d');
  // One row of puffs from x0, top to bottom; each puff overlaps the one above, so only the shaded underside of a puff
  // that reaches further than the next one shows: the stagger reads as layered cloud.
  const row=(s,x0,minL,maxL,minH,maxH,top,under,hi)=>{
    for(let y=-6,i=0;y<ha;i++){
      const rh=minH+Math.floor(hash(i,s,1)*(maxH-minH+1)),len=Math.round(wa*(minL+(maxL-minL)*hash(i,s,2)));
      for(let r=0;r<rh;r++){const k=Math.min(r,rh-1-r),tip=k===0?4:k===1?2:k===2?1:0;
        const run=Math.max(0,len-x0-tip);g.fillStyle=r>=rh-2?under:top;g.fillRect(x0,y+r,run,1);
        // the lit rim catches only the rounded front of the puff, not its whole length
        if(r<=1&&hi){const cap=Math.min(run,Math.round(wa*0.16));g.fillStyle=hi;g.fillRect(x0+run-cap,y+r,cap,1);}}
      y+=rh-2-Math.floor(hash(i,s,3)*3);
    }
  };
  row(seed+7,Math.round(wa*0.3),0.62,1,7,12,mix(shade,lit,0.25),mix(shade,'#000000',0.08),null);
  row(seed,0,0.34,0.84,8,14,lit,shade,rim);
  CURTAINS.set(key,c);return c;
}
// left / right: inner edges of the two banks in CSS px (WorldLogic.cloudBands). t in seconds, col: the sky colours.
function drawCurtains(ctx,w,h,left,right,t,col){
  const S=Math.max(0.6,h/800),P=Math.max(2,Math.round(3*S)),E=Math.min(0.16*w,150*S),wa=Math.max(8,Math.ceil(E/P)),ha=Math.ceil(h/P)+1;
  const lit=snapColor(col.cloud),shade=snapColor(col.cloudShade),rim=snapColor(mix(col.cloud,'#ffffff',0.2));
  const bank=(edge,seed,flip)=>{
    if(edge<=-E)return;
    ctx.save();if(flip){ctx.translate(w,0);ctx.scale(-1,1);}
    const x=Math.round(edge-E/2);
    if(x>0){ctx.fillStyle=lit;ctx.fillRect(0,0,x+1,h);}
    ctx.imageSmoothingEnabled=false;
    // Two fainter echoes of the edge inside the body, trailing a little slower than it: a cloud bank with depth.
    for(let k=2;k>=1;k--){const xe=Math.round(edge*(1-0.1*k)-E/2-E*0.85*k);if(xe+wa*P<=0)continue;
      ctx.globalAlpha=k===1?0.5:0.3;ctx.drawImage(curtainEdge(seed+k*5,wa,ha,lit,shade,rim),xe,0,wa*P,ha*P);}
    ctx.globalAlpha=1;ctx.drawImage(curtainEdge(seed,wa,ha,lit,shade,rim),x,0,wa*P,ha*P);ctx.imageSmoothingEnabled=true;
    // the mist fringe rides just ahead of the edge, breathing a little
    const n=Math.ceil(h/(110*S));
    for(let i=0;i<n;i++){const cw=(150+hash(i,seed,4)*110)*S,ch=cw*0.3,y=(i+0.5)/n*h+(hash(i,seed,5)-0.5)*40*S;
      mistWisp(ctx,edge-cw*(0.55+0.2*hash(i,seed,6))+Math.sin(t*1.3+i*2.1)*4*S,y-ch*0.5,cw,ch,i%MIST_VARIANTS,col.cloud,col.cloudShade,0.55);}
    ctx.restore();
  };
  bank(left,3,false);bank(w-right,11,true);
}

window.SkyRender={mix,night,renderIsland,drawWaterfall,drawPond,drawTree,drawBack,drawFront,drawCurtains};
})();
