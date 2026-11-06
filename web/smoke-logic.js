// The smoking corner down the east lawn: where things stand and the rhythm of a cigarette. No DOM, no canvas;
// tests/smoke-logic.test.mjs runs this block.
const k=(x,y)=>x+','+y;
// Laid out from the corner of the 4×4 outdoor spot (SkyLogic.outdoorSpots 'east-front'). The entrance is the first two
// tiles of the front row, beside the garden path that runs down from the east stairs; the planted trough takes the
// column facing the pantry. The bench seats sit along the back row and the two standing places flank the ash bin in the
// next row. The pad is only entered through the entrance: `shut` lists every other step across its edge ("a|b", both
// ways), so nobody climbs over the bench back from the stairs side or through the trough.
function layout(zone){
  const X=zone.x,Y=zone.y,seat=(dx,px)=>({act:'smoke',tile:[X+dx,Y],pt:[X+px,Y+0.45],stool:1,front:true});
  // The stone pad walks like the garden path (cheaper than grass), so smokers come in at the entrance and stay on it.
  const paved=[];for(let y=Y;y<Y+zone.h;y++)for(let x=X;x<X+zone.w;x++)paved.push(k(x,y));
  const entry=[[X,Y+zone.h-1],[X+1,Y+zone.h-1]],isEntry=(x,y)=>entry.some(e=>e[0]===x&&e[1]===y),inPad=(x,y)=>x>=X&&x<X+zone.w&&y>=Y&&y<Y+zone.h;
  const shut=[];
  for(let y=Y;y<Y+zone.h;y++)for(let x=X;x<X+zone.w;x++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,ny=y+dy;if(inPad(nx,ny)||isEntry(x,y))continue;shut.push(k(x,y)+'|'+k(nx,ny),k(nx,ny)+'|'+k(x,y));}
  return{x:X,y:Y,paved,entry,shut,
    blocked:[k(X,Y),k(X,Y+1),k(X,Y+2)],
    spots:[seat(1,1.8),seat(2,2.7),seat(3,3.6),
      {act:'smoke',tile:[X+1,Y+1],pt:[X+1.55,Y+1.95],front:true},{act:'smoke',tile:[X+2,Y+1],pt:[X+2.95,Y+1.95],front:true}]};
}
// Every PERIOD seconds a smoker takes a drag (hand at the mouth, ember bright) and then lets out a puff that fades;
// `exhale` runs 0..1 over that puff and is null the rest of the time.
const PERIOD=5,DRAG=0.22,PUFF_END=0.5;
function cycle(t){
  const c=((t/PERIOD)%1+1)%1;
  if(c<DRAG)return{drag:true,exhale:null};
  return{drag:false,exhale:c<PUFF_END?(c-DRAG)/(PUFF_END-DRAG):null};
}
export const SmokeLogic = {layout,cycle,PERIOD};

