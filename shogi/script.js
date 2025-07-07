const boardElement = document.getElementById('board');
const messageElement = document.getElementById('message');
const undoBtn = document.getElementById('undo');

const PIECE_VALUES = { K: 10000, R: 9, B: 8, G: 7, S: 5, N: 3, L: 3, P: 1 };

let board = [];
let history = [];
let currentPlayer = 'P'; // P: player, C: computer

function initBoard() {
  board = [
    ['C','LN','KN','SN','GN','K','GN','SN','LN'],
    ['C',null,'R','C','C','C','B',null,'C'],
    ['C','P','P','P','P','P','P','P','P'],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    ['P','p','p','p','p','p','p','p','p'],
    ['P',null,'b','P','P','P','r',null,'P'],
    ['P','l','n','s','g','k','g','s','l'],
  ];
}

function renderBoard() {
  boardElement.innerHTML = '';
  for (let y = 0; y < 9; y++) {
    const row = document.createElement('div');
    row.className = 'board-row';
    for (let x = 0; x < 9; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      const piece = board[y][x];
      if (piece) cell.textContent = piece;
      cell.addEventListener('mousedown', onMouseDown);
      row.appendChild(cell);
    }
    boardElement.appendChild(row);
  }
}

let dragPiece = null;
let dragFrom = null;

function onMouseDown(e) {
  const x = parseInt(e.target.dataset.x);
  const y = parseInt(e.target.dataset.y);
  const piece = board[y][x];
  if (!piece) return;
  if ((currentPlayer === 'P' && piece === piece.toLowerCase()) ||
      (currentPlayer === 'C' && piece === piece.toUpperCase())) return;

  dragPiece = piece;
  dragFrom = {x, y};
  highlightMoves(x, y, piece);
  document.addEventListener('mouseup', onMouseUp);
}

function highlightMoves(x, y, piece) {
  clearHighlights();
  const moves = getLegalMoves(x, y, piece);
  moves.forEach(m => {
    const cell = getCell(m.x, m.y);
    cell.classList.add('highlight');
  });
}

function clearHighlights() {
  document.querySelectorAll('.highlight').forEach(c => c.classList.remove('highlight'));
}

function onMouseUp(e) {
  clearHighlights();
  document.removeEventListener('mouseup', onMouseUp);
  if (!dragPiece) return;
  const x = parseInt(e.target.dataset.x);
  const y = parseInt(e.target.dataset.y);
  const moves = getLegalMoves(dragFrom.x, dragFrom.y, dragPiece);
  if (moves.some(m => m.x === x && m.y === y)) {
    history.push(JSON.stringify(board));
    board[dragFrom.y][dragFrom.x] = null;
    board[y][x] = dragPiece;
    renderBoard();
    dragPiece = null;
    dragFrom = null;
    switchTurn();
  } else {
    dragPiece = null;
    dragFrom = null;
  }
}

function switchTurn() {
  if (currentPlayer === 'P') {
    currentPlayer = 'C';
    message('考え中...');
    setTimeout(computerMove, 500);
  } else {
    currentPlayer = 'P';
    message('あなたの番');
  }
}

function message(text) {
  messageElement.textContent = text;
}

function getCell(x, y) {
  return boardElement.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function getLegalMoves(x, y, piece) {
  const moves = [];
  const isPlayer = piece === piece.toLowerCase();
  const dir = isPlayer ? -1 : 1; // player moves up
  const lower = piece.toLowerCase();
  if (lower === 'p') {
    const ny = y + dir;
    if (ny >= 0 && ny < 9 && !board[ny][x]) moves.push({x, y: ny});
  } else if (lower === 'k') {
    const dirs = [
      {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},
      {x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1}
    ];
    dirs.forEach(d => {
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx>=0&&nx<9&&ny>=0&&ny<9) moves.push({x:nx,y:ny});
    });
  }
  // minimal for other pieces omitted
  return moves;
}

function computerMove() {
  const moves = [];
  for (let y=0;y<9;y++) for (let x=0;x<9;x++) {
    const piece = board[y][x];
    if (piece && piece === piece.toUpperCase()) {
      const legal = getLegalMoves(x, y, piece);
      legal.forEach(m => moves.push({from:{x,y}, to:m, piece}));
    }
  }
  if (moves.length === 0) {
    message('あなたの勝ち!');
    setTimeout(resetGame, 1000);
    return;
  }
  let best = null;
  let bestScore = -Infinity;
  moves.forEach(m => {
    const captured = board[m.to.y][m.to.x];
    const score = captured ? PIECE_VALUES[captured.toUpperCase()] : 0;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  });
  if (!best) best = moves[Math.floor(Math.random()*moves.length)];
  history.push(JSON.stringify(board));
  board[best.from.y][best.from.x] = null;
  board[best.to.y][best.to.x] = best.piece;
  renderBoard();
  currentPlayer = 'P';
  message('あなたの番');
}

function resetGame() {
  initBoard();
  history = [];
  currentPlayer = 'P';
  renderBoard();
  message('新しい対局を開始');
}

undoBtn.addEventListener('click', () => {
  if (history.length > 0) {
    board = JSON.parse(history.pop());
    renderBoard();
    currentPlayer = currentPlayer === 'P' ? 'C' : 'P';
    if (currentPlayer === 'C') {
      message('考え中...');
      setTimeout(computerMove, 500);
    } else {
      message('あなたの番');
    }
  }
});

resetGame();
