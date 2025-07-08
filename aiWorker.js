const PROMOTE={P:"+P",L:"+L",N:"+N",S:"+S",B:"+B",R:"+R"};
const UNPROMOTE={"+P":"P","+L":"L","+N":"N","+S":"S","+B":"B","+R":"R"};
const PROMOTABLE={P:1,L:1,N:1,S:1,B:1,R:1};
let stop=false;
let bestMove=null;
let startTime=0;
let respectTime=true;
const TT=new Map();
// Tune search to respond quicker
const TIME_LIMIT=2000; // max thinking time in ms
const MAX_DEPTH=6; // maximum search depth
const MAX_QUIESCE=4; // capture search depth limit
const KILLER=Array.from({length:16},()=>[null,null]);
const HISTORY={};

function sameMove(a,b){
  if(!a||!b)return false;
  return a.from===b.from&&a.to===b.to&&a.drop===b.drop&&!!a.promote===!!b.promote;
}
function moveKey(m){
  if(m.from>=0)return m.from+"-"+m.to+(m.promote?"p":"");
  return "D"+m.drop+"-"+m.to;
}
function orderMoves(moves,depth){
  const killers=KILLER[depth]||[];
  return moves.sort((a,b)=>{
    const score=(m)=>{
      let s=0;
      if(sameMove(m,killers[0]))s+=1000;
      else if(sameMove(m,killers[1]))s+=990;
      if(m.capture)s+=50;
      if(m.promote)s+=20;
      s+=(HISTORY[moveKey(m)]||0);
      return s;
    };
    return score(b)-score(a);
  });
}
self.onmessage=e=>{
  const d=e.data;
  if(d.type==='start'){
    stop=false;
    bestMove=null;
    respectTime=true;
    const time=iterative(d.state);
    postMessage({move:bestMove,time});
  }else if(d.type==='stop'){
    stop=true;
    postMessage({move:bestMove,time:Date.now()-startTime});
  }
};
function iterative(state){
  startTime=Date.now();
  const legal=generateLegalMoves(state,state.turn);
  if(legal.length===0){bestMove=null;return Date.now()-startTime;}
  orderMoves(legal,0);
  for(let depth=1;depth<=MAX_DEPTH;depth++){
    const [v,m]=search(state,depth,-1e9,1e9,true);
    if(stop)break;
    if(m)bestMove=m;
    if(Date.now()-startTime>TIME_LIMIT && bestMove)break;
  }
  if(!bestMove){
    respectTime=false;
    const [v,m]=search(state,1,-1e9,1e9,true);
    bestMove=m;
    respectTime=true;
  }
  return Date.now()-startTime;
}
function search(s,depth,alpha,beta,root){
  if(stop||(respectTime && Date.now()-startTime>TIME_LIMIT))return[evalState(s),null];
  if(depth===0)return quiesce(s,alpha,beta,0);
  const key=hashState(s);
  const tt=TT.get(key);
  if(tt && tt.depth>=depth)return[tt.score,tt.move];
  const moves=orderMoves(generateLegalMoves(s,s.turn),depth);
  let best=null;
  let pv=false;
  for(const mv of moves){
    const ns=clone(s);
    applyMove(ns,mv);
    let score;
    if(pv){
      score=-search(ns,depth-1,-alpha-1,-alpha,false)[0];
      if(score>alpha && score<beta){
        score=-search(ns,depth-1,-beta,-alpha,false)[0];
      }
    }else{
      score=-search(ns,depth-1,-beta,-alpha,true)[0];
    }
    if(score>alpha){
      alpha=score;best=mv;pv=true;
      if(alpha>=beta){
        const killers=KILLER[depth];
        if(!sameMove(mv,killers[0])){killers[1]=killers[0];killers[0]=mv;}
        HISTORY[moveKey(mv)]=(HISTORY[moveKey(mv)]||0)+depth*depth;
        break;
      }
    }
    if(stop||(respectTime && Date.now()-startTime>TIME_LIMIT))break;
  }
  TT.set(key,{depth,score:alpha,move:best});
  if(TT.size>20000)TT.delete(TT.keys().next().value);
  return[alpha,best];
}
function quiesce(s,alpha,beta,depth=0){
  if(depth>=MAX_QUIESCE) return[evalState(s),null];
  let stand=evalState(s);
  if(stand>=beta)return[beta,null];
  if(alpha<stand)alpha=stand;
  const moves=orderMoves(generateMoves(s,s.turn).filter(m=>m.capture),depth);
  let best=null;
  for(const mv of moves){
    const ns=clone(s);
    applyMove(ns,mv);
    const [v]=quiesce(ns,-beta,-alpha,depth+1);
    const score=-v;
    if(score>alpha){
      alpha=score;best=mv;
      if(alpha>=beta)break;
    }
    if(stop||(respectTime && Date.now()-startTime>TIME_LIMIT))break;
  }
  return[alpha,best];
}
function evalState(s){
  const val={P:100,L:300,N:300,S:400,G:500,B:700,R:800,K:0,'+P':500,'+L':500,'+N':500,'+S':500,'+B':900,'+R':1000};
  let v=0;
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(p){
      v+=(p.c? -1:1)*val[p.t];
      const r=Math.floor(i/9);
      const prog=p.c? r:8-r;
      v+=(p.c? -1:1)*prog*10;
    }
  }
  for(let c=0;c<2;c++){
    const h=s.hand[c];
    for(let k in h)v+=(c? -1:1)*val[k]*(h[k]||0);
  }
  return v;
}
function hashState(s){
  let str=s.turn;
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(p)str+=p.t+p.c;else str+='.';
  }
  str+='|'+JSON.stringify(s.hand[0])+JSON.stringify(s.hand[1]);
  return str;
}
// helper functions compatible with main thread
function clone(s){
  return{board:s.board.map(p=>p?{t:p.t,c:p.c}:null),hand:s.hand.map(h=>({...h})),turn:s.turn};
}
function applyMove(s,m){
  if(m.from>=0){
    const p=s.board[m.from];
    s.board[m.from]=null;
    if(m.capture)s.hand[p.c][m.capture]=(s.hand[p.c][m.capture]||0)+1;
    if(m.promote)p.t=m.promoteTo;
    s.board[m.to]=p;
  }else{
    s.hand[s.turn][m.drop]--;
    s.board[m.to]={t:m.drop,c:s.turn};
  }
  s.turn^=1;
}
function generateLegalMoves(s,color){
  const moves=generateMoves(s,color);
  return moves.filter(m=>{const ns=clone(s);applyMove(ns,m);return !isCheck(ns,color);});
}
function generateMoves(s,color){
  const moves=[];
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(!p||p.c!==color)continue;
    genPieceMoves(i,p.t,color,s.board,moves);
  }
  const hand=s.hand[color];
  for(let k in hand){
    if(hand[k]>0){
      for(let i=0;i<81;i++)if(!s.board[i]){
        if(k==='P'&&invalidPawnDrop(i,color,s))continue;
        moves.push({from:-1,to:i,drop:k});
      }
    }
  }
  return moves;
}
function invalidPawnDrop(to,color,s){
  const file=to%9;
  for(let r=0;r<9;r++){const p=s.board[r*9+file];if(p&&p.c===color&&p.t==='P')return true;}
  const ns=clone(s);applyMove(ns,{from:-1,to,drop:'P'});return isMate(ns,color^1);
}
function genPieceMoves(idx,type,c,b,moves){
  const dirs={
    P:[[0,1]],
    L:[[0,1,true]],
    N:[[1,2],[-1,2]],
    S:[[0,1],[1,1],[-1,1],[1,-1],[-1,-1]],
    G:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1]],
    K:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1],[1,-1],[-1,-1]],
    B:[[1,1,true],[-1,1,true],[1,-1,true],[-1,-1,true]],
    R:[[0,1,true],[0,-1,true],[1,0,true],[-1,0,true]]
  };
  const add=(dx,dy,slide)=>{
    let x=idx%9,y=8-Math.floor(idx/9);if(c)dy=-dy;
    for(let n=1;;n++){
      const nx=x+dx*n,ny=y+dy*n;if(nx<0||nx>8||ny<0||ny>8)break;
      const ni=(8-ny)*9+nx;const t=b[ni];
      const promo=needPromote(type,c,idx,ni);
      const addMove=(pr)=>{
        const mv={from:idx,to:ni};
        if(pr){mv.promote=true;mv.promoteTo=PROMOTE[type];}
        if(t&&t.c!==c)mv.capture=UNPROMOTE[t.t]||t.t;
        moves.push(mv);
      };
      if(!t){
        addMove(false);
        if(promo)addMove(true);
      }else{
        if(t.c!==c){
          addMove(false);
          if(promo)addMove(true);
        }
        break;
      }
      if(!slide)break;
    }
  };
  let ps=dirs[type];
  if(!ps&&type[0]==='+')ps=dirs.G;
  if(type==='+B')ps=dirs.B.concat(dirs.R);
  if(type==='+R')ps=dirs.R.concat(dirs.B);
  if(!ps)return;
  for(const d of ps)add(d[0],d[1],d[2]);
}
function needPromote(type,c,from,to){
  if(!PROMOTABLE[type])return false;
  const fy=8-Math.floor(from/9),ty=8-Math.floor(to/9);
  const zone=y=>c?y<3:y>5;
  return zone(fy)||zone(ty);
}
function isCheck(s,color){
  const k=findKing(s,color);
  return attacksTo(s,k,color^1).length>0;
}
function findKing(s,color){
  for(let i=0;i<81;i++){const p=s.board[i];if(p&&p.c===color&&p.t==='K')return i;}
  return -1;
}
function attacksTo(s,idx,att){
  const moves=[];
  for(let i=0;i<81;i++){const p=s.board[i];if(p&&p.c===att)genPieceMoves(i,p.t,att,s.board,moves);}
  return moves.filter(m=>m.to===idx);
}
function isMate(s,color){
  if(!isCheck(s,color))return false;
  return generateLegalMoves(s,color).length===0;
}
