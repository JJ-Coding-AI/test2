const boardElem=document.getElementById('board');
const statusElem=document.getElementById('status');
const blackHandElem=document.getElementById('black-hand');
const whiteHandElem=document.getElementById('white-hand');
const undoBtn=document.getElementById('undo');

let board=[];
let hands={black:[],white:[]};
let history=[];
let turn='black';
let dragging=null;
let aiThinking=false;

const pieceNames={K:'王',R:'飛',B:'角',G:'金',S:'銀',N:'桂',L:'香',P:'歩',PR:'龍',PB:'馬',PS:'成銀',PN:'成桂',PL:'成香',PP:'と'};
const pieceValues={K:10000,R:500,B:400,G:300,S:250,N:200,L:200,P:100,PR:600,PB:500,PS:300,PN:300,PL:300,PP:200};

function clone(obj){return JSON.parse(JSON.stringify(obj));}
function initialBoard(){
  board=Array.from({length:9},()=>Array(9).fill(null));
  const b='black', w='white';
  board[0]=[{p:'L',c:w},{p:'N',c:w},{p:'S',c:w},{p:'G',c:w},{p:'K',c:w},{p:'G',c:w},{p:'S',c:w},{p:'N',c:w},{p:'L',c:w}];
  board[1][1]={p:'B',c:w};
  board[1][7]={p:'R',c:w};
  board[2]=Array(9).fill(null).map(()=>({p:'P',c:w}));
  board[6]=Array(9).fill(null).map(()=>({p:'P',c:b}));
  board[7][1]={p:'R',c:b};
  board[7][7]={p:'B',c:b};
  board[8]=[{p:'L',c:b},{p:'N',c:b},{p:'S',c:b},{p:'G',c:b},{p:'K',c:b},{p:'G',c:b},{p:'S',c:b},{p:'N',c:b},{p:'L',c:b}];
  hands={black:[],white:[]};
  history=[];
  turn='black';
  updateBoard();
  updateHands();
  setStatus();
}
function setStatus(text){
  statusElem.textContent=text|| (turn==='black'?'先手の番です':'後手の番です');
}

function updateBoard(){
  boardElem.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.x=x; cell.dataset.y=y;
      const p=board[y][x];
      if(p){
        cell.textContent=pieceNames[p.p];
        if(p.c==='white') cell.style.transform='rotate(180deg)';
      }
      boardElem.appendChild(cell);
    }
  }
}

function updateHands(){
  blackHandElem.innerHTML=hands.black.map((p,i)=>`<span class='hand-piece' data-idx='${i}' data-color='black'>${pieceNames[p.p]}</span>`).join(' ');
  whiteHandElem.innerHTML=hands.white.map((p,i)=>`<span class='hand-piece' data-idx='${i}' data-color='white'>${pieceNames[p.p]}</span>`).join(' ');
}
function addEventListeners(){
  boardElem.addEventListener('mousedown',onBoardDown);
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
  blackHandElem.addEventListener('mousedown',onHandDown);
  whiteHandElem.addEventListener('mousedown',onHandDown);
  undoBtn.addEventListener('click',undo);
}

function onBoardDown(e){
  if(aiThinking) return;
  const cell=e.target.closest('.cell');
  if(!cell) return;
  const x=+cell.dataset.x,y=+cell.dataset.y;
  const piece=board[y][x];
  if(!piece||piece.c!==turn) return;
  dragging={type:'move',from:{x,y},piece:clone(piece)};
  cell.classList.add('dragging');
  highlightMoves(x,y,piece);
}

function onHandDown(e){
  if(aiThinking) return;
  const span=e.target.closest('.hand-piece');
  if(!span) return;
  const color=span.dataset.color;
  if(color!==turn) return;
  const idx=+span.dataset.idx;
  const piece=hands[color][idx];
  dragging={type:'drop',from:{hand:idx},piece:clone(piece)};
  span.classList.add('dragging');
  highlightDrops(piece);
}

function onMove(e){ if(dragging){} }

function onUp(e){
  if(!dragging){clearHighlights();return;}
  const cell=e.target.closest('.cell');
  if(dragging.type==='move'&&cell){
    const x=+cell.dataset.x,y=+cell.dataset.y;
    const mv=legalMoves(dragging.from.x,dragging.from.y,dragging.piece).find(m=>m.x===x&&m.y===y);
    if(mv) makeMove({from:dragging.from,to:{x,y},piece:dragging.piece,promote:mv.promote});
  }else if(dragging.type==='drop'&&cell){
    const x=+cell.dataset.x,y=+cell.dataset.y;
    const ok=legalDrops(dragging.piece).some(m=>m.x===x&&m.y===y);
    if(ok) makeDrop({to:{x,y},piece:dragging.piece,handIdx:dragging.from.hand});
  }
  document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));
  dragging=null; clearHighlights();
}

function clearHighlights(){document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));}

function highlightMoves(x,y,piece){
  clearHighlights();
  for(const m of legalMoves(x,y,piece)){
    const c=boardElem.querySelector(`[data-x='${m.x}'][data-y='${m.y}']`);
    if(c) c.classList.add('highlight');
  }
}

function highlightDrops(piece){
  clearHighlights();
  for(const m of legalDrops(piece)){
    const c=boardElem.querySelector(`[data-x='${m.x}'][data-y='${m.y}']`);
    if(c) c.classList.add('highlight');
  }
}
function inside(x,y){return x>=0&&x<9&&y>=0&&y<9;}

function legalMoves(x,y,piece){
  const dirs={
    K:[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]],
    R:[[0,-1],[0,1],[-1,0],[1,0]],
    B:[[-1,-1],[1,-1],[-1,1],[1,1]],
    G:[[0,-1],[-1,-1],[1,-1],[-1,0],[1,0],[0,1]],
    S:[[0,-1],[-1,-1],[1,-1],[-1,1],[1,1]],
    N:[[-1,-2],[1,-2]],
    L:[[0,-1]],
    P:[[0,-1]]
  };
  let moves=[];
  const isW=piece.c==='white';
  const f=isW?1:-1;
  const p=piece.p.replace('P','');
  const arr=dirs[p]||[];
  const slide=['R','B','L'].includes(p);
  for(const [dx,dy] of arr){
    for(let i=1;;i++){
      const nx=x+(slide?dx*i:dx)*(isW?-1:1);
      const ny=y+(slide?dy*i:dy)*f;
      if(!inside(nx,ny)) break;
      const t=board[ny][nx];
      if(t&&t.c===piece.c) break;
      let promote=false;
      const inZone=isW?ny>=6:ny<=2;
      const fromZone=isW?y>=6:y<=2;
      if(['P','L','N','S','B','R'].includes(p)&&(inZone||fromZone)){
        if(p==='B'||p==='R') promote=confirm('成りますか?');
        else if(inZone) promote=confirm('成りますか?');
      }
      moves.push({x:nx,y:ny,promote});
      if(t) break;
      if(!slide) break;
    }
  }
  if(piece.promoted){
    if(['P','L','N','S'].includes(p)){
      for(const [dx,dy] of dirs.G){
        const nx=x+dx*(isW?-1:1); const ny=y+dy*f;
        if(!inside(nx,ny)) continue;
        const t=board[ny][nx];
        if(!t||t.c!==piece.c) moves.push({x:nx,y:ny,promote:false});
      }
    }
    if(p==='R'){
      for(const [dx,dy] of dirs.B){
        const nx=x+dx*(isW?-1:1); const ny=y+dy*f;
        if(!inside(nx,ny)) continue;
        const t=board[ny][nx];
        if(!t||t.c!==piece.c) moves.push({x:nx,y:ny,promote:false});
      }
    }
    if(p==='B'){
      for(const [dx,dy] of dirs.R){
        const nx=x+dx*(isW?-1:1); const ny=y+dy*f;
        if(!inside(nx,ny)) continue;
        const t=board[ny][nx];
        if(!t||t.c!==piece.c) moves.push({x:nx,y:ny,promote:false});
      }
    }
  }
  return moves;
}

function legalDrops(piece){
  let list=[];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(board[y][x]) continue;
      if(piece.p==='P'){
        let has=false;
        for(let yy=0;yy<9;yy++){
          const t=board[yy][x];
          if(t&&t.c===turn&&t.p==='P'&&!t.promoted){has=true;break;}
        }
        if(has) continue;
        if((turn==='black'&&y===0)||(turn==='white'&&y===8)) continue;
      }
      list.push({x,y});
    }
  }
  return list;
}
function makeMove(m){
  history.push(clone({board,hands,turn}));
  board[m.from.y][m.from.x]=null;
  if(board[m.to.y][m.to.x]){
    const cap=board[m.to.y][m.to.x];
    cap.c=turn; cap.promoted=false;
    hands[turn].push(cap);
  }
  const moving=clone(m.piece);
  if(m.promote) moving.promoted=true;
  board[m.to.y][m.to.x]=moving;
  turn=turn==='black'?'white':'black';
  updateBoard();
  updateHands();
  checkEnd();
  if(!aiThinking) aiTurn();
}

function makeDrop(d){
  history.push(clone({board,hands,turn}));
  const piece=clone(d.piece);
  hands[turn].splice(d.handIdx,1);
  board[d.to.y][d.to.x]=piece;
  turn=turn==='black'?'white':'black';
  updateBoard();
  updateHands();
  checkEnd();
  if(!aiThinking) aiTurn();
}

function undo(){
  if(history.length===0||aiThinking) return;
  const last=history.pop();
  board=last.board; hands=last.hands; turn=last.turn;
  updateBoard(); updateHands(); setStatus();
}

function evaluate(){
  let score=0;
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=board[y][x];
    if(p){
      const val=pieceValues[p.promoted?('P'+p.p):p.p];
      score+=(p.c==='black'?val:-val);
    }
  }
  for(const p of hands.black) score+=pieceValues[p.p];
  for(const p of hands.white) score-=pieceValues[p.p];
  return score;
}

function generateMoves(color){
  let ms=[];
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=board[y][x];
    if(p&&p.c===color){
      for(const m of legalMoves(x,y,p)) ms.push({from:{x,y},to:{x:m.x,y:m.y},piece:p,promote:m.promote});
    }
  }
  hands[color].forEach((p,idx)=>{
    for(const d of legalDrops(p)) ms.push({drop:true,to:{x:d.x,y:d.y},piece:p,handIdx:idx});
  });
  return ms;
}
function aiTurn(){
  if(turn!=='white') return;
  aiThinking=true;
  setStatus('考え中...');
  setTimeout(()=>{
    const moves=generateMoves('white');
    let bestScore=-Infinity,best=null;
    for(const m of moves){
      const backup=clone({board,hands,turn});
      if(m.drop) makeDrop(m); else makeMove(m);
      const score=evaluate();
      if(score>bestScore){bestScore=score; best=m;}
      board=backup.board; hands=backup.hands; turn='white';
    }
    if(best){if(best.drop) makeDrop(best); else makeMove(best);}
    aiThinking=false;
    setStatus();
  },200);
}

function isInCheck(color){
  let kx=-1,ky=-1;
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){ const p=board[y][x]; if(p&&p.c===color&&p.p==='K'){kx=x;ky=y;}}
  const enemy=color==='black'?'white':'black';
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){ const p=board[y][x]; if(p&&p.c===enemy){ for(const m of legalMoves(x,y,p)){ if(m.x===kx&&m.y===ky) return true; }}}
  return false;
}

function isCheckmate(color){
  if(!isInCheck(color)) return false;
  const moves=generateMoves(color);
  for(const m of moves){
    const backup=clone({board,hands,turn});
    if(m.drop) makeDrop(m); else makeMove(m);
    const chk=isInCheck(color);
    board=backup.board; hands=backup.hands; turn=backup.turn;
    if(!chk) return false;
  }
  return true;
}

function checkEnd(){
  const opp=turn==='black'?'white':'black';
  if(isCheckmate(opp)){
    setStatus(turn==='black'?'先手の勝ち!':'後手の勝ち!');
    setTimeout(initialBoard,1000);
  }else{
    setStatus();
  }
}

initialBoard();
addEventListeners();
