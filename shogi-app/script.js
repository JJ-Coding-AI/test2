const boardElement = document.getElementById('board');
const messageElement = document.getElementById('message');
const undoButton = document.getElementById('undo');
const capturedPlayerElement = document.getElementById('captured-player');
const capturedAIElement = document.getElementById('captured-ai');

let board = [];
let capturedPlayer = [];
let capturedAI = [];
let history = [];
let currentPlayer = 'player';
let draggingPiece = null;
let dragStart = null;
let fromCaptured = false;

const initialBoard = [
  ['l','n','s','g','k','g','s','n','l'],
  ['','r','','','','','','b',''],
  ['p','p','p','p','p','p','p','p','p'],
  ['','','','','','','','',''],
  ['','','','','','','','',''],
  ['','','','','','','','',''],
  ['P','P','P','P','P','P','P','P','P'],
  ['','B','','','','','','R',''],
  ['L','N','S','G','K','G','S','N','L']
];

function setupBoard() {
  board = JSON.parse(JSON.stringify(initialBoard));
  capturedPlayer = [];
  capturedAI = [];
  history = [];
  currentPlayer = 'player';
  render();
  messageElement.textContent = 'あなたの番です';
}

function render() {
  boardElement.innerHTML = '';
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const square = document.createElement('div');
      square.className = 'square' + ((x+y)%2?' dark':'');
      square.dataset.x = x;
      square.dataset.y = y;
      const piece = board[y][x];
      if (piece) {
        const p = document.createElement('div');
        p.className = 'piece';
        p.textContent = piece;
        p.draggable = currentPlayer==='player';
        p.addEventListener('dragstart', onDragStart);
        square.appendChild(p);
      }
      square.addEventListener('dragover', onDragOver);
      square.addEventListener('drop', onDrop);
      boardElement.appendChild(square);
    }
  }
  renderCaptured(capturedPlayer, capturedPlayerElement, true);
  renderCaptured(capturedAI, capturedAIElement, false);
}

function renderCaptured(list, element, isPlayer) {
  element.innerHTML = (isPlayer?'あなた':'AI') + 'の持ち駒: ';
  list.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'piece';
    d.textContent = p;
    if (isPlayer && currentPlayer==='player') {
      d.draggable = true;
      d.dataset.index = i;
      d.addEventListener('dragstart', (e)=>{
        draggingPiece = p;
        fromCaptured = true;
        dragStart = i;
      });
    }
    element.appendChild(d);
  });
}

function onDragStart(e) {
  draggingPiece = e.target.textContent;
  dragStart = {x: e.target.parentElement.dataset.x, y: e.target.parentElement.dataset.y};
  fromCaptured = false;
  highlightMoves(parseInt(dragStart.x), parseInt(dragStart.y));
}

function highlightMoves(x, y) {
  clearHighlights();
  const moves = getMoves(x, y);
  moves.forEach(m => {
    const sel = document.querySelector(`.square[data-x="${m.toX}"][data-y="${m.toY}"]`);
    if (sel) sel.classList.add('highlight');
  });
}

function clearHighlights() {
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function onDragOver(e) {
  e.preventDefault();
}

function onDrop(e) {
  e.preventDefault();
  const toX = parseInt(e.target.dataset.x);
  const toY = parseInt(e.target.dataset.y);
  if (fromCaptured) {
    const idx = dragStart;
    const list = currentPlayer==='player'?capturedPlayer:capturedAI;
    const piece = list.splice(idx,1)[0];
    if (!board[toY][toX]) {
      board[toY][toX] = currentPlayer==='player'?piece.toUpperCase():piece.toLowerCase();
      history.push(JSON.stringify({board,capturedPlayer,capturedAI}));
      currentPlayer = currentPlayer==='player'?'ai':'player';
      clearHighlights();
      render();
      if (currentPlayer==='ai') { messageElement.textContent='AI考え中...'; setTimeout(aiMove,500); }
      else messageElement.textContent='あなたの番です';
    } else {
      list.splice(idx,0,piece);
    }
  } else if (draggingPiece) {
    movePiece(dragStart.x, dragStart.y, toX, toY);
  }
  draggingPiece=null;
  fromCaptured=false;
  clearHighlights();
}

function movePiece(fromX, fromY, toX, toY) {
  fromX=parseInt(fromX);fromY=parseInt(fromY);toX=parseInt(toX);toY=parseInt(toY);
  const piece = board[fromY][fromX];
  const valid = getMoves(fromX, fromY).some(m=>m.toX===toX&&m.toY===toY);
  if (!valid) return;
  history.push(JSON.stringify({board,capturedPlayer,capturedAI}));
  let target = board[toY][toX];
  if (target) {
    if (target === 'K') { alert('あなたの勝ち!'); setupBoard(); return; }
    if (target === 'k') { alert('AIの勝ち!'); setupBoard(); return; }
    if (currentPlayer==='player') capturedPlayer.push(target.toUpperCase().replace('+',''));
    else capturedAI.push(target.toLowerCase().replace('+',''));
  }
  board[toY][toX] = piece;
  board[fromY][fromX] = '';
  // promotion
  if (shouldPromote(piece, toY, fromY)) {
    if (currentPlayer==='player') {
      if (confirm('成りますか?')) board[toY][toX] = '+'+piece.toUpperCase();
    } else {
      board[toY][toX] = '+'+piece.toLowerCase();
    }
  }
  currentPlayer = currentPlayer==='player'?'ai':'player';
  clearHighlights();
  render();
  if (currentPlayer==='ai') { messageElement.textContent='AI考え中...'; setTimeout(aiMove,500); }
  else messageElement.textContent='あなたの番です';
}

function shouldPromote(piece, toY, fromY) {
  const zone = currentPlayer==='player' ? toY<=2||fromY<=2 : toY>=6||fromY>=6;
  if (!zone) return false;
  const p = piece.toUpperCase().replace('+','');
  return ['P','L','N','S','B','R'].includes(p);
}

function getMoves(x, y) {
  const piece = board[y][x];
  if (!piece) return [];
  const isPlayer = piece===piece.toUpperCase();
  const p = piece.toUpperCase().replace('+','');
  const dirs = [];
  const moves = [];
  const forward = isPlayer? -1 : 1;
  switch(p) {
    case 'P': dirs.push([0,forward]); break;
    case 'L': dirs.push([0,forward,true]); break;
    case 'N': dirs.push([1,2*forward],[-1,2*forward]); break;
    case 'S': dirs.push([0,forward],[1,forward],[-1,forward],[1,-forward],[-1,-forward]); break;
    case 'G': dirs.push([0,forward],[1,0],[-1,0],[0,-forward],[1,forward],[-1,forward]); break;
    case 'B': dirs.push([1,1,true],[1,-1,true],[-1,1,true],[-1,-1,true]); break;
    case 'R': dirs.push([1,0,true],[-1,0,true],[0,1,true],[0,-1,true]); break;
    case 'K': dirs.push([1,1],[1,0],[1,-1],[-1,1],[-1,0],[-1,-1],[0,1],[0,-1]); break;
  }
  if (piece.startsWith('+') && p!=='B' && p!=='R') {
    dirs.length=0;
    dirs.push([0,forward],[1,0],[-1,0],[0,-forward],[1,forward],[-1,forward]);
  } else if (piece.startsWith('+') && (p==='B'||p==='R')) {
    if (p==='B') dirs.push([1,0,true],[-1,0,true],[0,1,true],[0,-1,true]);
    if (p==='R') dirs.push([1,1,true],[1,-1,true],[-1,1,true],[-1,-1,true]);
  }
  for(const d of dirs) {
    let nx=x+ d[0], ny=y+d[1];
    while(nx>=0&&nx<9&&ny>=0&&ny<9) {
      const target=board[ny][nx];
      if (!target || (isPlayer && target===target.toLowerCase()) || (!isPlayer && target===target.toUpperCase())) {
        moves.push({toX:nx,toY:ny});
      }
      if (target) break;
      if (!d[2]) break;
      nx+=d[0]; ny+=d[1];
    }
  }
  return moves;
}

function aiMove() {
  const moves = [];
  for (let y=0;y<9;y++) for(let x=0;x<9;x++) {
    const piece = board[y][x];
    if (piece && piece===piece.toLowerCase()) {
      const ms = getMoves(x,y);
      ms.forEach(m=>moves.push({fromX:x,fromY:y,toX:m.toX,toY:m.toY}));
    }
  }
  if (moves.length===0) { alert('AIに指し手がありません。あなたの勝ち!'); setupBoard(); return; }
  const m = moves[Math.floor(Math.random()*moves.length)];
  movePiece(m.fromX,m.fromY,m.toX,m.toY);
}

undoButton.addEventListener('click', () => {
  const prev = history.pop();
  if (prev) {
    const state = JSON.parse(prev);
    board = state.board;
    capturedPlayer = state.capturedPlayer;
    capturedAI = state.capturedAI;
    currentPlayer = 'player';
    render();
    messageElement.textContent = 'あなたの番です';
  }
});

setupBoard();
