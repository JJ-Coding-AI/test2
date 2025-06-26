const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const holdEls = [document.getElementById('hold0'), document.getElementById('hold1')];
const undoBtn = document.getElementById('undo');

const SENTE = 0;
const GOTE = 1;
let turn = SENTE;
let history = [];

const pieceNames = {
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '王',
  pP: 'と', pL: '成香', pN: '成桂', pS: '成銀', pB: '馬', pR: '竜'
};

class Piece {
  constructor(type, owner) {
    this.type = type; // like 'P', 'pP'
    this.owner = owner;
  }
  name() {
    return pieceNames[this.type];
  }
  promoted() {
    return this.type.startsWith('p');
  }
  baseType() {
    return this.promoted() ? this.type.slice(1) : this.type;
  }
}

let board = [];
let holdings = [[], []];

function initBoard() {
  board = Array.from({ length: 9 }, () => Array(9).fill(null));
  const set = (x, y, type, owner) => board[y][x] = new Piece(type, owner);
  // Initial pieces (simplified)
  const order = ['L','N','S','G','K','G','S','N','L'];
  order.forEach((t,i)=>{ set(i,0,t,GOTE); set(i,8,t,SENTE); });
  set(1,1,'B',GOTE); set(7,7,'B',SENTE);
  set(7,1,'R',GOTE); set(1,7,'R',SENTE);
  for(let i=0;i<9;i++){ set(i,2,'P',GOTE); set(i,6,'P',SENTE); }
}

function saveHistory() {
  history.push({
    board: board.map(row => row.map(p => p ? new Piece(p.type, p.owner) : null)),
    holdings: [holdings[0].map(p=>new Piece(p.type,p.owner)), holdings[1].map(p=>new Piece(p.type,p.owner))],
    turn: turn
  });
}

function restore(state) {
  board = state.board.map(row => row.map(p => p ? new Piece(p.type,p.owner) : null));
  holdings = [state.holdings[0].map(p=>new Piece(p.type,p.owner)), state.holdings[1].map(p=>new Piece(p.type,p.owner))];
  turn = state.turn;
  render();
}

function posInPromotionZone(y, owner) {
  return owner === SENTE ? y <=2 : y >=6;
}

function getMovableSquares(x, y, piece) {
  const dirs = {
    P: [[0,-1]],
    L: Array.from({length:8},(_,i)=>[0,-(i+1)]),
    N: [[-1,-2],[1,-2]],
    S: [[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]],
    G: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
    B: [[-1,-1],[1,-1],[-1,1],[1,1]],
    R: [[0,-1],[0,1],[-1,0],[1,0]],
    K: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
  };
  const slideTypes = ['L','B','R'];
  const promoteMap = {
    P:'G',L:'G',N:'G',S:'G',B:'B',R:'R'
  };
  let type = piece.baseType();
  let result = [];
  let moves = dirs[type];
  if (!moves) return result;
  moves.forEach(d => {
    let dx = piece.owner===SENTE? d[0] : -d[0];
    let dy = piece.owner===SENTE? d[1] : -d[1];
    let nx = x + dx; let ny = y + dy;
    while(nx>=0 && nx<9 && ny>=0 && ny<9){
      if(board[ny][nx] && board[ny][nx].owner===piece.owner) break;
      result.push([nx,ny]);
      if(board[ny][nx]) break;
      if(!slideTypes.includes(type)) break;
      nx += dx; ny += dy;
    }
  });
  return result;
}

function clearHighlights() {
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlight'));
}

function highlightMoves(x,y,piece){
  clearHighlights();
  const cells = getMovableSquares(x,y,piece);
  cells.forEach(([cx,cy])=>{
    const id = `cell-${cx}-${cy}`;
    const el = document.getElementById(id);
    if(el) el.classList.add('highlight');
  });
}

function render() {
  boardEl.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell = document.createElement('div');
      cell.className='cell';
      cell.id=`cell-${x}-${y}`;
      cell.dataset.x=x; cell.dataset.y=y;
      cell.addEventListener('dragover', ev=>ev.preventDefault());
      cell.addEventListener('drop', dropHandler);
      const p = board[y][x];
      if(p){
        const pieceEl = document.createElement('div');
        pieceEl.textContent=p.name();
        pieceEl.className='piece'+(p.owner===GOTE?' gote':'');
        pieceEl.draggable=true;
        pieceEl.dataset.owner=p.owner;
        pieceEl.dataset.type=p.type;
        pieceEl.dataset.from=`${x},${y}`;
        pieceEl.addEventListener('dragstart', dragStart);
        pieceEl.addEventListener('click', ()=>highlightMoves(x,y,p));
        cell.appendChild(pieceEl);
      }
      boardEl.appendChild(cell);
    }
  }
  holdEls.forEach((holdEl, idx)=>{
    holdEl.innerHTML = (idx===0? '先手の持ち駒:' : '後手の持ち駒:');
    holdings[idx].forEach((p,i)=>{
      const pe = document.createElement('span');
      pe.textContent = p.name();
      pe.className='piece'+(p.owner===GOTE?' gote':'');
      pe.draggable=true;
      pe.dataset.owner=p.owner;
      pe.dataset.type=p.type;
      pe.dataset.from=`hold-${idx}-${i}`;
      pe.addEventListener('dragstart', dragStart);
      pe.addEventListener('click', ()=>highlightHoldMoves(idx,i));
      holdEl.appendChild(pe);
    });
  });
  turnEl.textContent = turn===SENTE? '先手の番' : '後手の番';
  clearHighlights();
}

function dragStart(ev){
  ev.dataTransfer.setData('text/plain', ev.target.dataset.from);
  const from = ev.target.dataset.from;
  if(from.startsWith('hold-')){
    const [,owner] = from.split('-');
    const holdIdx = parseInt(owner,10);
    const idx = parseInt(from.split('-')[2],10);
    const piece = holdings[holdIdx][idx];
    highlightDropSquares(piece);
  } else {
    const [x,y]=from.split(',').map(Number);
    const piece=board[y][x];
    highlightMoves(x,y,piece);
  }
}

function highlightHoldMoves(owner,idx){
  const piece = holdings[owner][idx];
  highlightDropSquares(piece);
}

function highlightDropSquares(piece){
  clearHighlights();
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(!board[y][x]){
        boardEl.querySelector(`#cell-${x}-${y}`).classList.add('highlight');
      }
    }
  }
}

function dropHandler(ev){
  ev.preventDefault();
  const from = ev.dataTransfer.getData('text/plain');
  const x = parseInt(ev.currentTarget.dataset.x,10);
  const y = parseInt(ev.currentTarget.dataset.y,10);

  if(from.startsWith('hold-')){
    const [,owner,idx] = from.split('-');
    if(turn!==parseInt(owner,10)) return;
    const piece = holdings[owner][idx];
    if(board[y][x]) return;
    saveHistory();
    board[y][x]=piece;
    holdings[owner].splice(idx,1);
  } else {
    const [fx,fy]=from.split(',').map(Number);
    const piece = board[fy][fx];
    if(turn!==piece.owner) return;
    const cells = getMovableSquares(fx,fy,piece);
    if(!cells.some(([cx,cy])=>cx===x&&cy===y)) return;
    saveHistory();
    const target = board[y][x];
    if(target){
      target.type=target.baseType();
      target.owner=piece.owner;
      holdings[piece.owner].push(target);
    }
    board[fy][fx]=null;
    board[y][x]=piece;
    if(posInPromotionZone(y,piece.owner) || posInPromotionZone(fy,piece.owner)){
      if(!piece.promoted() && confirm('成りますか?')){
        piece.type='p'+piece.type;
      }
    }
    if(target && target.baseType()==='K'){
      alert('勝ち!');
      initBoard();
      history=[];
    }
  }
  turn = turn===SENTE?GOTE:SENTE;
  render();
}

undoBtn.addEventListener('click',()=>{
  if(history.length>0){
    const state=history.pop();
    restore(state);
  }
});

initBoard();
render();
