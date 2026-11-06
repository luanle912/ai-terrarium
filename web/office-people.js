import { PeopleLogic } from './people-logic.js';
import { mix } from './office-scene.js';
import { shade } from './office-util.js';
// ---- People: the parts that differ from one look to the next (PeopleLogic.look) ----
// Every function takes the scene's 1px rect R and the agent's look L. Men and women are told apart by silhouette
// (hair past the shoulders, a bun or a ponytail, an A-line skirt; short hair, a beard, a collar and tie), not by
// single pixels, so they still read at the world view's level of detail.
export const LOOK_TIE='#e8d27a',LOOK_CLIP='#e93d82',LOOK_LIPS='#c0405a',LOOK_BLUSH='#e0707a',LOOK_GOLD='#ffd166';
export const LOOK=a=>a.look||(a.look=PeopleLogic.look(a.sid||a.id));
export const hairTones=L=>[L.hair,shade(L.hair,-26),shade(L.hair,28)];
export const capOf=sh=>shade(sh,-45);
export const PERSON={
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
