// Simple AI engine with alpha-beta and transposition table
const PIECE_VALUES={P:100,L:300,N:300,S:400,G:500,B:850,R:900,K:10000};
const PROMO={'P':'+P','L':'+L','N':'+N','S':'+S','B':'+B','R':'+R'};
const UNPROMO={'+P':'P','+L':'L','+N':'N','+S':'S','+B':'B','+R':'R'};
const DIRS={
  P:[[1,0]],L:[[1,0,9]],N:[[2,-1],[2,1]],S:[[1,-1],[1,0],[1,1],[-1,-1],[-1,1]],
  G:[[1,0],[0,-1],[0,1],[-1,0],[1,-1],[1,1]],B:[[1,1,9],[1,-1,9],[-1,1,9],[-1,-1,9]],
  R:[[1,0,9],[-1,0,9],[0,1,9],[0,-1,9]],K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
};

function cloneBoard(b){return b.map(p=>p?{...p}:null);}

const Z=[];for(let i=0;i<81*14;i++)Z.push((Math.random()*2**32)|0);
let TT=new Map();
let stop=false;

function hash(state){let h=state.turn==='b'?1:0;state.board.forEach((p,i)=>{if(p)h^=Z[i*14+codeIndex(p.piece)];});return h>>>0;}
function codeIndex(pc){const arr=['P','L','N','S','G','B','R','K','+P','+L','+N','+S','+B','+R'];return arr.indexOf(pc);}

function parseSFEN(fen){
  const [pos,turn,hand]=fen.split(' ');
  const board=Array(81).fill(null);let r=0,c=0;let promo=false;
  for(let i=0;i<pos.length;i++){
    const ch=pos[i];
    if(ch=='/'){r++;c=0;continue;}
    if(ch>='1'&&ch<='9'){c+=parseInt(ch);continue;}
    if(ch=='+'){promo=true;continue;}
    const owner=ch===ch.toUpperCase()?'b':'w';
    const code=(promo?'+':'')+ch.toUpperCase();
    board[r*9+c]={owner,piece:code};
    c++;promo=false;
  }
  const handB={},handW={};
  if(hand && hand!=='-'){
    let num='';
    for(const ch of hand){
      if(ch>='0'&&ch<='9'){num+=ch;continue;}
      const cnt=num?parseInt(num):1;num='';
      const owner=ch===ch.toUpperCase()?'b':'w';
      const code=ch.toUpperCase();
      if(owner==='b')handB[code]=(handB[code]||0)+cnt;else handW[code]=(handW[code]||0)+cnt;
    }
  }
  return {board,handB,handW,turn};
}

function generateMoves(board,handB,handW,owner){
  const moves=[];const hands=owner==='b'?handB:handW;
  for(let i=0;i<81;i++){
    const p=board[i];
    if(!p||p.owner!==owner)continue;
    const r=Math.floor(i/9),c=i%9;const dir=owner==='b'?-1:1;
    const dlist=DIRS[UNPROMO[p.piece]||p.piece]||[];
    for(const d of dlist){
      const lim=d[2]||1;
      for(let k=1;k<=lim;k++){
        const nr=r+d[0]*dir*k,nc=c+d[1]*dir*k;const ni=nr*9+nc;
        if(nr<0||nr>=9||nc<0||nc>=9)break;
        const dst=board[ni];
        if(dst&&dst.owner===owner)break;
        let move={from:i,to:ni,promote:false};
        const fromZone=owner==='b'?r<=2:r>=6;
        const toZone=owner==='b'?nr<=2:nr>=6;
        if(PROMO[UNPROMO[p.piece]||p.piece] && (fromZone||toZone)) move.canPromote=true;
        moves.push(move);
        if(dst)break;
      }
    }
  }
  for(const [pc,cnt] of Object.entries(hands)){
    for(let i=0;i<81;i++) if(!board[i]){
      const r=Math.floor(i/9);if(pc==='P'&&((owner==='b'&&r===0)||(owner==='w'&&r===8))) continue;
      moves.push({drop:pc,to:i});
    }
  }
  return moves;
}

function applyMove(state,move){
  const b=cloneBoard(state.board);const hb={...state.handB};const hw={...state.handW};
  if(move.drop){
    const hand = state.turn==='b'?hb:hw;
    hand[move.drop] = (hand[move.drop]||0) - 1;
    if(hand[move.drop]===0) delete hand[move.drop];
    b[move.to]={owner:state.turn,piece:move.drop};
  }else{
    const p=b[move.from];b[move.from]=null;let target=b[move.to];
    if(target){
      const base=UNPROMO[target.piece]||target.piece;
      const hand=state.turn==='b'?hb:hw;
      hand[base]=(hand[base]||0)+1;
    }
    if(move.promote) p.piece=PROMO[UNPROMO[p.piece]||p.piece];
    b[move.to]=p;
  }
  return {board:b,handB:hb,handW:hw,turn:state.turn==='b'?'w':'b'};
}

function evaluate(board){
  let score=0;
  for(const p of board){
    if(!p)continue;let val=PIECE_VALUES[UNPROMO[p.piece]||p.piece];
    score+=p.owner==='b'?val:-val;
  }
  return score;
}

function negamax(state,depth,alpha,beta){
  const h=hash(state);const tt=TT.get(h);if(tt&&tt.depth>=depth)return tt.score;
  if(depth===0) return evaluate(state.board);
  let max=-Infinity;
  const moves=generateMoves(state.board,state.handB,state.handW,state.turn);
  for(const m of moves){
    const ns=applyMove(state,m);
    const score=-negamax(ns,depth-1,-beta,-alpha);
    if(score>max){max=score;}
    if(max>alpha){alpha=max;}
    if(alpha>=beta)break;
  }
  TT.set(h,{score:max,depth});
  if(TT.size>10000)TT.delete(TT.keys().next().value);
  return max;
}

function bestMove(fen,ms){
  const state=parseSFEN(fen);let best=null;let depth=1;const end=Date.now()+ms;
  stop=false;
  while(Date.now()<end && !stop){
    const moves=generateMoves(state.board,state.handB,state.handW,state.turn);
    let max=-Infinity;let bm=null;
    for(const m of moves){
      const ns=applyMove(state,m);
      const score=-negamax(ns,depth-1,-Infinity,Infinity);
      if(score>max){max=score;bm=m;}
    }
    if(Date.now()<end && !stop){best=bm;depth++;}else break;
  }
  return best;
}

onmessage=e=>{
  if(e.data.type==='go'){
    const m=bestMove(e.data.fen,e.data.ms);
    postMessage({type:'bestmove',move:m});
  }else if(e.data.type==='stop'){
    stop=true;
  }
};
