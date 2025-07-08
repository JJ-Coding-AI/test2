const boardElem = document.getElementById('board');
const blackHandElem = document.getElementById('black-hand');
const whiteHandElem = document.getElementById('white-hand');
const turnElem = document.getElementById('turn');
const moveElem = document.getElementById('move');
const messageElem = document.getElementById('message');
const undoBtn = document.getElementById('undo');
const resetBtn = document.getElementById('reset');

const PIECE_NAMES = {
  P:'歩', L:'香', N:'桂', S:'銀', G:'金', B:'角', R:'飛', K:'玉',
  '+P':'と', '+L':'杏', '+N':'圭', '+S':'全', '+B':'馬', '+R':'龍'
};
const PIECE_VALUES = {P:100,L:300,N:300,S:400,G:500,B:800,R:1000,K:0};
const DIR = {black: -1, white:1};
let state = {};
let history = [];
let dragging = null;
let highlights = [];
let aiWorker = new Worker('aiWorker.js');
let aiThinkingStart = 0;

function init(){
  state = createInitialState();
  history = [];
  draw();
}

function createInitialState(){
  const b = Array.from({length:9},()=>Array(9).fill(null));
  const piecesRow = ['L','N','S','G','K','G','S','N','L'];
  for(let i=0;i<9;i++){
    b[0][i] = {c:'white',t:piecesRow[i],p:false};
    b[2][i] = {c:'white',t:'P',p:false};
    b[6][i] = {c:'black',t:'P',p:false};
    b[8][i] = {c:'black',t:piecesRow[i],p:false};
  }
  b[1][1] = {c:'white',t:'B',p:false};
  b[1][7] = {c:'white',t:'R',p:false};
  b[7][1] = {c:'black',t:'R',p:false};
  b[7][7] = {c:'black',t:'B',p:false};
  return {board:b, hands:{black:{},white:{}}, turn:'black', move:1};
}

function draw(){
  boardElem.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const sq=document.createElement('div');
      sq.className='square';
      sq.dataset.x=x; sq.dataset.y=y;
      const piece=state.board[y][x];
      if(piece){
        const div=document.createElement('div');
        div.className='piece '+(piece.c==='white'?'white':'');
        if(piece.p) div.classList.add('promoted');
        div.textContent=PIECE_NAMES[(piece.p?'+':'')+piece.t];
        sq.appendChild(div);
      }
      boardElem.appendChild(sq);
    }
  }
  updateHands();
  turnElem.textContent='手番: '+(state.turn==='black'?'先手':'後手');
  moveElem.textContent=state.move+' 手目';
}

function updateHands(){
  const pieces=['P','L','N','S','G','B','R'];
  blackHandElem.innerHTML='先手: ';
  whiteHandElem.innerHTML='後手: ';
  for(const p of pieces){
    const bc=state.hands.black[p]||0;
    if(bc){
      const span=document.createElement('span');
      span.className='piece';
      span.textContent=PIECE_NAMES[p]+bc;
      span.dataset.piece=p;
      span.addEventListener('mousedown',()=>startHandDrag('black',p));
      blackHandElem.appendChild(span);
    }
    const wc=state.hands.white[p]||0;
    if(wc){
      const span=document.createElement('span');
      span.className='piece white';
      span.textContent=PIECE_NAMES[p]+wc;
      span.dataset.piece=p;
      span.addEventListener('mousedown',()=>startHandDrag('white',p));
      whiteHandElem.appendChild(span);
    }
  }
}

function onSquareDown(e){
  const sq=e.currentTarget;
  const x=+sq.dataset.x, y=+sq.dataset.y;
  const piece=state.board[y][x];
  if(piece && piece.c===state.turn){
    dragging={from:[x,y],piece};
    highlightLegalMoves(x,y,piece);
  }
}

function highlightLegalMoves(x,y,piece){
  clearHighlights();
  const moves=generateMoves(state,piece.c,x,y);
  for(const m of moves){
    if(m.from && m.from[0]===x && m.from[1]===y){
      const sq=boardElem.children[m.to[1]*9+m.to[0]];
      sq.classList.add('highlight');
      highlights.push(sq);
    }
  }
}

function clearHighlights(){
  for(const h of highlights) h.classList.remove('highlight');
  highlights=[];
}

function startHandDrag(color,type){
  if(color!==state.turn) return;
  dragging={from:null,piece:{c:color,t:type,p:false},drop:true};
  highlightDropSquares(type,color);
}

function highlightDropSquares(type,color){
  clearHighlights();
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(!state.board[y][x]){
        const sq=boardElem.children[y*9+x];
        sq.classList.add('highlight');
        highlights.push(sq);
      }
    }
  }
}

function onSquareUp(e){
  const sq=e.currentTarget;
  const x=+sq.dataset.x, y=+sq.dataset.y;
  if(!dragging) return;
  let moves;
  if(dragging.drop){
    moves=generateDropMoves(state,dragging.piece.t,dragging.piece.c);
  }else{
    moves=generateMoves(state,dragging.piece.c,dragging.from[0],dragging.from[1]);
  }
  const move=moves.find(m=>m.to[0]===x && m.to[1]===y);
  if(move){
    doMove(move);
  }
  dragging=null;
  clearHighlights();
}

function doMove(move){
  history.push(JSON.stringify(state));
  applyMove(state,move);
  draw();
  if(checkGameEnd()) return;
  if(state.turn==='white'){
    aiThinkingStart=Date.now();
    messageElem.textContent='考え中...';
    aiWorker.postMessage({type:'search',state});
  }
}

aIWorkerMessage = function(e){};

aiWorker.onmessage=function(e){
  if(e.data.type==='move'){
    const thinking=Date.now()-aiThinkingStart;
    messageElem.textContent='AI: '+(thinking/1000).toFixed(1)+'秒';
    doMove(e.data.move);
  }
};

function applyMove(st,m){
  if(m.drop){
    st.board[m.to[1]][m.to[0]]={c:st.turn,t:m.p,p:false};
    st.hands[st.turn][m.p]--;
  }else{
    const pc=st.board[m.from[1]][m.from[0]];
    st.board[m.from[1]][m.from[0]]=null;
    if(st.board[m.to[1]][m.to[0]]){
      const cap=st.board[m.to[1]][m.to[0]];
      const type=cap.p?cap.t:cap.t;
      st.hands[st.turn][type]=(st.hands[st.turn][type]||0)+1;
    }
    pc.p=m.promote?true:pc.p;
    st.board[m.to[1]][m.to[0]]=pc;
  }
  st.turn=st.turn==='black'?'white':'black';
  if(st.turn==='black') st.move++;
}

function checkGameEnd(){
  const kings=findKings(state.board);
  if(!kings.black){
    messageElem.textContent='先手の負けです';
    return true;
  }
  if(!kings.white){
    messageElem.textContent='後手の負けです';
    return true;
  }
  return false;
}

function findKings(b){
  let k={black:null,white:null};
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=b[y][x];
    if(p && p.t==='K') k[p.c]=[x,y];
  }
  return k;
}

undoBtn.onclick=function(){
  if(history.length<2) return;
  state=JSON.parse(history.pop());
  state=JSON.parse(history.pop());
  draw();
  messageElem.textContent='';
};

resetBtn.onclick=function(){
  init();
  messageElem.textContent='';
};

boardElem.addEventListener('mousedown',e=>{
  if(e.target.classList.contains('piece')){
    const sq=e.target.parentElement;
    onSquareDown({currentTarget:sq});
  }
});
boardElem.addEventListener('mouseup',e=>{
  const sq=e.target.closest('.square');
  if(sq) onSquareUp({currentTarget:sq});
});

init();

function generateMoves(st,color,x,y){
  const res=[];
  const piece=st.board[y][x];
  if(!piece || piece.c!==color) return res;
  const dir=color==='black'?-1:1;
  const inZone=(yy)=> color==='black'? yy<=2 : yy>=6;
  const promotable=['P','L','N','S','B','R'];
  const add=(toX,toY)=>{
    if(toX<0||toX>8||toY<0||toY>8) return;
    const target=st.board[toY][toX];
    if(target && target.c===color) return;
    let promote=false;
    if(promotable.includes(piece.t)&&(!piece.p)){
      if(inZone(y) || inZone(toY)) promote=true;
    }
    res.push({from:[x,y],to:[toX,toY],promote:false});
    if(promote) res.push({from:[x,y],to:[toX,toY],promote:true});
  };
  switch(piece.t){
    case 'P': add(x,y+dir); break;
    case 'L': for(let yy=y+dir;yy>=0 && yy<9;yy+=dir){ if(st.board[yy][x]){ if(st.board[yy][x].c!==color) add(x,yy); break;} else add(x,yy);} break;
    case 'N': add(x-1,y+2*dir); add(x+1,y+2*dir); break;
    case 'S': [[0,dir],[1,dir],[-1,dir],[1,-dir],[-1,-dir]].forEach(d=>add(x+d[0],y+d[1])); break;
    case 'G': [[0,dir],[1,dir],[-1,dir],[0,-dir],[1,0],[-1,0]].forEach(d=>add(x+d[0],y+d[1])); break;
    case 'K': [[0,1],[1,1],[-1,1],[0,-1],[1,-1],[-1,-1],[1,0],[-1,0]].forEach(d=>add(x+d[0],y+d[1])); break;
    case 'B': for(const d of [[1,1],[1,-1],[-1,1],[-1,-1]]){ let nx=x+d[0],ny=y+d[1]; while(nx>=0&&nx<9&&ny>=0&&ny<9){ if(st.board[ny][nx]){ if(st.board[ny][nx].c!==color) add(nx,ny); break;} else add(nx,ny); nx+=d[0]; ny+=d[1]; } } break;
    case 'R': for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){ let nx=x+d[0],ny=y+d[1]; while(nx>=0&&nx<9&&ny>=0&&ny<9){ if(st.board[ny][nx]){ if(st.board[ny][nx].c!==color) add(nx,ny); break;} else add(nx,ny); nx+=d[0]; ny+=d[1]; } } break;
  }
  if(piece.p){
    if(piece.t==='B') for(const d of [[0,1],[0,-1],[1,0],[-1,0]]) add(x+d[0],y+d[1]);
    if(piece.t==='R') for(const d of [[1,1],[1,-1],[-1,1],[-1,-1]]) add(x+d[0],y+d[1]);
    if(['P','L','N','S'].includes(piece.t)) [[0,dir],[1,dir],[-1,dir],[0,-dir],[1,0],[-1,0]].forEach(d=>add(x+d[0],y+d[1]));
  }
  return res;
}


function generateDropMoves(st,type,color){
  const res=[];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(!st.board[y][x]){
        res.push({drop:true,p:type,to:[x,y]});
      }
    }
  }
  return res;
}
