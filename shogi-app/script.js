const boardElem = document.getElementById('board');
const messageElem = document.getElementById('message');
const capturedBlack = document.getElementById('captured-black');
const capturedWhite = document.getElementById('captured-white');
const undoBtn = document.getElementById('undo');

const initialBoard = [
  ['l','n','s','g','k','g','s','n','l'],
  ['','r','','','','','','b',''],
  ['p','p','p','p','p','p','p','p','p'],
  ['','','','','','','','',''],
  ['','','','','','','','',''],
  ['','','','','','','','',''],
  ['P','P','P','P','P','P','P','P','P'],
  ['','B','','','','','','R',''],
  ['L','N','S','G','K','G','S','N','L']
];

let board = JSON.parse(JSON.stringify(initialBoard));
let captured = { black: [], white: [] };
let history = [];
let selected = null; // {x,y,fromCapture:boolean,index:number}
let currentPlayer = 'black';

function renderBoard() {
  boardElem.innerHTML = '';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell = document.createElement('div');
      cell.className = 'cell' + ((x+y)%2?' dark':'');
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.textContent = board[y][x];
      cell.addEventListener('click', onCellClick);
      boardElem.appendChild(cell);
    }
  }
  renderCaptured();
}

function renderCaptured() {
  capturedBlack.innerHTML = '先手持駒:';
  capturedWhite.innerHTML = '後手持駒:';
  captured.black.forEach((p,i)=>{
    const div = document.createElement('div');
    div.className='captured-piece';
    div.textContent=p;
    div.dataset.player='black';
    div.dataset.index=i;
    div.addEventListener('click',onCapturedClick);
    capturedBlack.appendChild(div);
  });
  captured.white.forEach((p,i)=>{
    const div = document.createElement('div');
    div.className='captured-piece';
    div.textContent=p.toLowerCase();
    div.dataset.player='white';
    div.dataset.index=i;
    div.addEventListener('click',onCapturedClick);
    capturedWhite.appendChild(div);
  });
}

function onCapturedClick(e){
  const player = e.target.dataset.player;
  if(player!==currentPlayer)return;
  selected={fromCapture:true,index:parseInt(e.target.dataset.index),piece:captured[player][e.target.dataset.index]};
}

function onCellClick(e){
  const x = parseInt(e.target.dataset.x);
  const y = parseInt(e.target.dataset.y);
  if(selected){
    const moves = legalMoves(selected);
    if(moves.some(m=>m.x===x&&m.y===y)){
      makeMove(selected,x,y);
      clearHighlights();
      selected=null;
      checkWin();
      switchPlayer();
    }else{
      message('そこには移動できません');
    }
  }else if(board[y][x] && owner(board[y][x])===currentPlayer){
    selected={x,y,piece:board[y][x]};
    highlight(legalMoves(selected));
  }
}

function makeMove(sel,x,y){
  history.push({board:JSON.parse(JSON.stringify(board)),captured:JSON.parse(JSON.stringify(captured)),currentPlayer});
  if(sel.fromCapture){
    const piece=captured[currentPlayer].splice(sel.index,1)[0];
    board[y][x]=currentPlayer==='black'?piece:piece.toLowerCase();
  }else{
    const target = board[y][x];
    if(target){
      if(target.toLowerCase()==='k'){
        message(currentPlayer==='black'?'先手の勝ち!':'後手の勝ち!');
        reset();
        return;
      }
      captured[currentPlayer].push(target.toUpperCase());
    }
    board[sel.y][sel.x]='';
    board[y][x]=sel.piece;
  }
  renderBoard();
}

function highlight(moves){
  clearHighlights();
  moves.forEach(m=>{
    const cell = boardElem.querySelector(`[data-x="${m.x}"][data-y="${m.y}"]`);
    if(cell)cell.classList.add('highlight');
  });
}

function clearHighlights(){
  boardElem.querySelectorAll('.highlight').forEach(c=>c.classList.remove('highlight'));
}

function legalMoves(sel){
  const dirs={
    p:[[0,-1]],
    P:[[0,1]],
    l:[[0,-1]],
    L:[[0,1]],
    n:[[ -1,-2],[1,-2]],
    N:[[ -1,2],[1,2]],
    s:[[ -1,-1],[0,-1],[1,-1],[ -1,1],[1,1]],
    S:[[ -1,1],[0,1],[1,1],[ -1,-1],[1,-1]],
    g:[[ -1,-1],[0,-1],[1,-1],[ -1,0],[1,0],[0,1]],
    G:[[ -1,1],[0,1],[1,1],[ -1,0],[1,0],[0,-1]],
    k:[[ -1,-1],[0,-1],[1,-1],[ -1,0],[1,0],[ -1,1],[0,1],[1,1]],
    K:[[ -1,1],[0,1],[1,1],[ -1,0],[1,0],[ -1,-1],[0,-1],[1,-1]],
    b:[[ -1,-1],[1,-1],[ -1,1],[1,1]],
    B:[[ -1,-1],[1,-1],[ -1,1],[1,1]],
    r:[[0,-1],[0,1],[-1,0],[1,0]],
    R:[[0,-1],[0,1],[-1,0],[1,0]],
  };
  let moves=[];
  if(sel.fromCapture){
    for(let y=0;y<9;y++){
      for(let x=0;x<9;x++){
        if(board[y][x]==''){
          if(sel.piece==='P' && hasPawn(currentPlayer,x))continue;
          moves.push({x,y});
        }
      }
    }
    return moves;
  }
  const piece = sel.piece;
  const d=dirs[piece];
  if(!d)return moves;
  d.forEach(dir=>{
    let nx=sel.x+dir[0];
    let ny=sel.y+dir[1];
    if(nx<0||ny<0||nx>=9||ny>=9)return;
    const target=board[ny][nx];
    if(!target||owner(target)!==currentPlayer)moves.push({x:nx,y:ny});
  });
  if(piece.toLowerCase()==='b' || piece.toLowerCase()==='r'){
    const lines=dirs[piece];
    lines.forEach(dir=>{
      let nx=sel.x+dir[0];
      let ny=sel.y+dir[1];
      while(nx>=0&&ny>=0&&nx<9&&ny<9){
        const target=board[ny][nx];
        if(!target){
          moves.push({x:nx,y:ny});
        }else{
          if(owner(target)!==currentPlayer)moves.push({x:nx,y:ny});
          break;
        }
        nx+=dir[0];
        ny+=dir[1];
      }
    });
  }
  return moves;
}

function owner(piece){
  return piece===piece.toUpperCase()? 'black':'white';
}

function hasPawn(player,x){
  for(let y=0;y<9;y++){
    const p = board[y][x];
    if(p===(player==='black'?'P':'p'))return true;
  }
  return false;
}

function switchPlayer(){
  currentPlayer=currentPlayer==='black'?'white':'black';
}

undoBtn.addEventListener('click',()=>{
  if(history.length){
    const last=history.pop();
    board=last.board;
    captured=last.captured;
    currentPlayer=last.currentPlayer;
    renderBoard();
    message('');
  }
});

function message(msg){
  messageElem.textContent=msg;
}

function reset(){
  board=JSON.parse(JSON.stringify(initialBoard));
  captured={black:[],white:[]};
  history=[];
  currentPlayer='black';
  renderBoard();
}

function checkWin(){
  const opponent=currentPlayer==='black'?'white':'black';
  const kingPos=findKing(opponent);
  if(!kingPos){
    message(currentPlayer==='black'?'先手の勝ち!':'後手の勝ち!');
    reset();
    return;
  }
  if(isCheckmated(opponent)){
    message(currentPlayer==='black'?'先手の勝ち!':'後手の勝ち!');
    reset();
  }
}

function findKing(player){
  const k=player==='black'?'K':'k';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(board[y][x]===k)return {x,y};
    }
  }
  return null;
}

function isCheck(player){
  const king=findKing(player);
  if(!king)return false;
  const opponent=player==='black'?'white':'black';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p&&owner(p)===opponent){
        const moves=legalMoves({x,y,piece:p});
        if(moves.some(m=>m.x===king.x&&m.y===king.y))return true;
      }
    }
  }
  return false;
}

function isCheckmated(player){
  if(!isCheck(player))return false;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const p=board[y][x];
      if(p&&owner(p)===player){
        const moves=legalMoves({x,y,piece:p});
        for(const m of moves){
          const saved=board[m.y][m.x];
          board[m.y][m.x]=p;
          board[y][x]='';
          const check=isCheck(player);
          board[y][x]=p;
          board[m.y][m.x]=saved;
          if(!check)return false;
        }
      }
    }
  }
  return true;
}

renderBoard();
