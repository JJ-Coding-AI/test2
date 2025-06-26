const boardElement = document.getElementById('board');
const turnElement = document.getElementById('turn');
const undoBtn = document.getElementById('undo');
const capturedWhite = document.getElementById('captured-white');
const capturedBlack = document.getElementById('captured-black');

let board, history, turn, captured;

const pieceSymbols = {
  'P':'歩','L':'香','N':'桂','S':'銀','G':'金','B':'角','R':'飛','K':'玉',
  'P+':'と','L+':'成香','N+':'成桂','S+':'成銀','B+':'馬','R+':'龍'
};

initGame();

function initGame(){
  board = Array.from({length:9},()=>Array(9).fill(null));
  captured = {black:[], white:[]};
  history = [];
  turn = 'black';
  const setup=[
    ['L','N','S','G','K','G','S','N','L'],
    [null,'R',null,null,null,null,null,'B',null],
    ['P','P','P','P','P','P','P','P','P'],
    Array(9).fill(null),
    Array(9).fill(null),
    Array(9).fill(null),
    ['P','P','P','P','P','P','P','P','P'],
    [null,'B',null,null,null,null,null,'R',null],
    ['L','N','S','G','K','G','S','N','L']
  ];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const t=setup[y][x];
      if(t){
        const owner=y<3?'white':'black';
        board[y][x]={type:t,owner:owner,promoted:false};
      }
    }
  }
  saveHistory();
  drawBoard();
  updateTurn();
}

function saveHistory(){
  history.push(JSON.parse(JSON.stringify({board,captured,turn})));
}

function updateTurn(){
  turnElement.textContent=(turn==='black'?'先手':'後手')+'の番';
}

function drawBoard(){
  boardElement.innerHTML='';
  for(let y=0;y<9;y++){
    const tr=document.createElement('tr');
    for(let x=0;x<9;x++){
      const td=document.createElement('td');
      td.dataset.x=x; td.dataset.y=y;
      td.addEventListener('dragover',e=>e.preventDefault());
      td.addEventListener('drop',onDrop);
      const p=board[y][x];
      if(p){
        const div=createPieceDiv(p);
        div.draggable=true;
        div.addEventListener('dragstart',onDragStart);
        td.appendChild(div);
      }
      tr.appendChild(td);
    }
    boardElement.appendChild(tr);
  }
  drawCaptured();
}

function drawCaptured(){
  capturedWhite.innerHTML='';
  capturedBlack.innerHTML='';
  captured.white.forEach((p,i)=>{
    const d=createPieceDiv(p);
    d.draggable=true;
    d.dataset.from='white';
    d.dataset.index=i;
    d.addEventListener('dragstart',onDragStart);
    capturedWhite.appendChild(d);
  });
  captured.black.forEach((p,i)=>{
    const d=createPieceDiv(p);
    d.draggable=true;
    d.dataset.from='black';
    d.dataset.index=i;
    d.addEventListener('dragstart',onDragStart);
    capturedBlack.appendChild(d);
  });
}

function createPieceDiv(p){
  const d=document.createElement('div');
  d.className='piece '+p.owner;
  d.textContent=pieceSymbols[p.type+(p.promoted?'+':'')] || p.type;
  d.dataset.type=p.type;
  d.dataset.owner=p.owner;
  d.dataset.promoted=p.promoted?'1':'0';
  return d;
}

function onDragStart(e){
  const div=e.target;
  if(div.dataset.owner!==turn){
    e.preventDefault();return;
  }
  e.dataTransfer.setData('text/plain','');
  const fromCaptured=div.parentElement.classList.contains('captured');
  div.classList.add('dragging');
  e.dataTransfer.setData('fromCaptured',fromCaptured);
  e.dataTransfer.setData('type',div.dataset.type);
  e.dataTransfer.setData('owner',div.dataset.owner);
  e.dataTransfer.setData('promoted',div.dataset.promoted);
  if(fromCaptured){
    e.dataTransfer.setData('index',div.dataset.index);
  }else{
    const x=div.parentElement.dataset.x;
    const y=div.parentElement.dataset.y;
    e.dataTransfer.setData('x',x);
    e.dataTransfer.setData('y',y);
  }
  highlightMoves(div);
}

function onDrop(e){
  e.preventDefault();
  const toX=parseInt(this.dataset.x);
  const toY=parseInt(this.dataset.y);
  const fromCaptured=e.dataTransfer.getData('fromCaptured')==='true';
  const type=e.dataTransfer.getData('type');
  const owner=e.dataTransfer.getData('owner');
  const promoted=e.dataTransfer.getData('promoted')==='1';
  let piece={type,owner,promoted};
  let fromX,fromY;
  if(fromCaptured){
    const idx=parseInt(e.dataTransfer.getData('index'));
    captured[owner].splice(idx,1);
  }else{
    fromX=parseInt(e.dataTransfer.getData('x'));
    fromY=parseInt(e.dataTransfer.getData('y'));
    if(fromX===toX&&fromY===toY) return;
    board[fromY][fromX]=null;
  }
  const legal=getLegalMoves(piece,fromX,fromY,fromCaptured);
  if(!legal.some(m=>m.x===toX&&m.y===toY)){
    drawBoard();
    return;
  }
  saveHistory();
  if(board[toY][toX]) capturePiece(board[toY][toX]);
  board[toY][toX]=piece;
  if(shouldPromote(piece,fromY,toY) && confirm('成りますか?')){
    board[toY][toX].promoted=true;
  }
  turn=turn==='black'?'white':'black';
  drawBoard();
  updateTurn();
  checkEnd();
}

undoBtn.addEventListener('click',()=>{
  if(history.length>1){
    history.pop();
    const prev=history[history.length-1];
    board=JSON.parse(JSON.stringify(prev.board));
    captured=JSON.parse(JSON.stringify(prev.captured));
    turn=prev.turn;
    drawBoard();
    updateTurn();
  }
});

function capturePiece(p){
  const owner=p.owner==='black'?'white':'black';
  captured[owner].push({type:p.type,owner:owner,promoted:false});
  if(p.type==='K'){
    alert((owner==='black'?'先手':'後手')+'の勝ち!');
    initGame();
  }
}

function shouldPromote(p,fromY,toY){
  if(!p) return false;
  if(p.promoted) return false;
  const zone=p.owner==='black'?[0,1,2]:[6,7,8];
  if(zone.includes(fromY)||zone.includes(toY)){
    if(['P','L','N','S','B','R'].includes(p.type)) return true;
  }
  return false;
}

function highlightMoves(div){
  clearHighlights();
  const fromCaptured=div.parentElement.classList.contains('captured');
  let x=null,y=null;
  if(!fromCaptured){
    x=parseInt(div.parentElement.dataset.x);
    y=parseInt(div.parentElement.dataset.y);
  }
  const piece={type:div.dataset.type,owner:div.dataset.owner,promoted:div.dataset.promoted==='1'};
  const moves=getLegalMoves(piece,x,y,fromCaptured);
  moves.forEach(m=>{
    const cell=boardElement.rows[m.y].cells[m.x];
    cell.classList.add('highlight');
  });
}

function clearHighlights(){
  document.querySelectorAll('#board td').forEach(td=>td.classList.remove('highlight'));
}

function getLegalMoves(piece,x,y,fromCaptured){
  const moves=[];
  if(fromCaptured){
    for(let yy=0;yy<9;yy++){
      for(let xx=0;xx<9;xx++){
        if(!board[yy][xx]) moves.push({x:xx,y:yy});
      }
    }
    return moves;
  }
  const forward=piece.owner==='black'? -1:1;
  const backward=-forward;
  const dirs=[];
  const leaps=[];
  switch(piece.type){
    case 'P': dirs.push([forward,0]);break;
    case 'L': dirs.push([forward,0]);break;
    case 'N': leaps.push([forward*2,-1],[forward*2,1]);break;
    case 'S': dirs.push([forward,-1],[forward,0],[forward,1],[backward,-1],[backward,1]);break;
    case 'G': dirs.push([forward,-1],[forward,0],[forward,1],[0,-1],[0,1],[backward,0]);break;
    case 'B': dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);break;
    case 'R': dirs.push([1,0],[-1,0],[0,1],[0,-1]);break;
    case 'K': dirs.push([forward,-1],[forward,0],[forward,1],[0,-1],[0,1],[backward,-1],[backward,0],[backward,1]);break;
  }
  if(piece.promoted){
    if(['P','L','N','S'].includes(piece.type)){
      dirs.length=0;
      dirs.push([forward,-1],[forward,0],[forward,1],[0,-1],[0,1],[backward,0]);
    }
    if(piece.type==='B') dirs.push([1,0],[-1,0],[0,1],[0,-1]);
    if(piece.type==='R') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  }
  const addDir=(dy,dx,repeat)=>{
    let ny=y+dy, nx=x+dx;
    while(ny>=0&&ny<9&&nx>=0&&nx<9){
      const target=board[ny][nx];
      if(target){
        if(target.owner!==piece.owner) moves.push({x:nx,y:ny});
        break;
      }else{
        moves.push({x:nx,y:ny});
      }
      if(!repeat) break;
      ny+=dy; nx+=dx;
    }
  };
  dirs.forEach(d=>addDir(d[0],d[1],piece.type==='L' || piece.type==='B' || piece.type==='R' || (piece.promoted && (piece.type==='B'||piece.type==='R'))));
  leaps.forEach(l=>{
    const ny=y+l[0], nx=x+l[1];
    if(ny>=0&&ny<9&&nx>=0&&nx<9){
      const target=board[ny][nx];
      if(!target||target.owner!==piece.owner) moves.push({x:nx,y:ny});
    }
  });
  return moves;
}

function checkEnd(){
  // simple check for checkmate not implemented; only check for king capture
}
