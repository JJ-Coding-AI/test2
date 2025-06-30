const boardElem = document.getElementById('board');
const handElems = [document.getElementById('hand0'), document.getElementById('hand1')];
const turnElem = document.getElementById('turn');
const messageElem = document.getElementById('message');
const undoBtn = document.getElementById('undo');

let currentPlayer = 0; // 0: 先手, 1: 後手
let board = [];
let hands = [[], []];
let history = [];

const pieceNames = {
  K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩',
  PR: '龍', PB: '馬', PS: '成銀', PN: '成桂', PL: '成香', PP: 'と'
};

const initialSetup = [
  ['L','N','S','G','K','G','S','N','L'],
  [null,'R',null,null,null,null,null,'B',null],
  ['P','P','P','P','P','P','P','P','P'],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P','P'],
  [null,'B',null,null,null,null,null,'R',null],
  ['L','N','S','G','K','G','S','N','L']
];

function cloneState() {
  return {
    board: board.map(row => row.map(p => p ? {...p} : null)),
    hands: [hands[0].map(p => ({...p})), hands[1].map(p => ({...p}))],
    currentPlayer
  };
}

function restoreState(state) {
  board = state.board.map(row => row.map(p => p ? {...p} : null));
  hands = [state.hands[0].map(p => ({...p})), state.hands[1].map(p => ({...p}))];
  currentPlayer = state.currentPlayer;
  render();
}

function init() {
  board = initialSetup.map((row, r) => row.map((c, cIdx) => {
    if (!c) return null;
    const player = r < 3 ? 1 : 0; // top rows are 後手
    return {type: c, player, promoted: false};
  }));
  hands = [[], []];
  currentPlayer = 0;
  history = [];
  render();
}

function render() {
  boardElem.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('dragover', onDragOver);
      cell.addEventListener('drop', onDrop);
      boardElem.appendChild(cell);
      const piece = board[r][c];
      if (piece) {
        const pieceElem = createPieceElem(piece);
        cell.appendChild(pieceElem);
      }
    }
  }
  handElems.forEach((handElem, idx) => {
    handElem.innerHTML = '';
    hands[idx].forEach((p, i) => {
      const pe = createPieceElem(p);
      pe.dataset.handIndex = i;
      handElem.appendChild(pe);
    });
  });
  turnElem.textContent = currentPlayer === 0 ? '手番: 先手' : '手番: 後手';
}

function createPieceElem(piece) {
  const div = document.createElement('div');
  div.className = 'piece';
  if (piece.player === 1) div.classList.add('player1');
  div.textContent = pieceNames[piece.promoted ? 'P'+piece.type : piece.type] || pieceNames[piece.type];
  div.draggable = true;
  div.dataset.player = piece.player;
  div.dataset.type = piece.type;
  div.dataset.promoted = piece.promoted;
  div.addEventListener('dragstart', onDragStart);
  return div;
}

let dragData = null; // {from:{r,c}|handIndex, piece}

function onDragStart(e) {
  const pieceElem = e.target;
  const cell = pieceElem.parentElement;
  if (cell.classList.contains('cell')) {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    if (board[r][c].player !== currentPlayer) {
      e.preventDefault();
      return;
    }
    dragData = {from: {r,c}, piece: board[r][c]};
    highlightMoves(board[r][c], r, c, true);
  } else { // from hand
    const hand = pieceElem.parentElement;
    const player = parseInt(pieceElem.dataset.player);
    if (player !== currentPlayer) {
      e.preventDefault();
      return;
    }
    const handIndex = parseInt(pieceElem.dataset.handIndex);
    dragData = {from: {handIndex}, piece: hands[currentPlayer][handIndex]};
    highlightDrops(dragData.piece);
  }
}

function onDragOver(e) {
  e.preventDefault();
}

function onDrop(e) {
  e.preventDefault();
  const r = parseInt(e.currentTarget.dataset.row);
  const c = parseInt(e.currentTarget.dataset.col);
  if (!dragData) return;
  const piece = dragData.piece;
  let legal = false;
  const destPiece = board[r][c];
  const moves = dragData.from.handIndex !== undefined ?
      getDropMoves(piece) : getMoves(piece, dragData.from.r, dragData.from.c);
  legal = moves.some(m => m.r === r && m.c === c);
  clearHighlights();
  if (!legal) {
    dragData = null;
    return;
  }
  history.push(cloneState());
  if (dragData.from.handIndex !== undefined) {
    hands[currentPlayer].splice(dragData.from.handIndex,1);
  } else {
    board[dragData.from.r][dragData.from.c] = null;
  }
  if (destPiece) {
    capturePiece(destPiece, currentPlayer);
  }
  board[r][c] = {...piece};
  if (shouldPromote(piece, dragData.from, {r,c})) {
    if (confirm('成りますか?')) {
      piece.promoted = true;
    }
  }
  board[r][c] = piece;
  dragData = null;
  if (destPiece && destPiece.type === 'K') {
    alert(currentPlayer === 0 ? '先手の勝ち' : '後手の勝ち');
    init();
    return;
  }
  currentPlayer = 1 - currentPlayer;
  render();
  checkState();
}

function capturePiece(piece, capturer) {
  const baseType = piece.type;
  hands[capturer].push({type: baseType, player: capturer, promoted: false});
}

function shouldPromote(piece, from, to) {
  if (piece.type === 'K' || piece.type === 'G') return false;
  const zone = piece.player === 0 ? [0,1,2] : [6,7,8];
  return zone.includes(to.r) || zone.includes(from.r);
}

function highlightMoves(piece, r, c) {
  clearHighlights();
  const moves = getMoves(piece, r, c);
  moves.forEach(m => {
    const cell = boardElem.children[m.r*9 + m.c];
    cell.classList.add('highlight');
  });
}

function highlightDrops(piece) {
  clearHighlights();
  const moves = getDropMoves(piece);
  moves.forEach(m => {
    const cell = boardElem.children[m.r*9 + m.c];
    cell.classList.add('highlight');
  });
}

function clearHighlights() {
  [...boardElem.children].forEach(c => c.classList.remove('highlight'));
}

function onDragEnd() {
  clearHighlights();
  dragData = null;
}

document.addEventListener('dragend', onDragEnd);
undoBtn.addEventListener('click', () => {
  if (history.length) {
    const state = history.pop();
    restoreState(state);
  }
});

function getMoves(piece, r, c) {
  const dir = piece.player === 0 ? -1 : 1;
  const moves = [];
  const add = (dr, dc, repeat=false) => {
    let nr = r + dr, nc = c + dc;
    while (nr >=0 && nr<9 && nc>=0 && nc<9) {
      const dest = board[nr][nc];
      if (dest && dest.player === piece.player) break;
      moves.push({r:nr,c:nc});
      if (dest) break;
      if (!repeat) break;
      nr += dr; nc += dc;
    }
  };
  switch (piece.type) {
    case 'K':
      [-1,0,1].forEach(dr=>[-1,0,1].forEach(dc=>{if(dr||dc)add(dr,dc);}));
      break;
    case 'R':
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>add(d[0],d[1],true));
      if (piece.promoted) [-1,-1,-1,1,1,1].forEach((dr, i)=>{const dc=[-1,0,1,-1,0,1][i];add(dr,dc);});
      break;
    case 'B':
      [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(d=>add(d[0],d[1],true));
      if (piece.promoted) [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>add(d[0],d[1]));
      break;
    case 'G':
      [[dir,-1],[dir,0],[dir,1],[0,-1],[0,1],[-dir,0]].forEach(d=>add(d[0],d[1]));
      break;
    case 'S':
      [[dir,-1],[dir,0],[dir,1],[-dir,-1],[-dir,1]].forEach(d=>add(d[0],d[1]));
      if (piece.promoted) [[dir,-1],[dir,0],[dir,1],[0,-1],[0,1],[-dir,0]].forEach(d=>add(d[0],d[1]));
      break;
    case 'N':
      add(dir*2,-1);
      add(dir*2,1);
      if (piece.promoted) [[dir,-1],[dir,0],[dir,1],[0,-1],[0,1],[-dir,0]].forEach(d=>add(d[0],d[1]));
      break;
    case 'L':
      add(dir,0,true);
      if (piece.promoted) [[dir,-1],[dir,0],[dir,1],[0,-1],[0,1],[-dir,0]].forEach(d=>add(d[0],d[1]));
      break;
    case 'P':
      add(dir,0);
      if (piece.promoted) [[dir,-1],[dir,0],[dir,1],[0,-1],[0,1],[-dir,0]].forEach(d=>add(d[0],d[1]));
      break;
  }
  return moves;
}

function getDropMoves(piece) {
  const moves = [];
  for (let r=0;r<9;r++) {
    for (let c=0;c<9;c++) {
      if (board[r][c]) continue;
      // 二歩チェック
      if (piece.type === 'P') {
        if (board.some((row,ri) => row[c] && row[c].player===currentPlayer && row[c].type==='P')) continue;
        if ((currentPlayer===0 && r===0) || (currentPlayer===1 && r===8)) continue;
      }
      moves.push({r,c});
    }
  }
  return moves;
}

function isCheck(player) {
  const kingPos = findKing(player);
  if (!kingPos) return false;
  for (let r=0;r<9;r++) {
    for (let c=0;c<9;c++) {
      const p = board[r][c];
      if (!p || p.player===player) continue;
      const moves = getMoves(p,r,c);
      if (moves.some(m=>m.r===kingPos.r && m.c===kingPos.c)) return true;
    }
  }
  return false;
}

function findKing(player) {
  for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
    const p=board[r][c];
    if (p && p.player===player && p.type==='K') return {r,c};
  }
  return null;
}

function isCheckmate(player) {
  if (!isCheck(player)) return false;
  for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
    const p=board[r][c];
    if (!p || p.player!==player) continue;
    const moves=getMoves(p,r,c);
    for(const m of moves){
      const b=cloneState();
      const target=board[m.r][m.c];
      board[m.r][m.c]=p; board[r][c]=null;
      if(target) capturePiece(target,player);
      if(!isCheck(player)){restoreState(b);return false;}
      restoreState(b);
    }
  }
  // drops
  for(const [i,p] of hands[player].entries()){
    const moves=getDropMoves(p);
    for(const m of moves){
      const b=cloneState();
      board[m.r][m.c]=p; hands[player].splice(i,1);
      if(!isCheck(player)){restoreState(b);return false;}
      restoreState(b);
    }
  }
  return true;
}

function checkState() {
  const opponent = 1-currentPlayer;
  if (isCheck(opponent)) {
    messageElem.textContent = '王手!';
    if (isCheckmate(opponent)) {
      alert(currentPlayer===0?'先手の勝ち(詰み)':'後手の勝ち(詰み)');
      init();
    }
  } else {
    messageElem.textContent = '';
  }
}

init();
