const PIECE_TYPES = {
  K: { name: '玉', move: kingMoves },
  R: { name: '飛', move: rookMoves, promote: 'PR' },
  B: { name: '角', move: bishopMoves, promote: 'PB' },
  G: { name: '金', move: goldMoves },
  S: { name: '銀', move: silverMoves, promote: 'G' },
  N: { name: '桂', move: knightMoves, promote: 'G' },
  L: { name: '香', move: lanceMoves, promote: 'G' },
  P: { name: '歩', move: pawnMoves, promote: 'PT' },
  PR: { name: '龍', move: rookMoves, extra: kingDiag },
  PB: { name: '馬', move: bishopMoves, extra: kingOrth },
  PT: { name: 'と', move: goldMoves }
};

let board = [];
let captured = { black: [], white: [] };
let turn = 'black';
let history = [];

function initBoard() {
  board = Array.from({length:9}, () => Array(9).fill(null));
  // white (上側)
  board[0] = [
    piece('L','white'), piece('N','white'), piece('S','white'), piece('G','white'), piece('K','white'), piece('G','white'), piece('S','white'), piece('N','white'), piece('L','white')
  ];
  board[1][1] = piece('B','white');
  board[1][7] = piece('R','white');
  for(let i=0;i<9;i++) board[2][i] = piece('P','white');
  // black (下側)
  board[8] = [
    piece('L','black'), piece('N','black'), piece('S','black'), piece('G','black'), piece('K','black'), piece('G','black'), piece('S','black'), piece('N','black'), piece('L','black')
  ];
  board[7][7] = piece('B','black');
  board[7][1] = piece('R','black');
  for(let i=0;i<9;i++) board[6][i] = piece('P','black');
  captured = { black: [], white: [] };
  turn = 'black';
  history = [];
}

function piece(t,o,p=false){return {t,o,p};}

function cloneState() {
  return {
    board: board.map(row => row.map(p => p? {...p}:null)),
    captured: {
      black: captured.black.map(p=>({...p})),
      white: captured.white.map(p=>({...p}))
    },
    turn
  };
}

function restoreState(state){
  board = state.board.map(row=>row.map(p=>p?{...p}:null));
  captured = {
    black: state.captured.black.map(p=>({...p})),
    white: state.captured.white.map(p=>({...p}))
  };
  turn = state.turn;
}

function saveHistory(){
  history.push(cloneState());
}

function undo(){
  if(history.length>0){
    const state = history.pop();
    restoreState(state);
    render();
  }
}

function render(){
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.x=x;
      cell.dataset.y=y;
      cell.addEventListener('dragover',ev=>ev.preventDefault());
      cell.addEventListener('drop',drop);
      const p=board[y][x];
      if(p){
        const d=document.createElement('div');
        d.className='piece';
        d.textContent=getPieceChar(p);
        d.draggable=true;
        d.dataset.x=x; d.dataset.y=y;
        d.addEventListener('dragstart',dragStart);
        if(p.o==='white') d.style.transform='rotate(180deg)';
        cell.appendChild(d);
      }
      boardDiv.appendChild(cell);
    }
  }
  document.getElementById('turnDisplay').textContent = turn==='black'? '先手の番':'後手の番';
  renderCaptured();
}

function renderCaptured(){
  const bDiv=document.getElementById('captured-black');
  const wDiv=document.getElementById('captured-white');
  bDiv.innerHTML='';
  wDiv.innerHTML='';
  captured.black.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='piece';
    d.textContent=getPieceChar(p);
    d.draggable=true;
    d.dataset.from='b'+i;
    d.addEventListener('dragstart',dragStart);
    bDiv.appendChild(d);
  });
  captured.white.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='piece';
    d.textContent=getPieceChar(p);
    d.draggable=true;
    d.dataset.from='w'+i;
    d.addEventListener('dragstart',dragStart);
    d.style.transform='rotate(180deg)';
    wDiv.appendChild(d);
  });
}

function getPieceChar(p){
  const key = p.p? (p.t==='R'? 'PR': p.t==='B'? 'PB': p.t==='P'? 'PT': p.t==='S'||p.t==='N'||p.t==='L'? 'G': p.t) : p.t;
  return PIECE_TYPES[key].name;
}

let dragData=null;
function dragStart(e){
  const x=e.target.dataset.x;
  const y=e.target.dataset.y;
  const from=e.target.dataset.from;
  if(from){
    dragData={from};
  }else{
    dragData={x:parseInt(x), y:parseInt(y)};
  }
  const moves=getMoves(dragData);
  highlight(moves);
}

function drop(e){
  e.preventDefault();
  const x=parseInt(e.currentTarget.dataset.x);
  const y=parseInt(e.currentTarget.dataset.y);
  const moves=getMoves(dragData);
  clearHighlights();
  if(!moves.some(m=>m.x===x&&m.y===y)) return;
  saveHistory();
  if(dragData.from){
    const arr=dragData.from.startsWith('b')?captured.black:captured.white;
    const idx=parseInt(dragData.from.slice(1));
    const p=arr.splice(idx,1)[0];
    p.o=turn; p.p=false;
    board[y][x]=p;
  }else{
    const p=board[dragData.y][dragData.x];
    if(board[y][x]){
      const cap=board[y][x];
      cap.o=turn; cap.p=false;
      captured[turn].push(cap);
    }
    board[dragData.y][dragData.x]=null;
    if(shouldPromote(p,dragData.y,y)) p.p=true;
    board[y][x]=p;
  }
  if(isKingCaptured()){
    alert(turn==='black'?'先手の勝ち':'後手の勝ち');
    initBoard();
  }else{
    turn=turn==='black'?'white':'black';
    if(isCheck(turn)){
      if(isCheckmate(turn)) alert('詰み!');
      else alert('王手!');
    }
  }
  render();
}

function shouldPromote(p,fromY,toY){
  if(p.t==='K'||p.t==='G') return false;
  const zone=p.o==='black'? [0,1,2]:[6,7,8];
  if(zone.includes(fromY)||zone.includes(toY)) return confirm('成りますか?');
  return false;
}

function getMoves(data){
  let p,x,y;
  if(data.from){
    const arr=data.from.startsWith('b')?captured.black:captured.white;
    p={...arr[parseInt(data.from.slice(1))], o:turn, p:false};
    x=null;y=null;
  }else{
    p=board[data.y][data.x];
    if(!p || p.o!==turn) return [];
    x=data.x; y=data.y;
  }
  const dirs=getDirections(p);
  const moves=[];
  dirs.forEach(d=>{
    let cx=x, cy=y;
    while(true){
      const nx=(cx==null?0:cx)+ (p.o==='black'?d.dx:-d.dx);
      const ny=(cy==null?0:cy)+ (p.o==='black'?d.dy:-d.dy);
      if(nx<0||nx>8||ny<0||ny>8) break;
      if(board[ny][nx] && board[ny][nx].o===p.o) break;
      moves.push({x:nx,y:ny});
      if(board[ny][nx] || !d.repeat) break;
      cx=nx; cy=ny;
    }
  });
  return moves;
}

function getDirections(p){
  const key=p.p? (p.t==='R'? 'PR': p.t==='B'? 'PB': p.t==='P'? 'PT': p.t==='S'||p.t==='N'||p.t==='L'? 'G': p.t) : p.t;
  const info=PIECE_TYPES[key];
  let dirs=[];
  dirs.push(...info.move());
  if(info.extra) dirs.push(...info.extra());
  return dirs;
}

function kingMoves(){return [dir(-1,-1),dir(-1,0),dir(-1,1),dir(0,-1),dir(0,1),dir(1,-1),dir(1,0),dir(1,1)];}
function goldMoves(){return [dir(-1,-1),dir(-1,0),dir(-1,1),dir(0,-1),dir(0,1),dir(1,0)];}
function silverMoves(){return [dir(-1,-1),dir(-1,0),dir(-1,1),dir(1,-1),dir(1,1)];}
function knightMoves(){return [dir(-2,-1),dir(-2,1)];}
function lanceMoves(){return [dir(-1,0,true)];}
function pawnMoves(){return [dir(-1,0)];}
function rookMoves(){return [dir(-1,0,true),dir(1,0,true),dir(0,-1,true),dir(0,1,true)];}
function bishopMoves(){return [dir(-1,-1,true),dir(-1,1,true),dir(1,-1,true),dir(1,1,true)];}
function kingDiag(){return [dir(-1,-1),dir(-1,1),dir(1,-1),dir(1,1)];}
function kingOrth(){return [dir(-1,0),dir(0,-1),dir(0,1),dir(1,0)];}

function dir(dy,dx,repeat=false){return {dy,dx,repeat};}

function highlight(moves){
  moves.forEach(m=>{
    const cell=document.querySelector(`.cell[data-x="${m.x}"][data-y="${m.y}"]`);
    if(cell) cell.classList.add('highlight');
  });
}
function clearHighlights(){
  document.querySelectorAll('.cell.highlight').forEach(c=>c.classList.remove('highlight'));
}

function isKingCaptured(){
  let bk=false,wk=false;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p){
        if(p.t==='K' && p.o==='black') bk=true;
        if(p.t==='K' && p.o==='white') wk=true;
      }
    }
  }
  return !(bk && wk);
}

function findKing(o){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p && p.t==='K' && p.o===o) return {x,y};
    }
  }
  return null;
}

function isCheck(player){
  const kingPos=findKing(player);
  if(!kingPos) return false;
  const opponent=player==='black'?'white':'black';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p && p.o===opponent){
        const moves=getMoves({x,y});
        if(moves.some(m=>m.x===kingPos.x && m.y===kingPos.y)) return true;
      }
    }
  }
  return false;
}

function isCheckmate(player){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p && p.o===player){
        const moves=getMoves({x,y});
        for(const m of moves){
          const backup=cloneState();
          const target=board[m.y][m.x];
          board[m.y][m.x]=p;
          board[y][x]=null;
          if(target){
            captured[player].push(target);
          }
          const inCheck=isCheck(player);
          restoreState(backup);
          if(!inCheck) return false;
        }
      }
    }
  }
  return true;
}

window.addEventListener('load',()=>{
  initBoard();
  render();
  document.getElementById('undoButton').addEventListener('click',undo);
});
