const boardElem = document.getElementById('board');
const messageElem = document.getElementById('message');
const undoBtn = document.getElementById('undo');
const handBlack = document.getElementById('handBlack');
const handWhite = document.getElementById('handWhite');

const EMPTY = null;
const BLACK = 'b';
const WHITE = 'w';

const PIECES = {
  K: {name: '王', value: 1000},
  R: {name: '飛', value: 9, prom:'龍'},
  B: {name: '角', value: 8, prom:'馬'},
  G: {name: '金', value: 6},
  S: {name: '銀', value: 5, prom:'全'},
  N: {name: '桂', value: 4, prom:'圭'},
  L: {name: '香', value: 3, prom:'杏'},
  P: {name: '歩', value: 1, prom:'と'}
};

let board = [];
let hands = {b: {}, w: {}};
let turn = BLACK;
let history = [];
let dragging = null;
let legalMoves = [];
let dropping = null;

function initBoard() {
  board = Array.from({length:9}, () => Array(9).fill(EMPTY));
  // place pieces for black (bottom)
  board[8][4] = {t:'K',o:BLACK};
  board[8][3] = board[8][5] = {t:'G',o:BLACK};
  board[8][2] = board[8][6] = {t:'S',o:BLACK};
  board[8][1] = board[8][7] = {t:'N',o:BLACK};
  board[8][0] = board[8][8] = {t:'L',o:BLACK};
  board[7][1] = {t:'R',o:BLACK};
  board[7][7] = {t:'B',o:BLACK};
  for(let i=0;i<9;i++) board[6][i] = {t:'P',o:BLACK};

  // white (top)
  board[0][4] = {t:'K',o:WHITE};
  board[0][3] = board[0][5] = {t:'G',o:WHITE};
  board[0][2] = board[0][6] = {t:'S',o:WHITE};
  board[0][1] = board[0][7] = {t:'N',o:WHITE};
  board[0][0] = board[0][8] = {t:'L',o:WHITE};
  board[1][7] = {t:'R',o:WHITE};
  board[1][1] = {t:'B',o:WHITE};
  for(let i=0;i<9;i++) board[2][i] = {t:'P',o:WHITE};

  hands = {b:{}, w:{}};
  turn = BLACK;
  history = [];
}

function render() {
  boardElem.innerHTML='';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.pos=`${r}-${c}`;
      if(legalMoves.some(m=>{
        if(m.to) return m.to[0]===r && m.to[1]===c;
        return m[0]===r && m[1]===c;
      })) cell.classList.add('highlight');
      const p=board[r][c];
      if(p){
        const d=document.createElement('div');
        d.className='piece';
        if(p.o===WHITE) d.classList.add('enemy');
        d.textContent = p.prom?PIECES[p.t].prom:PIECES[p.t].name;
        d.draggable=false;
        d.addEventListener('mousedown', startDrag);
        cell.appendChild(d);
      }
      boardElem.appendChild(cell);
    }
  }
  renderHands();
  messageElem.textContent = turn===BLACK?'あなたの手番':'コンピュータの手番';
}

function renderHands() {
  handBlack.innerHTML = '先手持ち駒: ' + renderHand(hands.b, BLACK);
  handWhite.innerHTML = '後手持ち駒: ' + renderHand(hands.w, WHITE);
}

function renderHand(hand, owner) {
  let frag=document.createDocumentFragment();
  for(const t in hand){
    if(hand[t]>0){
      const span=document.createElement('span');
      span.textContent=PIECES[t].name+'x'+hand[t];
      span.style.margin='0 5px';
      if(owner===turn){
        span.style.cursor='pointer';
        span.addEventListener('click',()=>startDrop(t,owner));
      }
      frag.appendChild(span);
    }
  }
  const div=document.createElement('div');
  div.appendChild(frag);
  return div.innerHTML;
}

function startDrag(e){
  const pos=e.target.parentElement.dataset.pos.split('-').map(Number);
  const piece=board[pos[0]][pos[1]];
  if(piece.o!==turn) return;
  dragging={from:pos,piece};
  legalMoves=getLegalMoves(pos,piece);
  render();
  document.addEventListener('mouseup', endDrag);
}

function startDrop(type,owner){
  if(owner!==turn) return;
  dropping={type,owner};
  legalMoves=getDropMoves(type,owner);
  render();
  document.addEventListener('mouseup', endDrop);
}

function endDrag(e){
  if(!dragging){document.removeEventListener('mouseup', endDrag);return;}
  const cell=e.target.closest('.cell');
  let to=null;
  if(cell) {
    to=cell.dataset.pos.split('-').map(Number);
  }
  const move = legalMoves.find(m=>m.to && m.to[0]===to[0] && m.to[1]===to[1]);
  if(move){
    makeMove(dragging.from,to,move.prom);
  }
  dragging=null;
  legalMoves=[];
  render();
  document.removeEventListener('mouseup', endDrag);
}

function endDrop(e){
  if(!dropping){document.removeEventListener('mouseup', endDrop);return;}
  const cell=e.target.closest('.cell');
  let to=null;
  if(cell){
    to=cell.dataset.pos.split('-').map(Number);
  }
  const mv = legalMoves.find(m=>m[0]===to[0] && m[1]===to[1]);
  if(mv){
    dropPiece(dropping.type,to);
  }
  dropping=null;
  legalMoves=[];
  render();
  document.removeEventListener('mouseup', endDrop);
}

function makeMove(from,to,prom,silent){
  const piece=board[from[0]][from[1]];
  const captured=board[to[0]][to[1]];
  const before=JSON.parse(JSON.stringify({board,hands,turn}));
  history.push(before);
  board[to[0]][to[1]]={t:piece.t,o:piece.o,prom:prom||piece.prom};
  board[from[0]][from[1]]=EMPTY;
  if(captured){
    const t=captured.prom?captured.t:captured.t;
    hands[piece.o][t]=(hands[piece.o][t]||0)+1;
  }
  if(needProm(piece,from,to) && !piece.prom){
    if(confirm('成りますか?')) board[to[0]][to[1]].prom=true;
  }
  turn=turn===BLACK?WHITE:BLACK;
  if(!silent){
    checkVictory();
    if(turn===WHITE) aiMove();
  }
}

function undo(){
  if(history.length===0) return;
  const last=history.pop();
  board=JSON.parse(JSON.stringify(last.board));
  hands=JSON.parse(JSON.stringify(last.hands));
  turn=last.turn;
  render();
}

function dropPiece(type,to,silent){
  const before=JSON.parse(JSON.stringify({board,hands,turn}));
  history.push(before);
  board[to[0]][to[1]]={t:type,o:turn};
  hands[turn][type]--;
  turn=turn===BLACK?WHITE:BLACK;
  if(!silent){
    checkVictory();
    if(turn===WHITE) aiMove();
  }
}

function getDropMoves(type,owner){
  const moves=[];
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    if(board[r][c]) continue;
    if(type==='P'){
      if(owner===BLACK && r===0) continue;
      if(owner===WHITE && r===8) continue;
    }
    moves.push([r,c]);
  }
  return moves;
}

undoBtn.addEventListener('click',()=>{undo();});

function getLegalMoves(pos,piece){
  const dirs={
    K:[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],
    G:[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1]],
    S:[[1,0],[1,1],[1,-1],[-1,1],[-1,-1]],
    N:[[2,1],[2,-1]],
    L:[[1,0]],
    P:[[1,0]],
  };
  let moves=[];
  const forward=piece.o===BLACK? -1:1; // board orientation reversed because board[0] is top
  const r=pos[0],c=pos[1];
  function add(r2,c2,step){
    if(r2<0||r2>8||c2<0||c2>8) return false;
    const target=board[r2][c2];
    if(target && target.o===piece.o) return false;
    moves.push({to:[r2,c2]});
    return !target;
  }
  if(piece.t==='K'||(piece.prom&&piece.t!=='R'&&piece.t!=='B')){
    dirs.K.forEach(d=>add(r+d[0]*forward,c+d[1],false));
  } else if(piece.t==='G'){
    dirs.G.forEach(d=>add(r+d[0]*forward,c+d[1],false));
  } else if(piece.t==='S'){
    if(piece.prom){ dirs.G.forEach(d=>add(r+d[0]*forward,c+d[1],false)); }
    else dirs.S.forEach(d=>add(r+d[0]*forward,c+d[1],false));
  } else if(piece.t==='N'){
    if(piece.prom){ dirs.G.forEach(d=>add(r+d[0]*forward,c+d[1],false)); }
    else dirs.N.forEach(d=>add(r+d[0]*2,c+d[1],false));
  } else if(piece.t==='L'){
    if(piece.prom){ dirs.G.forEach(d=>add(r+d[0]*forward,c+d[1],false)); }
    else { for(let i=1;i<9;i++) if(!add(r+i*forward,c,false)) break; }
  } else if(piece.t==='P'){
    if(piece.prom){ dirs.G.forEach(d=>add(r+d[0]*forward,c+d[1],false)); }
    else add(r+forward,c,false);
  } else if(piece.t==='B'){
    const ds=[[1,1],[1,-1],[-1,1],[-1,-1]];
    ds.forEach(d=>{for(let i=1;i<9;i++) if(!add(r+d[0]*i,c+d[1]*i,true)) break;});
    if(piece.prom) dirs.K.forEach(d=>add(r+d[0]*forward,c+d[1],false));
  } else if(piece.t==='R'){
    const ds=[[1,0],[-1,0],[0,1],[0,-1]];
    ds.forEach(d=>{for(let i=1;i<9;i++) if(!add(r+d[0]*i,c+d[1]*i,true)) break;});
    if(piece.prom) dirs.K.forEach(d=>add(r+d[0]*forward,c+d[1],false));
  }
  moves=moves.filter(m=>!(piece.t==='P'&&!piece.prom&&((piece.o===BLACK&&m.to[0]===0)||(piece.o===WHITE&&m.to[0]===8))));
  return moves;
}

function needProm(piece,from,to){
  const zone=piece.o===BLACK?2:6; // 0-based rows
  if(piece.prom) return false;
  if(piece.t==='G'||piece.t==='K') return false;
  if(piece.o===BLACK && (from[0]<=zone||to[0]<=zone)) return true;
  if(piece.o===WHITE && (from[0]>=zone||to[0]>=zone)) return true;
  return false;
}

function aiMove(){
  messageElem.textContent='考え中...';
  setTimeout(()=>{
    const moves=[];
    for(let r=0;r<9;r++) for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p&&p.o===WHITE){
        getLegalMoves([r,c],p).forEach(m=>moves.push({from:[r,c],to:m.to,prom:m.prom}));
      }
    }
    for(const t in hands.w){
      const count=hands.w[t]||0;
      for(let i=0;i<count;i++){
        getDropMoves(t,WHITE).forEach(pos=>moves.push({drop:t,to:pos}));
      }
    }
    let best=null,bestVal=-Infinity;
    moves.forEach(m=>{
      const snapshot=JSON.parse(JSON.stringify({board,hands,turn}));
      if(m.drop) dropPiece(m.drop,m.to,true); else makeMove(m.from,m.to,m.prom,true);
      const val=evaluate();
      if(val>bestVal){bestVal=val;best=m;}
      undo();
      history.pop();
    });
    if(best){
      if(best.drop) dropPiece(best.drop,best.to); else makeMove(best.from,best.to,best.prom);
    }
  },500);
}

function evaluate(){
  let val=0;
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    const p=board[r][c];
    if(p){
      const v=PIECES[p.t].value + (p.prom?1:0);
      val += (p.o===WHITE?1:-1)*v;
    }
  }
  for(const t in hands.w) val += (hands.w[t]||0)*PIECES[t].value;
  for(const t in hands.b) val -= (hands.b[t]||0)*PIECES[t].value;
  return val;
}

function checkVictory(){
  let kings={b:false,w:false};
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    const p=board[r][c];
    if(p&&p.t==='K'){kings[p.o]=true;}
  }
  if(!kings.w){alert('あなたの勝ち');initBoard();render();}
  else if(!kings.b){alert('コンピュータの勝ち');initBoard();render();}
}

initBoard();
render();
