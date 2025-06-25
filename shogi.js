const boardElement = document.getElementById('board');
const turnElement = document.getElementById('turn');
const handBlack = document.getElementById('hand-b');
const handWhite = document.getElementById('hand-w');
const undoBtn = document.getElementById('undo');

let board = [];
let hands = { b: {}, w: {} };
let turn = 'b';
let history = [];

const PIECE_NAMES = {
  P: '歩',
  L: '香',
  N: '桂',
  S: '銀',
  G: '金',
  B: '角',
  R: '飛',
  K: '王'
};

const PROMOTED_NAMES = {
  P: 'と',
  L: '成香',
  N: '成桂',
  S: '成銀',
  B: '馬',
  R: '竜'
};

function cloneState() {
  return {
    board: board.map(row => row.map(p => p ? { ...p } : null)),
    hands: {
      b: { ...hands.b },
      w: { ...hands.w }
    },
    turn
  };
}

function restoreState(state) {
  board = state.board.map(row => row.map(p => p ? { ...p } : null));
  hands = { b: { ...state.hands.b }, w: { ...state.hands.w } };
  turn = state.turn;
  render();
}

function pushHistory() {
  history.push(cloneState());
}

function popHistory() {
  if (history.length > 0) {
    const state = history.pop();
    restoreState(state);
  }
}

function initHands() {
  for (let t of ['b', 'w']) {
    hands[t] = { P:0, L:0, N:0, S:0, G:0, B:0, R:0 };
  }
}

function initBoard() {
  board = Array.from({ length: 9 }, () => Array(9).fill(null));

  // white pieces (top)
  const w = 'w';
  board[0] = [
    {type:'L', owner:w, promoted:false},
    {type:'N', owner:w, promoted:false},
    {type:'S', owner:w, promoted:false},
    {type:'G', owner:w, promoted:false},
    {type:'K', owner:w, promoted:false},
    {type:'G', owner:w, promoted:false},
    {type:'S', owner:w, promoted:false},
    {type:'N', owner:w, promoted:false},
    {type:'L', owner:w, promoted:false}
  ];
  board[1][1] = {type:'B', owner:w, promoted:false};
  board[1][7] = {type:'R', owner:w, promoted:false};
  for (let c=0;c<9;c++) board[2][c] = {type:'P', owner:w, promoted:false};

  // black pieces (bottom)
  const b = 'b';
  board[8] = [
    {type:'L', owner:b, promoted:false},
    {type:'N', owner:b, promoted:false},
    {type:'S', owner:b, promoted:false},
    {type:'G', owner:b, promoted:false},
    {type:'K', owner:b, promoted:false},
    {type:'G', owner:b, promoted:false},
    {type:'S', owner:b, promoted:false},
    {type:'N', owner:b, promoted:false},
    {type:'L', owner:b, promoted:false}
  ];
  board[7][7] = {type:'B', owner:b, promoted:false};
  board[7][1] = {type:'R', owner:b, promoted:false};
  for (let c=0;c<9;c++) board[6][c] = {type:'P', owner:b, promoted:false};

  initHands();
  turn = 'b';
  history = [];
}

function squareColor(r,c){
  return (r+c)%2===0?'' : 'black';
}

function createPieceElement(piece) {
  const div = document.createElement('div');
  div.className = 'piece';
  div.textContent = piece.promoted ? (PROMOTED_NAMES[piece.type] || PIECE_NAMES[piece.type]) : PIECE_NAMES[piece.type];
  div.draggable = true;
  div.dataset.owner = piece.owner;
  div.dataset.type = piece.type;
  div.dataset.promoted = piece.promoted ? '1' : '0';
  return div;
}

function render() {
  boardElement.innerHTML = '';
  for (let r=0;r<9;r++) {
    for (let c=0;c<9;c++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + squareColor(r,c);
      sq.dataset.row = r;
      sq.dataset.col = c;
      sq.addEventListener('dragover', ev => ev.preventDefault());
      sq.addEventListener('drop', dropOnBoard);
      const piece = board[r][c];
      if (piece) {
        const div = createPieceElement(piece);
        div.addEventListener('dragstart', dragStartBoard);
        sq.appendChild(div);
      }
      boardElement.appendChild(sq);
    }
  }
  renderHands();
  turnElement.textContent = turn === 'b' ? 'Black to move' : 'White to move';
}

function renderHands() {
  handBlack.innerHTML = '';
  handWhite.innerHTML = '';
  renderHandPieces('b', handBlack);
  renderHandPieces('w', handWhite);
}

function renderHandPieces(owner, container){
  for (const [type,count] of Object.entries(hands[owner])){
    for (let i=0;i<count;i++){
      const piece = {type, owner, promoted:false};
      const div = createPieceElement(piece);
      div.addEventListener('dragstart', dragStartHand);
      container.appendChild(div);
    }
  }
  container.addEventListener('dragover', ev => ev.preventDefault());
}

function dragStartBoard(ev){
  const piece = ev.target;
  const r = piece.parentElement.dataset.row;
  const c = piece.parentElement.dataset.col;
  if ((turn==='b' && piece.dataset.owner!=='b') || (turn==='w' && piece.dataset.owner!=='w')) {
    ev.preventDefault();
    return;
  }
  ev.dataTransfer.setData('text/plain', JSON.stringify({fromBoard:true,row:r,col:c}));
}

function dragStartHand(ev){
  const piece = ev.target;
  if ((turn==='b' && piece.dataset.owner!=='b') || (turn==='w' && piece.dataset.owner!=='w')) {
    ev.preventDefault();
    return;
  }
  ev.dataTransfer.setData('text/plain', JSON.stringify({fromBoard:false,type:piece.dataset.type,owner:piece.dataset.owner}));
}

function dropOnBoard(ev){
  ev.preventDefault();
  const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
  const r = parseInt(ev.currentTarget.dataset.row);
  const c = parseInt(ev.currentTarget.dataset.col);
  if (data.fromBoard){
    movePiece(data.row,data.col,r,c);
  } else {
    dropPiece(data.type,data.owner,r,c);
  }
}

function movePiece(sr,sc,dr,dc){
  sr = parseInt(sr); sc = parseInt(sc);
  const piece = board[sr][sc];
  if (!piece || piece.owner!==turn) return;
  const moves = getMoves(sr,sc,piece);
  if (!moves.some(m => m.r===dr && m.c===dc)) return;

  pushHistory();

  const dest = board[dr][dc];
  if (dest) capturePiece(dest);
  board[dr][dc] = piece;
  board[sr][sc] = null;

  if (canPromote(piece,sr,dr) && confirm('Promote?')) {
    piece.promoted = true;
  }

  endTurn();
}

function dropPiece(type,owner,r,c){
  if (turn!==owner) return;
  if (board[r][c]) return;
  if (hands[owner][type]<=0) return;

  pushHistory();

  board[r][c] = {type, owner, promoted:false};
  hands[owner][type]--;

  endTurn();
}

function capturePiece(piece){
  const owner = piece.owner==='b'?'w':'b';
  const type = piece.promoted ? piece.type : piece.type;
  const baseType = piece.type;
  hands[owner][baseType] = (hands[owner][baseType]||0)+1;
}

function canPromote(piece,sr,dr){
  if (piece.promoted) return false;
  if (piece.type==='K' || piece.type==='G') return false;
  const zone = piece.owner==='b'?2:6;
  if (piece.owner==='b'){
    return sr<=zone || dr<=zone;
  } else {
    return sr>=zone || dr>=zone;
  }
}

const DIRS = {
  up:    [-1,0],
  down:  [1,0],
  left:  [0,-1],
  right: [0,1],
  uleft: [-1,-1],
  uright:[-1,1],
  dleft: [1,-1],
  dright:[1,1]
};

function addDir(moves,dir,owner){
  let [dr,dc]=DIRS[dir];
  if(owner==='w'){dr=-dr;dc=-dc;}
  moves.push({dr,dc});
}

const MOVE_TABLE = {
  P: owner => { let m=[]; addDir(m,'up',owner); return {steps:m}; },
  L: owner => { let m=[]; addDir(m,'up',owner); return {lines:m}; },
  N: owner => { let [d,c]=owner==='b'?[-2,1]:[2,-1]; return {knight:[[d,1*c],[d,-1*c]]}; },
  S: owner => { let m=[]; ['up','uleft','uright','dleft','dright'].forEach(dir=>addDir(m,dir,owner)); return {steps:m}; },
  G: owner => { let m=[]; ['up','left','right','dleft','dright','down'].forEach(dir=>addDir(m,dir,owner)); return {steps:m}; },
  B: owner => { let m=[]; ['uleft','uright','dleft','dright'].forEach(dir=>addDir(m,dir,owner)); return {lines:m}; },
  R: owner => { let m=[]; ['up','down','left','right'].forEach(dir=>addDir(m,dir,owner)); return {lines:m}; },
  K: owner => { let m=[]; Object.keys(DIRS).forEach(dir=>addDir(m,dir,owner)); return {steps:m}; }
};

function promotedMove(base){
  return {
    steps:(base.steps||[]).concat([DIRS.uleft,DIRS.uright,DIRS.dleft,DIRS.dright].map(d=>({dr:d[0],dc:d[1]})))
  };
}

function getMoves(r,c,piece){
  const owner = piece.owner;
  const base = MOVE_TABLE[piece.type](owner);
  const res = [];
  if (base.steps){
    for (const s of base.steps){
      const nr = r + s.dr;
      const nc = c + s.dc;
      if (nr<0||nr>8||nc<0||nc>8) continue;
      const dest = board[nr][nc];
      if (!dest || dest.owner!==owner) res.push({r:nr,c:nc});
    }
  }
  if (base.lines){
    for (const s of base.lines){
      let nr = r + s.dr;
      let nc = c + s.dc;
      while(nr>=0&&nr<=8&&nc>=0&&nc<=8){
        const dest = board[nr][nc];
        if (!dest){
          res.push({r:nr,c:nc});
        } else {
          if (dest.owner!==owner) res.push({r:nr,c:nc});
          break;
        }
        nr += s.dr;
        nc += s.dc;
      }
    }
  }
  if (base.knight){
    for(const k of base.knight){
      let nr = r + k[0];
      let nc = c + k[1];
      if(nr<0||nr>8||nc<0||nc>8) continue;
      const dest = board[nr][nc];
      if(!dest || dest.owner!==owner) res.push({r:nr,c:nc});
    }
  }
  if (piece.promoted && ['P','L','N','S'].includes(piece.type)){
    const add = MOVE_TABLE['G'](owner).steps;
    for(const s of add){
      const nr = r + s.dr;
      const nc = c + s.dc;
      if(nr<0||nr>8||nc<0||nc>8) continue;
      const dest = board[nr][nc];
      if(!dest || dest.owner!==owner) res.push({r:nr,c:nc});
    }
  }
  if (piece.promoted && piece.type==='B'){
    const add = MOVE_TABLE['R'](owner).steps;
    for(const s of add){
      const nr = r + s.dr;
      const nc = c + s.dc;
      if(nr<0||nr>8||nc<0||nc>8) continue;
      const dest = board[nr][nc];
      if(!dest || dest.owner!==owner) res.push({r:nr,c:nc});
    }
  }
  if (piece.promoted && piece.type==='R'){
    const add = MOVE_TABLE['B'](owner).steps;
    for(const s of add){
      const nr = r + s.dr;
      const nc = c + s.dc;
      if(nr<0||nr>8||nc<0||nc>8) continue;
      const dest = board[nr][nc];
      if(!dest || dest.owner!==owner) res.push({r:nr,c:nc});
    }
  }
  return res;
}

function findKing(owner){
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p && p.owner===owner && p.type==='K') return [r,c];
    }
  }
  return null;
}

function isAttacked(r,c,byOwner){
  for(let i=0;i<9;i++){
    for(let j=0;j<9;j++){
      const p=board[i][j];
      if(p && p.owner===byOwner){
        const moves=getMoves(i,j,p);
        if(moves.some(m=>m.r===r && m.c===c)) return true;
      }
    }
  }
  return false;
}

function isCheck(owner){
  const kingPos=findKing(owner);
  if(!kingPos) return false;
  const opponent=owner==='b'?'w':'b';
  return isAttacked(kingPos[0],kingPos[1],opponent);
}

function isCheckmate(owner){
  if(!isCheck(owner)) return false;
  // generate all moves
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p && p.owner===owner){
        const moves=getMoves(r,c,p);
        for(const mv of moves){
          const state=cloneState();
          movePieceInternal(r,c,mv.r,mv.c);
          if(!isCheck(owner)){ restoreState(state); return false; }
          restoreState(state);
        }
      }
    }
  }
  // check drops
  for(const [type,count] of Object.entries(hands[owner])){
    if(count>0){
      for(let r=0;r<9;r++){
        for(let c=0;c<9;c++){
          if(!board[r][c]){
            const state=cloneState();
            board[r][c]={type,owner,promoted:false};
            hands[owner][type]--;
            if(!isCheck(owner)){ restoreState(state); return false; }
            restoreState(state);
          }
        }
      }
    }
  }
  return true;
}

function movePieceInternal(sr,sc,dr,dc){
  const piece=board[sr][sc];
  const dest=board[dr][dc];
  if(dest) capturePiece(dest);
  board[dr][dc]=piece;
  board[sr][sc]=null;
}

function endTurn(){
  turn=turn==='b'?'w':'b';
  render();
  const opponent=turn==='b'?'w':'b';
  if(isCheck(opponent)){
    alert(opponent==='b'?'Black':'White'+' is in check');
    if(isCheckmate(opponent)){
      alert('Checkmate!');
    }
  }
}

undoBtn.addEventListener('click', () => {
  popHistory();
});

initBoard();
render();
