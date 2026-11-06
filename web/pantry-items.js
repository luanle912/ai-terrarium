(function(){
const shade=(h,p)=>{const n=parseInt(h.slice(1),16),c=v=>Math.max(0,Math.min(255,v));return'#'+((1<<24)+(c((n>>16)+p)<<16)+(c(((n>>8)&255)+p)<<8)+c((n&255)+p)).toString(16).slice(1);};
const mix=(a,b,p)=>{const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16),f=s=>Math.round(((A>>s)&255)*(1-p)+((B>>s)&255)*p);return'#'+((1<<24)+(f(16)<<16)+(f(8)<<8)+f(0)).toString(16).slice(1);};
const FONT={A:'010101111101101',C:'011100100100011',E:'111100110100111',F:'111100110100100',N:'110101101101101',P:'110101110100100',R:'110101110101101',T:'111010010010010',Y:'101101010010010','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110',':':'000010000010000'};
function kit(ctx,ox,oy){
  const P=(x,y,z=0)=>[ox+(x-y)*16,oy+(x+y)*8-z];
  const rd=v=>Math.round(v*2)/2;
  const poly=(pts,f)=>{if(!f)return;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(rd(p[0]),rd(p[1])):ctx.moveTo(rd(p[0]),rd(p[1])));ctx.closePath();ctx.fillStyle=f;ctx.fill();};
  const top=(x,y,w,h,z,c)=>poly([P(x,y,z),P(x+w,y,z),P(x+w,y+h,z),P(x,y+h,z)],c);
  const fL=(x0,x1,y,z0,z1,c)=>poly([P(x0,y,z0),P(x1,y,z0),P(x1,y,z1),P(x0,y,z1)],c);
  const fR=(x,y0,y1,z0,z1,c)=>poly([P(x,y0,z0),P(x,y1,z0),P(x,y1,z1),P(x,y0,z1)],c);
  const box=(x,y,w,h,z0,z1,t,l,r)=>{fL(x,x+w,y+h,z0,z1,l||shade(t,-22));fR(x+w,y,y+h,z0,z1,r||shade(t,-38));top(x,y,w,h,z1,t);};
  const R=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(rd(x),rd(y),w,h);};
  const ell=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  const cyl=(x,y,z0,z1,r,t,s)=>{const [px,py]=P(x,y,z0),rx=r*22.6,ry=rx/2,h=z1-z0;s=s||shade(t,-25);ell(px,py,rx,ry,s);ctx.fillStyle=s;ctx.fillRect(px-rx,py-h,rx*2,h);ctx.fillStyle=shade(s,-14);ctx.fillRect(px+rx*0.35,py-h,rx*0.65,h);ctx.fillStyle=shade(s,14);ctx.fillRect(px-rx*0.7,py-h,rx*0.25,h);ell(px,py-h,rx,ry,t);};
  const al=(a,fn)=>{const o=ctx.globalAlpha;ctx.globalAlpha=o*a;fn();ctx.globalAlpha=o;};
  const line=(a,b,c,w=1)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();};
  const blob=(cx,cy,r,c)=>{for(let d=-r;d<=r;d++){const w=Math.round(Math.sqrt(r*r-d*d))*2;R(cx-w/2,cy+d,w,1,c);}};
  const glyphs=(s,sz)=>{[...s].forEach((ch,i)=>{const f=FONT[ch];if(f)for(let b=0;b<15;b++)if(f[b]==='1')ctx.fillRect(i*4*sz+(b%3)*sz,Math.floor(b/3)*sz,sz,sz);});};
  const wallText=(s,x,z,col,sz,y=0)=>{const [bx,by]=P(x,y,z);ctx.save();ctx.translate(bx,by);ctx.transform(1,0.5,0,1,0,0);ctx.fillStyle=col;glyphs(s,sz);ctx.restore();};
  const shadow=(x,y,w,h,a=0.28)=>al(a,()=>top(x-0.04,y-0.04,w+0.08,h+0.08,0.05,'#000000'));
  return {ctx,P,poly,top,fL,fR,box,R,ell,cyl,al,line,blob,wallText,shadow};
}
const I={};
I.fridge={name:'Tủ lạnh 2 cánh',group:'Bếp',size:[0.82,0.76],wall:true,note:'Inox 2 tông',draw(k,t){const {box,fL,fR,top,R,P,al}=k;
  box(0.04,0.04,0.74,0.68,0,1.6,'#22252f');for(let i=0;i<6;i++)fL(0.1+i*0.1,0.16+i*0.1,0.72,0.4,1.2,'#3a3f52');
  box(0,0,0.82,0.76,1.6,44,'#e9edf3','#d3d9e2','#b6bfcc');
  for(let z=4;z<44;z+=6)al(0.35,()=>fL(0,0.82,0.76,z,z+1,'#ffffff'));
  fL(0,0.82,0.76,28.4,29,'#8f9ab0');fR(0.82,0,0.76,28.4,29,'#7d889e');
  box(0.66,0.76,0.05,0.04,30.5,40,'#c9d3e3','#aab4c6','#8f9ab0');box(0.66,0.76,0.05,0.04,12,26,'#c9d3e3','#aab4c6','#8f9ab0');
  fL(0.12,0.36,0.76,32,39,'#3a3f52');fL(0.15,0.33,0.76,33,36,'#1f2230');fL(0.2,0.28,0.76,36.5,37.5,'#5ec8ff');
  fL(0.12,0.34,0.76,14,22,'#ffd166');[20.5,18.5,16.5].forEach(z=>fL(0.15,0.31,0.76,z,z+0.6,'#c9a227'));fL(0.21,0.25,0.76,21.2,22,'#e5484d');
  fL(0.38,0.58,0.76,15,21,'#ffffff');fL(0.4,0.56,0.76,16,20,'#5ec8ff');fL(0.4,0.56,0.76,16,17.4,'#46a758');
  [[0.42,24,'#e5484d'],[0.5,9,'#3e8ed0'],[0.2,10,'#8e4ec6'],[0.48,34,'#ffd166']].forEach(([x,z,c])=>fL(x,x+0.05,0.76,z,z+2,c));
  box(0.12,0.12,0.3,0.22,44,52,'#e5484d','#c0392b','#9e2a20');fL(0.14,0.4,0.34,46,50,'#ffd166');box(0.48,0.2,0.22,0.3,44,48,'#f6f4ee');}};
I.cabinet={name:'Tủ bếp dưới',group:'Bếp',size:[1.8,0.8],note:'Module 60cm',draw(k,t){const {box,fL,fR,top,R,P}=k,wd='#a8763e';
  box(0.04,0.06,1.72,0.7,0,2,'#2d1c10');box(0,0.02,1.8,0.74,2,12.5,wd,'#8a5f30','#74501f');
  for(let i=0;i<3;i++){const x=i*0.6;fL(x+0.04,x+0.56,0.76,3,11.6,shade(wd,10));fL(x+0.08,x+0.52,0.76,4,10.6,shade(wd,-10));fL(x+0.1,x+0.5,0.76,4.4,10.2,shade(wd,4));fL(x+0.43,x+0.47,0.76,8.6,9.6,'#e0b23a');fL(x+0.43,x+0.45,0.76,9.2,9.6,'#fff3b0');}
  box(-0.03,0,1.86,0.82,12.5,14,'#efe9dc','#d6cfbf','#bfb7a6');fL(-0.03,1.83,0.82,13.4,14,'#fbf8f1');
  [[0.3,0.3],[1.2,0.5]].forEach(([x,y])=>top(x,y,0.3,0.02,14.01,'#e2dbcb'));}};
I.espresso={name:'Máy espresso',group:'Bếp',size:[0.7,0.55],note:'Thân đen bo',draw(k,t){const {box,fL,fR,top,R,P,ell,cyl,al}=k;
  top(-0.1,-0.05,0.9,0.7,0.02,'#efe9dc');
  box(0.02,0.02,0.66,0.5,0,14,'#1f2230','#2a2e3d','#14161c');box(0.02,0.02,0.66,0.5,14,15,'#c9d3e3','#aab4c6','#8f9ab0');
  for(let i=0;i<5;i++)top(0.06+i*0.12,0.06,0.06,0.42,15.05,'#aab4c6');
  cyl(0.2,0.25,15,17.2,0.06,'#ffffff','#e6e9ef');cyl(0.45,0.28,15,17.2,0.06,'#e5484d','#c0392b');
  {const [gx,gy]=P(0.52,0.52,10.5);ell(gx,gy,3,3,'#e6e9ef');ell(gx,gy,2.2,2.2,'#ffffff');R(gx,gy-2,1,2,'#e5484d');}
  fL(0.06,0.64,0.52,11.5,12.2,'#3a3f52');{const [lx,ly]=P(0.12,0.52,12);R(lx,ly-1,1,1,'#46a758');const [mx,my]=P(0.2,0.52,12);R(mx,my-1,1,1,Math.floor(t*2)%2?'#ffd166':'#5a4a12');}
  box(0.22,0.52,0.2,0.08,7.5,9.5,'#8f9ab0','#aab4c6','#6b768c');box(0.2,0.58,0.24,0.06,6.6,7.5,'#3a3f52');box(0.28,0.64,0.06,0.18,6.8,7.6,'#14161c');
  box(0.14,0.52,0.48,0.14,0,1.6,'#3a3f52');for(let i=0;i<5;i++)top(0.17+i*0.09,0.55,0.04,0.08,1.62,'#14161c');
  cyl(0.32,0.6,1.6,4.2,0.06,'#ffffff','#e6e9ef');{const [cx,cy]=P(0.32,0.6,4.2);ell(cx,cy,1.2,0.6,'#6b3e24');}
  if(Math.floor(t)%5<3){const [sx,sy]=P(0.32,0.58,6.6);R(sx,sy,1,2.4,'#6b3e24');}
  box(0.6,0.4,0.04,0.04,4,11,'#c9d3e3');box(0.6,0.4,0.04,0.12,10,11,'#c9d3e3');
  for(let q=0;q<3;q++){const p=(t*0.6+q*0.33)%1,[sx,sy]=P(0.2,0.25,18+p*10);al(0.6*(1-p),()=>R(sx+(q%2),sy,1,2,'#e6e9ef'));}}};
I.grinder={name:'Máy xay & cốc',group:'Bếp',size:[0.9,0.45],note:'Máy xay đế nâu',draw(k,t){const {box,fL,top,R,P,cyl,al}=k;
  top(-0.05,-0.05,1.0,0.55,0.02,'#efe9dc');
  box(0.02,0.08,0.28,0.28,0,7,'#5c3a22','#4a2e1b','#3a2214');fL(0.06,0.26,0.36,2,4,'#2d1c10');{const [bx,by]=P(0.2,0.36,5);R(bx,by,1,1,'#e5484d');}
  box(0.07,0.12,0.18,0.18,7,8.5,'#c9d3e3');al(0.85,()=>box(0.05,0.1,0.22,0.22,8.5,15,'#cfe8ff','#a9d3f5','#8fbfe6'));box(0.06,0.11,0.2,0.2,8.5,12.5,'#6b3e24','#5c3420','#4a2a19');
  for(let i=0;i<9;i++){const [px,py]=P(0.08+(i%3)*0.06,0.14+Math.floor(i/3)*0.05,12.5);R(px,py,1,1,'#8a5a3a');}
  box(0.04,0.09,0.24,0.24,15,16.5,'#1f2230');
  [0,1,2,3].forEach(i=>cyl(0.5,0.25,i*1.7,1.5+i*1.7,0.075,'#ffffff','#e6e9ef'));
  cyl(0.75,0.22,0,6,0.09,'#e9f6ff','#cfe3f5');[[0.72,2],[0.78,3.5],[0.74,1]].forEach(([x,z])=>{const [px,py]=P(x,0.25,z);R(px,py,2,1,'#c98a4e');});cyl(0.75,0.22,6,7,0.095,'#a8763e','#8a5f30');}};
I.sink={name:'Bồn rửa & giá úp',group:'Bếp',size:[1.3,0.6],note:'Bồn inox lõm',draw(k,t){const {box,fL,fR,top,R,P,cyl,al,line}=k;
  top(-0.05,-0.05,1.4,0.7,0.02,'#efe9dc');
  top(0.05,0.08,0.8,0.46,0.03,'#aab4c6');top(0.1,0.13,0.7,0.36,0.04,'#6b768c');fL(0.1,0.8,0.13,-3,0.04,'#8f9ab0');fR(0.1,0.13,0.49,-3,0.04,'#7d889e');
  top(0.12,0.15,0.66,0.32,-2.5,'#5d6578');{const [dx,dy]=P(0.45,0.31,-2.5);R(dx-1,dy-1,2,2,'#2d3142');}
  box(0.42,0.0,0.07,0.07,0,6,'#c9d3e3');{const [a,b]=[P(0.455,0.035,6),P(0.455,0.3,9)];line(a,[a[0],a[1]-4],'#c9d3e3',2);line([a[0],a[1]-4],[b[0],b[1]],'#c9d3e3',2);}
  box(0.52,0.02,0.04,0.12,5,5.8,'#c9d3e3');
  if(Math.floor(t*1.6)%3===0){const p=(t*1.6)%1,[sx,sy]=P(0.455,0.3,8-p*8);R(sx,sy,1,1,'#9fd3ff');}
  cyl(0.2,0.08,0,4,0.05,'#46a758','#3f9a42');box(0.18,0.06,0.04,0.04,4,5.5,'#ffffff');
  box(0.92,0.1,0.34,0.42,0,1,'#c9d3e3');[0.16,0.28,0.4].forEach(y=>{fR(1.0,y,y+0.02,1,8,'#ffffff');fR(1.0,y-0.02,y,1,8,'#e6e9ef');});
  [0.95,1.22].forEach(x=>fR(x,0.1,0.52,1,3,'#aab4c6'));cyl(1.16,0.24,1,3.2,0.05,'#5b8def','#3e8ed0');cyl(1.16,0.4,1,3.2,0.05,'#ffffff','#e6e9ef');}};
I.microwave={name:'Lò vi sóng',group:'Bếp',size:[0.95,0.6],note:'Cửa kính tối',draw(k,t){const {box,fL,fR,top,R,P,al,ell}=k,on=Math.floor(t*0.4)%3!==2;
  top(-0.05,-0.05,1.05,0.7,0.02,'#efe9dc');
  box(0,0,0.95,0.6,0,8,'#1f2230','#2a2e3d','#14161c');box(0,0,0.95,0.6,8,8.6,'#3a3f52');
  fL(0.05,0.66,0.6,1,7.3,'#14161c');fL(0.08,0.63,0.6,1.6,6.8,on?'#5a4a20':'#1a2030');
  if(on){const a=t*1.5,[cx,cy]=P(0.35,0.6,3);al(0.9,()=>{ell(cx,cy,5,1.6,'#e6d7a8');R(cx-3+Math.round(Math.cos(a)*2),cy-3,6,2,'#ffffff');R(cx-2+Math.round(Math.cos(a)*2),cy-4,4,1,'#ffd166');});}
  al(0.25,()=>fL(0.1,0.2,0.6,2,6.6,'#ffffff'));
  fL(0.7,0.9,0.6,1,7.3,'#2a2e3d');fL(0.72,0.88,0.6,5.6,6.8,'#06120b');
  {const d=new Date(),s=String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');[...s].forEach((ch,i)=>{const [px,py]=P(0.735+i*0.035,0.6,6.6);R(px,py,1,1,'#50fa7b');});}
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)fL(0.73+c*0.05,0.76+c*0.05,0.6,4.4-r*1.1,4.9-r*1.1,'#8b93a7');fL(0.73,0.87,0.6,1.2,1.8,'#c9d3e3');}};
I.drinkfridge={name:'Tủ mát đồ uống',group:'Bếp',size:[1.0,0.8],note:'Tủ mát âm dưới mặt bếp',draw(k,t){const {box,fL,fR,top,R,P,al}=k;
  box(0,0.02,1.0,0.74,0,12.5,'#2a2e3d','#2a2e3d','#1f2230');fL(0.04,0.96,0.76,1.2,11.6,'#3a3f52');fL(0.08,0.92,0.76,1.8,11,'#0f1a2a');
  const cs=['#e5484d','#ffd166','#5ec8ff','#46a758','#ff8b3d','#ffffff','#8e4ec6','#e93d82'];
  [[2.2,0],[6.6,4]].forEach(([z,o])=>{fL(0.08,0.92,0.76,z-0.5,z,'#8b93a7');for(let i=0;i<7;i++){const x=0.12+i*0.115,c=cs[(i+o)%8],h=i%3===2?4.2:3.4;fL(x,x+0.085,0.76,z,z+h,c);fL(x,x+0.085,0.76,z+h-0.6,z+h,shade(c,40));fL(x+0.01,x+0.03,0.76,z+0.4,z+h-1,shade(c,30));}});
  al(0.3,()=>fL(0.08,0.92,0.76,10.4,11,'#9fe7ff'));al(0.12+0.04*Math.sin(t*2),()=>fL(0.08,0.92,0.76,1.8,11,'#9fe7ff'));
  al(0.18,()=>{for(let i=0;i<5;i++)fL(0.15+i*0.02,0.2+i*0.02,0.76,3+i*1.6,4+i*1.6,'#ffffff');});
  fL(0.86,0.9,0.76,4,9,'#c9d3e3');box(-0.03,0,1.06,0.82,12.5,14,'#efe9dc','#d6cfbf','#bfb7a6');}};
I.wallcab={name:'Tủ treo tường',group:'Bếp',size:[2.0,0.42],wall:true,wallZ:52,note:'Tủ gỗ treo cao',draw(k,t,o){const {box,fL,fR,top,R,P,al}=k,wd='#8a5a3a';
  if(o.night)al(0.35,()=>fL(0,2,0.01,22,37.5,'#ffd166'));
  box(0,0,2,0.42,38,50,wd,'#74501f','#5c3e1a');for(let i=0;i<4;i++){const x=i*0.5;fL(x+0.03,x+0.47,0.42,39,49,shade(wd,12));fL(x+0.07,x+0.43,0.42,40,48,shade(wd,-4));fL(i%2?x+0.08:x+0.38,i%2?x+0.12:x+0.42,0.42,40.5,44,'#e0b23a');}
  box(-0.03,0,2.06,0.45,50,51.5,shade(wd,22));fL(0,2,0.42,37.4,38,'#ffd166');}};
I.neon={name:'Biển neon CAFE',group:'Bếp',size:[2.9,0.3],wall:true,wallZ:58,note:'Tấm nền đen bắt vít',draw(k,t,o){const {box,fL,top,R,P,al,wallText}=k,neon='#ff5fa2',on=Math.floor(t*1.3)%11!==0;
  if(on&&o.night)al(0.2,()=>fL(-0.2,3.1,0.0,36,56,neon));
  box(0.05,0,2.8,0.05,40,52,'#1f2230','#171922','#14161c');[[0.1,51],[2.78,51],[0.1,41],[2.78,41]].forEach(([x,z])=>{const [px,py]=P(x,0.05,z);R(px,py,1,1,'#8b93a7');});
  wallText('CAFE',0.25,50,on?neon:'#5a2340',2,0.05);
  {const [cx,cy]=P(2.5,0.05,47);R(cx-2,cy-2,5,4,on?neon:'#5a2340');R(cx+3,cy-1,1,2,on?neon:'#5a2340');if(on){R(cx-1,cy-4,1,2,'#ffe0ee');R(cx+1,cy-5,1,2,'#ffe0ee');}}
  box(0.1,0,2.7,0.3,32.5,34,'#8a5a3a');[[0.25,'#f6f4ee',5.5],[0.75,'#e5484d',4],[1.25,'#f6f4ee',5.5],[1.75,'#ffd166',4],[2.25,'#46a758',5]].forEach(([x,c,h])=>box(x,0.07,0.15,0.15,34,34+h,c));}};
I.island={name:'Đảo quầy bar',group:'Quầy bar',size:[3.5,0.95],note:'Thân xanh xám',draw(k,t){const {box,fL,fR,top,R,P,ell,cyl,al,line}=k;
  box(0.08,0.08,3.34,0.8,0,1.5,'#2d3142');box(0.1,0.1,3.3,0.75,1.5,13,'#5a6f86','#4b5e74','#3e4f62');for(let x=0.3;x<3.3;x+=0.3)fL(x,x+0.03,0.85,2.2,12.4,'#41546a');
  box(0,0,3.5,0.95,13,15,'#f6f4ee','#dcd6c9','#c4bdae');fL(0,3.5,0.95,14.4,15,'#ffffff');
  [[0.4,0.2,1.2,0.6],[1.8,0.7,2.9,0.3],[2.2,0.15,3.2,0.5]].forEach(([a,b,c,d])=>line(P(a,b,15),P(c,d,15),'#d9d3c6'));
  {const [px,py]=P(0.55,0.45,15);ell(px,py,8,4,'#e6e9ef');ell(px,py-1,7,3.2,'#ffffff');[[-4,-3,'#e5484d'],[-1,-4,'#ffd166'],[2,-3,'#46a758'],[0,-1,'#ff8b3d'],[4,-2,'#8e4ec6'],[-3,-1,'#ffd166']].forEach(([dx,dy,c])=>{R(px+dx,py+dy-1,3,3,c);R(px+dx,py+dy-1,1,1,shade(c,50));});R(px+1,py-6,1,2,'#6b3e24');}
  cyl(1.45,0.45,15,16.5,0.03,'#c9d3e3');{const [px,py]=P(1.45,0.45,16.5);ell(px,py,7,3.5,'#ffffff');R(px-4,py-4,4,3,'#f2c9a0');R(px,py-3,4,2,'#a86b45');R(px-4,py-5,4,1,'#ffffff');R(px+1,py-4,2,1,'#e5484d');al(0.4,()=>{ell(px,py-4,8,6,'#cfe8ff');});R(px-1,py-11,2,1,'#c9d3e3');}
  box(2.3,0.35,0.22,0.16,15,17,'#f6f4ee');box(2.35,0.38,0.12,0.1,17,18.5,'#ffffff');
  cyl(2.9,0.5,15,18,0.05,'#ffffff','#e6e9ef');{const [cx,cy]=P(2.9,0.5,18);ell(cx,cy,1.2,0.6,'#6b3e24');}box(3.1,0.35,0.2,0.3,15,15.6,'#2d3142');top(3.12,0.37,0.16,0.26,15.62,'#5ec8ff');}};
I.stool={name:'Ghế bar',group:'Quầy bar',size:[0.4,0.4],note:'Đế tròn đen',draw(k,t){const {cyl,P,ctx,ell,R}=k;
  cyl(0.2,0.2,0,1,0.15,'#2d3142','#1f2230');cyl(0.2,0.2,1,10,0.035,'#e0b23a','#c9a227');
  {const [fx,fy]=P(0.2,0.2,4.5);ctx.strokeStyle='#c9a227';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(fx,fy,4,2,0,0,Math.PI*2);ctx.stroke();}
  cyl(0.2,0.2,10,12,0.18,'#2d3142','#20232d');{const [sx,sy]=P(0.2,0.2,12);ctx.strokeStyle='#4a5066';ctx.lineWidth=0.5;ctx.beginPath();ctx.ellipse(sx,sy,3.2,1.6,0,0,Math.PI*2);ctx.stroke();R(sx-3,sy-1,2,1,'#5d6578');}}};
I.pendant={name:'Đèn thả',group:'Quầy bar',size:[0.4,0.4],note:'Đế ốp trần',draw(k,t,o){const {P,R,ctx,al,ell}=k;const [cx,cy]=P(0.2,0.2,64),[lx,ly]=P(0.2,0.2,32);
  R(cx-3,cy-1,6,2,'#2d3142');ctx.strokeStyle='#14161c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx+0.25,cy);ctx.lineTo(lx+0.25,ly-3);ctx.stroke();
  if(o.night)al(0.22,()=>{ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(lx-5,ly+3);ctx.lineTo(lx+5,ly+3);ctx.lineTo(lx+16,ly+24);ctx.lineTo(lx-16,ly+24);ctx.closePath();ctx.fill();});
  R(lx-1,ly-4,2,2,'#c9a227');ell(lx,ly+1,6,4,'#c9a227');R(lx-6,ly+1,12,3,'#c9a227');R(lx-6,ly+3,12,1,'#e0b23a');R(lx-4,ly-2,3,2,'#fff3b0');ell(lx,ly+4,3,1.2,o.night?'#fffbe0':'#f2ead9');}};
I.sofa={name:'Sofa nhung 3 chỗ',group:'Phòng khách',size:[2.8,0.9],note:'Nhung xanh ngọc',draw(k,t){const {box,fL,fR,top,R,P}=k,f='#2f8f8a',fD='#24706c',fDD='#1c5956';
  [[0.1,0.1],[2.6,0.1],[0.1,0.75],[2.6,0.75]].forEach(([x,y])=>box(x,y,0.08,0.08,0,2,'#5c3a22'));
  box(0,0,2.8,0.9,2,7,f,fD,fDD);
  box(0.08,0,2.64,0.28,7,18,shade(f,6),fD,fDD);for(let i=0;i<3;i++){const x=0.22+i*0.8;box(x,0.04,0.76,0.22,8,17.5,shade(f,10),shade(f,-6),fD);fL(x+0.05,x+0.71,0.26,16.4,17.2,shade(f,24));}
  for(let i=0;i<3;i++){const x=0.22+i*0.8;box(x,0.28,0.77,0.58,7,9.5,shade(f,14),shade(f,-4),fD);fL(x+0.04,x+0.73,0.86,8.9,9.5,shade(f,28));}
  box(0,0,0.22,0.9,7,13,shade(f,4),fD,fDD);box(2.58,0,0.22,0.9,7,13,shade(f,4),fD,fDD);top(0,0,0.22,0.9,13.01,shade(f,16));top(2.58,0,0.22,0.9,13.01,shade(f,16));
  box(0.32,0.22,0.42,0.12,9.5,16,'#d9a441','#c08f33','#a67a2a');fL(0.36,0.7,0.34,12.4,13,'#f2c46a');
  box(2.06,0.22,0.42,0.12,9.5,15.5,'#d97757','#bb6345','#9e5238');
  box(1.4,0.3,0.6,0.56,9.5,10.4,'#e8d9bf','#d6c6a8','#c2b291');for(let i=0;i<4;i++)fL(1.42+i*0.14,1.48+i*0.14,0.86,4,10.4,'#e8d9bf');}};
I.coffeetable={name:'Bàn trà',group:'Phòng khách',size:[1.6,0.65],note:'Gỗ óc chó',draw(k,t){const {box,fL,fR,top,R,P,cyl,line}=k;
  [[0.04,0.04],[1.5,0.04],[0.04,0.55],[1.5,0.55]].forEach(([x,y])=>box(x,y,0.06,0.06,0,5,'#5c3a22'));
  box(0.1,0.1,1.4,0.45,1.5,2.2,'#7a5228');box(0.3,0.15,0.3,0.3,2.2,3.2,'#3e8ed0');box(0.32,0.16,0.28,0.28,3.2,3.8,'#e5484d');
  box(0,0,1.6,0.65,5,6.5,'#a86b45','#8a5a30','#74501f');top(0,0,1.6,0.65,6.5,'#b97a4a');for(let i=0;i<4;i++)line(P(0.05,0.12+i*0.14,6.5),P(1.55,0.12+i*0.14,6.5),'#a86b45');
  box(0.12,0.14,0.42,0.32,6.5,7,'#5b8def');box(0.16,0.17,0.36,0.26,7,7.3,'#ffffff');top(0.18,0.2,0.3,0.04,7.31,'#e5484d');
  box(0.66,0.2,0.4,0.28,6.5,7.3,'#c9d3e3','#aab4c6','#8f9ab0');{const [lx,ly]=P(0.86,0.34,7.3);R(lx-1,ly-1,2,1,'#ffffff');}
  cyl(1.18,0.24,6.5,8.6,0.05,'#ffffff','#e6e9ef');cyl(1.3,0.42,6.5,8.6,0.05,'#e5484d','#c0392b');
  cyl(1.45,0.18,6.5,8.6,0.06,'#c46a48','#a5573b');{const [px,py]=P(1.45,0.18,8.6);[[-2,-1],[1,-2],[0,0],[-1,-3]].forEach(([dx,dy],i)=>R(px+dx,py+dy,2,2,i%2?'#6fae5f':'#8fcf7a'));}}};
I.armchair={name:'Ghế bành',group:'Phòng khách',size:[0.85,0.9],note:'Vải cam đất',draw(k,t){const {box,fL,fR,top,R}=k,f='#d97757',fD='#b45f43',fDD='#94503a';
  [[0.06,0.06],[0.7,0.06],[0.06,0.76],[0.7,0.76]].forEach(([x,y])=>box(x,y,0.08,0.08,0,2,'#5c3a22'));
  box(0,0,0.85,0.9,2,7,f,fD,fDD);box(0.62,0.02,0.23,0.86,7,18,shade(f,6),fD,fDD);fR(0.62,0.08,0.82,10,17,shade(f,12));
  box(0.05,0.18,0.58,0.54,7,9.5,shade(f,14),shade(f,-4),fD);fL(0.08,0.6,0.72,8.9,9.5,shade(f,26));
  box(0,0,0.68,0.18,7,12.5,f,fD,fDD);box(0,0.72,0.68,0.18,7,12.5,f,fD,fDD);top(0,0,0.68,0.18,12.51,shade(f,16));top(0,0.72,0.68,0.18,12.51,shade(f,16));
  box(0.46,0.24,0.14,0.32,9.5,15,'#e8d9bf','#d6c6a8','#c2b291');}};
I.floorlamp={name:'Đèn cây',group:'Phòng khách',size:[0.4,0.4],note:'Đế tròn nặng',draw(k,t,o){const {P,R,ell,al,cyl}=k;const [bx,by]=P(0.2,0.2);
  if(o.night)al(0.2,()=>ell(bx+2,by+2,24,12,'#ffd166'));cyl(0.2,0.2,0,1.2,0.14,'#2d3142','#1f2230');
  const [tx,ty]=P(0.2,0.2,34);R(Math.round(tx)-1,ty,2,Math.round(by-ty)-1,'#2d3142');R(Math.round(tx)-1,ty,1,Math.round(by-ty)-1,'#4a5066');
  ell(tx,ty+1,7,2.5,'#c2b291');R(tx-7,ty-8,14,9,'#f2ead9');R(tx+2,ty-8,5,9,'#e2d6be');R(tx-7,ty-8,14,1,'#c2b291');ell(tx,ty-8,7,2.5,'#fbf6ea');if(o.night){al(0.7,()=>R(tx-6,ty+1,12,2,'#fff3b0'));}}};
I.rug={name:'Thảm phòng khách',group:'Phòng khách',size:[4.4,3.4],flat:true,note:'Viền đỏ rượu',draw(k,t){const {top,poly,P,R}=k;const x0=0,x1=4.4,y0=0,y1=3.4;
  top(x0,y0,x1,y1,0.15,'#7a3b4a');top(x0+0.15,y0+0.15,x1-0.3,y1-0.3,0.2,'#e8d9bf');top(x0+0.35,y0+0.35,x1-0.7,y1-0.7,0.25,'#2f5f73');
  for(let i=0;i<5;i++)for(let j=0;j<3;j++){const cx=x0+0.85+i*0.68,cy=y0+0.85+j*0.85;poly([P(cx,cy-0.24,0.3),P(cx+0.24,cy,0.3),P(cx,cy+0.24,0.3),P(cx-0.24,cy,0.3)],(i+j)%2?'#d9a441':'#e8d9bf');poly([P(cx,cy-0.1,0.31),P(cx+0.1,cy,0.31),P(cx,cy+0.1,0.31),P(cx-0.1,cy,0.31)],'#7a3b4a');}
  for(let q=0;q<15;q++){const [fx,fy]=P(x0+0.12+q*0.29,y1);R(fx,fy,1,2,'#e8d9bf');const [gx,gy]=P(x1,y0+0.12+q*0.22);if(q<15)R(gx,gy,1,2,'#e8d9bf');}}};
I.booth={name:'Băng ghế booth',group:'Góc booth',size:[0.6,3.7],note:'Khung gỗ óc chó',draw(k,t){const {box,fL,fR,top,R,P}=k;
  for(let y=0;y<3.69;y+=0.5){const h=Math.min(0.5,3.7-y);
    box(0,y,0.14,h,0,16,'#8a5a3a','#74501f','#5c3e1a');fR(0.14,y,y+h,10,10.6,'#a8763e');fR(0.14,y,y+h,14,14.6,'#a8763e');top(0,y,0.14,h,16.01,'#a8763e');
    box(0.14,y,0.44,h,0,5,'#8a5a3a','#74501f','#5c3e1a');box(0.16,y,0.4,h,5,6.8,'#c98a4e','#b07a44','#956535');box(0.14,y,0.05,h,6.8,13,'#c98a4e','#b07a44','#956535');}
  for(let i=0;i<6;i++){const [bx,by]=P(0.36,0.3+i*0.6,6.8);R(bx,by,1,1,'#7a5228');}
  [1.23,2.46].forEach(y=>fR(0.56,y-0.02,y+0.02,0.5,6.8,'#5c3e1a'));fL(0.14,0.58,3.7,0,5,'#74501f');}};
I.cafetable={name:'Bàn cafe & ghế',group:'Góc booth',size:[1.4,0.7],note:'Bàn vuông mặt trắng',draw(k,t,o){const {box,fL,fR,top,R,P,cyl,al}=k;
  cyl(0.35,0.35,0,1,0.15,'#2d3142');cyl(0.35,0.35,1,10,0.03,'#5d6578');box(0.05,0.05,0.6,0.6,10,11.5,'#f6f4ee','#dcd6c9','#c4bdae');fL(0.05,0.65,0.65,11,11.5,'#ffffff');
  {const [tx,ty]=P(0.3,0.3,11.5);R(tx-1,ty-3,3,3,'#ffffff');R(tx-1,ty-3,3,1,'#e5484d');}
  {const [lx,ly]=P(0.5,0.25,11.5);R(lx-1,ly-4,2,4,'#f2ead9');if(o.night){al(0.25,()=>k.ell(lx,ly-5,5,4,'#ffd166'));}R(lx-0.5,ly-6,1,2,Math.floor(t*6)%2?'#ffd166':'#ff8b3d');}
  [[0.9,0.13],[1.3,0.13],[0.9,0.53],[1.3,0.53]].forEach(([x,y])=>box(x,y,0.04,0.04,0,6,'#2d3142'));
  box(0.86,0.12,0.48,0.46,6,7.6,'#4a5a80','#3b4a6b','#2f3c58');box(1.25,0.1,0.1,0.5,7.6,16,'#3b4a6b','#2f3c58','#253048');top(1.25,0.1,0.1,0.5,16.01,'#5b6b94');fR(1.25,0.15,0.55,9,15,'#4a5a80');}};
I.arcade={name:'Máy arcade',group:'Góc game',size:[0.7,0.8],note:'Thân tím',draw(k,t,o){const {box,fL,fR,top,R,P,al}=k,body='#5b2a8c',neon='#ff5fa2',w=0.7,d=0.6,ph=Math.floor(t*6);
  box(0,0,w,d,0,1.5,'#14161c');box(0,0,w,d,1.5,32,body,shade(body,-12),shade(body,-32));
  for(let q=0;q<3;q++)fR(w,0.08+q*0.15,0.14+q*0.15,4,30,[neon,'#ffd166','#5ef2ff'][q]);fR(w,0.1,0.5,24,28,shade(body,-10));
  fL(0.04,w-0.04,d,27.5,31.5,neon);if(o.night)al(0.28,()=>fL(-0.12,w+0.12,d,25,34,neon));fL(0.1,w-0.1,d,28.5,30.5,'#ffe0ee');
  fL(0.05,w-0.05,d,14,26.8,'#2a1440');fL(0.09,w-0.09,d,15,25.8,'#07080c');
  for(let q=0;q<7;q++){const px=0.13+((ph*3+q*7)%9)*0.05,z=16+((ph+q*5)%9);fL(px,px+0.045,d,z,z+1,['#50fa7b','#ff5fa2','#ffd166','#5ef2ff','#ffffff','#e5484d','#8e4ec6'][q]);}
  fL(0.09,w-0.09,d,15,15.8,'#3a4462');{const bx=0.15+((ph*2)%8)*0.05;fL(bx,bx+0.08,d,16.4,17.4,'#ffd166');}
  al(0.15,()=>fL(0.1,0.22,d,17,25.5,'#ffffff'));
  box(0.02,d,w-0.04,0.2,11.5,14,shade(body,10),shade(body,-8),shade(body,-28));top(0.04,d+0.02,w-0.08,0.16,14.01,'#1f2230');
  {const [jx,jy]=P(0.2,d+0.1,14);R(jx,jy-3,1,3,'#2d3142');R(jx-1,jy-5,3,2,'#e5484d');R(jx-1,jy-5,1,1,'#ff9a9a');[[0.4,'#ffd166'],[0.48,'#5ef2ff'],[0.56,'#50fa7b']].forEach(([x,c])=>{const [bx2,by2]=P(x,d+0.1,14);R(bx2,by2-1,2,1,c);});}
  fL(0.12,w-0.12,d,3,9.5,shade(body,-22));fL(0.24,0.32,d,6,7.5,'#ffd166');fL(0.38,0.46,d,6,7.5,'#ffd166');if(Math.floor(t*2)%2)al(0.6,()=>fL(0.24,0.46,d,5.4,8,'#ffd166'));}};
I.foosball={name:'Bàn bi lắc',group:'Góc game',size:[1.6,0.6],note:'Khung gỗ',draw(k,t){const {box,fL,fR,top,R,P,line}=k,x1=1.6,y1=0.6;
  [[0.05,0.05],[1.5,0.05],[0.05,0.5],[1.5,0.5]].forEach(([dx,dy])=>box(dx,dy,0.06,0.06,0,9,'#2d3142'));box(0.1,0.1,1.4,0.4,2,2.6,'#2d3142');
  box(0,0,x1,y1,9,13,'#a86b45','#8a5a30','#74501f');top(0.06,0.06,x1-0.12,y1-0.12,12.5,'#2f8f4e');
  for(let i=0;i<7;i++)top(0.06+i*0.21,0.06,0.1,y1-0.12,12.52,'#2a8045');top(0.79,0.06,0.02,y1-0.12,12.6,'#ffffff');
  [0.06,x1-0.1].forEach(x=>top(x,0.22,0.04,0.16,12.6,'#ffffff'));
  {const p=(Math.sin(t*1.5)+1)/2,[bx,by]=P(0.25+p*1.1,0.3,12.6);R(bx,by-1,2,2,'#ffffff');}
  for(let i=0;i<6;i++){const x=0.18+i*0.25,col=i%2?'#3e8ed0':'#e5484d',sl=Math.sin(t*2+i)*0.04;const a=P(x,-0.18,15),b=P(x,y1+0.18,15);line(a,b,'#c9d3e3');
    for(let q=0;q<2;q++){const [px,py]=P(x,0.18+q*0.25+sl,13);R(px-1,py-3,2,3,col);R(px-1,py-4,2,1,'#f2c9a0');}R(b[0]-1,b[1]-1,3,3,'#14161c');}
  box(0.7,-0.06,0.2,0.06,13,15,'#2d3142');}};
I.planter={name:'Bồn cây vách ngăn',group:'Cây xanh',size:[0.55,2.5],note:'Bồn bê tông xám',draw(k,t,o){const {box,top,R,P}=k,pl=o.night?'#3b4052':'#8b93a7';
  for(let y=0;y<2.49;y+=0.5){box(0.02,y,0.52,0.5,0,10,pl,shade(pl,-18),shade(pl,-32));top(0.08,y+0.03,0.4,0.44,10,o.night?'#3a2a20':'#6b4e36');}
  [0.35,1.1,1.85].forEach((y,i)=>PLANT(k,0.28,y,t,i%3===1?1:0));}};
I.potplant={name:'Chậu cây góc',group:'Cây xanh',size:[0.5,0.5],note:'Chậu sứ trắng trụ tròn',draw(k,t){const {cyl,P}=k;cyl(0.25,0.25,0,9,0.2,'#f6f4ee','#e3ddd0');cyl(0.25,0.25,8.2,9,0.21,'#ffffff','#ece6da');PLANT(k,0.25,0.25,t,0,9);}};
function PLANT(k,x,y,t,kind,z=10){const {R,P,blob}=k;const [bx,by]=P(x,y,z),sw=Math.round(Math.sin(t*1.1+y*2)*0.6);
  if(kind===0){[[-6,-6,5],[5,-8,5],[0,-14,5],[7,-2,4],[-7,-1,4],[-2,-9,4],[2,-4,4]].forEach(([dx,dy,r],i)=>{const cx=bx+dx+sw,cy=by+dy;blob(cx,cy,r,i%2?'#2e8556':'#3fa36b');R(cx-0.5,cy-r+2,1,r*2-3,'#25704a');R(cx+1,cy-1,2,1,'#25704a');R(cx-3,cy+1,2,1,'#25704a');R(cx-r+2,cy-2,2,1,'#5cc187');if(i%3===0)R(cx+r-2,cy,1,1,'#0f2a1a');});}
  else{[[-4,20],[-2,26],[0,23],[2,28],[4,19],[-1,15],[3,14],[-5,13],[5,12]].forEach(([dx,h],i)=>{const s2=Math.round(Math.sin(t*1.4+i+y)*0.5);for(let q=0;q<h;q++){const w=q>h-3?1:2,xo=Math.round(s2*(q/h));R(bx+dx+xo,by-q,w,1,(q%4===0)?'#6fae5f':'#3f7d4a');}R(bx+dx-1,by-Math.round(h*0.7),1,Math.round(h*0.5),'#c9c25a');});}}
const ORDER=['fridge','cabinet','espresso','grinder','sink','microwave','drinkfridge','wallcab','neon','island','stool','pendant','sofa','coffeetable','armchair','floorlamp','rug','booth','cafetable','arcade','foosball','planter','potplant'];
const LAYOUT=[
  ['rug',2.3,5.35,0],
  ['planter',0,1.1,0],['planter',0,3.4,0],
  ['wallcab',1.45,0,0],['neon',3.6,0,0],
  ['fridge',0.45,0.05,0],['cabinet',1.35,0.05,0],['cabinet',3.15,0.05,0],['drinkfridge',4.95,0.05,0],
  ['espresso',1.5,0.12,14],['grinder',2.25,0.18,14],['sink',3.2,0.12,14],['microwave',4.65,0.12,14],
  ['island',1.55,2.4,0],['pendant',2.1,2.65,0],['pendant',3.9,2.65,0],
  ['stool',1.9,3.75,0],['stool',2.7,3.75,0],['stool',3.5,3.75,0],['stool',4.3,3.75,0],
  ['floorlamp',2.0,5.55,0],['sofa',2.6,5.55,0],['planter',0,8.1,0],['coffeetable',3.2,7.0,0],['armchair',5.8,6.8,0],
  ['planter',0,10.6,0],['booth',0.56,9.5,0],
  ['cafetable',1.25,9.85,0],['cafetable',1.25,11.05,0],['cafetable',1.25,12.25,0],['potplant',0.03,13.3,0],
  ['arcade',4.8,9.6,0],['arcade',5.7,9.6,0],['foosball',4.4,11.75,0],['potplant',3.75,13.3,0]
];
// Depth keys (island tiles; the pantry starts at x=20) for each LAYOUT entry, sorted with the rest of the scene.
// Flat rugs go first, then the wall band (19.5..19.6) ordered along the wall: a piece further along x is nearer the
// viewer, so the wall cabinet covers the edge of the fridge to its left instead of tying with it. Floor pieces sort
// by their near corner; a counter-top piece (rz>0) also sorts just after every base unit under it, so the microwave
// straddling the cabinet and the drinks cooler sits on the cooler's top instead of under it.
function depths(layout){
  const base=layout.map(([n,rx,ry])=>{const it=I[n];if(!it)return 0;
    if(it.flat)return 19;if(it.wall)return 19.5+rx*0.01;if(n==='planter')return 20+ry*0.01;return 20+rx+ry;});
  return layout.map(([n,rx,ry,rz],i)=>{const it=I[n];if(!it||!(rz>0))return base[i];const[w,h]=it.size;let z=base[i];
    layout.forEach(([m,bx,by,bz],j)=>{const b=I[m];if(!b||bz||b.flat||b.wall||m==='planter')return;const[bw,bh]=b.size;
      if(rx<bx+bw&&bx<rx+w&&ry<by+bh&&by<ry+h)z=Math.max(z,base[j]+0.01);});
    return z;});
}
window.PantryItems={I,kit,PLANT,LAYOUT,ORDER,depths};
})();
