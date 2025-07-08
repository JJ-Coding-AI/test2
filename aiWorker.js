let TIME_LIMIT=10000;
let startTime=0;
let stopFlag=false;
let best=null;
let TT=new Map();
let Z=[];
for(let i=0;i<81;i++){
  Z[i]=[];
  for(let j=0;j<32;j++){
    Z[i][j]=BigInt.asUintN(64,BigInt(Math.floor(Math.random()*Number.MAX_SAFE_INTEGER)));
  }
}
let ZTURN=BigInt.asUintN(64,BigInt(Math.floor(Math.random()*Number.MAX_SAFE_INTEGER)));

onmessage=e=>{
  if(e.data.type==='start'){
    stopFlag=false;best=null;startTime=Date.now();
    let state=e.data.state;
    searchRoot(state);
  }else if(e.data.type==='stop'){
    stopFlag=true;postMessage({stop:true,best});
  }
};

function hash(s){
  let h=0n;
  for(let i=0;i<81;i++){
    let pc=s.board[i];
    if(pc){
      let code=pieceCode(pc);
      h^=Z[i][code];
    }
  }
  if(s.turn)h^=ZTURN;
  return h;
}
function pieceCode(pc){
  const base={'P':0,'L':1,'N':2,'S':3,'G':4,'B':5,'R':6,'K':7};
  let v=base[pc.p];
  if(pc.pr)v+=8;
  if(pc.c)v+=16;
  return v;
}

function clone(s){return JSON.parse(JSON.stringify(s));}

function searchRoot(s){
  let depth=1;
  let bestmove=null;
  while(depth<=7){
    let res=alphabeta(s,depth,-Infinity,Infinity,true);
    if(stopFlag)break;
    bestmove=res.move||bestmove;
    best=bestmove;
    depth++;
    if(Date.now()-startTime>TIME_LIMIT)break;
  }
  let time=((Date.now()-startTime)/1000).toFixed(1);
  postMessage({best:bestmove,time});
}

function alphabeta(s,depth,alpha,beta,root){
  if(stopFlag||Date.now()-startTime>TIME_LIMIT)return {score:0};
  if(depth===0)return {score:evaluate(s)};
  let moves=generateLegalMoves(s,s.turn);
  if(!moves.length){
    return {score: -99999};
  }
  let bestMove=null;
  for(let m of moves){
    let ns=apply(clone(s),m);
    let score=-alphabeta(ns,depth-1,-beta,-alpha,false).score;
    if(score>alpha){
      alpha=score;bestMove=m;
      if(alpha>=beta)break;
    }
  }
  if(root)return {score:alpha,move:bestMove};
  return {score:alpha};
}

function evaluate(s){
  let score=0;
  for(let i=0;i<81;i++){
    let pc=s.board[i];
    if(pc){
      let val=pieceValue(pc);
      let r=Math.floor(i/9);
      if(pc.c===0)score+=val+((8-r)*10);
      else score-=val+((r)*10);
    }
  }
  if(isCheck(s,1))score+=500;
  if(isCheck(s,0))score-=500;
  return score;
}
function pieceValue(pc){
  const table={P:100,L:300,N:300,S:400,G:500,B:700,R:800,K:10000,'+P':500,'+L':500,'+N':500,'+S':500,'+B':800,'+R':900};
  return table[pc.pr?('+'+pc.p):pc.p];
}

function generateLegalMoves(s,turn){
  return generateMoves(s,turn).filter(m=>!isCheck(apply(clone(s),m),turn));
}

function generateMoves(s,turn){
  let res=[];
  for(let i=0;i<81;i++){
    let pc=s.board[i];
    if(!pc||pc.c!==turn)continue;
    let dirs=getDirs(pc);
    for(let d of dirs){
      let r=Math.floor(i/9);let c=i%9;
      let step=0;
      while(true){
        r+=d[0]*(turn?1:-1);c+=d[1]*(turn?1:-1);
        if(r<0||r>8||c<0||c>8)break;
        let to=r*9+c;
        if(pc.p==='N'&&!pc.pr&&step>=1)break;
        step++;
        let target=s.board[to];
        res.push({from:i,to, promote:false});
        if(target){if(target.c===turn)res.pop();break;}
        if(!isLong(pc)||pc.pr)break;
      }
    }
  }
  for(let p of ['P','L','N','S','G','B','R']){
    if(s.hand[turn][p]>0){
      for(let i=0;i<81;i++){
        if(!s.board[i]){
          let r=Math.floor(i/9);let c=i%9;
          if(!dropAllowed(p,turn,r,c,s))continue;
          res.push({drop:p,to:i});
        }
      }
    }
  }
  return res;
}

function getDirs(pc){
  const DIRS={
    P:[[-1,0]],
    L:[[-1,0]],
    N:[[-2,-1],[-2,1]],
    S:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]],
    G:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
    B:[[-1,-1],[-1,1],[1,-1],[1,1]],
    R:[[-1,0],[1,0],[0,-1],[0,1]],
    '+B':[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
    '+R':[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]],
    '+P':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
    '+L':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
    '+N':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
    '+S':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
    K:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
  };
  return DIRS[pc.pr?'+'+pc.p:pc.p];
}

function isLong(pc){
  if(pc.p==='L'&&!pc.pr) return true;
  if(pc.p==='B') return true;
  if(pc.p==='R') return true;
  return false;
}

function dropAllowed(p,turn,r,c,s){
  if(p==='P'){
    for(let i=r;i>=0&&i<9;i+=turn?1:-1){
      let idx=i*9+c;
      let q=s.board[idx];
      if(q&&q.c===turn&&q.p==='P'&&!q.pr)return false;
    }
    if(turn?r===8:r===0)return false;
  }
  if(p==='N'&&(turn?r>6:r<2))return false;
  if(p==='L'&&(turn?r===8:r===0))return false;
  return true;
}

function apply(s,m){
  if(m.drop){s.board[m.to]={p:m.drop,c:s.turn,pr:false};s.hand[s.turn][m.drop]--;}
  else{let pc=s.board[m.from];s.board[m.from]=null;if(s.board[m.to]){let cap=s.board[m.to];s.hand[s.turn][cap.p]++;}s.board[m.to]=pc;}
  s.turn^=1;return s;
}

function isCheck(s,turn){
  let king=-1;
  for(let i=0;i<81;i++){let pc=s.board[i];if(pc&&pc.p==='K'&&pc.c===turn){king=i;break;}}
  let ops=generateMoves(s,turn^1);
  return ops.some(m=>m.to===king);
}
