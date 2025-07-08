const boardElement = document.getElementById('board');
const turnElement = document.getElementById('turn');
const playerCapturedEl = document.getElementById('player-captured');
const aiCapturedEl = document.getElementById('ai-captured');
const undoButton = document.getElementById('undo');

let board = [];
let playerCaptured = [];
let aiCaptured = [];
let history = [];
let playerTurn = true; // true -> player, false -> ai
let dragged = null;
let dragFrom = null;

const pieceSymbols = {
  '歩': '歩', '香': '香', '桂': '桂', '銀': '銀', '金': '金', '王': '王',
  '飛': '飛', '角': '角',
  'と': 'と', '杏': '杏', '圭': '圭', '全': '全', '竜': '竜', '馬': '馬'
};

function cloneState() {
  return {
    board: JSON.parse(JSON.stringify(board)),
    playerCaptured: [...playerCaptured],
    aiCaptured: [...aiCaptured],
    playerTurn
  };
}

function restoreState(state) {
  board = JSON.parse(JSON.stringify(state.board));
  playerCaptured = [...state.playerCaptured];
  aiCaptured = [...state.aiCaptured];
  playerTurn = state.playerTurn;
}

function initBoard() {
  board = Array.from({ length: 9 }, () => Array(9).fill(null));
  // AI side (top)
  const aiBack = ['香','桂','銀','金','王','金','銀','桂','香'];
  for (let i = 0; i < 9; i++) {
    board[0][i] = {type: aiBack[i], owner: 'ai', promoted:false};
  }
  board[1][1] = {type:'角', owner:'ai', promoted:false};
  board[1][7] = {type:'飛', owner:'ai', promoted:false};
  for (let i = 0; i < 9; i++) {
    board[2][i] = {type:'歩', owner:'ai', promoted:false};
  }
  // Player side (bottom)
  const playerBack = ['香','桂','銀','金','王','金','銀','桂','香'];
  for (let i = 0; i < 9; i++) {
    board[8][i] = {type: playerBack[i], owner: 'player', promoted:false};
  }
  board[7][7] = {type:'角', owner:'player', promoted:false};
  board[7][1] = {type:'飛', owner:'player', promoted:false};
  for (let i = 0; i < 9; i++) {
    board[6][i] = {type:'歩', owner:'player', promoted:false};
  }
  playerCaptured = [];
  aiCaptured = [];
  history = [];
  playerTurn = true;
  render();
}

function render() {
  boardElement.innerHTML = '';
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const square = document.createElement('div');
      square.className = 'square';
      square.dataset.x = x;
      square.dataset.y = y;
      square.addEventListener('dragover', onDragOver);
      square.addEventListener('drop', onDrop);
      const piece = board[y][x];
      if (piece) {
        const p = document.createElement('div');
        p.textContent = pieceSymbols[piece.type];
        p.draggable = piece.owner === (playerTurn ? 'player' : 'ai');
        p.className = 'piece ' + piece.owner;
        p.addEventListener('dragstart', onDragStart);
        square.appendChild(p);
      }
      boardElement.appendChild(square);
    }
  }
  renderCaptured();
  turnElement.textContent = playerTurn ? 'あなたの手番です' : 'AIの手番です';
}

function renderCaptured() {
  playerCapturedEl.innerHTML = 'あなたの持ち駒:';
  playerCaptured.forEach((p,idx) => {
    const el = document.createElement('div');
    el.textContent = pieceSymbols[p];
    el.className = 'piece player';
    el.draggable = playerTurn;
    el.dataset.index = idx;
    el.addEventListener('dragstart', onCaptureDragStart);
    playerCapturedEl.appendChild(el);
  });
  aiCapturedEl.innerHTML = 'AIの持ち駒:';
  aiCaptured.forEach((p,idx) => {
    const el = document.createElement('div');
    el.textContent = pieceSymbols[p];
    el.className = 'piece ai';
    el.draggable = !playerTurn;
    el.dataset.index = idx;
    el.addEventListener('dragstart', onCaptureDragStart);
    aiCapturedEl.appendChild(el);
  });
}

function onDragStart(e) {
  const x = parseInt(this.parentElement.dataset.x);
  const y = parseInt(this.parentElement.dataset.y);
  dragged = board[y][x];
  dragFrom = {x,y};
  highlightMoves(x,y,dragged);
}

function onCaptureDragStart(e) {
  dragged = {type: playerTurn ? playerCaptured[this.dataset.index] : aiCaptured[this.dataset.index], owner: playerTurn ? 'player' : 'ai', capturedIndex: parseInt(this.dataset.index)};
  dragFrom = 'captured';
  highlightDrops(dragged);
}

function onDragOver(e) {
  e.preventDefault();
}

function onDrop(e) {
  e.preventDefault();
  const x = parseInt(this.dataset.x);
  const y = parseInt(this.dataset.y);
  clearHighlights();
  if (!dragged) return;
  if (dragFrom==='captured') {
    if (board[y][x]) return;
    if (!isLegalDrop(x,y,dragged)) return;
    history.push(cloneState());
    if (playerTurn) playerCaptured.splice(dragged.capturedIndex,1); else aiCaptured.splice(dragged.capturedIndex,1);
    board[y][x] = {type:dragged.type, owner:dragged.owner, promoted:false};
    endTurn();
  } else {
    const {x:fx,y:fy} = dragFrom;
    const moves = legalMoves(fx,fy,dragged);
    if (!moves.some(m=>m.x===x&&m.y===y)) return;
    history.push(cloneState());
    movePiece(fx,fy,x,y,dragged);
    endTurn();
  }
  dragged = null;
}

function movePiece(fx,fy,x,y,piece) {
  const target = board[y][x];
  if (target) {
    capturePiece(target);
  }
  board[fy][fx] = null;
  board[y][x] = piece;
  const promZone = piece.owner==='player'? y<=2 || fy<=2 : y>=6 || fy>=6;
  if (!piece.promoted && shouldPromote(piece,y,promZone)) {
    piece.promoted=true;
  }
  if (target && target.type==='王') {
    setTimeout(()=>{alert('勝ちました!'); initBoard();},10);
  }
}

function shouldPromote(piece,y,promZone){
  if (!promZone) return false;
  if (['歩','香','桂','銀','角','飛'].includes(piece.type)) return true;
  return false;
}

function capturePiece(piece){
  const type = piece.promoted? demote(piece.type): piece.type;
  if (piece.owner==='player') aiCaptured.push(type); else playerCaptured.push(type);
}

function demote(type){
  const map={'と':'歩','杏':'香','圭':'桂','全':'銀','竜':'飛','馬':'角'};
  return map[type]||type;
}

function legalMoves(x,y,piece){
  const moves=[];
  const dir = piece.owner==='player'? -1:1;
  function add(x2,y2){ if(x2>=0&&x2<9&&y2>=0&&y2<9){ const t=board[y2][x2]; if(!t||t.owner!==piece.owner) moves.push({x:x2,y:y2}); }}
  switch(piece.type){
    case '歩':
      add(x,y+dir);
      break;
    case '香':
      for(let i=1;i<9;i++){ const ny=y+i*dir; if(ny<0||ny>8) break; const t=board[ny][x]; if(!t) moves.push({x,y:ny}); else { if(t.owner!==piece.owner) moves.push({x,y:ny}); break; }}
      break;
    case '桂':
      add(x-1,y+2*dir); add(x+1,y+2*dir); break;
    case '銀':
      add(x-1,y+dir); add(x,y+dir); add(x+1,y+dir); add(x-1,y-dir); add(x+1,y-dir); break;
    case '金':
    case 'と':
    case '杏':
    case '圭':
    case '全':
      add(x,y+dir); add(x-1,y+dir); add(x+1,y+dir); add(x-1,y); add(x+1,y); add(x,y-dir); break;
    case '王':
      for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) if(dx||dy) add(x+dx,y+dy); break;
    case '飛':
    case '竜':
      for(let i=1;i<9;i++){ const nx=x+i; const t=board[y][nx]; if(nx>8) break; if(!t) moves.push({x:nx,y}); else{ if(t.owner!==piece.owner) moves.push({x:nx,y}); break; }}
      for(let i=1;i<9;i++){ const nx=x-i; const t=board[y][nx]; if(nx<0) break; if(!t) moves.push({x:nx,y}); else{ if(t.owner!==piece.owner) moves.push({x:nx,y}); break; }}
      for(let i=1;i<9;i++){ const ny=y+i; const t=board[ny]&&board[ny][x]; if(ny>8) break; if(!t) moves.push({x,y:ny}); else{ if(t.owner!==piece.owner) moves.push({x,y:ny}); break; }}
      for(let i=1;i<9;i++){ const ny=y-i; const t=board[ny]&&board[ny][x]; if(ny<0) break; if(!t) moves.push({x,y:ny}); else{ if(t.owner!==piece.owner) moves.push({x,y:ny}); break; }}
      if(piece.type==='竜'){ add(x-1,y-1); add(x+1,y-1); add(x-1,y+1); add(x+1,y+1); }
      break;
    case '角':
    case '馬':
      for(let i=1;i<9;i++){ const nx=x+i, ny=y+i; if(nx>8||ny>8) break; const t=board[ny][nx]; if(!t) moves.push({x:nx,y:ny}); else{ if(t.owner!==piece.owner) moves.push({x:nx,y:ny}); break; }}
      for(let i=1;i<9;i++){ const nx=x-i, ny=y+i; if(nx<0||ny>8) break; const t=board[ny][nx]; if(!t) moves.push({x:nx,y:ny}); else{ if(t.owner!==piece.owner) moves.push({x:nx,y:ny}); break; }}
      for(let i=1;i<9;i++){ const nx=x+i, ny=y-i; if(nx>8||ny<0) break; const t=board[ny][nx]; if(!t) moves.push({x:nx,y:ny}); else{ if(t.owner!==piece.owner) moves.push({x:nx,y:ny}); break; }}
      for(let i=1;i<9;i++){ const nx=x-i, ny=y-i; if(nx<0||ny<0) break; const t=board[ny][nx]; if(!t) moves.push({x:nx,y:ny}); else{ if(t.owner!==piece.owner) moves.push({x:nx,y:ny}); break; }}
      if(piece.type==='馬'){ add(x-1,y); add(x+1,y); add(x,y-1); add(x,y+1); }
      break;
  }
  return moves;
}

function highlightMoves(x,y,piece){
  const moves = legalMoves(x,y,piece);
  moves.forEach(m=>{ const sq=document.querySelector(`.square[data-x='${m.x}'][data-y='${m.y}']`); if(sq) sq.classList.add('highlight'); });
}

function highlightDrops(piece){
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){ if(!board[y][x] && isLegalDrop(x,y,piece)){ const sq=document.querySelector(`.square[data-x='${x}'][data-y='${y}']`); sq.classList.add('highlight'); }}
}

function isLegalDrop(x,y,piece){
  // simple rule: cannot drop on occupied square. Additional rules like pawn drop mate are ignored.
  return !board[y][x];
}

function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function endTurn(){
  playerTurn = !playerTurn;
  render();
  if(!playerTurn){ setTimeout(makeAIMove,500); }
}

function makeAIMove(){
  const moves=[];
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){ const p=board[y][x]; if(p && p.owner==='ai'){ const ms=legalMoves(x,y,p); ms.forEach(m=>moves.push({from:{x,y},to:m,p})); }}
  aiCaptured.forEach((type,idx)=>{ for(let y=0;y<9;y++) for(let x=0;x<9;x++){ if(isLegalDrop(x,y,{type,owner:'ai'})) moves.push({drop:true,to:{x,y},type,idx}); }});
  if(moves.length===0){ alert('あなたの勝ちです'); initBoard(); return; }
  const move=moves[Math.floor(Math.random()*moves.length)];
  history.push(cloneState());
  if(move.drop){ aiCaptured.splice(move.idx,1); board[move.to.y][move.to.x]={type:move.type,owner:'ai',promoted:false}; }
  else{ movePiece(move.from.x,move.from.y,move.to.x,move.to.y,move.p); }
  endTurn();
}

undoButton.addEventListener('click',()=>{
  const state=history.pop();
  if(state){ restoreState(state); render(); }
});

initBoard();
