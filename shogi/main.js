const boardElem = document.getElementById('board');
const statusElem = document.getElementById('status');
const undoButton = document.getElementById('undoButton');
const blackHandElem = document.getElementById('black-hand');
const whiteHandElem = document.getElementById('white-hand');

let board = [];
let moveHistory = [];
let hands = { black: [], white: [] };
let turn = 'black';
let selected = null;
let aiThinking = false;

function initBoard() {
  board = [];
  for (let y = 0; y < 9; y++) {
    const row = [];
    for (let x = 0; x < 9; x++) {
      row.push(null);
    }
    board.push(row);
  }
  // kings
  board[0][4] = { type: 'OU', player: 'white' };
  board[8][4] = { type: 'OU', player: 'black' };
  // pawns
  for (let x = 0; x < 9; x++) {
    board[2][x] = { type: 'FU', player: 'white' };
    board[6][x] = { type: 'FU', player: 'black' };
  }
  hands = { black: [], white: [] };
  moveHistory = [];
  turn = 'black';
  aiThinking = false;
  render();
  statusElem.textContent = '先手の番です';
}

function render() {
  boardElem.innerHTML = '';
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      const piece = board[y][x];
      if (piece) {
        const div = document.createElement('div');
        div.className = 'piece ' + piece.player;
        div.textContent = piece.type === 'OU' ? '王' : '歩';
        cell.appendChild(div);
      }
      cell.addEventListener('click', () => onCellClick(x, y));
      boardElem.appendChild(cell);
    }
  }
  renderHands();
}

function renderHands() {
  function renderHand(handElem, pieces, player) {
    handElem.innerHTML = '<h2>' + (player === 'black' ? '先手' : '後手') + 'の持ち駒</h2>';
    pieces.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'piece ' + player;
      div.textContent = p.type === 'OU' ? '王' : '歩';
      div.addEventListener('click', () => onHandClick(player, idx));
      handElem.appendChild(div);
    });
  }
  renderHand(blackHandElem, hands.black, 'black');
  renderHand(whiteHandElem, hands.white, 'white');
}

function onCellClick(x, y) {
  if (aiThinking) return;
  const piece = board[y][x];
  if (selected) {
    if (selected.fromHand) {
      if (!piece) {
        board[y][x] = { type: selected.piece.type, player: turn };
        hands[turn].splice(selected.handIdx, 1);
        moveHistory.push(JSON.stringify({ board, hands, turn }));
        selected = null;
        render();
        checkWin();
        switchTurn();
        if (turn === 'white') aiMove();
      } else {
        selected = null;
        render();
      }
    } else {
      const moves = legalMoves(selected.piece, selected.x, selected.y);
      if (moves.some(m => m.x === x && m.y === y)) {
        movePiece(selected.x, selected.y, x, y);
        selected = null;
        render();
        checkWin();
        switchTurn();
        if (turn === 'white') aiMove();
      } else {
        selected = null;
        render();
      }
    }
  } else if (piece && piece.player === turn) {
    selected = { piece, x, y };
    highlightMoves(legalMoves(piece, x, y));
  }
}

function onHandClick(player, idx) {
  if (aiThinking) return;
  if (turn !== player) return;
  const piece = hands[player][idx];
  selected = { piece, fromHand: true, handIdx: idx };
  const moves = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      if (!board[y][x]) moves.push({ x, y });
    }
  }
  highlightMoves(moves);
}

function highlightMoves(moves) {
  render();
  moves.forEach(m => {
    const selector = `.cell[data-x="${m.x}"][data-y="${m.y}"]`;
    const cell = document.querySelector(selector);
    if (cell) cell.classList.add('highlight');
  });
}

function legalMoves(piece, x, y) {
  const moves = [];
  const dir = piece.player === 'black' ? -1 : 1;
  if (piece.type === 'FU') {
    const ny = y + dir;
    if (ny >= 0 && ny < 9 && !board[ny][x]) {
      moves.push({ x, y: ny });
    }
    if (board[ny] && board[ny][x] && board[ny][x].player !== piece.player) {
      moves.push({ x, y: ny });
    }
  } else if (piece.type === 'OU') {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
          if (!board[ny][nx] || board[ny][nx].player !== piece.player) {
            moves.push({ x: nx, y: ny });
          }
        }
      }
    }
  }
  return moves;
}

function movePiece(sx, sy, tx, ty) {
  const piece = board[sy][sx];
  const target = board[ty][tx];
  if (target) {
    hands[piece.player].push({ type: target.type, player: piece.player });
  }
  board[ty][tx] = piece;
  board[sy][sx] = null;
  moveHistory.push(JSON.stringify({ board, hands, turn }));
}

function checkWin() {
  let blackKing = false;
  let whiteKing = false;
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && p.type === 'OU') {
        if (p.player === 'black') blackKing = true;
        else whiteKing = true;
      }
    }
  }
  if (!blackKing || !whiteKing) {
    alert((blackKing ? '先手' : '後手') + 'の勝ちです');
    initBoard();
  }
}

function switchTurn() {
  turn = turn === 'black' ? 'white' : 'black';
  statusElem.textContent = turn === 'black' ? '先手の番です' : '後手の番です';
}

function aiMove() {
  aiThinking = true;
  statusElem.textContent = '考え中...';
  setTimeout(() => {
    const moves = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = board[y][x];
        if (p && p.player === 'white') {
          const ms = legalMoves(p, x, y);
          ms.forEach(m => moves.push({ sx: x, sy: y, tx: m.x, ty: m.y }));
        }
      }
    }
    if (moves.length === 0) {
      alert('先手の勝ちです');
      initBoard();
      return;
    }
    const m = moves[Math.floor(Math.random() * moves.length)];
    movePiece(m.sx, m.sy, m.tx, m.ty);
    render();
    checkWin();
    switchTurn();
    aiThinking = false;
  }, 500);
}

undoButton.addEventListener('click', () => {
  if (moveHistory.length > 0) {
    const last = moveHistory.pop();
    const state = JSON.parse(last);
    board = state.board;
    hands = state.hands;
    turn = state.turn;
    render();
    statusElem.textContent = turn === 'black' ? '先手の番です' : '後手の番です';
  }
});

initBoard();
