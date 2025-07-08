let game;
self.onmessage=e=>{
  if(e.data.type==='start'){
    game=JSON.parse(e.data.state);
    const start=Date.now();
    const move=searchRoot(3); // depth 3 for speed
    postMessage({move,time:Date.now()-start});
  }else if(e.data.type==='stop'){
    // ignore for simplicity
  }
};

function searchRoot(depth){
  const moves=allMoves(game.turn);
  let best=null,bestScore=-1e9;
  for(const m of moves){
    make(m);
    const s=-search(depth-1,-1e9,1e9);
    undo();
    if(s>bestScore){bestScore=s;best=m;}
  }
  return best;
}

function search(depth,alpha,beta){
  if(depth===0)return evaluate();
  const moves=allMoves(game.turn);
  if(moves.length===0)return -1e5;
  for(const m of moves){
    make(m);
    const s=-search(depth-1,-beta,-alpha);
    undo();
    if(s>alpha){alpha=s; if(alpha>=beta)break;}
  }
  return alpha;
}

function evaluate(){
  const values={P:100,L:300,N:300,S:400,G:500,B:700,R:800,K:0};
  let score=0;
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
    const p=game.board[y][x];
    if(p){
      let v=values[p.p];
      if(p.pro) v+=50;
      score+=v*p.c;
    }
  }
  for(const c of [1,-1]){
    const h=game.hands[c];
    for(const k in h){
      let v=values[k.replace('+','')];
      score+=v*h[k]*c;
    }
  }
  return score*game.turn;
}

function allMoves(color){
  const moves=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
    const p=game.board[y][x];
    if(p&&p.c===color){
      generateMovesFor(x,y,p).forEach(m=>moves.push(m));
    }
  }
  return moves;
}

function generateMovesFor(x,y,piece){
  const moves=[];
  const dirs={
    P:[[0,-1]],L:[[0,-1,8]],N:[[1,-2,1],[-1,-2,1]],S:[[0,-1],[1,-1],[-1,-1],[1,1],[-1,1]],
    G:[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],K:[[0,-1],[1,-1],[-1,-1],[1,1],[-1,1],[0,1],[1,0],[-1,0]],
    B:[[1,1,8],[1,-1,8],[-1,1,8],[-1,-1,8]],R:[[0,1,8],[0,-1,8],[1,0,8],[-1,0,8]]
  };
  let d=dirs[piece.p];
  const forward=piece.c===1?-1:1;
  if(piece.pro){
    d=d.slice();
    if(piece.p==='B')d.push([0,1],[0,-1],[1,0],[-1,0]);
    if(piece.p==='R')d.push([1,1],[1,-1],[-1,1],[-1,-1]);
    if(['P','L','N','S'].includes(piece.p)){
      d=dirs['G'];
    }
  }
  d.forEach(v=>{
    const [dx,dy,range]=v;let nx=x,ny=y;let r=range||1;while(r--){nx+=dx;ny+=dy*forward; if(nx<0||nx>8||ny<0||ny>8)break;let t=game.board[ny][nx]; if(!t){moves.push({from:{x,y},to:{x:nx,y:ny},promote:false});}else{if(t.c!==piece.c)moves.push({from:{x,y},to:{x:nx,y:ny},promote:false});break;}}});
  const zone=piece.c===1? [0,1,2]:[6,7,8];
  if(['P','L','N','S','B','R'].includes(piece.p)){
    moves.forEach(m=>{if(zone.includes(m.from.y)||zone.includes(m.to.y))m.promote=true;});
  }
  return moves;
}

function make(m){
  if(m.drop){
    deleteFromHand(game.turn,m.piece);
    game.board[m.to.y][m.to.x]={p:m.piece,c:game.turn,pro:false};
  }else{
    const piece=game.board[m.from.y][m.from.x];
    const target=game.board[m.to.y][m.to.x];
    if(target) addToHand(game.turn,target);
    game.board[m.from.y][m.from.x]=null;
    piece.pro = piece.pro || m.promote;
    game.board[m.to.y][m.to.x]=piece;
  }
  game.turn*=-1;
}
function undo(){
  game.turn*=-1;
  // This worker uses structuredClone simplicity by ignoring history
}
function addToHand(c,p){
  const key=(p.pro?'+':'')+p.p; game.hands[c][key]=(game.hands[c][key]||0)+1;
}
function deleteFromHand(c,p){
  game.hands[c][p]--; if(game.hands[c][p]<=0)delete game.hands[c][p];
}
