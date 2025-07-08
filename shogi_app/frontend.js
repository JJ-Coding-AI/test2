// 将棋盤と駒の管理を行うフロントエンドスクリプト

let socket;
let boardEl = document.getElementById('board');
let turnEl = document.getElementById('turn');
let spinnerEl = document.getElementById('spinner');
let levelSelect = document.getElementById('level');
let undoBtn = document.getElementById('undo');
let downloadBtn = document.getElementById('download');
let legalMoves = {}; // { from: [to1, to2, ...] }

/** ボード初期化 */
function initBoard() {
  boardEl.innerHTML = '';
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.pos = `${9 - x}${y + 1}`; // 例: 77
      cell.addEventListener('dragover', ev => ev.preventDefault());
      cell.addEventListener('drop', onDrop);
      boardEl.appendChild(cell);
    }
  }
}

/** 駒要素生成 */
function createPiece(piece) {
  const div = document.createElement('div');
  div.className = 'piece';
  div.textContent = piece.label;
  div.draggable = true;
  div.dataset.from = piece.from;
  div.addEventListener('dragstart', onDragStart);
  return div;
}

/** 盤面更新 */
function renderBoard(state) {
  boardEl.querySelectorAll('.piece').forEach(p => p.remove());
  for (const cell of boardEl.children) {
    const pos = cell.dataset.pos;
    const piece = state.board[pos];
    if (piece) {
      const el = createPiece({ label: piece, from: pos });
      cell.appendChild(el);
    }
  }
  document.getElementById('hand_sente').innerHTML = '先手持ち駒:' + state.hands.sente.map(p => `<span class="hand-piece" draggable="true" data-from="hand_sente" data-piece="${p}">${p}</span>`).join('');
  document.getElementById('hand_gote').innerHTML = '後手持ち駒:' + state.hands.gote.map(p => `<span class="hand-piece" draggable="true" data-from="hand_gote" data-piece="${p}">${p}</span>`).join('');
  document.querySelectorAll('.hand-piece').forEach(el => {
    el.addEventListener('dragstart', onDragStart);
  });
  turnEl.textContent = state.turn === 'sente' ? 'あなたの手番' : 'AIの手番';
  legalMoves = state.legal_moves;
  spinnerEl.hidden = true;
}

function onDragStart(ev) {
  const from = ev.target.dataset.from;
  if (turnEl.textContent !== 'あなたの手番') {
    ev.preventDefault();
    return;
  }
  highlightMoves(from);
  ev.dataTransfer.setData('text/plain', from);
}

function onDrop(ev) {
  ev.preventDefault();
  const from = ev.dataTransfer.getData('text/plain');
  const to = ev.currentTarget.dataset.pos;
  sendMove(from, to);
  clearHighlights();
}

function highlightMoves(from) {
  clearHighlights();
  const moves = legalMoves[from] || [];
  for (const cell of boardEl.children) {
    if (moves.includes(cell.dataset.pos)) {
      cell.classList.add('highlight');
    }
  }
}

function clearHighlights() {
  boardEl.querySelectorAll('.highlight').forEach(c => c.classList.remove('highlight'));
}

function sendMove(from, to) {
  if (!socket) return;
  spinnerEl.hidden = false;
  socket.send(JSON.stringify({ type: 'move', from, to }));
}

function connect() {
  socket = new WebSocket(`ws://${location.host}/ws`);
  socket.onmessage = ev => {
    const data = JSON.parse(ev.data);
    if (data.type === 'state') {
      renderBoard(data.state);
    } else if (data.type === 'kif') {
      const url = URL.createObjectURL(new Blob([data.kif], { type: 'text/plain' }));
      downloadBtn.href = url;
      downloadBtn.download = 'game.kif';
    }
  };
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'level', level: levelSelect.value }));
  };
}

undoBtn.onclick = () => {
  socket.send(JSON.stringify({ type: 'undo' }));
};

downloadBtn.onclick = () => {
  socket.send(JSON.stringify({ type: 'kif' }));
};

levelSelect.onchange = () => {
  socket.send(JSON.stringify({ type: 'level', level: levelSelect.value }));
};

initBoard();
connect();
