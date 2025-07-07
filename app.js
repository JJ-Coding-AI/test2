const boardElem = document.getElementById('board');
const turnInfo = document.getElementById('turnInfo');
const messageElem = document.getElementById('message');
const handElems = [document.getElementById('hand0'), document.getElementById('hand1')];
const undoBtn = document.getElementById('undoBtn');

let board = [];
let hands = [[], []];
let history = [];
let turn = 0; // 0: player(先手), 1: AI(後手)

const pieceChars = {
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '王',
  '+P':'と', '+L':'成香', '+N':'成桂', '+S':'成銀', '+B':'馬', '+R':'龍'
};

const movesDef = {
  P:[[0,-1]], L:[[0,-1,'slide']], N:[[1,-2],[-1,-2]],
  S:[[0,-1],[1,-1],[-1,-1],[1,1],[-1,1]],
  G:[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],
  R:[[1,0,'slide'],[-1,0,'slide'],[0,1,'slide'],[0,-1,'slide']],
  K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
  '+P':[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],
  '+L':[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],
  '+N':[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],
  '+S':[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],
  '+B':[[1,1,'slide'],[-1,1,'slide'],[1,-1,'slide'],[-1,-1,'slide'],[1,0],[-1,0],[0,1],[0,-1]],
  '+R':[[1,0,'slide'],[-1,0,'slide'],[0,1,'slide'],[0,-1,'slide'],[1,1],[-1,1],[1,-1],[-1,-1]]
};

function initBoard() {
  board = Array.from({length:9}, ()=>Array(9).fill(null));
  // Setup pieces minimal (only kings and pawns for demo)
  board[0][4] = {type:'K', owner:1};
  board[8][4] = {type:'K', owner:0};
  for(let i=0;i<9;i++) {
    board[2][i] = {type:'P', owner:1};
    board[6][i] = {type:'P', owner:0};
  }
  hands = [[],[]];
  history=[];
  turn=0;
}

function render() {
  boardElem.innerHTML='';
  for(let r=0;r<9;r++) {
    for(let c=0;c<9;c++) {
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.x=c;
      cell.dataset.y=r;
      const piece=board[r][c];
      if(piece){
        const span=document.createElement('span');
        span.textContent=pieceChars[piece.type];
        span.className='piece p'+piece.owner;
        span.draggable= turn===piece.owner;
        span.dataset.x=c; span.dataset.y=r;
        span.addEventListener('dragstart',onDragStart);
        cell.appendChild(span);
      }
      cell.addEventListener('dragover',onDragOver);
      cell.addEventListener('drop',onDrop);
      boardElem.appendChild(cell);
    }
  }
  handElems.forEach((el,i)=>{
    el.innerHTML='';
    hands[i].forEach((p,idx)=>{
      const span=document.createElement('span');
      span.textContent=pieceChars[p.type];
      span.className='piece p'+i;
      span.draggable= turn===i;
      span.dataset.hand=i;
      span.dataset.index=idx;
      span.addEventListener('dragstart',onDragStart);
      el.appendChild(span);
    });
  });
  turnInfo.textContent= turn===0? 'あなたの番(先手)':'AIの番(後手)';
}

let dragData=null;
function onDragStart(e){
  const x=e.target.dataset.x;
  const y=e.target.dataset.y;
  if(x!==undefined){
    dragData={from:{x:+x,y:+y}, hand:false};
    highlightMoves(+x,+y);
  } else if(e.target.dataset.hand){
    dragData={from:{hand:+e.target.dataset.hand,index:+e.target.dataset.index}, hand:true};
    highlightDrops();
  }
}

function onDragOver(e){ e.preventDefault(); }

function onDrop(e){
  e.preventDefault();
  if(!dragData) return;
  const x=e.currentTarget.dataset.x; const y=e.currentTarget.dataset.y;
  if(x===undefined) return;
  const tx=+x, ty=+y;
  if(isLegalDrop(tx,ty)){
    const prevState=JSON.stringify({board,hands});
    history.push(prevState);
    if(dragData.hand){
      const arr=hands[turn];
      const piece=arr.splice(dragData.from.index,1)[0];
      board[ty][tx]=piece;
    } else {
      const piece=board[dragData.from.y][dragData.from.x];
      board[dragData.from.y][dragData.from.x]=null;
      if(board[ty][tx]){ hands[turn].push(board[ty][tx]); }
      board[ty][tx]=piece;
      autoPromote(piece, ty);
    }
    clearHighlights();
    dragData=null;
    render();
    if(checkWin()) return;
    turn=1-turn;
    render();
    if(turn===1) aiMove();
  }
}

function highlightMoves(x,y){
  clearHighlights();
  const piece=board[y][x];
  if(!piece||piece.owner!==turn) return;
  const moves=getLegalMoves(x,y,piece);
  moves.forEach(([tx,ty])=>{
    const cell=cellElem(tx,ty);
    if(cell) cell.classList.add('highlight');
  });
}

function highlightDrops(){
  clearHighlights();
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(!board[r][c]) cellElem(c,r).classList.add('highlight');
    }
  }
}
function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function cellElem(x,y){
  return boardElem.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
}

function isLegalDrop(x,y){
  return cellElem(x,y).classList.contains('highlight');
}

function getLegalMoves(x,y,piece){
  const defs=movesDef[piece.type];
  const res=[];
  defs.forEach(d=>{
    const dx=d[0], dy=d[1];
    if(d[2]==='slide'){
      let nx=x+dx*(piece.owner?1:-1), ny=y+dy*(piece.owner?1:-1);
      while(inBoard(nx,ny) && !board[ny][nx]){
        res.push([nx,ny]);
        nx+=dx*(piece.owner?1:-1); ny+=dy*(piece.owner?1:-1);
      }
      if(inBoard(nx,ny) && board[ny][nx] && board[ny][nx].owner!==piece.owner) res.push([nx,ny]);
    } else {
      const nx=x+dx*(piece.owner?1:-1), ny=y+dy*(piece.owner?1:-1);
      if(inBoard(nx,ny) && (!board[ny][nx] || board[ny][nx].owner!==piece.owner)) res.push([nx,ny]);
    }
  });
  return res;
}
function inBoard(x,y){ return x>=0&&x<9&&y>=0&&y<9; }

function autoPromote(piece, y){
  if(piece.type==='P'){
    if((piece.owner===0 && y===0) || (piece.owner===1 && y===8)){
      piece.type='+P';
    }
  }
}

function aiMove(){
  messageElem.textContent='考え中...';
  setTimeout(()=>{
    const moves=[];
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p&&p.owner===1){
        getLegalMoves(c,r,p).forEach(m=>moves.push({from:{x:c,y:r},to:{x:m[0],y:m[1]}}));
      }
    }
    if(moves.length===0){
      alert('あなたの勝ち！');
      initBoard();
      render();
      return;
    }
    const mv=moves[Math.floor(Math.random()*moves.length)];
    const prev=JSON.stringify({board,hands});
    history.push(prev);
    const piece=board[mv.from.y][mv.from.x];
    board[mv.from.y][mv.from.x]=null;
    if(board[mv.to.y][mv.to.x]) hands[1].push(board[mv.to.y][mv.to.x]);
    board[mv.to.y][mv.to.x]=piece;
    autoPromote(piece, mv.to.y);
    messageElem.textContent='';
    render();
    if(checkWin()) return;
    turn=0;
    render();
  },500);
}

function checkWin(){
  let king0=false, king1=false;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=board[r][c];
    if(p&&p.type==='K'){ if(p.owner===0) king0=true; else king1=true; }
  }
  if(!king0){ alert('AIの勝ち！'); initBoard(); render(); return true; }
  if(!king1){ alert('あなたの勝ち！'); initBoard(); render(); return true; }
  return false;
}

undoBtn.onclick=function(){
  if(history.length){
    const state=JSON.parse(history.pop());
    board=state.board; hands=state.hands; turn=1-turn; render();
  }
}

initBoard();
render();
