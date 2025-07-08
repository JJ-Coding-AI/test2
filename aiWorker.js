const TIME_LIMIT=10000;
let stop=false;
let bestMove=null;
let startTime=0;

onmessage=e=>{
  if(e.data.type==='stop'){
    stop=true;
    postMessage({bestMove});
    return;
  }
  if(e.data.type==='start'){
    stop=false;
    startTime=Date.now();
    const state=e.data.state;
    bestMove=null;
    let depth=1;
    let best=null;
    while(depth<=7 && !stop && Date.now()-startTime<TIME_LIMIT){
      best=searchRoot(state,depth,-Infinity,Infinity);
      if(!stop) bestMove=best.move;
      depth++;
    }
    postMessage({move:bestMove,bestMove,time:Date.now()-startTime});
  }
};

function searchRoot(s,depth,alpha,beta){
  let bestScore=-Infinity;let best=null;
  const moves=generateMoves(s);
  for(const m of moves){
    const ns=applyMove(s,m);
    const score=-search(ns,depth-1,-beta,-alpha);
    if(stop||Date.now()-startTime>TIME_LIMIT) break;
    if(score>bestScore){bestScore=score;best=m;}
    if(score>alpha) alpha=score;
  }
  return {score:bestScore,move:best};
}

function search(s,depth,alpha,beta){
  if(stop||Date.now()-startTime>TIME_LIMIT){stop=true;return 0;}
  if(depth===0) return evaluate(s);
  const moves=generateMoves(s);
  if(moves.length===0){
    return isCheck(s,s.turn)?-99999:0;
  }
  let val=-Infinity;
  for(const m of moves){
    const ns=applyMove(s,m);
    const score=-search(ns,depth-1,-beta,-alpha);
    if(stop) return 0;
    if(score>val) val=score;
    if(val>alpha) alpha=val;
    if(alpha>=beta) break;
  }
  return val;
}

// ----- game logic -----
const pieceValues={P:100,L:300,N:300,S:400,G:500,B:800,R:1000,K:10000,'+P':500,'+L':600,'+N':600,'+S':700,'+B':900,'+R':1100};
const promotable={P:1,L:1,N:1,S:1,B:1,R:1};
const goldLike={'+P':1,'+L':1,'+N':1,'+S':1};
const moveTable={
  P:[[0,-1]],L:[[0,-1,8]],N:[[-1,-2],[1,-2]],S:[[0,-1],[-1,-1],[1,-1],[-1,1],[1,1],[0,1]],
  G:[[0,-1],[-1,-1],[1,-1],[0,1],[-1,0],[1,0]],
  K:[[0,-1],[-1,-1],[1,-1],[0,1],[-1,1],[1,1],[-1,0],[1,0]],
  B:[[-1,-1,8],[1,-1,8],[-1,1,8],[1,1,8]],
  R:[[0,-1,8],[0,1,8],[-1,0,8],[1,0,8]],
};

function generateMovesForPiece(board,idx){
  const p=board[idx];
  if(!p) return [];
  const dirs=goldLike[p.type]?moveTable['G']:moveTable[p.type.replace('+','')]||[];
  const moves=[];const x=idx%9,y=Math.floor(idx/9);
  for(const d of dirs){
    let nx=x,ny=y;let step=0;while(true){
      nx+=d[0]*(p.c?-1:1);
      ny+=d[1]*(p.c?-1:1);
      if(nx<0||nx>=9||ny<0||ny>=9)break;
      const n=ny*9+nx;const q=board[n];
      if(q&&q.c===p.c)break;
      moves.push({from:idx,to:n,piece:p,promote:false});
      if(q||!d[2])break;
      if(step>=d[2])break;
    }
  }
  return moves;
}

function generateDrops(state){
  const moves=[];
  const pieces=state.hand[state.turn];
  for(const t in pieces){
    for(let i=0;i<81;i++) if(!state.board[i]){
      const y=Math.floor(i/9);
      if(t==='P'){
        if((state.turn===0&&y===0)||(state.turn===1&&y===8)) continue;
        const col=i%9;let hasPawn=false;
        for(let r=0;r<9;r++){const pp=state.board[r*9+col];if(pp&&pp.c===state.turn&&pp.type==='P'){hasPawn=true;break;}}
        if(hasPawn) continue;
      }
      if(t==='L'&&((state.turn===0&&y===0)||(state.turn===1&&y===8))) continue;
      if(t==='N'&&((state.turn===0&&y<=1)||(state.turn===1&&y>=7))) continue;
      moves.push({from:null,to:i,piece:{type:t,c:state.turn},promote:false});
    }
  }
  return moves;
}

function generateMoves(state){
  const moves=[];
  for(let i=0;i<81;i++){
    const p=state.board[i];
    if(p&&p.c===state.turn){
      moves.push(...generateMovesForPiece(state.board,i));
    }
  }
  moves.push(...generateDrops(state));
  return moves;
}

function applyMove(s,m){
  const ns={board:s.board.map(p=>p?{type:p.type,c:p.c}:null),hand:[{...s.hand[0]},{...s.hand[1]}],turn:1-s.turn};
  if(m.from!==null){
    const p=ns.board[m.from];
    ns.board[m.from]=null;
    if(ns.board[m.to]){
      const cap=ns.board[m.to];
      const t=cap.type.replace('+','');
      ns.hand[s.turn][t]=(ns.hand[s.turn][t]||0)+1;
    }
    ns.board[m.to]={type:m.promote?('+'+p.type):p.type,c:p.c};
  }else{
    ns.hand[s.turn][m.piece.type]--;if(ns.hand[s.turn][m.piece.type]===0) delete ns.hand[s.turn][m.piece.type];
    ns.board[m.to]={type:m.piece.type,c:s.turn};
  }
  return ns;
}

function findKing(board,color){
  for(let i=0;i<81;i++){const p=board[i];if(p&&p.c===color&&p.type==='K')return i;}
  return -1;
}

function isCheck(state,color){
  const king=findKing(state.board,color);
  const opp=1-color;
  for(let i=0;i<81;i++){
    const p=state.board[i];
    if(p&&p.c===opp){
      const ms=generateMovesForPiece(state.board,i);
      for(const mv of ms){ if(mv.to===king) return true; }
    }
  }
  return false;
}

function evaluate(s){
  let score=0;
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(p){
      const v=pieceValues[p.type];
      score+=(p.c===0?1:-1)*v;
      const y=Math.floor(i/9);
      score+=(p.c===0?(8-y):y)*10*(p.c===0?1:-1);
    }
  }
  const hand=s.hand;
  for(let c=0;c<2;c++){
    for(const t in hand[c]){
      score+=(c===0?1:-1)*pieceValues[t]*hand[c][t];
    }
  }
  if(isCheck(s,1)) score+=500;
  if(isCheck(s,0)) score-=500;
  return score*(s.turn===0?1:-1);
}
