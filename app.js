const boardElem = document.getElementById('board');
const turnElem = document.getElementById('turn');
const handSElem = document.getElementById('hand-s');
const handGElem = document.getElementById('hand-g');
const undoBtn = document.getElementById('undo');

let history = [];

const PIECES = {
  p: '歩',
  l: '香',
  n: '桂',
  s: '銀',
  g: '金',
  b: '角',
  r: '飛',
  k: '玉',
  pp: 'と',
  pl: '成香',
  pn: '成桂',
  ps: '成銀',
  pb: '馬',
  pr: '竜'
};

let state = {
  board: [],
  hand: { S: {}, G: {} },
  turn: 'S'
};

function initBoard() {
  const emptyRow = () => Array(9).fill(null);
  state.board = [
    [
      {t:'l',p:'G'},{t:'n',p:'G'},{t:'s',p:'G'},{t:'g',p:'G'},{t:'k',p:'G'},{t:'g',p:'G'},{t:'s',p:'G'},{t:'n',p:'G'},{t:'l',p:'G'}
    ],
    [null,{t:'b',p:'G'},null,null,null,null,null,{t:'r',p:'G'},null],
    Array(9).fill({t:'p',p:'G'}),
    emptyRow(),
    emptyRow(),
    emptyRow(),
    Array(9).fill({t:'p',p:'S'}),
    [null,{t:'r',p:'S'},null,null,null,null,null,{t:'b',p:'S'},null],
    [
      {t:'l',p:'S'},{t:'n',p:'S'},{t:'s',p:'S'},{t:'g',p:'S'},{t:'k',p:'S'},{t:'g',p:'S'},{t:'s',p:'S'},{t:'n',p:'S'},{t:'l',p:'S'}
    ]
  ];
  state.hand = { S: {}, G: {} };
  state.turn = 'S';
  history = [];
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function pushHistory() {
  history.push(clone(state));
}

function render() {
  boardElem.innerHTML = '';
  for (let y=0; y<9; y++) {
    for (let x=0; x<9; x++) {
      const sq = document.createElement('div');
      sq.className = 'square';
      sq.dataset.x = x;
      sq.dataset.y = y;
      const piece = state.board[y][x];
      if (piece) {
        const d = document.createElement('div');
        d.textContent = PIECES[piece.promoted?('p'+piece.t):piece.t];
        d.className = 'piece';
        d.draggable = true;
        d.dataset.x = x;
        d.dataset.y = y;
        d.addEventListener('dragstart', onDragStart);
        d.addEventListener('click', () => selectPiece(x,y));
        sq.appendChild(d);
      }
      sq.addEventListener('dragover', e => e.preventDefault());
      sq.addEventListener('drop', onDrop);
      boardElem.appendChild(sq);
    }
  }
  renderHands();
  turnElem.textContent = `手番: ${state.turn==='S'?'先手':'後手'}`;
}

function renderHands() {
  handSElem.innerHTML = '';
  handGElem.innerHTML = '';
  for (const [t,count] of Object.entries(state.hand.S)) {
    for (let i=0;i<count;i++) {
      const d = document.createElement('div');
      d.textContent = PIECES[t];
      d.className = 'piece';
      d.draggable = true;
      d.dataset.hand = 'S';
      d.dataset.type = t;
      d.addEventListener('dragstart', onDragHandStart);
      handSElem.appendChild(d);
    }
  }
  for (const [t,count] of Object.entries(state.hand.G)) {
    for (let i=0;i<count;i++) {
      const d = document.createElement('div');
      d.textContent = PIECES[t];
      d.className = 'piece';
      d.draggable = true;
      d.dataset.hand = 'G';
      d.dataset.type = t;
      d.addEventListener('dragstart', onDragHandStart);
      handGElem.appendChild(d);
    }
  }
}

let dragData = null;

function onDragStart(e) {
  const x = +e.target.dataset.x;
  const y = +e.target.dataset.y;
  dragData = { from: {x,y} };
  highlightMoves(x,y);
}

function onDragHandStart(e) {
  const t = e.target.dataset.type;
  const player = e.target.dataset.hand;
  dragData = { from: 'hand', type: t, player };
  if (player !== state.turn) {
    dragData = null;
    e.preventDefault();
    return;
  }
  highlightDropSquares(t, player);
}

function onDrop(e) {
  if (!dragData) return;
  const x = +e.currentTarget.dataset.x;
  const y = +e.currentTarget.dataset.y;
  if (dragData.from==='hand') {
    if (state.board[y][x]) return clearHighlight();
    if (!canDrop(dragData.type, x, y, dragData.player)) {
      clearHighlight();
      return;
    }
    pushHistory();
    state.hand[dragData.player][dragData.type]--;
    if (!state.hand[dragData.player][dragData.type]) delete state.hand[dragData.player][dragData.type];
    state.board[y][x] = {t: dragData.type, p: dragData.player};
    switchTurn();
  } else {
    const {x:fx,y:fy} = dragData.from;
    const piece = state.board[fy][fx];
    if (!piece) return clearHighlight();
    if (piece.p !== state.turn) return clearHighlight();
    const moves = legalMoves(fx, fy, piece);
    if (!moves.some(m=>m.x===x&&m.y===y)) return clearHighlight();
    pushHistory();
    const target = state.board[y][x];
    if (target) capture(target);
    state.board[y][x] = piece;
    state.board[fy][fx] = null;
    if (shouldPromote(piece, fy, y, piece.p)) {
      if (confirm('成りますか?')) piece.promoted = true;
    }
    switchTurn();
  }
  clearHighlight();
  render();
  checkGameEnd();
}

function capture(piece) {
  const owner = piece.p==='S'?'G':'S';
  const t = piece.promoted?piece.t:piece.t;
  const baseType = piece.promoted?piece.t:piece.t;
  piece.promoted = false;
  state.hand[owner][baseType]=(state.hand[owner][baseType]||0)+1;
}

function switchTurn() {
  state.turn = state.turn==='S'?'G':'S';
}

function highlightMoves(x,y) {
  clearHighlight();
  const piece = state.board[y][x];
  if (!piece || piece.p!==state.turn) return;
  const moves = legalMoves(x,y,piece);
  moves.forEach(m=>{
    const selector = `.square[data-x="${m.x}"][data-y="${m.y}"]`;
    const sq = document.querySelector(selector);
    if (sq) sq.classList.add('highlight');
  });
}

function highlightDropSquares(t, player) {
  clearHighlight();
  for (let y=0;y<9;y++) {
    for (let x=0;x<9;x++) {
      if (!state.board[y][x] && canDrop(t,x,y,player)) {
        const selector = `.square[data-x="${x}"][data-y="${y}"]`;
        const sq = document.querySelector(selector);
        if (sq) sq.classList.add('highlight');
      }
    }
  }
}

function clearHighlight() {
  document.querySelectorAll('.square').forEach(s=>s.classList.remove('highlight'));
  dragData=null;
}

function legalMoves(x,y,piece) {
  const dirs = [];
  const forward = piece.p==='S'?-1:1;
  const enemy = piece.p==='S'?'G':'S';
  function add(dx,dy,repeat=false) {
    let nx=x+dx, ny=y+dy;
    while(nx>=0&&nx<9&&ny>=0&&ny<9) {
      const target=state.board[ny][nx];
      if(target && target.p===piece.p) break;
      dirs.push({x:nx,y:ny});
      if(target) break;
      if(!repeat) break;
      nx+=dx; ny+=dy;
    }
  }
  const t = piece.promoted?('p'+piece.t):piece.t;
  switch(t){
    case 'p': add(0,forward); break;
    case 'pp':
    case 'pl':
    case 'pn':
    case 'ps':
    case 'g': add(0,forward); add(-1,0); add(1,0); add(-1,forward); add(1,forward); add(0,-forward); break;
    case 'l': add(0,forward,true); break;
    case 'n': add(-1,forward*2); add(1,forward*2); break;
    case 's': add(0,forward); add(-1,forward); add(1,forward); add(-1,-forward); add(1,-forward); break;
    case 'b': add(-1,-1,true); add(1,-1,true); add(-1,1,true); add(1,1,true); break;
    case 'pb':
      add(-1,-1,true); add(1,-1,true); add(-1,1,true); add(1,1,true);
      add(0,forward); add(-1,0); add(1,0); add(0,-forward);
      break;
    case 'r': add(0,1,true); add(0,-1,true); add(1,0,true); add(-1,0,true); break;
    case 'pr':
      add(0,1,true); add(0,-1,true); add(1,0,true); add(-1,0,true);
      add(-1,-1); add(1,-1); add(-1,1); add(1,1);
      break;
    case 'k':
      add(0,1); add(0,-1); add(1,0); add(-1,0); add(1,1); add(1,-1); add(-1,1); add(-1,-1);
      break;
  }
  return dirs;
}

function canDrop(t,x,y,player){
  if(player!==state.turn) return false;
  if(t==='p'){
    // no two pawns in same file
    for(let yy=0;yy<9;yy++){
      const pc=state.board[yy][x];
      if(pc&&pc.p===player&&!pc.promoted&&pc.t==='p') return false;
    }
    // cannot drop pawn to last row
    if((player==='S'&&y===0)||(player==='G'&&y===8)) return false;
  }
  return true;
}

function shouldPromote(piece,fromY,toY,player){
  if(piece.t==='k'||piece.t==='g') return false;
  const zone = player==='S'? [0,1,2]: [6,7,8];
  return (zone.includes(fromY)||zone.includes(toY));
}

function checkGameEnd(){
  const enemy=state.turn==='S'?'G':'S';
  const kingPos=findKing(enemy);
  if(!kingPos){
    alert(`${state.turn==='S'?'後手':'先手'}の勝ち`);
    initBoard();
    render();
    return;
  }
  if(isCheck(enemy)){
    if(isCheckmate(enemy)){
      alert(`詰み！ ${state.turn==='S'?'先手':'後手'}の勝ち`);
      initBoard();
      render();
    }else{
      alert('王手！');
    }
  }
}

function findKing(player){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const pc=state.board[y][x];
      if(pc&&pc.t==='k'&&pc.p===player) return {x,y};
    }
  }
  return null;
}

function isCheck(player){
  const king=findKing(player);
  if(!king) return false;
  const enemy=player==='S'?'G':'S';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const pc=state.board[y][x];
      if(pc&&pc.p===enemy){
        const moves=legalMoves(x,y,pc);
        if(moves.some(m=>m.x===king.x&&m.y===king.y)) return true;
      }
    }
  }
  return false;
}

function isCheckmate(player){
  const king=findKing(player);
  if(!king) return true;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const pc=state.board[y][x];
      if(pc&&pc.p===player){
        const moves=legalMoves(x,y,pc);
        for(const m of moves){
          const backup=clone(state);
          const target=state.board[m.y][m.x];
          state.board[m.y][m.x]=pc;
          state.board[y][x]=null;
          if(target) capture(target);
          if(pc.promoted && shouldPromote(pc,y,m.y,player)){} // ignore optional promote
          const chk=isCheck(player);
          state=backup;
          if(!chk) return false;
        }
      }
    }
  }
  return true;
}

undoBtn.addEventListener('click', ()=>{
  if(history.length){
    state=history.pop();
    render();
  }
});

function selectPiece(x,y){
  highlightMoves(x,y);
}

initBoard();
render();
