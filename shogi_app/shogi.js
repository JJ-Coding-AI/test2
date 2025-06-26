const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const handBEl = document.getElementById('handB');
const handWEl = document.getElementById('handW');
const undoBtn = document.getElementById('undo');

let history = [];
let board, hands, turn;

const PIECES = {
  K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩',
  R2: '龍', B2: '馬', S2: '全', N2: '圭', L2: '杏', P2: 'と'
};

function init() {
  board = Array.from({ length: 9 }, () => Array(9).fill(null));
  hands = { B: [], W: [] };
  turn = 'B';
  // Initial pieces
  const setup = [
    ['L','N','S','G','K','G','S','N','L'],
    [null,'B',null,null,null,null,null,'R',null],
    ['P','P','P','P','P','P','P','P','P']
  ];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (r < 3) {
        const type = setup[r] ? setup[r][c] : null;
        if (type) board[r][c] = { type, color: 'W', p: false };
      } else if (r > 5) {
        const type = setup[8 - r] ? setup[8 - r][c] : null;
        if (type) board[r][c] = { type, color: 'B', p: false };
      }
    }
  }
  history = [];
  render();
}

function cloneState() {
  return {
    board: board.map(row => row.map(p => p ? { ...p } : null)),
    hands: { B: hands.B.map(p => ({ ...p })), W: hands.W.map(p => ({ ...p })) },
    turn
  };
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('dragover', ev => ev.preventDefault());
      cell.addEventListener('drop', drop);
      const piece = board[r][c];
      if (piece) {
        const div = createPieceEl(piece, r, c);
        cell.appendChild(div);
      }
      boardEl.appendChild(cell);
    }
  }
  renderHands();
  turnEl.textContent = turn === 'B' ? '先手の番です' : '後手の番です';
}

function renderHands() {
  handBEl.innerHTML = '';
  handWEl.innerHTML = '';
  hands.B.forEach((p, i) => {
    const el = createPieceEl(p, null, null, 'B', i);
    handBEl.appendChild(el);
  });
  hands.W.forEach((p, i) => {
    const el = createPieceEl(p, null, null, 'W', i);
    handWEl.appendChild(el);
  });
}

function createPieceEl(piece, r, c, fromHand, index) {
  const div = document.createElement('div');
  div.className = 'piece' + (piece.color === 'W' ? ' white' : '');
  div.textContent = PIECES[piece.type + (piece.p ? '2' : '')] || PIECES[piece.type];
  div.draggable = true;
  div.dataset.row = r;
  div.dataset.col = c;
  if (fromHand) {
    div.dataset.hand = fromHand;
    div.dataset.index = index;
  }
  div.addEventListener('dragstart', drag);
  div.addEventListener('click', selectPiece);
  return div;
}

function drag(ev) {
  const r = ev.target.dataset.row;
  const c = ev.target.dataset.col;
  const hand = ev.target.dataset.hand;
  ev.dataTransfer.setData('text/plain', JSON.stringify({ r, c, hand, index: ev.target.dataset.index }));
}

function drop(ev) {
  ev.preventDefault();
  const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
  const toR = +ev.currentTarget.dataset.row;
  const toC = +ev.currentTarget.dataset.col;
  if (data.hand) {
    const piece = hands[data.hand][data.index];
    if (piece && data.hand === turn) {
      if (isLegalDrop(piece, toR, toC)) {
        history.push(cloneState());
        board[toR][toC] = { ...piece };
        hands[data.hand].splice(data.index, 1);
        if (mustPromote(piece, toR)) piece.p = true;
        finalizeMove(toR, toC);
      }
    }
  } else {
    const fromR = +data.r; const fromC = +data.c;
    const piece = board[fromR][fromC];
    if (piece && piece.color === turn) {
      if (isLegalMove(piece, fromR, fromC, toR, toC)) {
        history.push(cloneState());
        const captured = board[toR][toC];
        board[toR][toC] = piece;
        board[fromR][fromC] = null;
        if (captured) capturePiece(captured);
        if (canPromote(piece, fromR, toR) && confirm('成りますか？')) piece.p = true;
        if (mustPromote(piece, toR)) piece.p = true;
        finalizeMove(toR, toC);
      }
    }
  }
}

function finalizeMove(toR, toC) {
  if (board[toR][toC].type === 'K' && board[toR][toC].color !== turn) {
    alert(turn === 'B' ? '先手の勝ち!' : '後手の勝ち!');
    init();
    return;
  }
  turn = turn === 'B' ? 'W' : 'B';
  if (isCheck(turn)) {
    if (isCheckmate(turn)) alert('詰みです');
    else alert('王手!');
  }
  render();
}

function capturePiece(piece) {
  const copy = { type: piece.type, color: turn, p: false };
  if (piece.p) copy.type = baseType(piece.type); // remove promotion
  hands[turn].push(copy);
}

function baseType(type) {
  return type.replace('2', '');
}

function isLegalMove(piece, fr, fc, tr, tc) {
  if (fr === tr && fc === tc) return false;
  const moves = getMoves(piece, fr, fc, true);
  return moves.some(m => m[0] === tr && m[1] === tc);
}

function isLegalDrop(piece, r, c) {
  if (board[r][c]) return false;
  // pawn double rule
  if (piece.type === 'P') {
    for (let i = 0; i < 9; i++) {
      const p = board[i][c];
      if (p && p.color === piece.color && p.type === 'P' && !p.p) return false;
    }
    if ((piece.color === 'B' && r === 0) || (piece.color === 'W' && r === 8)) return false;
  }
  if (piece.type === 'L' && ((piece.color === 'B' && r === 0) || (piece.color === 'W' && r === 8))) return false;
  if (piece.type === 'N' && ((piece.color === 'B' && r <= 1) || (piece.color === 'W' && r >= 7))) return false;
  return true;
}

function canPromote(piece, fr, tr) {
  const zone = piece.color === 'B' ? 2 : 6;
  if (piece.type === 'K' || piece.type === 'G') return false;
  return (piece.color === 'B' ? fr <= zone || tr <= zone : fr >= zone || tr >= zone);
}

function mustPromote(piece, r) {
  if (piece.type === 'P' || piece.type === 'L') {
    return (piece.color === 'B' && r === 0) || (piece.color === 'W' && r === 8);
  }
  if (piece.type === 'N') {
    return (piece.color === 'B' && r <= 1) || (piece.color === 'W' && r >= 7);
  }
  return false;
}

function getMoves(piece, r, c, checkBlock) {
  const moves = [];
  const dir = piece.color === 'B' ? -1 : 1;
  const add = (dr, dc, repeat=false) => {
    let nr = r + dr, nc = c + dc;
    while (nr >=0 && nr<9 && nc>=0 && nc<9) {
      if (board[nr][nc]) {
        if (board[nr][nc].color !== piece.color) moves.push([nr,nc]);
        break;
      } else {
        moves.push([nr,nc]);
      }
      if (!repeat) break;
      nr += dr; nc += dc;
    }
  };
  const gold = () => {
    add(dir, -1); add(dir,0); add(dir,1); add(0,-1); add(0,1); add(-dir,0);
  };
  switch(piece.type) {
    case 'K':
      [-1,0,1].forEach(dr=>[-1,0,1].forEach(dc=>{if(dr||dc)add(dr,dc);}));
      break;
    case 'R':
      add(dir,0,true); add(-dir,0,true); add(0,1,true); add(0,-1,true); if(piece.p){add(1,1);add(1,-1);add(-1,1);add(-1,-1);} break;
    case 'B':
      add(1,1,true); add(1,-1,true); add(-1,1,true); add(-1,-1,true); if(piece.p){add(dir,0);add(-dir,0);add(0,1);add(0,-1);} break;
    case 'G': gold(); break;
    case 'S': if(piece.p){gold();break;} add(dir,-1); add(dir,0); add(dir,1); add(-dir,-1); add(-dir,1); break;
    case 'N': if(piece.p){gold();break;} add(2*dir,1); add(2*dir,-1); break;
    case 'L': if(piece.p){gold();break;} add(dir,0,true); break;
    case 'P': if(piece.p){gold();break;} add(dir,0); break;
  }
  if (checkBlock) {
    // remove moves that leave own king in check
    const valid = [];
    moves.forEach(m=>{
      const prev = board[m[0]][m[1]];
      board[m[0]][m[1]] = piece;
      board[r][c] = null;
      if (!isCheck(piece.color)) valid.push(m);
      board[r][c] = piece;
      board[m[0]][m[1]] = prev;
    });
    return valid;
  }
  return moves;
}

function selectPiece(ev) {
  clearHighlight();
  const r = ev.currentTarget.dataset.row;
  const c = ev.currentTarget.dataset.col;
  const hand = ev.currentTarget.dataset.hand;
  if (hand) {
    if (hand !== turn) return;
    const piece = hands[hand][ev.currentTarget.dataset.index];
    highlightDrops(piece);
  } else {
    const piece = board[r][c];
    if (!piece || piece.color !== turn) return;
    highlight(board, piece, r, c);
  }
}

function highlight(boardArr, piece, r, c) {
  getMoves(piece, +r, +c).forEach(m => {
    const cell = boardEl.children[m[0]*9 + m[1]];
    cell.classList.add('highlight');
  });
}

function highlightDrops(piece) {
  for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
    if (isLegalDrop(piece, r, c)) {
      boardEl.children[r*9 + c].classList.add('highlight');
    }
  }
}

function clearHighlight() {
  boardEl.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function isCheck(color) {
  const kingPos = findKing(color);
  if (!kingPos) return false;
  const opp = color === 'B' ? 'W' : 'B';
  for (let r=0;r<9;r++) for(let c=0;c<9;c++) {
    const p=board[r][c];
    if(p && p.color===opp){
      if(getMoves(p,r,c,false).some(m=>m[0]===kingPos[0] && m[1]===kingPos[1])) return true;
    }
  }
  return false;
}

function isCheckmate(color) {
  if (!isCheck(color)) return false;
  for (let r=0;r<9;r++) for(let c=0;c<9;c++) {
    const p=board[r][c];
    if(p && p.color===color){
      if(getMoves(p,r,c,true).length) return false;
    }
  }
  // drops
  for (const piece of hands[color]) {
    for (let r=0;r<9;r++) for(let c=0;c<9;c++) {
      if (isLegalDrop(piece, r, c)) {
        board[r][c] = { ...piece };
        if (!isCheck(color)) { board[r][c]=null; return false; }
        board[r][c]=null;
      }
    }
  }
  return true;
}

function findKing(color) {
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
    const p=board[r][c];
    if(p && p.color===color && p.type==='K') return [r,c];
  }
  return null;
}

undoBtn.onclick = () => {
  const prev = history.pop();
  if(prev){
    board = prev.board;
    hands = prev.hands;
    turn = prev.turn;
    render();
  }
};

init();
