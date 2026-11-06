"use strict";
// Drawing the office: sky, camera, the floor, walls, planters, pantry and desks.
mixin(ClaudeOffice,class{
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
});
