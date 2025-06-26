const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const capturedSente = document.getElementById('captured_sente');
const capturedGote = document.getElementById('captured_gote');
const undoBtn = document.getElementById('undo');
let draggingHand = null;

const PIECES = ['歩','香','桂','銀','金','角','飛','王'];
const INITIAL_BOARD = [
  ['l','n','s','g','k','g','s','n','l'],
  [null,'r',null,null,null,null,null,'b',null],
  ['p','p','p','p','p','p','p','p','p'],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P','P'],
  [null,'B',null,null,null,null,null,'R',null],
  ['L','N','S','G','K','G','S','N','L']
];

let board = [];
let turn = 'sente';
let moveHistory = [];

function initBoard() {
  boardEl.innerHTML = '';
  board = JSON.parse(JSON.stringify(INITIAL_BOARD));
  for (let r=0;r<9;r++) {
    for (let c=0;c<9;c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      boardEl.appendChild(cell);
      renderPiece(r,c);
    }
  }
  capturedSente.innerHTML = '';
  capturedGote.innerHTML = '';
  turn = 'sente';
  updateTurnDisplay();
}

function renderPiece(r,c) {
  const cell = getCell(r,c);
  cell.innerHTML = '';
  const p = board[r][c];
  if (!p) return;
  const pieceEl = document.createElement('div');
  pieceEl.textContent = pieceName(p);
  pieceEl.className = 'piece';
  pieceEl.draggable = true;
  pieceEl.dataset.piece = p;
  pieceEl.dataset.row = r;
  pieceEl.dataset.col = c;
  pieceEl.addEventListener('dragstart', onDragStart);
  pieceEl.addEventListener('click', () => showMoves(r,c));
  cell.appendChild(pieceEl);
}

function pieceName(p) {
  const promoted = p.includes('+');
  const base = p.replace('+','');
  const names = {
    p:'歩', l:'香', n:'桂', s:'銀', g:'金', b:'角', r:'飛', k:'王',
    P:'歩', L:'香', N:'桂', S:'銀', G:'金', B:'角', R:'飛', K:'王'
  };
  return promoted? '成'+names[base]:names[base];
}

function getCell(r,c) {
  return boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function onDragStart(e) {
  const piece = e.target.dataset.piece;
  const r = e.target.dataset.row;
  const c = e.target.dataset.col;
  const moves = legalMoves(r,c,piece);
  showMoveHighlights(moves);
  e.dataTransfer.setData('text/plain', JSON.stringify({piece,r,c,moves}));
}

boardEl.addEventListener('dragover', e => e.preventDefault());
boardEl.addEventListener('drop', onDrop);

function onDrop(e) {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
  const cell = e.target.closest('.cell');
  if(!cell) return;
  const rTo = parseInt(cell.dataset.row);
  const cTo = parseInt(cell.dataset.col);
  if(data.fromHand){
    if(turn==='sente'&&data.piece!==data.piece.toUpperCase()) return;
    if(turn==='gote'&&data.piece!==data.piece.toLowerCase()) return;
    if(board[rTo][cTo]) return;
    moveHistory.push(JSON.stringify({board:board,turn:turn}));
    board[rTo][cTo]=data.piece;
    if(draggingHand) draggingHand.remove();
    draggingHand=null;
    turn=turn==='sente'?'gote':'sente';
    updateTurnDisplay();
    renderBoard();
  }else{
    if (!data.moves.some(m=>m[0]==rTo&&m[1]==cTo)) {
      clearHighlights();
      return;
    }
    makeMove(parseInt(data.r),parseInt(data.c),rTo,cTo);
    clearHighlights();
  }
}

function showMoves(r,c){
  const p = board[r][c];
  if (!p) return;
  const moves = legalMoves(r,c,p);
  showMoveHighlights(moves);
}

function showMoveHighlights(moves){
  clearHighlights();
  moves.forEach(m=>{
    const cell = getCell(m[0],m[1]);
    cell.classList.add('highlight');
  });
}

function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function legalMoves(r,c,p){
  const dirs = {
    p: [[1,0]],
    P: [[-1,0]],
    l: Array.from({length:8},(_,i)=>[i+1,0]),
    L: Array.from({length:8},(_,i)=>[-(i+1),0]),
    n: [[2,-1],[2,1]],
    N: [[-2,-1],[-2,1]],
    s: [[1,-1],[1,0],[1,1],[-1,-1],[-1,1]],
    S: [[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]],
    g: [[1,-1],[1,0],[1,1],[0,-1],[0,1],[-1,0]],
    G: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
    b: [[1,1],[1,-1],[-1,1],[-1,-1]],
    B: [[1,1],[1,-1],[-1,1],[-1,-1]],
    r: [[1,0],[-1,0],[0,1],[0,-1]],
    R: [[1,0],[-1,0],[0,1],[0,-1]],
    k: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
    K: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
  };
  const slidePieces=['l','L','b','B','r','R'];
  const moves=[];
  const isSente = p === p.toUpperCase();
  dirs[p.replace('+','')]?.forEach(d=>{
    let [dr,dc]=d;
    if(!isSente){dr=-dr;dc=-dc;}
    let nr=parseInt(r)+dr,nc=parseInt(c)+dc;
    while(nr>=0&&nr<9&&nc>=0&&nc<9){
      const target=board[nr][nc];
      if(target){
        if((isSente && target===target.toLowerCase())||(!isSente&&target===target.toUpperCase())){
          moves.push([nr,nc]);
        }
        break;
      }else{
        moves.push([nr,nc]);
        if(!slidePieces.includes(p.replace('+',''))) break;
        nr+=dr;nc+=dc;
      }
    }
  });
  return moves;
}

function makeMove(rFrom,cFrom,rTo,cTo){
  const piece = board[rFrom][cFrom];
  let captured = board[rTo][cTo];
  moveHistory.push(JSON.stringify({board:board,turn:turn}));
  board[rFrom][cFrom]=null;
  board[rTo][cTo]=piece;
  if(captured){
    if(captured.includes('+')) captured=captured.replace('+','');
    if(turn==='sente'){
      capturedSente.appendChild(createCapturedPiece(captured.toUpperCase()));
    }else{
      capturedGote.appendChild(createCapturedPiece(captured.toLowerCase()));
    }
  }
  if(shouldPromote(piece,rFrom,rTo,turn)){
    if(confirm('成りますか？')){
      board[rTo][cTo]='+'+piece;
    }
  }
  if(isKingCaptured()){
    alert('勝利！');
    initBoard();
    return;
  }
  turn = turn==='sente'?'gote':'sente';
  updateTurnDisplay();
  renderBoard();
}

function renderBoard(){
  for (let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      renderPiece(r,c);
    }
  }
}

function createCapturedPiece(p){
  const el=document.createElement('div');
  el.textContent=pieceName(p);
  el.className='piece';
  el.draggable=true;
  el.dataset.piece=p;
  el.addEventListener('dragstart',e=>{
    draggingHand = el;
    e.dataTransfer.setData('text/plain', JSON.stringify({fromHand:true,piece:p}));
  });
  return el;
}

function shouldPromote(piece,rFrom,rTo,side){
  const zone = side==='sente'? [0,1,2] : [6,7,8];
  const isInZone = zone.includes(parseInt(rFrom)) || zone.includes(parseInt(rTo));
  const promotable = ['p','l','n','s','b','r','P','L','N','S','B','R'];
  return isInZone && promotable.includes(piece);
}


function isKingCaptured(){
  let hasSenteK=false,hasGoteK=false;
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(board[r][c]==='K') hasSenteK=true;
      if(board[r][c]==='k') hasGoteK=true;
    }
  }
  return !(hasSenteK&&hasGoteK);
}

function updateTurnDisplay(){
  turnEl.textContent='手番: '+(turn==='sente'?'先手':'後手');
}

undoBtn.addEventListener('click', ()=>{
  const last=moveHistory.pop();
  if(!last) return;
  const state=JSON.parse(last);
  board=state.board;
  turn=state.turn;
  renderBoard();
  updateTurnDisplay();
});

initBoard();
