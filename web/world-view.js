// World mode: the page is served by a hub (GET /api/config says mode 'world'). Every island is an IslandScene fed by
// /api/world/stream. "Toàn cảnh" is the 8-slot sky (WorldLogic.skyLayout): my island in the centre, the other seven
// slots in a ring around it, each a small pixel-art island (drawSimpleIsland) rather than the full scene. "Của tôi"
// and an island opened from the sky draw that one island in full. There is no world camera: no drag, zoom or minimap.
(function(){
  const VIEW_KEY='ai-terrarium.view';
  const OFF_MS=250,OFFLINE_ALPHA=0.65,ME_PROBE_MS=10000;
  const KIND_LABEL=new Map([['shell',tr('world.kind.shell')],['edit',tr('world.kind.edit')],['read',tr('world.kind.read')],['web',tr('world.kind.web')],['agent',tr('world.kind.agent')],['mcp',tr('world.kind.mcp')],['other',tr('world.kind.other')],['none','—']]);
  const SHARE_LABEL=new Map([['kin',tr('world.share.kin')],['co-ban',tr('world.share.coBan')]]);
  const BUSY=new Set(['working','thinking','talking']);
  // Lets go of a full-detail canvas (~20 MB at k=4); the next full draw makes a new one.
  const releaseCanvas=sc=>{sc.canvas.width=sc.canvas.height=0;sc.k=null;sc.lod=null;sc.drawnAt=-Infinity;};
  const okColor=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)?c:'#8b8fa3';
  const clip=(s,n)=>{s=String(s==null?'':s);return s.length>n?s.slice(0,n-1)+'…':s;};
  const validSlot=s=>Number.isInteger(s)&&s>=0&&s<WorldLogic.SLOTS;
  // How many sessions of an island are at work, and whether one waits for approval or for another session.
  const tally=sc=>{let busy=0,alert=false;if(sc)for(const s of sc.raw.values()){if(BUSY.has(s.status))busy++;else if(s.status==='permission'||s.status==='waiting')alert=true;}return{busy,alert};};

  // ---- simple islands for "Toàn cảnh" ----
  // Each is painted once into an ART_W x ART_H canvas (one art pixel = one canvas pixel) and stamped at a whole number
  // of device pixels per art pixel with smoothing off, so edges stay crisp at any devicePixelRatio. The art follows the
  // scene's look: 2:1 isometric, three flat shades per block (top, left 12 % darker, right 30 % darker), 1 px outline.
  // Island: grass diamond, an earth-and-stone underside tapering to the front corner, one office block roofed in the
  // island colour with six windows (one lit per session at work, at most six), two trees, a path, a gold pennant on mine.
  const ART_W=88,ART_H=59,LABEL_H=26,LABEL_H2=38,ISL={cx:44,cy:26,hw:40},BLD={cx:42,cy:24,hw:14,h:12};
  const OUTLINE='#141a26',GOLD='#ffd166';
  // Painted sprites by key, least recently used first (a hit moves its key to the end; a full cache drops the first).
  // Each is painted on one scratch canvas made for read-backs (the outline pass reads its pixels), then copied into a
  // plain canvas: a willReadFrequently canvas stays in software memory, and the sky stamps up to eight every frame.
  const ART=new Map(),ART_MAX=96;let artScratch=null;
  const art=(key,paint)=>{let c=ART.get(key);if(c){ART.delete(key);ART.set(key,c);return c;}
    if(!artScratch){artScratch=document.createElement('canvas');artScratch.width=ART_W;artScratch.height=ART_H;}
    const g=artScratch.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,ART_W,ART_H);g.save();paint(g);g.restore();
    c=document.createElement('canvas');c.width=ART_W;c.height=ART_H;c.getContext('2d').drawImage(artScratch,0,0);
    if(ART.size>=ART_MAX)ART.delete(ART.keys().next().value);
    ART.set(key,c);return c;};
  // Text measurements by key (plate widths, name plate fits), least recently used first like ART. Emptied when a web
  // font finishes loading, since the widths change with it.
  const MEASURE=new Map(),MEASURE_MAX=128;
  const measured=(key,fn)=>{let v=MEASURE.get(key);if(v){MEASURE.delete(key);MEASURE.set(key,v);return v;}
    v=fn();if(MEASURE.size>=MEASURE_MAX)MEASURE.delete(MEASURE.keys().next().value);MEASURE.set(key,v);return v;};
  if(document.fonts&&document.fonts.addEventListener){document.fonts.addEventListener('loadingdone',()=>MEASURE.clear());
    if(document.fonts.ready)document.fonts.ready.then(()=>MEASURE.clear());}
  const textW=(ctx,f,s)=>measured('w\n'+f+'\n'+s,()=>{ctx.font=f;return{w:ctx.measureText(s).width};}).w;
  const px1=(g,c,x,y,w,hh)=>{g.fillStyle=c;g.fillRect(x,y,w||1,hh||1);};
  // A 2:1 diamond centred on (cx, cy) with half-width hw: rows grow 4 px wider to the middle, then shrink.
  // rim lights the two back edges.
  const diamond=(g,cx,cy,hw,col,rim)=>{const hh=hw/2;
    for(let r=0;r<2*hh;r++){const half=r<hh?2*(r+1):2*(2*hh-r),y=cy-hh+r;px1(g,col,cx-half,y,2*half,1);
      if(rim&&r<hh){px1(g,rim,cx-half,y,2,1);px1(g,rim,cx+half-2,y,2,1);}}};
  // The columns of the two front faces under a diamond: fn(x, last row of the diamond there, left face?, i), where i
  // counts columns out from the front corner (1 at the corner).
  const faceCols=(cx,cy,hw,fn)=>{const hh=hw/2;
    for(let x=cx-hw;x<cx+hw;x++){const left=x<cx,i=left?cx-x:x-cx+1;fn(x,cy+hh-Math.ceil(i/2),left,i);}};
  const hash=(x,s)=>{const v=Math.sin(x*127.1+s*311.7)*43758.5453;return v-Math.floor(v);};
  // Every clear pixel next to a solid one becomes the outline (a sprite outline that follows any silhouette).
  // dashed (empty places): dashes run along the diamond's edges, four columns (two rows) on and four off, counted out
  // from the centre so both sides match; the columns past the two side corners are left out, so no vertical runs.
  const outline=(g,col,dashed)=>{const a=g.getImageData(0,0,ART_W,ART_H).data,solid=(x,y)=>x>=0&&y>=0&&x<ART_W&&y<ART_H&&a[(y*ART_W+x)*4+3]>=24;
    g.fillStyle=col;
    const off=x=>{const u=x<ISL.cx?ISL.cx-1-x:x-ISL.cx;return u>=ISL.hw||Math.floor(u/4)%2===1;};
    for(let y=0;y<ART_H;y++)for(let x=0;x<ART_W;x++){if(solid(x,y)||(dashed&&off(x)))continue;
      if(solid(x-1,y)||solid(x+1,y)||solid(x,y-1)||solid(x,y+1))g.fillRect(x,y,1,1);}};
  const tree=(g,x,y,df)=>{const N=SkyRender.night,leaf=N('#3e9a45',df);
    px1(g,'rgba(0,0,0,0.2)',x-3,y,6,1);px1(g,N('#6b4a2a',df),x,y-3,1,3);
    px1(g,leaf,x-2,y-7,5,4);px1(g,SkyRender.mix(leaf,'#000000',0.18),x+1,y-7,2,4);px1(g,N('#57b85a',df),x-1,y-8,3,1);};
  function paintIsland(g,color,df,lit,mine){
    const N=SkyRender.night,M=SkyRender.mix,{cx,cy,hw}=ISL,b=BLD;
    // underside: two rows of grass edge, three of earth, then stone, deepest (and a little ragged) at the front corner
    faceCols(cx,cy,hw,(x,y0,left,i)=>{const d=2+Math.round(9*Math.pow(1-(i-1)/hw,1.2))+(i>3&&i<hw-4&&hash(x,1)>0.6?1:0);
      for(let j=0;j<d;j++){const base=j<2?(left?'#3f7f33':'#356c2b'):j<5?'#8a5a36':j<9?'#7a7a84':'#5f6070';
        px1(g,N(j<2?base:M(base,'#000000',left?0.12:0.3),df),x,y0+1+j);}});
    diamond(g,cx,cy,hw,N('#5fae4b',df),N('#7cc65f',df));
    for(const[fx,fy,fc]of[[-14,9,GOLD],[9,12,'#ff8fab'],[-30,2,'#ffffff'],[27,2,GOLD],[-6,-9,'#ffffff'],[-20,8,'#ff8fab']])px1(g,N(fc,df),cx+fx,cy+fy);
    // the path runs from the door, square to the office's right face
    for(let k=0;k<6;k++)px1(g,N(k%2?'#bdb6aa':'#c9c3b8',df),b.cx+8+2*k,b.cy+4+k,2,1);
    tree(g,cx-24,cy+1,df);
    const wall=N('#efe9dc',df),roof=N(color,df),glass=N('#33415e',df);
    const WIN=[[false,7],[true,7],[false,2],[true,2],[false,12],[true,12]];// lit in this order, right face first
    faceCols(b.cx,b.cy-b.h,b.hw,(x,y0,left,i)=>{
      for(let j=0;j<b.h;j++)px1(g,M(j<2?roof:wall,'#000000',(left?0.12:0.3)+(j<2?0.12:0)),x,y0+1+j);
      const wi=WIN.findIndex(([l,c])=>l===left&&(i===c||i===c+1));
      if(wi>=0)for(let j=4;j<7;j++)px1(g,wi<lit?GOLD:M(glass,'#000000',left?0:0.2),x,y0+1+j);
      if(!left&&(i===7||i===8))for(let j=8;j<b.h;j++)px1(g,N('#5c4330',df),x,y0+1+j);});
    diamond(g,b.cx,b.cy-b.h,b.hw,roof,M(roof,'#ffffff',0.3));
    if(mine){const y=b.cy-b.h-10;px1(g,'#3b4058',b.cx,y,1,10);px1(g,GOLD,b.cx+1,y,4,1);px1(g,GOLD,b.cx+1,y+1,3,1);px1(g,GOLD,b.cx+1,y+2,2,1);}
    tree(g,cx+21,cy+8,df);
    outline(g,SkyRender.mix(OUTLINE,'#3a4766',1-df),false);// lighter at night, so islands keep their edge on a dark sky
  }
  // A place with no island: a see-through diamond with a dashed outline; the viewer's place-to-be ("yours") is gold.
  function paintTile(g,kind){
    const yours=kind==='yours',{cx,cy,hw}=ISL;
    faceCols(cx,cy,hw,(x,y0,left)=>px1(g,yours?'rgba(255,209,102,0.14)':left?'rgba(16,20,30,0.14)':'rgba(16,20,30,0.22)',x,y0+1,1,2));
    diamond(g,cx,cy,hw,yours?'rgba(255,209,102,0.2)':'rgba(16,20,30,0.18)',yours?'rgba(255,209,102,0.4)':'rgba(255,255,255,0.14)');
    outline(g,yours?GOLD:kind==='full'?'rgba(200,208,222,0.8)':'rgba(236,242,250,0.85)',true);
  }
  // Lines of text on a dark plate in the island-label style, centred on (x, y) in stage px: lines = [[text, font, colour]].
  function plate(ctx,x,y,lines,border,alpha){
    ctx.save();let wd=0;for(const[s,f]of lines)wd=Math.max(wd,textW(ctx,f,s));
    const lh=15,pw=Math.ceil(wd+20),ph=lines.length*lh+8,px=Math.round(x-pw/2),py=Math.round(y-ph/2);
    ctx.fillStyle='rgba(16,20,30,'+(alpha||0.82)+')';ctx.fillRect(px,py,pw,ph);
    if(border){ctx.strokeStyle=border;ctx.lineWidth=1;ctx.strokeRect(px+0.5,py+0.5,pw-1,ph-1);}
    ctx.textBaseline='middle';ctx.textAlign='center';
    lines.forEach(([s,f,c],i)=>{ctx.font=f;ctx.fillStyle=c;ctx.fillText(s,px+pw/2,py+4+lh*i+lh/2+1);});
    ctx.restore();
  }
  // The connection panels ("Thử lại", "Phiên đã hết"); the island's own panel is worldSheet.
  const PANEL={position:'absolute',zIndex:10,top:12,right:12,width:300,maxWidth:'calc(100% - 24px)',maxHeight:'calc(100% - 68px)',overflowY:'auto',boxSizing:'border-box',background:'var(--surface)',border:'3px solid var(--fg)',boxShadow:'6px 6px 0 rgba(0,0,0,0.45)',padding:14,display:'flex',flexDirection:'column',gap:12,fontSize:12};
  const TITLE={fontFamily:"'Pixelify Sans',monospace",fontSize:17,fontWeight:600,color:'#ffffff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'};
  const MUTED={fontSize:10,color:'var(--muted)'};
  const swatch=c=>h('span',{style:{width:14,height:14,background:okColor(c),flex:'none'}});
  const field=(label,val,key)=>h('div',{key:key||label,style:{display:'flex',flexDirection:'column',gap:2,minWidth:0}},h('span',{style:MUTED},label),h('span',{style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},val));
  // "Của tôi" refreshes every 30 s ±20 % while the tab is visible: the hub's general limit is 120 a minute per
  // user (per IP when signed out), shared with everything else the page asks.
  const ME_EVERY_MS=30000,ME_JITTER=0.2,STALL_MS=10000,MAX_STALLS=2,REMOVE_WAIT_MS=5000,PROBE_MS=8000,RETRY_CAP_S=60,HEX_ID=/^[0-9a-f]{16}$/;
  // One-island layout: the panel's column on a wide stage, and on a phone the room under the back control (top) and
  // above the collapsed sheet (its 46 px bar + borders, 12 px from the bottom).
  const PANEL_COL=324,ONE_TOP=54,ONE_BOTTOM=74;
  const SEND_LABEL=new Map([['sending',[tr('world.send.sending'),'#46a758']],['private',[tr('world.send.private'),'#8b8fa3']],['offline',[tr('world.send.offline'),'#e5484d']],['revoked',[tr('world.send.revoked'),'#8b8fa3']]]);
  const NAME_ERR=tr('world.nameErr');
  const LINK={color:'#9fd3ff'};
  const isJson=r=>/^application\/json\b/i.test(r.headers.get('content-type')||'');
  // Retry-After (seconds or an HTTP date) in whole seconds, 0..RETRY_CAP_S; 0 when absent or unreadable.
  const retryAfterS=v=>{if(!v)return 0;let s=/^\d+$/.test(v.trim())?Number(v):(Date.parse(v)-Date.now())/1000;
    return Number.isFinite(s)?Math.min(RETRY_CAP_S,Math.max(0,Math.ceil(s))):0;};
  // What /api/config says now: 'world' (with cfg), 'signedout' (401), 'busy' (429, with retryS), 'other' (200 JSON,
  // not world mode) or 'down' (network error, no answer within PROBE_MS, any other status, or not JSON).
  const probeConfig=()=>fetch('/api/config',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},
    signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(PROBE_MS):undefined})
    .then(r=>{if(r.status===401)return{kind:'signedout'};if(r.status===429)return{kind:'busy',retryS:retryAfterS(r.headers.get('retry-after'))};
      if(r.status!==200||!isJson(r))return{kind:'down'};
      return r.json().then(cfg=>cfg&&cfg.mode==='world'&&cfg.me&&typeof cfg.me==='object'?{kind:'world',cfg}:{kind:'other'});})
    .catch(()=>({kind:'down'}));
  const when=ms=>{const d=new Date(ms);return Number.isFinite(ms)?d.toLocaleString(I18n.locale,{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'—';};
  const INPUT={flex:1,minWidth:0,background:'var(--bg)',border:'1px solid var(--border)',color:'var(--fg)',padding:'5px 8px',fontFamily:'inherit',fontSize:12};
  const SMALL_BTN={padding:'3px 8px',fontSize:11,flex:'none'};
  const ERR={color:'#ff9b9e',lineHeight:1.4};
  // "<question>" + confirm / cancel, inline where the action was asked for.
  const confirmRow=(text,okLabel,c,onOk,onCancel)=>h('div',{style:{display:'flex',flexDirection:'column',gap:6,padding:8,background:'var(--bg)',borderLeft:'4px solid #e5484d'}},
    h('span',{style:{lineHeight:1.4,overflowWrap:'anywhere'}},text),
    h('div',{style:{display:'flex',gap:6}},
      h('button',{className:'btn',disabled:!!c.busy,onClick:onOk,style:{...SMALL_BTN,borderColor:'#e5484d',background:'#e5484d',color:'#ffffff',fontWeight:600}},c.busy?tr('world.confirm.busy'):okLabel),
      h('button',{className:'btn',disabled:!!c.busy,onClick:onCancel,style:SMALL_BTN},tr('world.confirm.cancel'))),
    c.err&&h('span',{role:'alert',style:ERR},c.err));

  Object.assign(ClaudeOffice.prototype,{
    // Decide the mode once, before any data source opens: world only on a 200 JSON answer saying so (the local
    // server answers 404, a file:// page cannot fetch). ?server= is never read in world mode (B9).
    boot(){
      let done=false;
      const local=()=>{if(done)return;done=true;this.startSource();this.pollPreview();};
      const timer=setTimeout(local,3000);
      fetch('/api/config',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})
        .then(r=>r.status===200&&/^application\/json\b/i.test(r.headers.get('content-type')||'')?r.json():null)
        .then(cfg=>{if(done)return;clearTimeout(timer);
          if(cfg&&cfg.mode==='world'&&cfg.me&&typeof cfg.me==='object'){done=true;this.startWorld(cfg);}else local();})
        .catch(()=>{clearTimeout(timer);local();});
    },
    // Local page: the "Thế giới" chip follows the publisher every 5 s; hidden while it is off.
    pollPreview(){
      const tick=()=>fetch('/api/public-preview',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{
        const hub=d&&typeof d.hub==='string'&&/^https?:\/\//.test(d.hub)?d.hub:'';
        const v=d&&typeof d.state==='string'&&d.state!=='off'?{state:d.state,share:d.share==='co-ban'?'co-ban':'kin',hub}:null,c=this.state.worldChip||null;
        const joinable=!!d&&d.state==='off';
        if(joinable!==!!this.state.joinable)this.setState({joinable});
        if(!v!==!c||(v&&(v.state!==c.state||v.share!==c.share||v.hub!==c.hub)))this.setState({worldChip:v});
        const jp=this.state.join&&this.state.join.phase;
        if(v&&v.state!=='revoked'&&jp&&jp!=='leaving')this.setState({join:null});});
      this.previewTick=tick;tick();this.previewTimer=setInterval(tick,5000);
    },
    // "Tham gia thế giới": the local server pairs with the hub and opens its approval page in the browser.
    joinWorld(){
      const j=this.state.join;if(j&&j.phase==='starting')return;
      this.setState({join:{phase:'starting'}});
      fetch('/api/join',{method:'POST',headers:{'X-Terrarium':'join'},cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(res=>{
        if(!res||typeof res.phase!=='string'){this.setState({join:{phase:'error',error:'local'}});return;}
        this.setState({join:res.phase==='joined'?null:res});
        if(res.phase==='pending')this.watchJoin();else if(this.previewTick)this.previewTick();
      });
    },
    watchJoin(){
      clearTimeout(this.joinTimer);
      this.joinTimer=setTimeout(()=>fetch('/api/join',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(res=>{
        if(!res||res.phase==='pending'||res.phase==='starting'){this.watchJoin();return;}
        this.setState({join:res.phase==='error'?res:null});
        if(this.previewTick)this.previewTick();
      }),3000);
    },
    leaveWorld(){
      if(!this.state.leaveArmed){this.setState({leaveArmed:true});clearTimeout(this.armTimer);this.armTimer=setTimeout(()=>this.setState({leaveArmed:false}),4000);return;}
      clearTimeout(this.armTimer);clearTimeout(this.joinTimer);
      this.setState({leaveArmed:false,join:{phase:'leaving'}});
      fetch('/api/leave',{method:'POST',headers:{'X-Terrarium':'leave'},cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(res=>{
        if(!res){this.setState({join:{phase:'error',error:'local'}});return;}
        this.setState({join:res.phase==='error'||res.warn?{phase:'error',error:res.warn||res.error}:null,worldChip:null});
        if(this.previewTick)this.previewTick();
      });
    },
    // Header: status only. The actions live in the settings panel (worldJoinSection).
    worldChip(){
      const c=this.state.worldChip,j=this.state.join;
      const dot=col=>h('span',{style:{width:8,height:8,borderRadius:'50%',background:col,display:'inline-block'}});
      if(!c&&j&&j.phase==='pending')return h('div',{className:'chip',title:tr('world.chip.pendingTitle'),style:{borderColor:'#f5a524'}},dot('#f5a524'),h('span',null,tr('world.chip.pending',{code:String(j.code||'')})));
      if(!c)return null;
      const[text,col]={sending:[tr('world.chip.sending',{share:SHARE_LABEL.get(c.share)}),'#46a758'],private:[tr('world.chip.private'),'#8b8fa3'],offline:[tr('world.chip.offline'),'#e5484d'],revoked:[tr('world.chip.revoked'),'#e5484d'],paused:[tr('world.chip.paused'),'#f5a524']}[c.state]||['…','#8b8fa3'];
      const kids=[dot(col),h('span',null,tr('world.chip.label',{status:text}))];
      if(!c.hub)return h('div',{className:'chip',title:tr('world.chip.title'),style:{borderColor:col}},...kids);
      return h('a',{className:'chip',href:c.hub,target:'_blank',rel:'noopener noreferrer',title:tr('world.chip.openTitle'),style:{borderColor:col,textDecoration:'none'}},...kids);
    },
    worldJoinError(e){
      if(e==='local')return tr('world.join.errLocal');
      if(e==='hub_unreachable')return tr('world.join.warnUnreachable');
      if(e==='local_config')return tr('world.join.errConfig');
      if(/hub_full|hub is full/.test(e))return tr('world.join.errFull');
      if(/denied/.test(e))return tr('world.join.errDenied');
      if(/expired/.test(e))return tr('world.join.errExpired');
      return tr('world.join.errFailed',{msg:String(e||'')});
    },
    worldJoinSection(){
      const c=this.state.worldChip,j=this.state.join||{};
      if(!c&&!this.state.joinable&&!this.state.join)return null;
      const joined=!!c&&c.state!=='revoked';
      const busy=j.phase==='starting'||j.phase==='leaving';
      const url=typeof j.url==='string'&&/^https?:\/\//.test(j.url)?j.url:'';
      const sm={padding:'5px 10px',fontSize:11};
      let line=tr('world.join.idle');
      if(j.phase==='starting')line=tr('world.join.starting');
      else if(j.phase==='leaving')line=tr('world.join.leaving');
      else if(j.phase==='pending')line=tr('world.join.pending',{code:String(j.code||'')});
      else if(c&&c.state==='revoked')line=tr('world.join.revoked');
      else if(joined)line=tr('world.join.joined',{share:SHARE_LABEL.get(c.share)});
      const btns=[];
      if(joined){
        if(c.hub)btns.push(h('a',{key:'open',className:'btn',href:c.hub,target:'_blank',rel:'noopener noreferrer',style:{...sm,textDecoration:'none'}},tr('world.join.open')));
        btns.push(h('button',{key:'leave',type:'button',className:'btn',disabled:busy,onClick:()=>this.leaveWorld(),
          style:{...sm,borderColor:'#e5484d',color:this.state.leaveArmed?'#ffffff':'#ff8a8d',background:this.state.leaveArmed?'#e5484d':undefined}},
          this.state.leaveArmed?tr('world.join.leaveConfirm'):tr('world.join.leave')));
      }else if(j.phase==='pending'){
        if(url)btns.push(h('a',{key:'open',className:'btn',href:url,target:'_blank',rel:'noopener noreferrer',style:{...sm,textDecoration:'none'}},tr('world.join.openApproval')));
        btns.push(h('button',{key:'cancel',type:'button',className:'btn',onClick:()=>this.setState({leaveArmed:true},()=>this.leaveWorld()),style:sm},tr('world.join.cancel')));
      }else{
        btns.push(h('button',{key:'join',type:'button',className:'btn btn-accent',disabled:busy,onClick:()=>this.joinWorld(),style:sm},
          busy?tr('world.join.busy'):c?tr('world.join.rejoin'):tr('world.join.join')));
      }
      return h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
        h('div',{style:{borderTop:'1px solid var(--border)',margin:'2px 0'}}),
        h('div',{style:{color:'#ffffff',fontWeight:600}},tr('world.join.heading')),
        h('div',{style:{color:'var(--muted)',lineHeight:1.45}},line),
        j.phase==='error'&&j.error&&h('div',{role:'alert',style:{color:'#ff8a8d'}},this.worldJoinError(j.error)),
        h('div',{style:{display:'flex',flexWrap:'wrap',gap:6}},...btns),
        h('div',{style:{borderTop:'1px solid var(--border)',margin:'4px 0 0'}}));
    },

    startWorld(cfg){
      let view='all';try{const v=this.storage&&this.storage.getItem(VIEW_KEY);if(v==='mine'||v==='all')view=v;}catch(_){}
      if(this.world){clearTimeout(this.world.meTimer);clearTimeout(this.world.waitTimer);clearTimeout(this.world.probeTimer);}// "Thử lại" starts a fresh world
      this.world={me:cfg.me,csrf:typeof cfg.csrf==='string'?cfg.csrf:'',islands:[],scenes:new Map(),viewers:0,capacity:WorldLogic.SLOTS,conn:'connecting',view,focus:null,hover:null,sw:0,sh:0,sky:null,
        dead:false,errAt:0,mine:null,meErr:false,meSeq:0,draft:null,confirm:null,probe:WorldLogic.meProbeState()};
      this.setState({sel:null,selIsland:null,live:'off'});
      // The pointer handlers bound at mount drive the local camera; the world has none of it (no drag, no zoom).
      // Hover and clicks go to a scroller over the canvases, which on a phone also scrolls the sky.
      const st=this.stageEl;
      if(st&&!this.setWorldStage)for(const[ev,k]of[['wheel','onWheel'],['pointerdown','onDown'],['pointermove','onDrag'],['pointerup','onUp'],['pointercancel','onUp']])st.removeEventListener(ev,this[k]);
      this.setWorldStage=el=>{this.stageEl=el;};
      this.setWorldCanvas=el=>{this.worldCanvas=el;};
      this.setWorldScroller=el=>{this.worldScroller=el;};this.setWorldSpacer=el=>{this.worldSpacer=el;};
      if(!this.onWorldHover)this.onWorldHover=e=>this.worldHover(e);
      const w=this.world,parse=e=>{try{const d=JSON.parse(e.data);return d&&typeof d==='object'?d:null;}catch(_){return null;}};
      const es=new EventSource('/api/world/stream');w.es=es;
      es.onopen=()=>{if(!w.dead){w.conn='ok';w.errAt=0;this.worldStalls=0;}};
      // A dropped connection retries by itself; a refused one (401/403 signed out or banned, 429/503 too many streams)
      // closes for good. Retrying that keeps failing for STALL_MS also ends the stream, so a stopped hub is told apart.
      es.onerror=()=>{if(w.dead)return;
        if(es.readyState===EventSource.CLOSED)return this.worldEnded(true);
        const now=performance.now();if(!w.errAt)w.errAt=now;
        if(now-w.errAt>=STALL_MS)this.worldEnded(false);else w.conn='error';};
      es.addEventListener('world',e=>{const d=parse(e);if(d)this.worldMeta(d);});
      es.addEventListener('island',e=>{const d=parse(e);if(!d||typeof d.id!=='string'||w.dead)return;
        if(w.metaSeen&&!w.islands.some(i=>i.id===d.id))return;// not (or no longer) in the world list
        let sc=w.scenes.get(d.id);if(!sc){sc=new IslandScene(this,d.id);w.scenes.set(d.id,sc);}
        sc.sync(Array.isArray(d.sessions)?d.sessions.filter(s=>s&&typeof s.id==='string'):[]);});
      es.addEventListener('remove',e=>{const d=parse(e);if(!d||typeof d.id!=='string'||w.dead)return;
        const sc=w.scenes.get(d.id);if(sc)releaseCanvas(sc);
        w.scenes.delete(d.id);w.islands=w.islands.filter(i=>i.id!==d.id);
        this.dropGone();});
      // "Của tôi" polls only while the tab is visible, and refreshes once when it becomes visible again.
      const tick=()=>{if(this.world!==w)return;
        if(w.view==='mine'&&!w.dead&&document.visibilityState==='visible')this.loadMe();
        w.meTimer=setTimeout(tick,ME_EVERY_MS*(1-ME_JITTER+Math.random()*2*ME_JITTER));};
      w.meTimer=setTimeout(tick,ME_EVERY_MS*(1-ME_JITTER+Math.random()*2*ME_JITTER));
      if(!this.onWorldVisible){this.onWorldVisible=()=>{const x=this.world;
        if(x&&!x.dead&&x.view==='mine'&&document.visibilityState==='visible')this.loadMe();
        if(x&&!x.dead&&document.visibilityState==='visible')this.meProbe([],false);};
        document.addEventListener('visibilitychange',this.onWorldVisible);}
      // Phones (<= 480 px) fold the "Máy mới" notices into one line and use a 16 px name field (no zoom on focus).
      if(!this.phoneMq&&window.matchMedia){this.phoneMq=window.matchMedia('(max-width: 480px)');
        const re=()=>{if(this.world)this.forceUpdate();};
        if(this.phoneMq.addEventListener)this.phoneMq.addEventListener('change',re);else if(this.phoneMq.addListener)this.phoneMq.addListener(re);}
      if(view==='mine')this.loadMe();
      // Esc: closes an open confirm first, else goes back to "Toàn cảnh"; never while typing or with settings open.
      if(!this.onWorldKey){this.onWorldKey=e=>{const x=this.world;if(e.key!=='Escape'||!x||x.dead)return;
          const el=e.target,typing=!!el&&(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.isContentEditable);
          const act=WorldLogic.escAction({view:x.view,typing,settings:!!this.state.showSettings,confirm:!!x.confirm,mod:e.ctrlKey||e.metaKey||e.altKey});
          if(act==='confirm'){if(x.confirm.busy)return;clearTimeout(x.confirm.timer);x.confirm=null;this.forceUpdate();}
          else if(act==='back')this.navigate({view:'all'});};
        window.addEventListener('keydown',this.onWorldKey);}
    },
    // Asks /api/me when an unseen island may be mine (WorldLogic.meProbeStep), with one trailing call when throttled.
    meProbe(ids,first){
      const w=this.world;if(!w||w.dead)return;
      const r=WorldLogic.meProbeStep(w.probe,ids,performance.now(),{first:!!first,visible:document.visibilityState==='visible',hasMine:!!this.myIslandId(),every:ME_PROBE_MS});
      clearTimeout(w.probeTimer);w.probeTimer=null;
      if(r.fire)this.loadMe();
      else if(r.retryIn!=null)w.probeTimer=setTimeout(()=>{if(this.world===w)this.meProbe([],false);},Math.ceil(r.retryIn)+20);
    },
    // Forget a selection or an owner's "Xoá đảo" question whose island is no longer in the world.
    dropGone(){
      const w=this.world,has=id=>w.islands.some(i=>i.id===id);
      if(w.confirm&&w.confirm.kind==='remove'&&!has(w.confirm.id)){clearTimeout(w.confirm.timer);w.confirm=null;this.forceUpdate();}
      if(this.state.selIsland!=null&&!has(this.state.selIsland))this.setState({sel:null,selIsland:null});
      // The island on screen is gone (an owner removed it, or I left the hub on another tab): back through the clouds.
      // While clouds already run, navigate is refused: applyView lands on "Toàn cảnh" by itself, or worldFrame calls
      // this again once they are gone.
      if(WorldLogic.viewGone(w.view,w.view==='one'?w.focus:w.shown,has))this.navigate({view:'all'});
    },
    worldMeta(d){
      const w=this.world;
      // Only islands with a slot 0-7 have a place in the sky (an older hub sends none: nothing is shown).
      w.islands=(Array.isArray(d.islands)?d.islands:[]).filter(i=>i&&typeof i.id==='string'&&validSlot(i.slot));
      w.viewers=Number.isFinite(d.viewers)?d.viewers:0;
      w.capacity=Number.isInteger(d.capacity)&&d.capacity>0?d.capacity:WorldLogic.SLOTS;
      // Without an island of my own, an island never seen before may be mine (just paired on another tab): ask
      // /api/me, at most once every ME_PROBE_MS, so the centre turns from "chỗ của bạn" into my island by itself.
      this.meProbe(w.islands.map(i=>i.id),!w.metaSeen);
      const ids=new Set(w.islands.map(i=>i.id));
      for(const[id,sc]of[...w.scenes])if(!ids.has(id)){releaseCanvas(sc);w.scenes.delete(id);}
      for(const i of w.islands)if(!w.scenes.has(i.id))w.scenes.set(i.id,new IslandScene(this,i.id));
      this.dropGone();
      // My island's name, colour or sending state changed (a rename from /me, a device going offline...): the
      // "Của tôi" panel asks /api/me again rather than wait for the next poll.
      const m=this.myIsland(),sig=m?JSON.stringify([m.name,m.color,m.online,m.private,m.share]):'';
      const changed=w.metaSeen&&sig!==w.mineSig;w.mineSig=sig;w.metaSeen=true;
      if(changed&&w.view==='mine'&&document.visibilityState==='visible')this.loadMe();
    },
    // The stream is gone (refused: closed by the hub's answer; else it kept failing): drop everything shown and ask
    // /api/config why. Signed out → reload (the hub sends the login page); still world mode → the hub refused the
    // stream (too many tabs) or, for a stalled one, came back; no answer → unreachable. Both get "Thử lại".
    // A stalled stream is restarted by itself at most MAX_STALLS times in a row without an onopen; then the page
    // stops and offers "Thử lại". 429 from /api/config (the hub's request limit) is 'busy', with "Thử lại" held
    // until its Retry-After.
    worldEnded(refused){
      const w=this.world;if(w.dead)return;
      w.dead=true;w.es&&w.es.close();for(const sc of w.scenes.values())releaseCanvas(sc);
      w.scenes.clear();w.islands=[];w.viewers=0;w.hover=null;
      if(w.confirm)clearTimeout(w.confirm.timer);w.confirm=null;
      this.setState({sel:null,selIsland:null});
      probeConfig().then(x=>{if(this.world!==w)return;
        if(x.kind==='signedout')return location.reload();
        if(x.kind==='other'){w.conn='ended';this.forceUpdate();return location.reload();}
        if(x.kind==='world'&&!refused){
          if((this.worldStalls||0)<MAX_STALLS){this.worldStalls=(this.worldStalls||0)+1;return this.startWorld(x.cfg);}
          w.conn='unreachable';return this.forceUpdate();}
        this.worldStopped(w,x);});
    },
    // Shows why the world stays down: refused (the hub answers but would not stream), busy or unreachable.
    worldStopped(w,x){
      clearTimeout(w.waitTimer);w.retryAt=0;
      w.conn=x.kind==='world'?'refused':x.kind==='busy'?'busy':'unreachable';
      if(x.kind==='busy'&&x.retryS>0){w.retryAt=performance.now()+x.retryS*1000;
        const count=()=>{if(this.world!==w)return;this.forceUpdate();
          if(performance.now()<w.retryAt)w.waitTimer=setTimeout(count,Math.min(1000,w.retryAt-performance.now()+20));else w.retryAt=0;};
        w.waitTimer=setTimeout(count,1000);}
      this.forceUpdate();
    },
    retryWorld(){
      const w=this.world;if(w.retrying||(w.retryAt&&performance.now()<w.retryAt))return;
      w.retrying=true;w.es&&w.es.close();this.forceUpdate();
      probeConfig().then(x=>{if(this.world!==w)return;w.retrying=false;
        if(x.kind==='signedout')return location.reload();
        if(x.kind==='world'){this.worldStalls=0;return this.startWorld(x.cfg);}
        if(x.kind==='busy'||x.kind==='down')return this.worldStopped(w,x);
        this.forceUpdate();});// still failing: keep the state, the button works again
    },
    // ---- "Của tôi": my island, colours and devices from GET /api/me ----
    loadMe(){
      const w=this.world,seq=++w.meSeq;
      return fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})
        .then(r=>r.status===200&&isJson(r)?r.json():Promise.reject(r.status))
        .then(d=>{if(this.world!==w||seq!==w.meSeq)return;// an older answer than one already asked for
          if(!d||typeof d!=='object'||!Array.isArray(d.devices))throw new Error('shape');
          const island=d.island&&typeof d.island==='object'&&HEX_ID.test(d.island.id)?d.island:null;
          w.mine={island,colors:(Array.isArray(d.colors)?d.colors:[]).filter(c=>okColor(c)===c),devices:d.devices.filter(x=>x&&typeof x==='object'&&HEX_ID.test(x.id))};
          w.meErr=false;
          if(!w.draft||!w.draft.dirty||!island)w.draft=island?{name:String(island.name||''),color:island.color,dirty:false}:null;
          // Pairing or removal since the page loaded moves "my island" (and the sky's centre with it).
          const id=island?island.id:null;if(id!==w.me.islandId)w.me={...w.me,islandId:id};})
        .catch(()=>{if(this.world===w&&seq===w.meSeq)w.meErr=true;})// keep what was shown
        .then(()=>{if(this.world===w)this.forceUpdate();});
    },
    postJson(path,body){
      return fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-CSRF-Token':this.world.csrf,accept:'application/json'},body:JSON.stringify(body||{})})
        .then(r=>(isJson(r)?r.json().catch(()=>null):Promise.resolve(null)).then(data=>({status:r.status,data})))
        .catch(()=>({status:0,data:null}));
    },
    saveIsland(){
      const w=this.world,d=w.draft;if(!d||w.saving)return;
      w.saving=true;w.saveMsg=null;this.forceUpdate();
      const sent={name:d.name,color:d.color};
      this.postJson('/api/me/island',sent).then(({status,data})=>{if(this.world!==w)return;w.saving=false;
        const i=status===200&&data&&data.island;
        // Typing went on while the save was in flight: keep what is in the field (still unsaved).
        const same=w.draft===d&&d.name===sent.name&&d.color===sent.color;
        if(i){if(same)w.draft={name:String(i.name||''),color:i.color,dirty:false};w.saveMsg={ok:true,text:tr('world.save.ok')};}
        else w.saveMsg={ok:false,text:status===400?NAME_ERR:status===404?tr('world.save.noIsland'):tr('world.save.failed')};
        this.loadMe();});
    },
    // Revoke one of my devices, after the in-panel "Thu hồi <tên>?".
    revokeDevice(id){
      const w=this.world,c=w.confirm;if(!c||c.busy||!HEX_ID.test(id))return;
      c.busy=true;c.err=null;this.forceUpdate();
      this.postJson('/api/me/devices/'+id+'/revoke').then(({status})=>{if(this.world!==w)return;
        if(status===200){if(w.confirm===c)w.confirm=null;}else{c.busy=false;c.err=tr('world.revoke.failed');}
        this.loadMe();});
    },
    // Owner: remove someone's island. Success shows up as the stream's 'remove' event, which closes the panel.
    removeIsland(id){
      const w=this.world,c=w.confirm;if(!c||c.busy||!HEX_ID.test(id))return;
      c.busy=true;c.err=null;this.forceUpdate();
      this.postJson('/api/owner/islands/'+id+'/remove').then(({status,data})=>{if(this.world!==w||w.confirm!==c)return;
        // Stays "Đang gửi…" until the 'remove' event; if that is lost, the question closes after REMOVE_WAIT_MS anyway.
        if(status===200){c.timer=setTimeout(()=>{if(this.world===w&&w.confirm===c){w.confirm=null;this.forceUpdate();}},REMOVE_WAIT_MS);return;}
        c.busy=false;c.err=status===403&&data&&data.error==='owner_island'?tr('world.remove.ownerIsland'):tr('world.remove.failed');
        this.forceUpdate();});
    },
    // My island: the one /api/me (or the page's config) names, only while the hub lists it in a slot.
    myIslandId(){const w=this.world,m=w.mine,id=m&&m.island?m.island.id:w.me.islandId;return id&&w.islands.some(i=>i.id===id)?id:null;},
    mySlot(){const id=this.myIslandId(),m=id&&this.world.islands.find(i=>i.id===id);return m?m.slot:null;},
    myIsland(){const id=this.myIslandId();return id?this.world.islands.find(i=>i.id===id):null;},
    // The 8-slot layout for the current islands and stage, remembered until one of its inputs changes, with what every
    // frame of "Toàn cảnh" needs from it: the ring cells top row first and the island in each slot.
    // The world list, w.mine and w.me are replaced (never changed in place) when they change, so identity tells.
    sky(){
      const w=this.world,lw=w.lw||w.sw,k=w.sky;
      if(k&&k.islands===w.islands&&k.mine===w.mine&&k.me===w.me&&k.lw===lw&&k.sh===w.sh)return k;
      const slots=w.islands.map(i=>i.slot),mine=this.mySlot(),key=slots.join(',')+'|'+mine+'|'+lw+'|'+w.sh;
      const same=k&&k.key===key,L=same?k.L:WorldLogic.skyLayout(slots,mine,lw,w.sh);
      const bySlot=new Map();for(const i of w.islands)if(!bySlot.has(i.slot))bySlot.set(i.slot,i);
      return w.sky={key,L,sorted:same?k.sorted:[...L.cells].sort((a,b)=>a.rect.y-b.rect.y),bySlot,
        islands:w.islands,mine:w.mine,me:w.me,lw,sh:w.sh};
    },
    skyNow(){return this.sky().L;},
    // Moves between "Toàn cảnh" ('all'), one island ('one', focus = its id) and "Của tôi" ('mine') through the cloud
    // transition: worldFrame swaps the view (applyView) once the clouds cover it. A second request while the clouds
    // run is dropped, not queued.
    navigate(to){
      const w=this.world;if(!w||w.dead)return;
      const now=performance.now(),reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const t=WorldLogic.beginTrans({trans:w.trans,reduced:w.transReduced,view:w.view,focus:w.focus},to,now,reduced);if(!t)return;
      w.trans=t;w.transReduced=reduced;
      w.hover=null;const el=this.worldScroller;if(el&&el.style.cursor!=='default')el.style.cursor='default';
    },
    // Called once per transition, behind full cover. An island removed meanwhile lands on "Toàn cảnh".
    applyView(to){
      const w=this.world,{view,focus}=WorldLogic.landingView(to,id=>w.islands.some(i=>i.id===id));
      const old=w.shown&&w.scenes.get(w.shown);
      if(old)releaseCanvas(old);
      w.view=view;w.focus=focus;w.hover=null;w.shown=null;w.oneR=null;w.sheetOpen=null;
      if(view!=='one')try{this.storage&&this.storage.setItem(VIEW_KEY,view);}catch(_){}
      if(w.confirm)clearTimeout(w.confirm.timer);w.confirm=null;
      this.setState({sel:null,selIsland:focus});
      if(view==='mine'&&!w.dead)this.loadMe();
    },
    // One island alone, as wide as the local page draws it (no camera), in the room the controls leave
    // (WorldLogic.oneArea): between the back control and the collapsed sheet on a phone, beside an open panel on a
    // wide stage when that keeps it large.
    oneIslandRect(sw,sh){const phone=this.phoneStage(sw);
      const a=WorldLogic.oneArea(sw,sh,{phone,panelOpen:!phone&&this.sheetOpen(),panelW:PANEL_COL,top:ONE_TOP,bottom:ONE_BOTTOM,lw:LW,fh:FH});
      return WorldLogic.fitOne(a,LW,FH,LH);},
    phoneStage(sw){return sw>0&&sw<=WorldLogic.PHONE_MAX_W;},
    // The island panel: open unless the viewer collapsed it; a phone starts collapsed (but open with nothing to see:
    // "Của tôi" without an island). An open question (confirm) always shows.
    sheetOpen(){const w=this.world;if(w.confirm)return true;if(w.sheetOpen!=null)return w.sheetOpen;
      return!this.phoneStage(w.sw)||(w.view==='mine'&&!this.myIslandId());},

    worldFrame(ts){
      const w=this.world,dt=Math.min(0.05,Math.max(0,(ts-this.last)/1000));this.last=ts;
      this.env=this.envNow();this.frameTheme=this.theme;
      const st=this.stageEl;w.sw=st?st.clientWidth:0;w.sh=st?st.clientHeight:0;
      // The sky is laid out in the scroller's width: a classic scrollbar (desktop, narrow window) takes its own room.
      const sc_=this.worldScroller;w.lw=sc_&&sc_.clientWidth?Math.min(w.sw,sc_.clientWidth):w.sw;
      const phone=this.phoneStage(w.sw);if(phone!==w.phone){w.phone=phone;w.oneR=null;this.forceUpdate();}
      // The view swaps on the first frame the clouds cover it (the hold, when nothing moves, so a slow first full
      // draw of the new island does not show as a stutter).
      const step=WorldLogic.transStep(w.trans,performance.now(),w.transReduced);
      if(step.swapNow){w.trans.swapped=true;this.applyView(w.trans.to);}
      this.drawWorld(ts/1000,dt,w.sw,w.sh);
      this.drawSky(ts/1000);
      if(step.phase)this.drawClouds(this.frontCanvas.getContext('2d'),step.phase,w.sw,w.sh,ts/1000);
      // An island removed while the clouds ran (navigate was refused then) is caught once they are gone.
      if(w.trans&&step.done){w.trans=null;this.dropGone();}
    },
    // The transition over everything on the stage but the React panels: two cloud banks (cover), or with reduced motion
    // a plain veil of cloud colour (fade). Drawn on the front canvas, which drawSky has just painted this frame.
    drawClouds(ctx,phase,sw,sh,t){
      const col=this.env&&this.env.col;if(!col||sw<=0||sh<=0)return;
      if(phase.cover>0){const b=WorldLogic.cloudBands(phase.cover,sw);SkyRender.drawCurtains(ctx,sw,sh,b.left,b.right,t||0,col);}
      if(phase.fade>0){ctx.globalAlpha=phase.fade;ctx.fillStyle=col.cloud;ctx.fillRect(0,0,sw,sh);ctx.globalAlpha=1;}
    },
    drawWorld(t,dt,sw,sh){
      const w=this.world,cv=this.worldCanvas;if(!cv)return;
      const dpr=window.devicePixelRatio||1,bw=Math.round(sw*dpr),bh=Math.round(sh*dpr);
      if(cv.width!==bw||cv.height!==bh){cv.width=bw;cv.height=bh;}
      const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,sw,sh);
      if(w.view!=='all')this.setScroll(0);
      const now=performance.now(),full=sw>0&&sh>0?(w.view==='all'?(this.drawSky8(t,dt,sw,sh),null):this.drawOne(ctx,t,dt,sw,sh,now)):null;
      // Islands not drawn in full still walk, a few times a second, and hold no full-detail canvas.
      for(const sc of w.scenes.values())if(sc.id!==full){if(sc.lod==='full')releaseCanvas(sc);
        if(now-sc.simAt>=OFF_MS){const d=Math.min(1,(now-(sc.simAt||now))/1000);sc.simAt=now;if(d>0)sc.frame(d);}}
    },
    // "Của tôi" or one island from the sky: the full scene every frame, at the screen's resolution. Returns its id.
    drawOne(ctx,t,dt,sw,sh,now){
      const w=this.world,id=w.view==='mine'?this.myIslandId():w.focus,sc=id&&w.scenes.get(id),meta=sc&&w.islands.find(i=>i.id===id);
      if(!sc||!meta)return null;
      const dpr=window.devicePixelRatio||1,target=this.oneIslandRect(sw,sh),simDt=Math.min(1,(now-(sc.simAt||now))/1000)||dt;
      // The island glides to its new place when the panel opens or closes (the bake keeps the target's resolution).
      const o=w.oneR,ease=o&&!(this.env&&this.env.reduced)?1-Math.exp(-dt*14):1;
      const r=w.oneR=o?{x:o.x+(target.x-o.x)*ease,y:o.y+(target.y-o.y)*ease,w:o.w+(target.w-o.w)*ease,h:o.h+(target.h-o.h)*ease,fh:target.fh}:target;
      if(Math.abs(r.x-target.x)+Math.abs(r.y-target.y)+Math.abs(r.w-target.w)<0.5)w.oneR=target;
      sc.simAt=now;sc.frame(Math.min(0.05,simDt));
      sc.lodK=Math.min(4,Math.max(0.5,target.w*dpr/LW));sc.lod='full';
      sc.state.sel=this.state.selIsland===sc.id?this.state.sel:null;sc.draw(t);sc.drawnAt=now;
      const bob=this.env&&this.env.reduced?0:Math.round(Math.sin(t*0.7)*3);
      ctx.globalAlpha=meta.online===false?OFFLINE_ALPHA:1;ctx.imageSmoothingEnabled=r.w<sc.canvas.width/dpr;
      ctx.drawImage(sc.canvas,r.x,r.y+bob,r.w,r.h);
      ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
      // no name plate here: the panel title and the back control already name the island
      w.shown=id;// so a later removal of this island (mine included) takes the view back to "Toàn cảnh"
      return id;
    },
    // "Toàn cảnh": the ring first (top rows first, so lower places overlap upper ones), my place in the centre last.
    // On a phone the stage scrolls (a spacer as tall as the layout); the canvas stays put and draws shifted up.
    drawSky8(t,dt,sw,sh){
      const w=this.world,ctx=this.worldCanvas.getContext('2d'),S=this.sky(),L=S.L,bySlot=S.bySlot,sc_=this.worldScroller;
      const tall=L.phone&&L.height>sh;this.setScroll(tall?L.height:0);
      const top=tall&&sc_?sc_.scrollTop:0,reduced=!!(this.env&&this.env.reduced);
      const at=r=>top?{x:r.x,y:r.y-top,w:r.w,h:r.h}:r,seen=r=>r.y-top<sh&&r.y-top+r.h>0;
      // Phone cells keep room for a two-line plate, so plates in a row line up whatever their length.
      const labelH=L.phone?LABEL_H2:LABEL_H;
      const island=(r,meta,mine)=>{const sc=w.scenes.get(meta.id),c=tally(sc);
        this.drawSimpleIsland(ctx,at(r),meta,{busy:c.busy,alert:c.alert,hover:w.hover===meta.slot,mine,t,reduced,labelH});};
      for(const c of S.sorted){if(!seen(c.rect))continue;
        const meta=c.kind==='island'&&bySlot.get(c.slot);
        if(meta)island(c.rect,meta,false);else this.drawSlotTile(ctx,at(c.rect),'empty',{labelH});}
      const C=L.centre;
      if(seen(C.rect)){const meta=C.kind==='mine'&&bySlot.get(C.slot);
        if(meta)island(C.rect,meta,true);else this.drawSlotTile(ctx,at(C.rect),C.kind==='mine'?'yours':C.kind,{hover:C.kind==='yours'&&w.hover===C.slot,t,reduced,labelH});}
    },
    // A content height to scroll through, or 0 for none (back at the top, so hit tests need no offset).
    setScroll(height){
      const el=this.worldScroller,sp=this.worldSpacer,ov=height?'auto':'hidden',hs=height?Math.ceil(height)+'px':'100%';
      if(el&&el.style.overflowY!==ov){el.style.overflowY=ov;if(!height)el.scrollTop=0;}
      if(sp&&sp.style.height!==hs)sp.style.height=hs;
    },
    // Where a simple island (or an empty place) goes inside its rect, in device px: s device px per art px, the art's
    // top left (ax, ay), and whether its name plate (labelH CSS px) fits under it. The scale is a whole number, except
    // that 1.25 or 1.5 is used where 2 does not fit, and a little under 1 (down to 0.85) keeps the plate under the art in
    // the smallest phone cells at DPR 1; stamped with smoothing off either way.
    // Only a cell smaller still puts the plate over the island.
    artPlace(rect,labelH){
      const dpr=window.devicePixelRatio||1,W=rect.w*dpr,H=rect.h*dpr,lh=(labelH||LABEL_H)*dpr;
      const room=Math.min(W/ART_W,(H-lh)/ART_H),under=room>=0.85;
      let s=under?Math.floor(room):Math.max(1,Math.floor(Math.min(W/ART_W,H/ART_H)));
      if(under&&s<=1)s=room>=1.5?1.5:room>=1.25?1.25:Math.min(1,room);
      const aw=Math.round(ART_W*s),ah=Math.round(ART_H*s),block=ah+(under?lh:0);
      return{dpr,s,aw,ah,under,ax:Math.round(rect.x*dpr+(W-aw)/2),ay:Math.round(rect.y*dpr+(H-block)/2)};
    },
    // Lift on hover and a ±1 px bob (none with reduced motion), in whole device px.
    artShift(p,hover,t,slot,reduced){
      return(hover?-Math.round(WorldLogic.HOVER_LIFT*p.dpr):0)+(reduced?0:Math.round(Math.sin(t*0.7+(slot||0)*1.7))*Math.max(1,Math.round(p.dpr)));
    },
    stampArt(ctx,img,p,dy,alpha){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;
      ctx.drawImage(img,p.ax,p.ay+dy,p.aw,p.ah);ctx.restore();
    },
    drawSimpleIsland(ctx,rect,meta,{busy,alert,hover,mine,t,reduced,labelH}){
      const df=Math.round((this.env?this.env.df:1)*10)/10,lit=Math.min(6,busy|0),color=okColor(meta.color);
      const img=art('i'+color+df+lit+(mine?'m':''),g=>paintIsland(g,color,df,lit,!!mine));
      const p=this.artPlace(rect,labelH),dy=this.artShift(p,hover,t,meta.slot,reduced),lh=labelH||LABEL_H;
      this.stampArt(ctx,img,p,dy,meta.online===false?OFFLINE_ALPHA:1);
      // the name plate hangs from its top edge just under the art (one or two lines), or over the underside when the
      // cell has no room for it
      const top=p.under?(p.ay+p.ah+dy)/p.dpr+4:Math.min(rect.y+rect.h-lh,(p.ay+p.ah+dy)/p.dpr-lh);
      this.drawIslandLabel(ctx,meta,busy,alert,rect.x+rect.w/2,top,hover,rect.w+8,true,!!mine);
    },
    drawSlotTile(ctx,rect,kind,o){
      o=o||{};const img=art('t'+kind,g=>paintTile(g,kind)),p=this.artPlace(rect,o.labelH),hover=!!o.hover&&kind==='yours';
      const dy=kind==='yours'?this.artShift(p,hover,o.t||0,0,o.reduced||kind!=='yours'):0;
      this.stampArt(ctx,img,p,dy,1);
      const x=rect.x+rect.w/2,y=(p.ay+(ISL.cy+2)*p.s+dy)/p.dpr;
      const B="600 12px 'JetBrains Mono',monospace",S="500 10px 'JetBrains Mono',monospace";
      if(kind==='empty')plate(ctx,x,y,[[tr('world.slot.empty'),"500 11px 'JetBrains Mono',monospace",'#dfe4ee']],null,0.55);
      else if(kind==='yours')plate(ctx,x,y,[[tr('world.slot.yours'),B,'#ffffff'],[tr('world.slot.pair'),S,GOLD]],hover?'#ffe08f':GOLD);
      else plate(ctx,x,y,[[tr('world.slot.full',{n:WorldLogic.SLOTS}),B,'#ffffff'],[tr('world.slot.askOwner'),S,'#aab2c5']],'#4a5468');
    },
    // Name, how many are working (muted when offline), a yellow dot when someone waits for approval or another session.
    // Mine (the caller says) has a gold edge; a hovered one a light edge and a darker plate. Wider than maxW (a narrow
    // phone cell), the count goes on a second line and the name is shortened to fit. y is the plate's bottom (6 px
    // above), or with fromTop its top edge, so a two-line plate grows downwards and never climbs over the island.
    // The fit (shortened name, widths) is measured once per name, count text, dot and maxW.
    drawIslandLabel(ctx,m,busy,alert,x,y,hover,maxW,fromTop,mine){
      const NF="600 12px 'JetBrains Mono',monospace",SF="500 11px 'JetBrains Mono',monospace";
      const full=clip(m.name||tr('world.island.defaultName'),24),sub=m.private?tr('world.label.private'):m.online===false?tr('world.label.busyOffline',{n:busy}):tr('world.label.busy',{n:busy});
      const dot=alert?14:0;
      ctx.save();
      const{name,nw,pw,two}=measured('l\n'+full+'\n'+sub+'\n'+dot+'\n'+maxW,()=>{
        let name=full;ctx.font=NF;let nw=ctx.measureText(name).width;
        ctx.font=SF;const sw_=ctx.measureText(sub).width;
        let pw=Math.ceil(14+nw+10+sw_+dot+10),two=false;
        if(maxW&&pw>maxW){two=true;ctx.font=NF;
          while(name.length>2&&14+nw+dot+10>maxW){name=clip(name,name.length-1);nw=ctx.measureText(name).width;}
          pw=Math.ceil(14+Math.max(nw+dot,sw_)+10);}
        return{name,nw,pw,two};});
      const ph=two?36:22,px=Math.round(x-pw/2),py=Math.round(fromTop?y:y-ph-6),l1=two?py+11:py+ph/2;
      ctx.fillStyle=hover?'rgba(10,13,20,0.94)':'rgba(16,20,30,0.82)';ctx.fillRect(px,py,pw,ph);
      ctx.fillStyle=okColor(m.color);ctx.fillRect(px,py,4,ph);
      if(mine||hover){ctx.strokeStyle=mine?GOLD:'#e6e9ef';ctx.lineWidth=1;ctx.strokeRect(px+0.5,py+0.5,pw-1,ph-1);}
      ctx.textBaseline='middle';
      ctx.font=NF;ctx.fillStyle='#ffffff';ctx.fillText(name,px+12,l1+1);
      ctx.font=SF;ctx.fillStyle=m.private?'#c9cfdc':m.online===false?'#7d8599':'#aab2c5';ctx.fillText(sub,two?px+12:px+12+nw+10,two?py+26:l1+1);
      if(alert){ctx.fillStyle=GOLD;ctx.beginPath();ctx.arc(px+pw-12,l1,4,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    },

    // ---- pointer: hover and click, in content px (the phone layout scrolls) ----
    worldPt(e){const el=this.worldScroller,r=el.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top+el.scrollTop];},
    // The agent under a stage point on the island drawn in full ("Của tôi" or one island), if any.
    oneHit(px,py){
      const w=this.world,id=w.view==='mine'?this.myIslandId():w.focus,sc=id&&w.scenes.get(id);if(!sc||sc.k==null)return null;
      const r=w.oneR||this.oneIslandRect(w.sw,w.sh);
      return sc.hit({currentTarget:{getBoundingClientRect:()=>({left:r.x,top:r.y,width:r.w,height:r.h})},clientX:px,clientY:py});
    },
    worldHover(e){
      const w=this.world,el=this.worldScroller;if(!el||w.dead||w.trans)return;// no hover while the clouds run
      let hover=null,hand=false;
      if(e.type!=='pointerleave'){const[px,py]=this.worldPt(e);
        if(w.view==='all'){const hit=WorldLogic.skyHit(this.skyNow(),px,py);hover=hit?hit.slot:null;hand=!!hit&&(hit.kind==='island'||hit.kind==='mine'||hit.kind==='yours');}
        else hand=!!this.oneHit(px,py);}
      w.hover=hand?hover:null;
      const cur=hand?'pointer':'default';if(el.style.cursor!==cur)el.style.cursor=cur;
    },
    onWorldClick(e){
      const w=this.world;if(!this.worldScroller||w.dead||w.trans)return;// clicks are dropped while the clouds run
      const[px,py]=this.worldPt(e);
      if(w.view!=='all'){const a=this.oneHit(px,py),id=w.view==='mine'?this.myIslandId():w.focus;
        if(a&&this.phoneStage(w.sw))w.sheetOpen=true;
        this.setState(a?{selIsland:id,sel:a.id}:{sel:null});return;}
      const hit=WorldLogic.skyHit(this.skyNow(),px,py);if(!hit)return;
      if(hit.kind==='mine'||hit.kind==='yours')return this.navigate({view:'mine'});
      const meta=hit.kind==='island'&&w.islands.find(i=>i.slot===hit.slot);
      if(meta)this.navigate({view:'one',focus:meta.id});
    },

    // ---- world page ----
    renderWorld(){
      const w=this.world,{showSettings}=this.state,mine=this.myIsland(),online=w.islands.filter(i=>i.online!==false).length;
      const pad={paddingLeft:'max(16px, env(safe-area-inset-left, 0px))',paddingRight:'max(16px, env(safe-area-inset-right, 0px))'};
      const hdrCtl={padding:'4px 10px',fontSize:11};
      const connCol=w.conn==='ok'?'#46a758':w.conn==='connecting'||w.conn==='busy'?'#f5a524':'#e5484d';
      const connText={ok:tr('world.conn.ok'),error:tr('world.conn.error'),ended:tr('world.conn.ended'),refused:tr('world.conn.refused'),busy:tr('world.conn.busy'),unreachable:tr('world.conn.unreachable')}[w.conn]||tr('world.conn.connecting');
      // "← Toàn cảnh" on one island and on "Của tôi", edged in that island's colour like its name plate.
      const shownMeta=w.view==='one'?w.islands.find(i=>i.id===w.focus):w.view==='mine'?mine:null;
      const back=w.view!=='all'&&!w.dead&&h('button',{key:'back:'+w.view+':'+(w.focus||''),type:'button',className:'sky-back',
        'aria-label':tr('world.back.aria'),title:tr('world.back.aria'),onClick:()=>this.navigate({view:'all'})},
        h('span',{className:'tab','aria-hidden':true,style:{background:shownMeta?okColor(shownMeta.color):GOLD}}),
        h('span',{'aria-hidden':true},'←'),h('span',null,tr('world.view.all')),h('kbd',{'aria-hidden':true},'Esc'));
      const tab=(v,label)=>h('button',{key:v,className:'btn'+(w.view===v?' btn-active':''),style:hdrCtl,'aria-pressed':w.view===v,onClick:()=>this.navigate({view:v})},label);
      // "Đảo 5/8 · 3 online", led by eight small squares, one per place in the sky: green sending, grey offline,
      // hollow free; mine has a gold edge.
      const cap=w.capacity||WorldLogic.SLOTS,bySlot=new Map(w.islands.map(i=>[i.slot,i])),mySlot=this.mySlot();
      const slotChip=h('div',{className:'chip',title:tr('world.slots.title',{islands:w.islands.length,cap,online})},
        h('span',{'aria-hidden':true,style:{display:'flex',gap:2}},Array.from({length:cap},(_,s)=>{const m=bySlot.get(s);
          return h('span',{key:s,style:{width:6,height:6,boxSizing:'border-box',display:'inline-block',
            background:m?(m.online===false?'#5d6478':'#46a758'):'transparent',border:'1px solid '+(s===mySlot?'#ffd166':m?'transparent':'#4a5468')}});})),
        h('span',null,tr('world.slots.label')),h('strong',{style:{color:'#ffffff'}},w.islands.length+'/'+cap),h('span',null,tr('world.slots.online',{n:online})));
      return h('div',{className:'app',style:{display:'flex',flexDirection:'column',gap:8,paddingTop:12,paddingBottom:12,boxSizing:'border-box',overflow:'hidden',background:'var(--bg)',...pad}},
        h('header',{style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 16px'}},
          h('div',{style:{display:'flex',alignItems:'baseline',gap:8,flex:'none'}},
            h('div',{style:{fontFamily:"'Pixelify Sans',monospace",fontSize:20,fontWeight:700,letterSpacing:'0.02em',color:'#ffffff'}},'CLAUDE CO.'),
            h('span',{style:{fontSize:11,color:'var(--muted)'}},location.host)),
          h('div',{style:{display:'flex',flexWrap:'wrap',gap:6,fontSize:11,alignItems:'center',flex:'1 1 300px',minWidth:0}},
            slotChip,
            h('div',{className:'chip'},h('span',null,tr('world.header.viewers')),h('strong',{style:{color:'#ffffff'}},w.viewers)),
            h('div',{className:'chip',title:connText},h('span',{style:{width:8,height:8,background:connCol,display:'inline-block'}}),h('span',null,connText))),
          h('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,flex:'none'}},
            h('div',{role:'group','aria-label':tr('world.header.viewMode'),style:{display:'flex'}},tab('all',tr('world.view.all')),tab('mine',tr('world.view.mine'))),
            h('a',{className:'btn',style:{...hdrCtl,textDecoration:'none'},href:'/me'},tr('world.header.myIslandLink')),
            // Settings live in the header here: the sky uses the whole stage, down to its bottom corners.
            h('button',{className:'btn'+(showSettings?' btn-active':''),'aria-label':tr('world.settings.label'),'aria-expanded':!!showSettings,title:tr('world.settings.title'),
              style:{...hdrCtl,width:30,padding:'4px 0'},onClick:()=>this.setState(p=>({showSettings:!p.showSettings}))},'⚙'))),
        h('div',{ref:this.setWorldStage,style:{position:'relative',flex:'1 1 0',minHeight:0,border:'3px solid #232a39',overflow:'hidden'}},
          h('canvas',{ref:this.setBack,style:{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:0,display:'block'}}),
          h('canvas',{ref:this.setWorldCanvas,style:{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:1,display:'block'}}),
          h('canvas',{ref:this.setFront,style:{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:2,pointerEvents:'none',display:'block'}}),
          // Takes hover and clicks; on a phone it scrolls a spacer as tall as the sky (drawSky8 sets overflow and height).
          h('div',{ref:this.setWorldScroller,onClick:e=>this.onWorldClick(e),onPointerMove:this.onWorldHover,onPointerLeave:this.onWorldHover,
            style:{position:'absolute',inset:0,zIndex:3,overflowX:'hidden',touchAction:w.view==='all'?'pan-y':'manipulation'}},
            h('div',{ref:this.setWorldSpacer,style:{width:1}})),
          back,
          this.worldPanel(mine),
          showSettings&&this.worldSettings())
      );
    },
    worldPanel(mine){
      const w=this.world,{sel,selIsland}=this.state;
      if(w.dead){
        if(w.conn==='refused'||w.conn==='busy'||w.conn==='unreachable'){
          const[title,text]={refused:[tr('world.dead.refused.title'),tr('world.dead.refused.text')],
            busy:[tr('world.conn.busy'),tr('world.dead.busy.text')],unreachable:[tr('world.dead.unreachable.title'),tr('world.dead.unreachable.text')]}[w.conn];
          const waitS=w.retryAt?Math.ceil((w.retryAt-performance.now())/1000):0;
          return h('div',{style:PANEL},
            h('div',{style:TITLE},title),
            h('span',{role:'alert',style:{lineHeight:1.5}},text),
            h('button',{className:'btn btn-accent',disabled:!!w.retrying||waitS>0,onClick:()=>this.retryWorld()},
              w.retrying?tr('world.dead.retrying'):waitS>0?tr('world.dead.retryIn',{s:waitS}):tr('world.dead.retry')));}
        if(w.conn==='ended')return h('div',{style:PANEL},
          h('div',{style:TITLE},tr('world.conn.ended')),
          h('span',{style:{lineHeight:1.5}},tr('world.dead.ended.text')),
          h('a',{href:'/auth/login',className:'btn btn-accent',style:{textAlign:'center',textDecoration:'none'}},tr('world.session.relogin')));
        return h('div',{style:PANEL},h('div',{style:TITLE},tr('world.stream.lost')),h('span',{style:{color:'var(--muted)'}},tr('world.stream.askingHub')));
      }
      const close=h('button',{className:'btn','aria-label':tr('world.panel.close'),onClick:()=>{if(sel!=null)return this.setState({sel:null});
        if(w.view==='one')return this.navigate({view:'all'});w.confirm=null;this.setState({sel:null,selIsland:null});},style:{width:28,height:28,padding:0,flex:'none'}},'×');
      const sc=selIsland&&w.scenes.get(selIsland),meta=selIsland&&w.islands.find(i=>i.id===selIsland);
      const a=sc&&sel!=null&&sc.byId(sel);
      if(a){// Hub data has no names, prompts or folders: status, kind of work, room, and tool / model on "Cơ bản".
        const raw=sc.raw.get(a.sid)||{},Dp=sc.depts.get(a.dept),stx=ST[a.status]||ST.working,par=a.parent&&sc.byId(a.parent);
        return this.worldSheet({label:tr('world.sheet.agentAria',{dept:clip(a.dept,40)}),
          icon:h('div',{style:{width:34,height:34,background:Dp?Dp.color:'#8b8fa3',color:'#ffffff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Pixelify Sans',monospace",fontSize:13,fontWeight:700,flex:'none'}},clip(a.short,4)),
          title:clip(a.dept,40),sub:(meta?clip(meta.name,40)+' · ':'')+stx[0],extra:close},[
          h('div',{style:{display:'flex',flexDirection:'column',gap:4,padding:10,background:'var(--bg)',borderLeft:'4px solid '+stx[1]}},h('span',{style:{fontWeight:600,color:stx[1]}},stx[0])),
          h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'10px 14px'}},
            field(tr('world.agent.field.kind'),KIND_LABEL.get(raw.kind)||'—'),
            field(tr('world.field.dept'),clip(a.dept,40)),
            raw.tool?field(tr('world.agent.field.tool'),clip(raw.tool,32)):null,
            raw.model?field(tr('world.agent.field.model'),clip(raw.model,48)):null,
            field(tr('world.agent.field.role'),par?tr('world.agent.role.sub',{parent:par.short}):tr('world.agent.role.main')))]);
      }
      if(w.view==='one'&&sc&&meta){
        const tl=tally(sc),bar={label:tr('world.sheet.islandAria',{name:meta.name||''}),icon:swatch(meta.color),title:meta.name||tr('world.island.fallbackName'),extra:close,
          sub:(meta.online===false?tr('world.island.offline'):tr('world.island.online'))+' · '+(meta.private?tr('world.label.private'):tr('world.label.busy',{n:tl.busy}))};
        // Owners may remove anyone's island but their own (the hub also refuses another owner's).
        const canRemove=w.me.role==='owner'&&meta.id!==this.myIslandId()&&meta.id!==w.me.islandId;
        const ask=canRemove&&w.confirm&&w.confirm.kind==='remove'&&w.confirm.id===meta.id?w.confirm:null;
        if(ask)return this.worldSheet(bar,[
          confirmRow(tr('world.island.remove.confirm'),tr('world.island.remove.ok'),ask,()=>this.removeIsland(meta.id),()=>{w.confirm=null;this.forceUpdate();})]);
        const counts=new Map();for(const x of sc.agents)if(!x.leaving)counts.set(x.dept,(counts.get(x.dept)||0)+1);
        return this.worldSheet(bar,[
          h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'10px 14px'}},
            field(tr('world.field.status'),meta.online===false?tr('world.island.offline'):tr('world.island.online')),
            field(tr('world.field.shareLevel'),meta.private?tr('world.island.private'):SHARE_LABEL.get(meta.share)||'—'),
            field(tr('world.field.sessions'),String(sc.raw.size))),
          meta.private?h('span',{style:{color:'var(--muted)'}},tr('world.island.privateNote')):
          h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
            h('span',{style:MUTED},tr('world.field.dept')),
            counts.size?[...counts].map(([dk,n],i)=>{const Dp=sc.depts.get(dk);return h('div',{key:i,style:{display:'flex',alignItems:'center',gap:8}},
              h('span',{style:{width:8,height:8,background:Dp?Dp.color:'#8b8fa3',display:'inline-block',flex:'none'}}),
              h('span',{style:{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},dk),h('strong',{style:{color:'#ffffff'}},n));})
            :h('span',{style:{color:'var(--muted)'}},tr('world.island.noSessions'))),
          canRemove&&h('button',{className:'btn',onClick:()=>{w.confirm={kind:'remove',id:meta.id};this.forceUpdate();},
            style:{...SMALL_BTN,alignSelf:'flex-start',borderColor:'#e5484d',color:'#ff9b9e'}},tr('world.island.remove.button'))]);
      }
      if(w.view!=='mine')return null;
      const fullLink=h('a',{href:'http://localhost:4317',target:'_blank',rel:'noopener noreferrer',style:LINK},tr('world.mine.link.full'));
      const meLink=h('a',{href:'/me',style:LINK},tr('world.mine.link.manage'));
      const leaveLink=h('a',{href:'/me/leave',style:LINK},tr('world.mine.link.leave'));
      const isl=w.mine?w.mine.island:null;
      if(w.mine?!isl:!w.me.islandId){const origin=location.origin;
        return this.worldSheet({icon:swatch(GOLD),title:tr('world.join.title'),sub:tr('world.sheet.pairHint')},[
          h('span',{style:{lineHeight:1.5}},tr('world.join.intro')),
          h('ol',{style:{margin:0,paddingLeft:18,display:'flex',flexDirection:'column',gap:6,lineHeight:1.5}},
            h('li',null,tr('world.join.step1'),h('code',{style:{display:'block',marginTop:4,background:'var(--bg)',padding:'6px 8px',color:'#ffd166',fontSize:11,wordBreak:'break-all',userSelect:'all'}},'node server.js join '+origin)),
            h('li',null,tr('world.join.step2')),
            h('li',null,tr('world.join.step3')),
            h('li',null,tr('world.join.step4'))),
          w.meErr&&h('span',{role:'alert',style:ERR},tr('world.mine.devicesError')),
          meLink,leaveLink]);
      }
      const devs=w.mine?w.mine.devices:[],colors=w.mine?w.mine.colors:[],d=w.draft,sending=mine&&mine.online!==false;
      const asking=(x,where)=>{const c=w.confirm;return c&&c.kind==='revoke'&&c.id===x.id&&c.where===where?c:null;};
      const phone=!!(this.phoneMq&&this.phoneMq.matches),fresh=devs.filter(x=>x.isNew&&x.send!=='revoked');
      // On a phone several "Máy mới" notices fold into one "N máy mới" line (open while one of them is being revoked).
      const fold=phone&&fresh.length>1&&!w.newOpen&&!fresh.some(x=>asking(x,'new'));
      const askRevoke=(x,where)=>h('button',{className:'btn',style:SMALL_BTN,onClick:()=>{w.confirm={kind:'revoke',id:x.id,where};this.forceUpdate();}},tr('world.mine.revoke.button'));
      const revokeAsk=(x,c)=>confirmRow(tr('world.mine.revoke.confirm',{name:clip(x.name,40)||tr('world.mine.revoke.thisDevice')}),tr('world.mine.revoke.button'),c,()=>this.revokeDevice(x.id),()=>{w.confirm=null;this.forceUpdate();});
      const edit=patch=>{const dr=w.draft;if(!dr)return;Object.assign(dr,patch,{dirty:true});w.saveMsg=null;this.forceUpdate();};
      const mt=mine&&tally(w.scenes.get(mine.id));
      return this.worldSheet({label:tr('world.view.mine'),icon:swatch(mine?mine.color:isl&&isl.color),title:(mine?mine.name:isl&&isl.name)||tr('world.mine.fallbackName'),
        sub:!mine?tr('world.sheet.noDevice'):(sending?tr('world.mine.sending'):tr('world.mine.disconnected'))+' · '+(mine.private?tr('world.label.private'):tr('world.label.busy',{n:mt.busy}))},[
        // A device paired in the last 7 days: say so, in case it was not this person.
        fold?h('div',{key:'new-fold',style:{display:'flex',alignItems:'center',gap:8,padding:8,background:'var(--bg)',borderLeft:'4px solid #ffd166'}},
          h('span',{style:{flex:1,minWidth:0,lineHeight:1.4}},tr('world.mine.newDevices',{n:fresh.length})),
          h('button',{className:'btn',style:SMALL_BTN,'aria-expanded':false,onClick:()=>{w.newOpen=true;this.forceUpdate();}},tr('world.mine.newDevices.show'))):
        fresh.map(x=>{const c=asking(x,'new');
          return h('div',{key:'new-'+x.id,style:{display:'flex',flexDirection:'column',gap:6,padding:8,background:'var(--bg)',borderLeft:'4px solid #ffd166'}},
            h('div',{style:{display:'flex',alignItems:'center',gap:8}},
              h('span',{style:{flex:1,minWidth:0,lineHeight:1.4,overflowWrap:'anywhere'}},tr('world.mine.newDevice',{name:clip(x.name,40)||'—',time:when(x.createdAt)})),
              !c&&askRevoke(x,'new')),
            c&&revokeAsk(x,c));}),
        phone&&fresh.length>1&&!fold&&h('button',{key:'new-less',className:'btn',style:{...SMALL_BTN,alignSelf:'flex-start'},'aria-expanded':true,
          onClick:()=>{w.newOpen=false;this.forceUpdate();}},tr('world.mine.newDevices.collapse')),
        d&&h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
          h('span',{style:MUTED},tr('world.mine.edit.heading')),
          h('div',{style:{display:'flex',gap:6}},
            h('input',{type:'text','aria-label':tr('world.mine.edit.nameAria'),maxLength:24,value:d.name,style:phone?{...INPUT,fontSize:16}:INPUT,
              onChange:e=>edit({name:e.target.value}),onKeyDown:e=>{if(e.key==='Enter')this.saveIsland();}}),
            h('button',{className:'btn',disabled:!!w.saving,style:SMALL_BTN,onClick:()=>this.saveIsland()},w.saving?tr('world.mine.edit.saving'):tr('world.mine.edit.save'))),
          colors.length>0&&h('div',{role:'group','aria-label':tr('world.mine.edit.colorsAria'),style:{display:'flex',flexWrap:'wrap',gap:6}},
            colors.map(c=>h('button',{key:c,type:'button',title:c,'aria-label':tr('world.mine.edit.colorAria',{color:c}),'aria-pressed':d.color===c,onClick:()=>edit({color:c}),
              style:{width:24,height:24,padding:0,cursor:'pointer',boxSizing:'border-box',background:c,border:d.color===c?'3px solid #ffffff':'2px solid var(--border)'}}))),
          w.saveMsg&&h('span',w.saveMsg.ok?{role:'status',style:{color:'#46a758'}}:{role:'alert',style:ERR},w.saveMsg.text)),
        h('div',{style:{display:'flex',flexDirection:'column',gap:8}},
          h('span',{style:MUTED},tr('world.mine.devices.heading')),
          !w.mine?(!w.meErr&&h('span',{style:{color:'var(--muted)'}},tr('world.mine.devices.loading'))):
          devs.length?devs.map(x=>{const[lab,col]=SEND_LABEL.get(x.send)||['—','#8b8fa3'],revoked=x.send==='revoked',c=asking(x,'list');
            return h('div',{key:x.id,style:{display:'flex',flexDirection:'column',gap:6}},
              h('div',{style:{display:'flex',alignItems:'center',gap:8,opacity:revoked?0.6:1}},
                h('span',{style:{width:8,height:8,borderRadius:'50%',background:col,flex:'none'}}),
                h('div',{style:{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:1}},
                  h('span',{style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#ffffff'}},clip(x.name,40)||'—'),
                  h('span',{style:MUTED},lab+(!revoked&&SHARE_LABEL.has(x.share)?tr('world.mine.devices.shareSuffix',{level:SHARE_LABEL.get(x.share)}):''))),
                !revoked&&!c&&askRevoke(x,'list')),
              c&&revokeAsk(x,c));})
          :h('span',{style:{color:'var(--muted)'}},tr('world.mine.devices.empty')),
          w.meErr&&h('span',{role:'alert',style:ERR},tr('world.mine.devicesError'))),
        !mine&&h('span',{style:{color:'var(--muted)',lineHeight:1.5}},tr('world.mine.notSending')),
        mine&&h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'10px 14px'}},
          field(tr('world.field.shareLevel'),SHARE_LABEL.get(mine.share)||'—'),
          field(tr('world.mine.field.private'),mine.private?tr('world.mine.yes'):tr('world.mine.no')),
          field(tr('world.mine.field.sendStatus'),sending?tr('world.mine.sending'):tr('world.mine.disconnected')),
          field(tr('world.field.sessions'),String((w.scenes.get(mine.id)||{raw:new Map()}).raw.size))),
        h('span',{style:{color:'var(--muted)',lineHeight:1.5}},tr('world.mine.filteredNote')),
        fullLink,meLink,leaveLink]);
    },
    // The island's panel (worldSheet): a title bar (icon, title, one line of status, a chevron, an optional close
    // button) and the body. On a wide stage it sits top right and the bar collapses it; on a phone it is a bottom sheet
    // that starts as the bar alone. Keyed by view, so it enters with the back control at each swap, not on every change.
    worldSheet(o,children){
      const w=this.world,phone=this.phoneStage(w.sw),open=this.sheetOpen(),id='sky-sheet-body';
      const chev=phone===open?'▾':'▴';
      return h('section',{key:'sheet:'+w.view+':'+(w.focus||''),className:'sky-sheet'+(phone?' is-phone':''),'aria-label':o.label||o.title},
        h('div',{className:'sky-sheet-head'},
          h('button',{type:'button',className:'sky-sheet-bar','aria-expanded':open,'aria-controls':id,title:open?tr('world.sheet.collapse'):tr('world.sheet.expand'),
            onClick:()=>{w.sheetOpen=!open;this.forceUpdate();}},
            o.icon,
            h('span',{className:'sky-sheet-name'},h('span',{style:TITLE},o.title),o.sub&&h('span',{style:{...MUTED,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},o.sub)),
            h('span',{className:'sky-sheet-chev','aria-hidden':true},chev)),
          o.extra||null),
        open&&h('div',{id,className:'sky-sheet-body'},...children));
    },
    worldSettings(){
      const st=this.state;
      return h('div',{className:'settings-panel',style:{top:12,bottom:'auto'}},
        h('div',{style:{fontFamily:"'Pixelify Sans',monospace",fontSize:14,fontWeight:600,color:'#ffffff',marginBottom:4}},tr('settings.title')),
        languagePicker(),
        h('label',null,tr('settings.speed',{speed:st.speed.toFixed(2)}),h('input',{type:'range',min:0.5,max:3,step:0.25,value:st.speed,onChange:e=>this.setState({speed:+e.target.value})})),
        h('div',{style:{borderTop:'1px solid var(--border)',margin:'2px 0'}}),
        h('label',null,tr('settings.weather'),
          h('select',{'aria-label':tr('settings.weather.modeAria'),value:st.weatherMode,onChange:e=>this.setWeather({weatherMode:e.target.value})},
            h('option',{value:'random'},tr('weather.mode.random')),h('option',{value:'real'},tr('weather.mode.real')),h('option',{value:'off'},tr('weather.mode.off')))),
        st.weatherMode==='real'&&h('div',{style:{display:'flex',gap:6}},
          h('input',{type:'text','aria-label':tr('settings.city.aria'),placeholder:tr('settings.city.placeholder'),value:st.cityDraft,style:{flex:1,maxWidth:'none'},
            onChange:e=>this.setState({cityDraft:e.target.value}),onKeyDown:e=>{if(e.key==='Enter')this.setWeather({city:st.cityDraft.trim()});}}),
          h('button',{className:'btn',style:{padding:'4px 8px',fontSize:11},onClick:()=>this.setWeather({city:st.cityDraft.trim()})},tr('settings.city.update'))),
        st.weatherMode==='real'&&st.realStatus.text&&h('span',{role:'status',style:{fontSize:11,lineHeight:1.4,color:st.realStatus.state==='error'?'#ff9b9e':'var(--muted)'}},st.realStatus.text),
        h('div',{style:{display:'flex',flexWrap:'wrap',gap:4}},
          WEATHER_PREVIEW.map(([type,label])=>h('button',{key:type,className:'btn',title:tr('settings.weather.previewTitle',{label:WEATHER_LABEL[type]}),style:{padding:'3px 7px',fontSize:11},onClick:()=>this.previewWeather(type)},label))));
    },
  });
})();

ReactDOM.createRoot(document.getElementById('root')).render(h(ClaudeOffice));
