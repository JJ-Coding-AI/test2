let stop=false;
let maxDepth=5;
let startTime=0;
let timeLimit=0;
const TT=new Map();
const Z=[];
for(let i=0;i<9*9*16;i++)Z[i]=Math.floor(Math.random()*2**32);
const pieceValue={P:100,L:300,N:300,S:400,G:500,B:850,R:900,K:10000};

onmessage=e=>{
  const d=e.data;
  if(d.type==='go'){
    stop=false;
    startTime=Date.now();
    timeLimit=d.ms;
    const state=parseFEN(d.fen);
    const best=iterative(state);
    postMessage({type:'bestmove',move:best});
  }else if(d.type==='stop'){
    stop=true;
  }
};

function iterative(state){
  let best=null;
  for(let depth=1;depth<=maxDepth;depth++){
    let [val,move]=search(state,depth,-1e9,1e9,true);
    if(stop||Date.now()-startTime>timeLimit)break;
    if(move)best=move;
  }
  return best;
}

function search(state,depth,alpha,beta){
  if(stop||Date.now()-startTime>timeLimit)return [evaluate(state),null];
  if(depth===0)return [quiescence(state,alpha,beta),null];
  const key=hash(state);
  if(TT.has(key)){
    const t=TT.get(key);
    if(t.depth>=depth)return [t.value,t.move];
  }
  let moves=generateMoves(state);
  orderMoves(moves);
  let bestMove=null;
  for(const m of moves){
    const s=apply(state,m);
    let [val]=search(s,depth-1,-beta,-alpha);
    val=-val;
    undo(state,m,s);
    if(val>alpha){
      alpha=val;bestMove=m;
      if(alpha>=beta)break;
    }
  }
  TT.set(key,{depth,value:alpha,move:bestMove});
  return [alpha,bestMove];
}

function quiescence(state,alpha,beta){
  const stand=evaluate(state);
  if(stand>=beta)return beta;
  if(alpha<stand)alpha=stand;
  const moves=generateMoves(state,true);
  orderMoves(moves);
  for(const m of moves){
    const s=apply(state,m);
    let val=-quiescence(s,-beta,-alpha);
    undo(state,m,s);
    if(val>alpha){
      alpha=val;
      if(alpha>=beta)break;
    }
  }
  return alpha;
}

function generateMoves(state,captureOnly=false){
  const moves=[];
  const dir=state.turn==='player'?-1:1;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=state.board[r][c];
    if(!p||p.owner!==state.turn)continue;
    const add=(dr,dc)=>{
      const nr=r+dr,nc=c+dc;
      if(nr<0||nr>8||nc<0||nc>8)return;
      const t=state.board[nr][nc];
      if(t&&t.owner===p.owner)return;
      if(captureOnly&&(!t))return;
      moves.push({from:[r,c],to:[nr,nc],piece:p.type,capture:!!t});
    };
    switch(p.type){
      case '歩':add(dir,0);break;
      case '香':for(let i=1;i<9;i++){add(dir*i,0);if(state.board[r+dir*i]&&state.board[r+dir*i][c])break;}break;
      case '桂':add(dir*2,-1);add(dir*2,1);break;
      case '銀':add(dir,-1);add(dir,0);add(dir,1);add(-dir,-1);add(-dir,1);break;
      case '金':case 'と':case '杏':case '圭':case '全':add(dir,-1);add(dir,0);add(dir,1);add(0,-1);add(0,1);add(-dir,0);break;
      case '角':for(let i=1;i<9;i++){add(i,i);if(state.board[r+i]&&state.board[r+i][c+i])break;}for(let i=1;i<9;i++){add(-i,-i);if(state.board[r-i]&&state.board[r-i][c-i])break;}for(let i=1;i<9;i++){add(i,-i);if(state.board[r+i]&&state.board[r+i][c-i])break;}for(let i=1;i<9;i++){add(-i,i);if(state.board[r-i]&&state.board[r-i][c+i])break;}break;
      case '飛':for(let i=1;i<9;i++){add(i,0);if(state.board[r+i]&&state.board[r+i][c])break;}for(let i=1;i<9;i++){add(-i,0);if(state.board[r-i]&&state.board[r-i][c])break;}for(let i=1;i<9;i++){add(0,i);if(state.board[r][c+i])break;}for(let i=1;i<9;i++){add(0,-i);if(state.board[r][c-i])break;}break;
      case '王':add(1,0);add(-1,0);add(0,1);add(0,-1);add(1,1);add(1,-1);add(-1,1);add(-1,-1);break;
    }
  }
  if(!captureOnly){
    const hand=state.hands[state.turn];
    hand.forEach((p,i)=>{
      for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!state.board[r][c])moves.push({drop:true,piece:p.type,to:[r,c]});
    });
  }
  return moves;
}

function orderMoves(moves){
  moves.sort((a,b)=>{
    if(a.capture&&!b.capture)return -1;
    if(!a.capture&&b.capture)return 1;
    if(a.drop&&!b.drop)return 1;
    if(!a.drop&&b.drop)return -1;
    return 0;
  });
}

function apply(state,move){
  const newState=JSON.parse(JSON.stringify(state));
  if(move.drop){
    const idx=newState.hands[newState.turn].findIndex(p=>p.type===move.piece);
    const p=newState.hands[newState.turn].splice(idx,1)[0];
    p.owner=newState.turn;
    newState.board[move.to[0]][move.to[1]]=p;
  }else{
    const p=newState.board[move.from[0]][move.from[1]];
    if(newState.board[move.to[0]][move.to[1]]){
      const cap=newState.board[move.to[0]][move.to[1]];
      cap.owner=newState.turn;
      cap.prom=false;
      newState.hands[newState.turn].push(cap);
    }
    newState.board[move.to[0]][move.to[1]]=p;
    newState.board[move.from[0]][move.from[1]]=null;
  }
  newState.turn=newState.turn==='player'?'ai':'player';
  return newState;
}
function undo(state,move,s){
  // nothing because we use newState copies
}

function evaluate(state){
  let v=0;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=state.board[r][c];
    if(!p)continue;
    const val=pieceValueChar(p.type);
    v+=(p.owner==='player'?val:-val);
  }
  state.hands.player.forEach(p=>v+=pieceValueChar(p.type));
  state.hands.ai.forEach(p=>v-=pieceValueChar(p.type));
  return v;
}
function pieceValueChar(ch){return pieceValue[{'歩':'P','香':'L','桂':'N','銀':'S','金':'G','角':'B','飛':'R','王':'K'}[ch]||'P']||100;}

function parseFEN(fen){
  const [boardStr,turn]=fen.split(' ');
  const rows=boardStr.split('/');
  const board=rows.map(row=>{let arr=[];let i=0;while(i<row.length){let c=row[i];if(/\d/.test(c)){for(let n=0;n<parseInt(c);n++)arr.push(null);i++;}else{let ch=c;arr.push(charToPiece(ch));i++;}}return arr;});
  return {board,hands:{player:[],ai:[]},turn:turn==='b'?'player':'ai'};
}
function charToPiece(ch){let owner=ch>='A'&&ch<='Z'?'player':'ai';ch=ch.toUpperCase();const map={P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛',K:'王'};return {type:map[ch]||'歩',owner};}

function hash(state){
  let h=0;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=state.board[r][c];
    if(p){
      let idx=(r*9+c)*16+pieceIndex(p);
      h^=Z[idx];
    }
  }
  return h;
}
function pieceIndex(p){const map={'歩':0,'香':1,'桂':2,'銀':3,'金':4,'角':5,'飛':6,'王':7};return map[p.type]||0;}
