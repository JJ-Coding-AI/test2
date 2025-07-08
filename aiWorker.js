let stop=false;
let maxThink=1000;

const PIECE_VALUE={K:0,R:1000,B:800,G:700,S:600,N:400,L:300,P:100,'+R':1200,'+B':1000,'+S':700,'+N':600,'+L':500,'+P':300};
const DIRS={
 K:[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],
 R:[[1,0],[-1,0],[0,1],[0,-1]],
 B:[[1,1],[1,-1],[-1,1],[-1,-1]],
 G:[[1,0],[0,1],[-1,0],[0,-1],[1,-1],[-1,-1]],
 S:[[1,0],[1,1],[-1,1],[1,-1],[-1,-1]],
 N:[[2,1],[2,-1]],
 L:[[1,0]],
 P:[[1,0]]
};

const ZOBRIST=new Uint32Array(81*28*2+1);
for(let i=0;i<ZOBRIST.length;i++) ZOBRIST[i]=(Math.random()*2**32)|0;

function hash(board){
  let h=0;
  for(let i=0;i<81;i++){
    const p=board.squares[i];
    if(p){
      const idx=p.index*2+(p.color);
      h^=ZOBRIST[i*56+idx];
    }
  }
  for(let col=0;col<2;col++){
    const hand=board.hands[col];
    Object.entries(hand).forEach(([k,v])=>{
      const idx=PIECE_INDEX[k]+col;
      h^=ZOBRIST[81*56+idx]*v;
    });
  }
  if(board.turn) h^=ZOBRIST[ZOBRIST.length-1];
  return h>>>0;
}

const PIECE_INDEX={K:0,R:1,B:2,G:3,S:4,N:5,L:6,P:7,'+R':8,'+B':9,'+S':10,'+N':11,'+L':12,'+P':13};
const INDEX_PIECE=Object.fromEntries(Object.entries(PIECE_INDEX).map(([k,v])=>[v,k]));

function cloneBoard(b){
  return {squares:b.squares.slice(),hands:[{...b.hands[0]},{...b.hands[1]}],turn:b.turn};
}

function parseSFEN(sfen){
  const [piecePart,turn,hand]=sfen.split(' ');
  let squares=[];
  piecePart.split('/').forEach(r=>{
    for(const c of r){
      if(/[1-9]/.test(c)) for(let i=0;i<+c;i++) squares.push(null); else{
        const col=c===c.toUpperCase()?0:1;
        const name=c.toUpperCase();
        squares.push({color:col,index:PIECE_INDEX[name],prom:name.startsWith('+')});
      }
    }
  });
  const hands=[{},{}];
  if(hand!=='-'){
    let n='';
    for(const c of hand){
      if(/[1-9]/.test(c)) n+=c; else{const count=n?+n:1;n='';const col=c===c.toUpperCase()?0:1;hands[col][c.toUpperCase()]=count;}
    }
  }
  return {squares,hands,turn:turn==='b'?0:1};
}

function generate(b){
  const moves=[];
  for(let i=0;i<81;i++){
    const p=b.squares[i];
    if(!p||p.color!==b.turn) continue;
    const type=INDEX_PIECE[p.index];
    const dirs=DIRS[type==='K'?'K':type==='R'?'R':type==='B'?'B':type==='G'?'G':type==='S'?'S':type==='N'?'N':type==='L'?'L':'P'];
    const forward=p.color===0?1:-1;
    for(const [dr,dc] of dirs){
      let r=Math.floor(i/9)+dr*(p.color===0?1:-1);
      let c=i%9+dc*(p.color===0?1:-1);
      while(r>=0&&r<9&&c>=0&&c<9){
        const idx=r*9+c;
        const t=b.squares[idx];
        if(!t||t.color!==p.color){
          moves.push({from:i,to:idx});
        }
        if(t) break;
        if(['R','B','L'].includes(type)){
          r+=dr*(p.color===0?1:-1);c+=dc*(p.color===0?1:-1);
        }else break;
      }
    }
  }
  return moves;
}

function evaluate(b){
  let sum=0;
  for(let i=0;i<81;i++){
    const p=b.squares[i];
    if(p){
      const name=INDEX_PIECE[p.index];
      sum+=(p.color===0?1:-1)*PIECE_VALUE[name];
    }
  }
  Object.entries(b.hands[0]).forEach(([k,v])=>sum+=PIECE_VALUE[k]*v);
  Object.entries(b.hands[1]).forEach(([k,v])=>sum-=PIECE_VALUE[k]*v);
  return sum;
}

function make(b,m){
  const p=b.squares[m.from];
  const captured=b.squares[m.to];
  b.squares[m.to]=p;
  b.squares[m.from]=null;
  if(captured){
    const name=INDEX_PIECE[captured.index];
    b.hands[p.color][name.replace('+','')]=(b.hands[p.color][name.replace('+','')]||0)+1;
  }
  b.turn^=1;
  return captured;
}
function unmake(b,m,cap){
  b.turn^=1;
  const p=b.squares[m.to];
  b.squares[m.from]=p;
  b.squares[m.to]=cap;
  if(cap){
    const name=INDEX_PIECE[cap.index];
    b.hands[p.color][name.replace('+','')]--;
  }
}

const TT=new Map();
const TT_ORDER=[];
function store(hash,depth,val){
  if(TT.size>10000){const k=TT_ORDER.shift();TT.delete(k);}
  TT.set(hash,{depth,val});
  TT_ORDER.push(hash);
}

function alphabeta(b,depth,alpha,beta){
  if(stop) return 0;
  const h=hash(b);
  const tt=TT.get(h);
  if(tt&&tt.depth>=depth) return tt.val;
  if(depth===0) return evaluate(b);
  let best=-Infinity;
  for(const m of generate(b)){
    const cap=make(b,m);
    const score=-alphabeta(b,depth-1,-beta,-alpha);
    unmake(b,m,cap);
    if(score>best) best=score;
    if(score>alpha) alpha=score;
    if(alpha>=beta) break;
  }
  store(h,depth,best);
  return best;
}

function search(b,ms){
  const end=Date.now()+ms;
  let bestMove=null;
  for(let d=1;;d+=2){
    let best=-Infinity;
    for(const m of generate(b)){
      const cap=make(b,m);
      const val=-alphabeta(b,d-1,-Infinity,Infinity);
      unmake(b,m,cap);
      if(val>best){best=val;bestMove=m;}
      if(Date.now()>end){stop=true;break;}
    }
    if(stop||Date.now()>end) break;
  }
  return bestMove?bestMove.from+'-'+bestMove.to:null;
}

onmessage=e=>{
  if(e.data.type==='go'){
    stop=false;
    maxThink=e.data.ms;
    const b=parseSFEN(e.data.fen);
    const mv=search(b,maxThink);
    postMessage({type:'bestmove',move:mv});
  }else if(e.data.type==='stop'){
    stop=true;
  }
};
