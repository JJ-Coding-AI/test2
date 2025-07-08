const SIZE=9;
let board=[],turn='ai',hands={player:{},ai:{}};
const values={P:100,L:300,N:300,S:400,G:500,B:850,R:900,K:10000};
function parseSFEN(f){
  const [b,t,h]=f.split(' ');
  turn=t==='b'?'player':'ai';
  board=[];
  const rows=b.split('/');
  for(let y=0;y<SIZE;y++){
    const row=[];const r=rows[y];
    for(let i=0;i<r.length;i++){
      let c=r[i];
      if(!isNaN(c)){
        for(let n=0;n<parseInt(c);n++)row.push(null);
      }else{
        let promo=false;
        if(c==='+'){promo=true;c=r[++i];}
        const owner=c===c.toUpperCase()?'player':'ai';
        const type=(promo?'+':'')+c.toUpperCase();
        row.push({type,owner});
      }
    }
    board.push(row);
  }
  hands={player:{},ai:{}};
  if(h&&h!=='-'){
    let num='';let side='player';
    for(const ch of h){
      if(ch>='0'&&ch<='9'){num+=ch;continue;}
      side=ch===ch.toUpperCase()?'player':'ai';
      const count=num?parseInt(num):1;num='';
      const type=ch.toUpperCase();
      hands[side][type]=(hands[side][type]||0)+count;
    }
  }
}
function evaluate(){
  let s=0;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p=board[y][x];
    if(!p)continue;
    const v=values[p.type.replace('+','')];
    s+=p.owner==='player'?v:-v;
  }
  for(const side of ['player','ai']){
    for(const k in hands[side]){
      const v=values[k]*hands[side][k];
      s+=side==='player'?v:-v;
    }
  }
  return s;
}
function generateMoves(side){
  const moves=[];const d=side==='player'?-1:1;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p=board[y][x];
    if(p&&p.owner===side){
      if(p.type==='P'){
        const ny=y+d;
        if(ny>=0&&ny<SIZE&&!board[ny][x])moves.push({from:{x,y},to:{x,y:ny}});
      }
    }
  }
  return moves;
}
function makeMove(m){
  if(m.drop){
    board[m.to.y][m.to.x]={type:m.drop,owner:turn};
    hands[turn][m.drop]--;if(hands[turn][m.drop]<=0)delete hands[turn][m.drop];
  }else{
    const p=board[m.from.y][m.from.x];
    board[m.from.y][m.from.x]=null;
    const cap=board[m.to.y][m.to.x];
    if(cap){const t=cap.type.replace('+','');hands[turn][t]=(hands[turn][t]||0)+1;}
    board[m.to.y][m.to.x]=p; p.owner=turn;
  }
  turn=turn==='player'?'ai':'player';
}
function unmakeMove(m,prev,cap){
  turn=prev;
  if(m.drop){
    board[m.to.y][m.to.x]=cap;
    hands[turn][m.drop]=(hands[turn][m.drop]||0)+1;
  }else{
    const p=board[m.to.y][m.to.x];
    board[m.from.y][m.from.x]=p;
    board[m.to.y][m.to.x]=cap;
    if(cap){const t=cap.type.replace('+','');hands[prev==='player'?'ai':'player'][t]--;}
  }
}
let bestMove=null,startTime=0,maxDepth=3,limit=1000,stop=false;
function search(depth,alpha,beta){
  if(Date.now()-startTime>limit){stop=true;throw'X';}
  if(depth===0)return evaluate();
  const moves=generateMoves(turn);
  if(!moves.length)return evaluate();
  let val=-Infinity;
  for(const m of moves){
    const prev=turn;const cap=board[m.to.y][m.to.x];
    makeMove(m);
    const sc=-search(depth-1,-beta,-alpha);
    unmakeMove(m,prev,cap);
    if(sc>val){val=sc;if(depth===maxDepth)bestMove=m;}
    if(sc>alpha)alpha=sc;
    if(alpha>=beta)break;
  }
  return val;
}
function iterative(){
  bestMove=null;startTime=Date.now();
  for(let d=1;d<=5&&!stop;d++){
    maxDepth=d;
    try{search(d,-Infinity,Infinity);}catch(e){break;}
    if(Date.now()-startTime>limit)break;
  }
  if(bestMove){
    if(bestMove.drop){
      postMessage({bestmove:`${bestMove.drop}*${bestMove.to.x+1}${bestMove.to.y+1}`});
    }else{
      postMessage({bestmove:`${bestMove.from.x+1}${bestMove.from.y+1}${bestMove.to.x+1}${bestMove.to.y+1}`});
    }
  }else postMessage({bestmove:null});
}
self.onmessage=e=>{
  const d=e.data;
  if(d.type==='go'){parseSFEN(d.fen);limit=d.ms;stop=false;iterative();}
  else if(d.type==='stop'){stop=true;}
};
