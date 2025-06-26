const boardElement = document.getElementById('board');
const turnElement = document.getElementById('turn');
const handElements = [document.getElementById('hand-0'), document.getElementById('hand-1')];
const undoButton = document.getElementById('undo');

let board = [];
let hands = [[], []]; // captured pieces for each player
let turn = 0; // 0: player1 (先手), 1: player2 (後手)
let history = [];
let selectedPiece = null;
let selectedFromHand = false;

const PIECES = {
  FU: { name: '歩', moves: [[0,-1]], promote: 'TO' },
  KY: { name: '香', moves: [[0,-1]], long: true, promote: 'NY' },
  KE: { name: '桂', moves: [[-1,-2],[1,-2]], promote: 'NK' },
  GI: { name: '銀', moves: [[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]], promote: 'NG' },
  KI: { name: '金', moves: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]] },
  KA: { name: '角', moves: [[-1,-1],[1,-1],[-1,1],[1,1]], long: true, promote: 'UM' },
  HI: { name: '飛', moves: [[0,-1],[0,1],[-1,0],[1,0]], long: true, promote: 'RY' },
  OU: { name: '玉', moves: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] },
  // promoted pieces
  TO: { name: 'と', moves: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]] },
  NY: { name: '成香', moves: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]] },
  NK: { name: '成桂', moves: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]] },
  NG: { name: '成銀', moves: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]] },
  UM: { name: '馬', moves: [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0]], long: true },
  RY: { name: '龍', moves: [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]], long: true }
};

function createInitialBoard() {
  board = Array.from({length:9}, () => Array(9).fill(null));
  // Player2 (後手) pieces (rows 0-2)
  board[0] = [
    {type:'KY',player:1},{type:'KE',player:1},{type:'GI',player:1},{type:'KI',player:1},{type:'OU',player:1},{type:'KI',player:1},{type:'GI',player:1},{type:'KE',player:1},{type:'KY',player:1}
  ];
  board[1][1] = {type:'HI',player:1};
  board[1][7] = {type:'KA',player:1};
  for(let i=0;i<9;i++) board[2][i] = {type:'FU',player:1};

  // Player1 (先手) pieces (rows 6-8)
  board[8] = [
    {type:'KY',player:0},{type:'KE',player:0},{type:'GI',player:0},{type:'KI',player:0},{type:'OU',player:0},{type:'KI',player:0},{type:'GI',player:0},{type:'KE',player:0},{type:'KY',player:0}
  ];
  board[7][7] = {type:'HI',player:0};
  board[7][1] = {type:'KA',player:0};
  for(let i=0;i<9;i++) board[6][i] = {type:'FU',player:0};
}

function renderBoard() {
  boardElement.innerHTML = '';
  for(let y=0;y<9;y++) {
    for(let x=0;x<9;x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.addEventListener('click', () => selectCell(x,y));
      const piece = board[y][x];
      if(piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece player'+(piece.player+1);
        pieceEl.textContent = PIECES[piece.type].name;
        cell.appendChild(pieceEl);
      }
      boardElement.appendChild(cell);
    }
  }
  renderHands();
  turnElement.textContent = turn===0 ? '先手の番です' : '後手の番です';
  addPieceEventHandlers();
}

function renderHands() {
  for(let p=0;p<2;p++) {
    const handEl = handElements[p];
    handEl.innerHTML = (p===0?'先手持ち駒:':'後手持ち駒:');
    hands[p].forEach((piece,i) => {
      const pieceEl = document.createElement('div');
      pieceEl.className = 'piece player'+(p+1);
      pieceEl.textContent = PIECES[piece.type].name;
      pieceEl.addEventListener('click', () => selectHandPiece(p,i));
      handEl.appendChild(pieceEl);
    });
  }
}

function selectCell(x,y) {
  if(selectedPiece) {
    const moves = getMoves(selectedPiece.x, selectedPiece.y, selectedPiece.piece);
    if(moves.some(m=>m.x===x && m.y===y)) {
      movePiece(selectedPiece.x, selectedPiece.y, x, y);
      selectedPiece = null;
      clearHighlights();
    }
  }
}

function selectHandPiece(player,index) {
  if(turn!==player) return;
  const piece = hands[player][index];
  selectedPiece = {piece, fromHand:true, index};
  showDrops(player,piece);
}

function showDrops(player,piece) {
  clearHighlights();
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) {
    if(!board[y][x] && canDrop(player,piece,x,y)) {
      const cell = getCell(x,y);
      cell.classList.add('highlight');
      cell.addEventListener('click', ()=>{
        dropPiece(player,piece,x,y);
        selectedPiece=null;
        clearHighlights();
      }, {once:true});
    }
  }
}

function clearHighlights() {
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function movePiece(sx,sy,dx,dy) {
  const piece = board[sy][sx];
  const captured = board[dy][dx];
  history.push({board:JSON.parse(JSON.stringify(board)),hands:JSON.parse(JSON.stringify(hands)),turn});
  if(captured) {
    captured.player = turn;
    captured.type = captured.type.replace(/^N|TO|NY|NK|NG|UM|RY$/, match=>{
      switch(match){case 'TO':return 'FU';case 'NY':return 'KY';case 'NK':return 'KE';case 'NG':return 'GI';case 'UM':return 'KA';case 'RY':return 'HI';default:return match;}
    });
    hands[turn].push(captured);
  }
  board[dy][dx] = piece;
  board[sy][sx] = null;
  // promotion check
  if(shouldPromote(piece, sy, dy, turn)) {
    const promote = confirm('成りますか?');
    if(promote) {
      piece.type = PIECES[piece.type].promote || piece.type;
    }
  }
  turn = 1-turn;
  renderBoard();
  checkGameEnd();
}

function dropPiece(player,piece,x,y) {
  history.push({board:JSON.parse(JSON.stringify(board)),hands:JSON.parse(JSON.stringify(hands)),turn});
  board[y][x] = {type:piece.type, player};
  hands[player].splice(selectedPiece.index,1);
  turn = 1-turn;
  renderBoard();
  checkGameEnd();
}

function shouldPromote(piece, sy, dy, player) {
  const zone = player===0 ? [0,1,2] : [6,7,8];
  if(PIECES[piece.type].promote) {
    if(zone.includes(sy) || zone.includes(dy)) return true;
  }
  return false;
}

function computeMoves(x,y,piece) {
  const info = PIECES[piece.type];
  const moves = [];
  for(const [dx,dy] of info.moves) {
    let nx = x + (piece.player===0?dx:-dx);
    let ny = y + (piece.player===0?dy:-dy);
    while(nx>=0&&nx<9&&ny>=0&&ny<9) {
      const target = board[ny][nx];
      if(!target || target.player!==piece.player) {
        moves.push({x:nx,y:ny});
      }
      if(target || !info.long) break;
      nx += (piece.player===0?dx:-dx);
      ny += (piece.player===0?dy:-dy);
    }
  }
  return moves;
}

function getMoves(x,y,piece) {
  const moves = computeMoves(x,y,piece);
  highlightMoves(moves);
  return moves;
}

function highlightMoves(moves) {
  clearHighlights();
  moves.forEach(m => {
    const cell = getCell(m.x,m.y);
    cell.classList.add('highlight');
  });
}

function getCell(x,y) {
  return boardElement.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function onPieceClick(e,x,y) {
  const piece = board[y][x];
  if(piece.player !== turn) return;
  selectedPiece = {x,y,piece};
  getMoves(x,y,piece);
}

function addPieceEventHandlers() {
  const cells = boardElement.querySelectorAll('.cell');
  cells.forEach(cell => {
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    cell.onclick = () => selectCell(x,y);
    const piece = board[y][x];
    if(piece && piece.player===turn) {
      cell.firstChild.onclick = (e)=>{e.stopPropagation(); onPieceClick(e,x,y);};
    }
  });
}

function canDrop(player,piece,x,y) {
  if(board[y][x]) return false;
  // simple pawn drop rule: cannot drop pawn if another unpromoted pawn exists in column
  if(piece.type==='FU') {
    for(let row=0;row<9;row++) {
      const p = board[row][x];
      if(p && p.player===player && p.type==='FU') return false;
    }
    if((player===0 && y===0) || (player===1 && y===8)) return false;
  }
  return true;
}

function findKing(player) {
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) {
    const p = board[y][x];
    if(p && p.player===player && p.type==='OU') return {x,y};
  }
  return null;
}

function isKingInCheck(player) {
  const king = findKing(player);
  if(!king) return false;
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) {
    const p = board[y][x];
    if(p && p.player!==player) {
      const moves = computeMoves(x,y,p);
      if(moves.some(m=>m.x===king.x && m.y===king.y)) return true;
    }
  }
  return false;
}

function hasAnyLegalMove(player) {
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) {
    const p = board[y][x];
    if(p && p.player===player) {
      const moves = computeMoves(x,y,p);
      for(const m of moves) {
        const saved = board[m.y][m.x];
        board[m.y][m.x] = p;
        board[y][x] = null;
        const inCheck = isKingInCheck(player);
        board[y][x] = p;
        board[m.y][m.x] = saved;
        if(!inCheck) return true;
      }
    }
  }
  // check drops
  for(const piece of hands[player]) {
    for(let y=0;y<9;y++) for(let x=0;x<9;x++) {
      if(canDrop(player,piece,x,y)) {
        board[y][x] = {type:piece.type, player};
        const idx = hands[player].indexOf(piece);
        hands[player].splice(idx,1);
        const inCheck = isKingInCheck(player);
        hands[player].splice(idx,0,piece);
        board[y][x] = null;
        if(!inCheck) return true;
      }
    }
  }
  return false;
}

function checkGameEnd() {
  let kings = [false,false];
  for(let y=0;y<9;y++) for(let x=0;x<9;x++) {
    const p = board[y][x];
    if(p && p.type==='OU') kings[p.player] = true;
  }
  if(!kings[0] || !kings[1]) {
    alert((kings[0]? '先手':'後手') + 'の勝ち!');
    createInitialBoard();
    hands=[[],[]];
    history=[];
    turn=0;
    renderBoard();
    return;
  }

  const opponent = turn;
  if(isKingInCheck(opponent)) {
    if(!hasAnyLegalMove(opponent)) {
      alert((turn===0?'後手':'先手')+'詰み!');
      createInitialBoard();
      hands=[[],[]];
      history=[];
      turn=0;
      renderBoard();
    } else {
      alert('王手!');
    }
  }
}

undoButton.addEventListener('click',()=>{
  const state = history.pop();
  if(state) {
    board = state.board;
    hands = state.hands;
    turn = state.turn;
    renderBoard();
  }
});

createInitialBoard();
renderBoard();
