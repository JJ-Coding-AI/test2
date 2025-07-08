const PIECE_VALUES={P:100,L:300,N:300,S:400,G:500,B:800,R:1000,K:0};

onmessage=function(e){
  if(e.data.type==='search'){
    const state=e.data.state;
    const start=Date.now();
    let best=null;
    for(let depth=1;depth<=3;depth++){
      const [score,move]=search(state,depth,-1e9,1e9);
      if(move) best=move;
      if(Date.now()-start>900) break;
    }
    postMessage({type:'move',move:best});
  }
};

function cloneState(st){
  return JSON.parse(JSON.stringify(st));
}

function search(st,depth,alpha,beta){
  if(depth===0) return [evaluate(st),null];
  const moves=generateAllMoves(st,st.turn);
  let best=null;
  for(const m of moves){
    const next=cloneState(st);
    applyMove(next,m);
    const [score]=search(next,depth-1,-beta,-alpha);
    const val=-score;
    if(val>alpha){
      alpha=val; best=m;
      if(alpha>=beta) break;
    }
  }
  return [alpha,best];
}

function evaluate(st){
  let s=0;
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=st.board[y][x];
    if(p){
      const val=PIECE_VALUES[p.t]+(p.p?50:0);
      s+=p.c==='black'?val:-val;
    }
  }
  for(const c of ['black','white']){
    for(const t in st.hands[c]){
      const val=PIECE_VALUES[t]*(st.hands[c][t]);
      s+=c==='black'?val:-val;
    }
  }
  return s;
}

function generateAllMoves(st,color){
  const moves=[];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=st.board[y][x];
      if(p&&p.c===color){
        moves.push(...generateMoves(st,color,x,y));
      }
    }
  }
  for(const t of ['P','L','N','S','G','B','R']){
    const n=st.hands[color][t]||0;
    for(let i=0;i<n;i++){
      moves.push(...generateDropMoves(st,t,color));
    }
  }
  return moves;
}

function generateMoves(st,color,x,y){
  const piece=st.board[y][x];
  if(!piece) return [];
  const dir=color==='black'?-1:1;
  const res=[];
  const add=(dx,dy)=>{
    const nx=x+dx,ny=y+dy;
    if(nx<0||nx>8||ny<0||ny>8) return;
    const target=st.board[ny][nx];
    if(target && target.c===color) return;
    res.push({from:[x,y],to:[nx,ny],promote:false});
  };
  switch(piece.t){
    case 'P': add(0,dir); break;
    case 'L': for(let ny=y+dir;ny>=0&&ny<9;ny+=dir){ if(st.board[ny][x]){ if(st.board[ny][x].c!==color) add(0,ny-y); break;} else add(0,ny-y);} break;
    case 'N': add(-1,2*dir); add(1,2*dir); break;
    case 'S': [[0,dir],[1,dir],[-1,dir],[1,-dir],[-1,-dir]].forEach(d=>add(d[0],d[1])); break;
    case 'G': [[0,dir],[1,dir],[-1,dir],[0,-dir],[1,0],[-1,0]].forEach(d=>add(d[0],d[1])); break;
    case 'K': [[0,1],[1,1],[-1,1],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0]].forEach(d=>add(d[0],d[1])); break;
    case 'B': for(const d of [[1,1],[1,-1],[-1,1],[-1,-1]]){ let nx=x+d[0],ny=y+d[1]; while(nx>=0&&nx<9&&ny>=0&&ny<9){ if(st.board[ny][nx]){ if(st.board[ny][nx].c!==color) res.push({from:[x,y],to:[nx,ny],promote:false}); break;} else res.push({from:[x,y],to:[nx,ny],promote:false}); nx+=d[0]; ny+=d[1]; } } break;
    case 'R': for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){ let nx=x+d[0],ny=y+d[1]; while(nx>=0&&nx<9&&ny>=0&&ny<9){ if(st.board[ny][nx]){ if(st.board[ny][nx].c!==color) res.push({from:[x,y],to:[nx,ny],promote:false}); break;} else res.push({from:[x,y],to:[nx,ny],promote:false}); nx+=d[0]; ny+=d[1]; } } break;
  }
  return res;
}

function generateDropMoves(st,type,color){
  const res=[];
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) if(!st.board[y][x]) res.push({drop:true,p:type,to:[x,y]});
  return res;
}

function applyMove(st,m){
  if(m.drop){
    st.board[m.to[1]][m.to[0]]={c:st.turn,t:m.p,p:false};
    st.hands[st.turn][m.p]--;
  }else{
    const pc=st.board[m.from[1]][m.from[0]];
    st.board[m.from[1]][m.from[0]]=null;
    if(st.board[m.to[1]][m.to[0]]){
      const cap=st.board[m.to[1]][m.to[0]];
      st.hands[st.turn][cap.t]=(st.hands[st.turn][cap.t]||0)+1;
    }
    st.board[m.to[1]][m.to[0]]=pc;
  }
  st.turn=st.turn==='black'?'white':'black';
}
