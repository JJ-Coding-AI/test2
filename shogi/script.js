const boardElem = document.getElementById('board');
const turnElem = document.getElementById('turn');
const undoBtn = document.getElementById('undo');

const pieceSymbols = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩'
};
const goldLike = ['G'];

let board = [];
let captured = [[], []];
let history = [];
let turn = 0; // 0: sente, 1: gote

function cloneBoard(b) {
  return b.map(row => row.map(cell => cell ? {...cell} : null));
}

function initBoard() {
  board = Array.from({length:9}, () => Array(9).fill(null));
  // set initial pieces
  const set = (x, y, type, player) => board[y][x] = {type, player, promoted:false};
  // kings
  set(4,0,'K',1); set(4,8,'K',0);
  // gold
  set(3,0,'G',1); set(5,0,'G',1); set(3,8,'G',0); set(5,8,'G',0);
  // silver
  set(2,0,'S',1); set(6,0,'S',1); set(2,8,'S',0); set(6,8,'S',0);
  // knights
  set(1,0,'N',1); set(7,0,'N',1); set(1,8,'N',0); set(7,8,'N',0);
  // lances
  set(0,0,'L',1); set(8,0,'L',1); set(0,8,'L',0); set(8,8,'L',0);
  // bishop rook
  set(1,1,'B',1); set(7,7,'B',0); set(7,1,'R',1); set(1,7,'R',0);
  // pawns
  for(let i=0;i<9;i++){set(i,2,'P',1); set(i,6,'P',0);}
}

function createBoard() {
  boardElem.innerHTML = '';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const sq = document.createElement('div');
      sq.className = 'square';
      sq.dataset.x = x; sq.dataset.y = y;
      sq.addEventListener('dragover', onDragOver);
      sq.addEventListener('drop', onDrop);
      boardElem.appendChild(sq);
    }
  }
}

function render() {
  const squares = boardElem.children;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const sq = squares[y*9+x];
      sq.classList.remove('highlight');
      sq.innerHTML = '';
      const p = board[y][x];
      if(p){
        const div = document.createElement('div');
        div.className = 'piece';
        div.draggable = true;
        div.textContent = pieceSymbols[p.type] + (p.promoted?'+':'');
        if(p.player===1) div.style.transform='rotate(180deg)';
        if(p.promoted) div.classList.add('promoted');
        div.addEventListener('dragstart', evt => onDragStart(evt, {from:'board',x,y}));
        sq.appendChild(div);
      }
    }
  }
  for(let pl=0;pl<2;pl++){
    const area=document.getElementById('captured'+pl);
    area.innerHTML='';
    captured[pl].forEach((t,idx)=>{
      const div=document.createElement('div');
      div.className='piece';
      div.draggable=true;
      div.textContent=pieceSymbols[t];
      if(pl===1)div.style.transform='rotate(180deg)';
      div.addEventListener('dragstart',evt=>onDragStart(evt,{from:'captured',index:idx,player:pl}));
      area.appendChild(div);
    });
  }
  turnElem.textContent = turn===0? '先手の番です':'後手の番です';
}

function onDragStart(evt, info){
  evt.dataTransfer.setData('text/plain', JSON.stringify(info));
  const moves = info.from==='board'? getLegalMoves(info.x, info.y, board, turn): getDropMoves(info.player, captured[info.player][info.index]);
  highlightMoves(moves);
}

function highlightMoves(moves){
  clearHighlights();
  moves.forEach(([x,y])=>{
    const idx=y*9+x;
    boardElem.children[idx].classList.add('highlight');
  });
}

function clearHighlights(){
  [...boardElem.children].forEach(sq=>sq.classList.remove('highlight'));
}

function onDragOver(evt){
  evt.preventDefault();
}

function onDrop(evt){
  evt.preventDefault();
  clearHighlights();
  const info = JSON.parse(evt.dataTransfer.getData('text/plain'));
  const x= parseInt(this.dataset.x); const y=parseInt(this.dataset.y);
  if(info.from==='board'){
    const moves = getLegalMoves(info.x, info.y, board, turn);
    if(moves.some(m=>m[0]===x&&m[1]===y)){
      const before = cloneBoard(board);
      history.push({board:before,captured:JSON.parse(JSON.stringify(captured)),turn});
      movePiece(info.x, info.y, x, y);
    }
  }else if(info.from==='captured' && info.player===turn){
    const type = captured[info.player][info.index];
    const moves = getDropMoves(info.player, type);
    if(moves.some(m=>m[0]===x&&m[1]===y)){
      const before = cloneBoard(board);
      history.push({board:before,captured:JSON.parse(JSON.stringify(captured)),turn});
      captured[info.player].splice(info.index,1);
      board[y][x]={type,player:info.player,promoted:false};
      turn = 1-turn;
    }
  }
  render();
  checkCheck();
}

function movePiece(fx,fy,tx,ty){
  const piece = board[fy][fx];
  const target = board[ty][tx];
  if(target) captured[piece.player].push(target.type);
  board[ty][tx]=piece; board[fy][fx]=null;
  // promotion
  const promoteZone = piece.player===0? ty<=2 || fy<=2: ty>=6 || fy>=6;
  if(canPromote(piece) && promoteZone){
    if(confirm('成りますか？')) piece.promoted=true;
  }
  piece.player===0?piece.side='sente':piece.side='gote';
  turn = 1-turn;
}

function getDropMoves(player, type){
  const moves=[];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(!board[y][x]){
        if(type==='P' && !pawnDropAllowed(player,x)) continue;
        moves.push([x,y]);
      }
    }
  }
  return moves;
}

function pawnDropAllowed(player,x){
  // no second pawn in column
  for(let y=0;y<9;y++){
    const p=board[y][x];
    if(p && p.player===player && p.type==='P' && !p.promoted) return false;
  }
  return true;
}

function getLegalMoves(x,y,b,pl){
  const piece=b[y][x];
  if(!piece || piece.player!==pl) return [];
  const dirs={
    up:[0,-1], down:[0,1], left:[-1,0], right:[1,0],
    uleft:[-1,-1], uright:[1,-1], dleft:[-1,1], dright:[1,1]
  };
  const res=[];
  const add=(dx,dy,step)=>{
    let nx=x+dx, ny=y+dy;
    while(nx>=0&&nx<9&&ny>=0&&ny<9){
      const t=b[ny][nx];
      if(t && t.player===pl) break;
      res.push([nx,ny]);
      if(t) break;
      if(!step) break;
      nx+=dx; ny+=dy;
    }
  };
  const forward = piece.player===0? -1: 1;
  switch(piece.type){
    case 'K':
      Object.values(dirs).forEach(d=>add(d[0],d[1])); break;
    case 'R':
      add(dirs.up[0],dirs.up[1],true); add(dirs.down[0],dirs.down[1],true);
      add(dirs.left[0],dirs.left[1],true); add(dirs.right[0],dirs.right[1],true);
      if(piece.promoted){ add(dirs.uleft[0],dirs.uleft[1]); add(dirs.uright[0],dirs.uright[1]); add(dirs.dleft[0],dirs.dleft[1]); add(dirs.dright[0],dirs.dright[1]); }
      break;
    case 'B':
      add(dirs.uleft[0],dirs.uleft[1],true); add(dirs.uright[0],dirs.uright[1],true);
      add(dirs.dleft[0],dirs.dleft[1],true); add(dirs.dright[0],dirs.dright[1],true);
      if(piece.promoted){ add(dirs.up[0],dirs.up[1]); add(dirs.down[0],dirs.down[1]); add(dirs.left[0],dirs.left[1]); add(dirs.right[0],dirs.right[1]); }
      break;
    case 'G':
      add(0,forward); add(-1,forward); add(1,forward); add(0,-forward); add(-1,0); add(1,0); break;
    case 'S':
      if(piece.promoted){
        add(0,forward); add(-1,forward); add(1,forward); add(-1,0); add(1,0); add(0,-forward);
      }else{
        add(0,forward); add(-1,forward); add(1,forward); add(-1,-forward); add(1,-forward);
      }
      break;
    case 'N':
      if(piece.promoted){
        add(0,forward); add(-1,forward); add(1,forward); add(-1,0); add(1,0); add(0,-forward);
      }else{
        add(-1,2*forward); add(1,2*forward);
      }
      break;
    case 'L':
      if(piece.promoted){
        add(0,forward); add(-1,forward); add(1,forward); add(-1,0); add(1,0); add(0,-forward);
      }else{
        add(0,forward,true);
      }
      break;
    case 'P':
      if(piece.promoted){
        add(0,forward); add(-1,forward); add(1,forward); add(-1,0); add(1,0); add(0,-forward);
      }else{
        add(0,forward);
      }
      break;
  }
  return res;
}

function canPromote(piece){
  return ['P','L','N','S','B','R'].includes(piece.type) && !piece.promoted;
}

function isCheck(player){
  const kingPos=findKing(player);
  const opp=1-player;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p&&p.player===opp){
        const moves=getLegalMoves(x,y,board,opp);
        if(moves.some(m=>m[0]===kingPos.x&&m[1]===kingPos.y)) return true;
      }
    }
  }
  return false;
}

function findKing(player){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p && p.player===player && p.type==='K') return {x,y};
    }
  }
  return null;
}

function checkCheck(){
  if(isCheck(turn)){
    alert('王手!');
  }
}

undoBtn.addEventListener('click',()=>{
  const last=history.pop();
  if(last){
    board=cloneBoard(last.board);
    captured=JSON.parse(JSON.stringify(last.captured));
    turn=last.turn;
    render();
  }
});

initBoard();
createBoard();
render();
