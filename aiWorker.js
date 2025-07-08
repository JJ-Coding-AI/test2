let stop = false;
let bestMove = null;
const TT = new Map();

onmessage = function(e) {
  if (e.data.type === 'go') {
    stop = false;
    const pos = parseSFEN(e.data.fen);
    const end = Date.now() + e.data.ms;
    let depth = 1;
    while(Date.now()<end && !stop) {
      const [score, move] = search(pos, depth, -99999, 99999, end);
      if(!stop) bestMove = move;
      depth += 2;
    }
    postMessage({type:'bestmove', move: moveToString(bestMove)});
  } else if (e.data.type === 'stop') {
    stop = true;
    if (bestMove) postMessage({type:'bestmove', move: moveToString(bestMove)});
  }
};

function search(pos, depth, alpha, beta, end) {
  if (stop || Date.now() > end) {stop=true; return [0,null];}
  if (depth===0) return [evaluate(pos), null];
  const key = toSFEN(pos);
  const hit = TT.get(key);
  if (hit && hit.depth >= depth) return [hit.value, hit.move];
  const moves = generateAllMoves(pos);
  if (moves.length===0) return [pos.turn==='b'? -10000:10000,null];
  let best=null;
  for(const m of moves) {
    makeMove(pos,m);
    const [score] = search(pos, depth-1, -beta, -alpha, end);
    const val = -score;
    undoMove(pos,m);
    if(val>alpha){
      alpha=val; best=m; if(alpha>=beta) break;
    }
    if(stop) break;
  }
  TT.set(key,{depth,value:alpha,move:best});
  if (TT.size>10000) TT.delete(TT.keys().next().value);
  return [alpha,best];
}

function evaluate(pos){
  const values={P:100,L:300,N:300,S:400,G:500,B:800,R:900,K:10000};
  let score=0;
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=pos.board[y][x]; if(!p) continue;
    const v=values[p.type];
    score += p.color==='b'?v:-v;
  }
  return score;
}

function generateAllMoves(pos){
  const moves=[];
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=pos.board[y][x]; if(!p||p.color!==pos.turn) continue;
    generateMoves(pos,x,y).forEach(m=>moves.push(m));
  }
  return moves;
}

function makeMove(pos,m){
  m.captured=pos.board[m.to.y][m.to.x];
  pos.board[m.to.y][m.to.x]=pos.board[m.from.y][m.from.x];
  pos.board[m.from.y][m.from.x]=null;
  pos.turn=pos.turn==='b'?'w':'b';
}
function undoMove(pos,m){
  pos.turn=pos.turn==='b'?'w':'b';
  pos.board[m.from.y][m.from.x]=pos.board[m.to.y][m.to.x];
  pos.board[m.to.y][m.to.x]=m.captured;
}

function moveToString(m){
  const fx=String.fromCharCode('1'.charCodeAt(0)+(8-m.from.x));
  const fy=String.fromCharCode('1'.charCodeAt(0)+m.from.y);
  const tx=String.fromCharCode('1'.charCodeAt(0)+(8-m.to.x));
  const ty=String.fromCharCode('1'.charCodeAt(0)+m.to.y);
  return fx+fy+tx+ty;
}

// use same helper from shogi.js
function parseSFEN(s){
  const [boardStr,turn]=s.split(' ');
  const rows=boardStr.split('/');
  const board=[];
  for(let y=0;y<9;y++){
    const row=[];
    for(let i=0,x=0;i<rows[y].length;i++){
      const ch=rows[y][i];
      if(ch>='1'&&ch<='9'){for(let k=0;k<+ch;k++){row.push(null);x++;}}
      else if(ch==='+'){const n=rows[y][++i];row.push({type:n.toUpperCase(),color:n===n.toUpperCase()?'b':'w',promoted:true});x++;}
      else{row.push({type:ch.toUpperCase(),color:ch===ch.toUpperCase()?'b':'w',promoted:false});x++;}
    }
    board.push(row);
  }
  return {board,turn};
}

function generateMoves(pos,x,y){
  const p=pos.board[y][x];
  if(!p)return[];
  const moves=[];
  const dir=p.color==='b'?-1:1;
  const add=(dx,dy,slide=false)=>{let nx=x+dx,ny=y+dy;while(nx>=0&&nx<9&&ny>=0&&ny<9){const t=pos.board[ny][nx];if(!t)moves.push({from:{x,y},to:{x:nx,y:ny}});else{if(t.color!==p.color)moves.push({from:{x,y},to:{x:nx,y:ny}});break;}if(!slide)break;nx+=dx;ny+=dy;}};
  switch(p.type+(p.promoted?'+':'')){
    case'P':add(0,dir);break;
    case'P+':case'L+':case'N+':case'S+':[[0,dir],[1,0],[-1,0],[0,-dir],[1,dir],[-1,dir]].forEach(d=>add(d[0],d[1]));break;
    case'L':add(0,dir,true);break;
    case'N':add(-1,2*dir);add(1,2*dir);break;
    case'S':[[0,dir],[1,dir],[-1,dir],[1,-dir],[-1,-dir]].forEach(d=>add(d[0],d[1]));break;
    case'G':[[0,dir],[1,0],[-1,0],[0,-dir],[1,dir],[-1,dir]].forEach(d=>add(d[0],d[1]));break;
    case'B':add(1,1,true);add(1,-1,true);add(-1,1,true);add(-1,-1,true);break;
    case'B+':add(1,1,true);add(1,-1,true);add(-1,1,true);add(-1,-1,true);[[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>add(d[0],d[1]));break;
    case'R':add(1,0,true);add(-1,0,true);add(0,1,true);add(0,-1,true);break;
    case'R+':add(1,0,true);add(-1,0,true);add(0,1,true);add(0,-1,true);[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(d=>add(d[0],d[1]));break;
    case'K':[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(d=>add(d[0],d[1]));break;
  }
  return moves;
}

function toSFEN(pos){
  let s='';
  for(let y=0;y<9;y++){
    let empty=0;
    for(let x=0;x<9;x++){
      const p=pos.board[y][x];
      if(p){
        if(empty){s+=empty;empty=0;}
        s+=(p.promoted?'+':'')+(p.color==='b'?p.type:p.type.toLowerCase());
      }else empty++;
    }
    if(empty)s+=empty;
    if(y!==8)s+='/';
  }
  return s+' '+pos.turn;
}
