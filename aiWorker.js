let stop=false;
let bestMove=null;
self.onmessage=e=>{
  if(e.data.type==='move'){
    stop=false;
    const start=Date.now();
    bestMove=null;
    let depth=1;
    while(Date.now()-start<900 && depth<=5 && !stop){
      let [score,move]=alphabeta(e.data,depth,-1e9,1e9);
      if(!stop && move) bestMove=move;
      depth++;
    }
    postMessage(bestMove);
  }else if(e.data.type==='stop'){
    stop=true;
    postMessage(bestMove);
  }
};

function clone(state){
  return {board:JSON.parse(JSON.stringify(state.board)),hands:JSON.parse(JSON.stringify(state.hands)),turn:state.turn};
}

const PIECE_VALUES={P:100,L:300,N:300,S:400,G:500,B:800,R:1000,K:10000};

function evalBoard(s){
  let val=0;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=s.board[r][c];
    if(!p) continue;
    let v=PIECE_VALUES[p.type];
    if(p.pr) v+=50;
    val += p.color? -v: v;
  }
  for(let i=0;i<2;i++) for(const t of s.hands[i]){
    let v=PIECE_VALUES[t];
    val += i? -v: v;
  }
  return val;
}

function inCheck(board,color){
  const king=findKing(board,color);
  const moves=generateMoves({board,hands:[[],[]],turn:color^1},color^1,false);
  return moves.some(m=>m.to[0]===king[0]&&m.to[1]===king[1]);
}
function findKing(board,color){
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=board[r][c];if(p&&p.type==='K'&&p.color===color) return [r,c];}
  return null;
}

function alphabeta(state,depth,alpha,beta){
  if(stop) return [0,null];
  if(depth===0) return [evalBoard(state),null];
  let moves=generateMoves(state,state.turn,true);
  if(moves.length===0) return [state.turn===0?-1e9:1e9,null];
  let best=null;
  for(const m of moves){
    const st=applyMove(state,m);
    st.turn^=1;
    const [score]=alphabeta(st,depth-1,-beta,-alpha);
    const val=-score;
    if(val>alpha){alpha=val;best=m;}
    if(alpha>=beta) break;
  }
  return [alpha,best];
}

function applyMove(s,m){
  s=clone(s);
  if(m.drop){
    const idx=s.hands[s.turn].indexOf(m.drop);
    if(idx>=0) s.hands[s.turn].splice(idx,1);
    s.board[m.to[0]][m.to[1]]={type:m.drop,color:s.turn,pr:false};
  }else{
    const p=s.board[m.from[0]][m.from[1]];
    s.board[m.from[0]][m.from[1]]=null;
    if(s.board[m.to[0]][m.to[1]]) s.hands[s.turn].push(s.board[m.to[0]][m.to[1]].type);
    if(m.promote) p.pr=true;
    s.board[m.to[0]][m.to[1]]=p;
  }
  return s;
}

function generateMoves(state,color,filterCheck){
  let moves=[];
  const board=state.board, hands=state.hands;
  for(const t of hands[color]){
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(board[r][c])continue;
      if(t==='P' && board.some(row=>row[c]&&row[c].color===color&&row[c].type==='P'&&!row[c].pr))continue;
      let m={drop:t,to:[r,c]};
      if(!filterCheck || !wouldBeSelfCheck(board,hands,color,m)) moves.push(m);
    }
  }
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=board[r][c];
    if(!p||p.color!==color) continue;
    for(const [dr,dc,slide] of getPieceMoves(p)){
      let rr=r+dr,cc=c+dc;
      while(rr>=0&&rr<9&&cc>=0&&cc<9){
        const target=board[rr][cc];
        if(target && target.color===color) break;
        let m={from:[r,c],to:[rr,cc],promote:false};
        const zone=color===0?rr<=2||r<=2:rr>=6||r>=6;
        if(p.type!=='G'&&p.type!=='K'&&!p.pr&&zone){
          moves.push({...m,promote:true});
        }
        moves.push(m);
        if(target) break;
        if(!slide) break;
        rr+=dr;cc+=dc;
      }
    }
  }
  if(filterCheck) moves=moves.filter(m=>!wouldBeSelfCheck(board,hands,color,m));
  return moves;
}

function wouldBeSelfCheck(board,hands,color,m){
  const s={board:JSON.parse(JSON.stringify(board)),hands:JSON.parse(JSON.stringify(hands)),turn:color};
  if(m.drop){
    const idx=s.hands[color].indexOf(m.drop);
    if(idx>=0) s.hands[color].splice(idx,1);
    s.board[m.to[0]][m.to[1]]={type:m.drop,color,pr:false};
  }else{
    const p=s.board[m.from[0]][m.from[1]];
    s.board[m.from[0]][m.from[1]]=null;
    if(s.board[m.to[0]][m.to[1]]) s.hands[color].push(s.board[m.to[0]][m.to[1]].type);
    if(m.promote) p.pr=true;
    s.board[m.to[0]][m.to[1]]=p;
  }
  return inCheck(s.board,color);
}

function getPieceMoves(p){
  const f=p.color===0?-1:1;
  let base={
    P:[[f,0,false]],
    L:[[f,0,true]],
    N:[[f*2,-1,false],[f*2,1,false]],
    S:[[f,0,false],[f,1,false],[f,-1,false],[-f,1,false],[-f,-1,false]],
    G:[[f,0,false],[f,1,false],[f,-1,false],[0,1,false],[0,-1,false],[-f,0,false]],
    B:[[1,1,true],[1,-1,true],[-1,1,true],[-1,-1,true]],
    R:[[1,0,true],[-1,0,true],[0,1,true],[0,-1,true]],
    K:[[1,0,false],[-1,0,false],[0,1,false],[0,-1,false],[1,1,false],[1,-1,false],[-1,1,false],[-1,-1,false]]
  }[p.type];
  if(p.pr){
    if(p.type==='B') base=base.concat([[1,0,false],[-1,0,false],[0,1,false],[0,-1,false]]);
    else if(p.type==='R') base=base.concat([[1,1,false],[1,-1,false],[-1,1,false],[-1,-1,false]]);
    else base=[[f,0,false],[f,1,false],[f,-1,false],[0,1,false],[0,-1,false],[-f,0,false]];
  }
  return base;
}
