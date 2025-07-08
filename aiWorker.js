const TIME_LIMIT=10000;
let stop=false,startTime=0,bestMove=null;

onmessage=e=>{
  if(e.data.type==='stop'){stop=true;postMessage({move:null,bestMove,time:(Date.now()-startTime)/1000});return;}
  const state=JSON.parse(e.data.state);
  stop=false;startTime=Date.now();bestMove=null;
  let depth=1;
  while(depth<=7&&!stop&&(Date.now()-startTime)<TIME_LIMIT){
    search(state,depth,-1e9,1e9,true);
    depth++;
  }
  postMessage({move:bestMove,bestMove,time:(Date.now()-startTime)/1000});
};

const values={K:0,R:500,B:400,G:300,S:250,N:200,L:150,P:100,'+R':550,'+B':450,'+S':300,'+N':250,'+L':200,'+P':150};

function clone(s){return JSON.parse(JSON.stringify(s));}

function generateMoves(state){
  // similar to main generateLegalMoves but simplified
  const moves=[];
  for(let i=0;i<81;i++){
    const p=state.board[i];
    if(p&&p.c===state.turn){
      for(const t of legalMoves(state,i))moves.push({from:i,to:t});
    }
  }
  const hand=state.hand[state.turn];
  for(let k in hand){
    if(hand[k]>0){
      for(const t of legalDrops(state,k))moves.push({from:null,to:t,drop:k});
    }
  }
  return moves;
}

function legalMoves(state,pos){
  // use same logic as in UI but without highlights
  const piece=state.board[pos];
  if(!piece) return [];
  const res=[];
  const [x,y]=[pos%9,Math.floor(pos/9)];
  const tbl={
    K:[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]],
    G:[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
    S:[[0,1],[1,1],[-1,1],[1,-1],[-1,-1]],
    '+S':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
    N:[[1,2],[-1,2]],
    '+N':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
    L:[[0,1]],
    '+L':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
    P:[[0,1]],
    '+P':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]]
  };
  const range={R:[[0,1],[1,0],[0,-1],[-1,0]],B:[[1,1],[1,-1],[-1,1],[-1,-1]],'+R':[[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]],'+B':[[1,1],[1,-1],[-1,1],[-1,-1],[0,1],[1,0],[0,-1],[-1,0]]};
  const moves=tbl[piece.type]||[];
  for(const d of moves){
    let nx=x+(piece.c? -d[0]:d[0]);
    let ny=y+(piece.c? -d[1]:d[1]);
    if(nx<0||nx>8||ny<0||ny>8)continue;
    const ni=ny*9+nx;
    const t=state.board[ni];
    if(!t||t.c!==piece.c)res.push(ni);
  }
  const r=range[piece.type];
  if(r){
    for(const d of r){
      for(let step=1;;step++){
        let nx=x+(piece.c?-d[0]*step:d[0]*step);
        let ny=y+(piece.c?-d[1]*step:d[1]*step);
        if(nx<0||nx>8||ny<0||ny>8)break;
        const ni=ny*9+nx;
        const t=state.board[ni];
        if(t){
          if(t.c!==piece.c)res.push(ni);
          break;
        }else res.push(ni);
      }
    }
  }
  return res;
}

function legalDrops(state,type){
  const res=[];
  for(let i=0;i<81;i++){
    if(state.board[i])continue;
    const x=i%9,y=Math.floor(i/9);
    if(type==='P'){
      if(hasPawn(state,state.turn,x))continue;
      if((state.turn===0&&y===0)||(state.turn===1&&y===8))continue;
    }
    if(type==='N'){
      if((state.turn===0&&y>=7)||(state.turn===1&&y<=1))continue;
    }
    if(type==='L'){
      if((state.turn===0&&y===0)||(state.turn===1&&y===8))continue;
    }
    res.push(i);
  }
  return res;
}
function hasPawn(state,c,x){
  for(let y=0;y<9;y++){const p=state.board[y*9+x];if(p&&p.c===c&&p.type==='P')return true;}
  return false;
}

function makeMove(state,m){
  const s=clone(state);
  if(m.drop){
    s.board[m.to]={type:m.drop,c:s.turn};
    s.hand[s.turn][m.drop]--;
  }else{
    const piece=s.board[m.from];
    s.board[m.from]=null;
    let type=piece.type;
    if(m.promote) type=promoteMap[type];
    const target=s.board[m.to];
    if(target){
      const base=demoteMap[target.type]||target.type;
      s.hand[piece.c][base]=(s.hand[piece.c][base]||0)+1;
    }
    s.board[m.to]={type,c:piece.c};
  }
  s.turn=1-s.turn;
  return s;
}

function evaluate(state){
  let score=0;
  for(let i=0;i<81;i++){
    const p=state.board[i];
    if(p){
      let v=values[p.type];
      const y=Math.floor(i/9);
      v+= (p.c? -1:1)*(p.c?8-y:y)*10; // forward bonus
      score += (p.c? -v:v);
    }
  }
  for(let c=0;c<2;c++){
    const hand=state.hand[c];
    for(let k in hand){
      score+=(c? -1:1)*values[k]*hand[k];
    }
  }
  return score;
}

function isCheck(state){
  const kingPos=state.board.findIndex(p=>p&&p.c===state.turn&&p.type==='K');
  state.turn=1-state.turn;
  const moves=generateMoves(state);
  state.turn=1-state.turn;
  for(const m of moves){if(m.to===kingPos)return true;}
  return false;
}

function search(state,depth,alpha,beta,root){
  if(stop||(Date.now()-startTime)>TIME_LIMIT) return evaluate(state);
  if(depth===0) return evaluate(state);
  const moves=generateMoves(state);
  if(moves.length===0){
    if(isCheck(clone(state))) return -1e8-depth; // mate
    return 0;
  }
  let best=null;
  for(const m of moves){
    const next=makeMove(state,m);
    const score=-search(next,depth-1,-beta,-alpha,false);
    if(score>alpha){
      alpha=score; best=m;
      if(root) bestMove=m;
      if(alpha>=beta) break;
    }
  }
  return alpha;
}
