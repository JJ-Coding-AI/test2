const boardEl = document.getElementById('board');
const turnText = document.getElementById('turnText');
const undoBtn = document.getElementById('undo');
const handBlackEl = document.getElementById('hand-black');
const handWhiteEl = document.getElementById('hand-white');

const shogi = new Shogi();
const history = [];

function opposite(color) {
  return color === Shogi.Color.Black ? Shogi.Color.White : Shogi.Color.Black;
}

function pieceChar(kind, promoted=false) {
  // mapping from Kind to Kanji character
  return Shogi.kindToString(kind, true);
}

function render() {
  boardEl.innerHTML = '';
  for (let y = 1; y <= 9; y++) {
    for (let x = 9; x >= 1; x--) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.addEventListener('dragover', e => e.preventDefault());
      cell.addEventListener('drop', onDrop);
      const piece = shogi.get(x, y);
      if (piece) {
        const pEl = document.createElement('div');
        pEl.className = 'piece ' + (piece.color === Shogi.Color.White ? 'white' : '');
        pEl.textContent = pieceChar(piece.kind);
        pEl.draggable = true;
        pEl.dataset.x = x;
        pEl.dataset.y = y;
        pEl.addEventListener('dragstart', onDragStart);
        cell.appendChild(pEl);
      }
      boardEl.appendChild(cell);
    }
  }
  renderHands();
  turnText.textContent = Shogi.colorToString(shogi.turn);
}

function renderHands() {
  handBlackEl.innerHTML = '';
  handWhiteEl.innerHTML = '';
  [Shogi.Color.Black, Shogi.Color.White].forEach(color => {
    const handEl = color === Shogi.Color.Black ? handBlackEl : handWhiteEl;
    for (const piece of shogi.hands[color]) {
      const pEl = document.createElement('div');
      pEl.className = 'hand-piece ' + (color === Shogi.Color.White ? 'white' : '');
      pEl.textContent = pieceChar(piece.kind);
      pEl.draggable = true;
      pEl.dataset.kind = piece.kind;
      pEl.dataset.color = color;
      pEl.addEventListener('dragstart', onHandDragStart);
      handEl.appendChild(pEl);
    }
  });
}

function onDragStart(e) {
  const x = e.target.dataset.x;
  const y = e.target.dataset.y;
  e.dataTransfer.setData('text/plain', JSON.stringify({type:'move', x, y}));
  highlightMoves(x, y);
}

function onHandDragStart(e) {
  const kind = e.target.dataset.kind;
  const color = Number(e.target.dataset.color);
  e.dataTransfer.setData('text/plain', JSON.stringify({type:'drop', kind, color}));
}

function clearHighlights() {
  document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
}

function highlightMoves(x, y) {
  clearHighlights();
  const moves = shogi.getMovesFrom(Number(x), Number(y));
  moves.forEach(m => {
    const sel = `.cell[data-x="${m.to.x}"][data-y="${m.to.y}"]`;
    const cell = document.querySelector(sel);
    if (cell) cell.classList.add('highlight');
  });
}

function onDrop(e) {
  e.preventDefault();
  clearHighlights();
  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
  const toX = Number(e.currentTarget.dataset.x);
  const toY = Number(e.currentTarget.dataset.y);
  if (data.type === 'move') {
    const fromX = Number(data.x);
    const fromY = Number(data.y);
    const piece = shogi.get(fromX, fromY);
    const promoteZone = piece.color === Shogi.Color.Black ? [7,8,9] : [1,2,3];
    let promote = false;
    if (Shogi.Piece.canPromote(piece.kind) &&
        (promoteZone.includes(fromY) || promoteZone.includes(toY))) {
      promote = confirm('Promote?');
    }
    history.push(shogi.toSFENString());
    try {
      shogi.move(fromX, fromY, toX, toY, promote);
    } catch(err) {
      alert(err);
      history.pop();
      return;
    }
  } else if (data.type === 'drop') {
    const kind = data.kind;
    const color = Number(data.color);
    history.push(shogi.toSFENString());
    try {
      shogi.drop(toX, toY, kind, color);
    } catch(err) {
      alert(err);
      history.pop();
      return;
    }
  }
  render();
  checkWin();
  setTimeout(aiMove, 200);
}

function checkWin() {
  const hasBlackKing = hasKing(Shogi.Color.Black);
  const hasWhiteKing = hasKing(Shogi.Color.White);
  if (!hasWhiteKing) {
    alert('先手の勝ち');
    reset();
  } else if (!hasBlackKing) {
    alert('後手の勝ち');
    reset();
  }
}

function hasKing(color) {
  for (let x=1;x<=9;x++){
    for (let y=1;y<=9;y++){
      const p=shogi.get(x,y);
      if(p && p.kind==='OU' && p.color===color) return true;
    }
  }
  return false;
}

function reset() {
  shogi.initialize();
  history.length = 0;
  render();
}

undoBtn.addEventListener('click', () => {
  const prev = history.pop();
  if (prev) {
    shogi.initializeFromSFENString(prev);
    render();
  }
});

// --- AI ---
function aiMove() {
  const aiColor = shogi.turn;
  const move = search(shogi, 3, aiColor).move;
  if (!move) return;
  history.push(shogi.toSFENString());
  if (move.drop) {
    shogi.drop(move.to.x, move.to.y, move.kind, aiColor);
  } else {
    shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
  }
  render();
  checkWin();
}

const PIECE_VALUE = {
  FU: 1,
  KY: 3,
  KE: 3,
  GI: 4,
  KI: 5,
  KA: 8,
  HI: 9,
  OU: 1000,
  TO: 2,
  NY: 4,
  NK: 4,
  NG: 5,
  UM: 9,
  RY: 10
};

function evaluate(board) {
  let score = 0;
  for (let x=1;x<=9;x++){
    for (let y=1;y<=9;y++){
      const p = board.get(x,y);
      if (!p) continue;
      const value = PIECE_VALUE[p.kind] || 0;
      score += (p.color===Shogi.Color.Black ? value : -value);
    }
  }
  for (const p of board.hands[Shogi.Color.Black]) {
    score += PIECE_VALUE[p.kind] || 0;
  }
  for (const p of board.hands[Shogi.Color.White]) {
    score -= PIECE_VALUE[p.kind] || 0;
  }
  return score;
}

function clone(board) {
  const copy = new Shogi();
  copy.initializeFromSFENString(board.toSFENString());
  return copy;
}

function generateMoves(board, color) {
  const moves = [];
  for (let x=1;x<=9;x++){
    for (let y=1;y<=9;y++){
      const piece = board.get(x,y);
      if (!piece || piece.color!==color) continue;
      for (const m of board.getMovesFrom(x,y)) {
        const move = {from:{x,y}, to:m.to, promote:false, drop:false};
        const promZone = color === Shogi.Color.Black ? [7,8,9] : [1,2,3];
        if (Shogi.Piece.canPromote(piece.kind) && (promZone.includes(y) || promZone.includes(m.to.y))) {
          moves.push({...move, promote:false});
          moves.push({...move, promote:true});
        } else {
          moves.push(move);
        }
      }
    }
  }
  for (const m of board.getDropsBy(color)) {
    moves.push({drop:true, kind:m.kind, to:m.to});
  }
  // filter illegal (self-check)
  return moves.filter(move => {
    const b = clone(board);
    try {
      if (move.drop) {
        b.drop(move.to.x, move.to.y, move.kind, color);
      } else {
        b.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
      }
    } catch(err) { return false; }
    return !b.isCheck(color);
  });
}

function search(board, depth, color) {
  if (depth === 0) return {score:evaluate(board)};
  const moves = generateMoves(board, color);
  if (moves.length === 0) {
    const score = board.isCheck(color) ? -Infinity : 0;
    return {score};
  }
  let bestMove = null;
  let bestScore = color===Shogi.Color.Black ? -Infinity : Infinity;
  for (const m of moves) {
    const b = clone(board);
    if (m.drop) {
      b.drop(m.to.x, m.to.y, m.kind, color);
    } else {
      b.move(m.from.x, m.from.y, m.to.x, m.to.y, m.promote);
    }
    const res = search(b, depth-1, opposite(color));
    if (color===Shogi.Color.Black) {
      if (res.score > bestScore) { bestScore = res.score; bestMove = m; }
    } else {
      if (res.score < bestScore) { bestScore = res.score; bestMove = m; }
    }
  }
  return {score:bestScore, move:bestMove};
}

reset();
