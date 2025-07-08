class ShogiGame{
  constructor(){
    this.reset();
  }
  reset(){
    // board[y][x] = {p:'P', c:1, pro:false}
    const s=(p,c,pro=false)=>({p,c,pro});
    this.board=[
      [s('L',-1),s('N',-1),s('S',-1),s('G',-1),s('K',-1),s('G',-1),s('S',-1),s('N',-1),s('L',-1)],
      [null,s('R',-1),null,null,null,null,null,s('B',-1),null],
      [s('P',-1),s('P',-1),s('P',-1),s('P',-1),s('P',-1),s('P',-1),s('P',-1),s('P',-1),s('P',-1)],
      [null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null],
      [s('P',1),s('P',1),s('P',1),s('P',1),s('P',1),s('P',1),s('P',1),s('P',1),s('P',1)],
      [null,s('B',1),null,null,null,null,null,s('R',1),null],
      [s('L',1),s('N',1),s('S',1),s('G',1),s('K',1),s('G',1),s('S',1),s('N',1),s('L',1)]
    ];
    this.hands={1:{},-1:{}};
    this.turn=1; // 1: sente, -1: gote
    this.moveCount=0;
    this.history=[];
  }
}

const PIECE_NAMES={
  P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛',K:'王',
  '+P':'と','+L':'成香','+N':'成桂','+S':'成銀','+B':'馬','+R':'龍'
};

function createCell(x,y){
  const d=document.createElement('div');
  d.className='cell';
  d.dataset.x=x;d.dataset.y=y;
  d.addEventListener('dragover',e=>e.preventDefault());
  d.addEventListener('drop',dropPiece);
  d.addEventListener('click',cellClick);
  return d;
}

const boardEl=document.getElementById('board');
const turnEl=document.getElementById('turn');
const movesEl=document.getElementById('moves');
const messageEl=document.getElementById('message');
const handS=document.getElementById('hand-sente');
const handG=document.getElementById('hand-gote');
const game=new ShogiGame();

function render(){
  boardEl.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell=createCell(x,y);
      const piece=game.board[y][x];
      if(piece){
        const p=document.createElement('div');
        p.className='piece'+(piece.c===-1?' white':'')+(piece.pro?' promoted':'');
        p.draggable=true;
        p.textContent=PIECE_NAMES[(piece.pro?'+':'')+piece.p]||piece.p;
        p.dataset.x=x;p.dataset.y=y;
        p.addEventListener('dragstart',startDrag);
        p.addEventListener('click',pieceClick);
        cell.appendChild(p);
      }
      boardEl.appendChild(cell);
    }
  }
  updateHands();
  turnEl.textContent=game.turn===1?'先手番':'後手番';
  movesEl.textContent=game.moveCount+' 手';
}

function updateHands(){
  handS.textContent=handToString(game.hands[1]);
  handG.textContent=handToString(game.hands[-1]);
}
function handToString(h){
  return Object.keys(h).map(k=>PIECE_NAMES[k]+(h[k]>1?h[k]:'')).join(' ');
}

let dragSrc=null; // {x,y} or piece from hand
let legalMoves=[];

function pieceClick(e){
  const x=parseInt(e.target.dataset.x); const y=parseInt(e.target.dataset.y);
  selectPiece(x,y);
}
function selectPiece(x,y){
  clearHighlights();
  const piece=game.board[y][x];
  if(!piece || piece.c!==game.turn)return;
  dragSrc={x,y};
  legalMoves=generateMovesFor(x,y,piece);
  highlightMoves(legalMoves);
}
function cellClick(e){
  if(!dragSrc)return;
  const x=parseInt(e.currentTarget.dataset.x);
  const y=parseInt(e.currentTarget.dataset.y);
  for(const m of legalMoves){
    if(m.to.x===x && m.to.y===y){
      makeMove(m);
      dragSrc=null;clearHighlights();
      aiTurn();
      return;
    }
  }
  dragSrc=null;clearHighlights();
}

function startDrag(e){
  const x=parseInt(e.target.dataset.x); const y=parseInt(e.target.dataset.y);
  const piece=game.board[y][x];
  if(piece.c!==game.turn){e.preventDefault();return;}
  dragSrc={x,y};
  legalMoves=generateMovesFor(x,y,piece);
  highlightMoves(legalMoves);
}
function dropPiece(e){
  e.preventDefault();
  if(!dragSrc)return;
  const x=parseInt(e.currentTarget.dataset.x);
  const y=parseInt(e.currentTarget.dataset.y);
  for(const m of legalMoves){
    if(m.to.x===x && m.to.y===y){
      makeMove(m);
      dragSrc=null;clearHighlights();
      aiTurn();
      return;
    }
  }
  dragSrc=null;clearHighlights();
}

function highlightMoves(moves){
  moves.forEach(m=>{
    const cell=document.querySelector(`.cell[data-x='${m.to.x}'][data-y='${m.to.y}']`);
    if(cell)cell.classList.add('highlight');
  });
}
function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(c=>c.classList.remove('highlight'));
}

function makeMove(m){
  game.history.push(JSON.stringify(game));
  if(game.history.length>100)game.history.shift();
  if(m.drop){
    deleteFromHand(game.turn,m.piece);
    game.board[m.to.y][m.to.x]={p:m.piece,c:game.turn,pro:false};
  }else{
    const piece=game.board[m.from.y][m.from.x];
    let target=game.board[m.to.y][m.to.x];
    if(target){
      addToHand(game.turn,target);
    }
    game.board[m.from.y][m.from.x]=null;
    piece.pro = piece.pro || m.promote;
    game.board[m.to.y][m.to.x]=piece;
  }
  game.turn*=-1;
  game.moveCount++;
  render();
}
function addToHand(color,p){
  const key=(p.pro?'+':'')+p.p;
  game.hands[color][key]=(game.hands[color][key]||0)+1;
}
function deleteFromHand(color,piece){
  game.hands[color][piece]--; if(game.hands[color][piece]<=0)delete game.hands[color][piece];
}

function generateMovesFor(x,y,piece){
  const moves=[];
  const dirs={
    P:[[0,-1]],L:[[0,-1,8]],N:[[1,-2,1],[-1,-2,1]],S:[[0,-1],[1,-1],[-1,-1],[1,1],[-1,1]],
    G:[[0,-1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0]],K:[[0,-1],[1,-1],[-1,-1],[1,1],[-1,1],[0,1],[1,0],[-1,0]],
    B:[[1,1,8],[1,-1,8],[-1,1,8],[-1,-1,8]],R:[[0,1,8],[0,-1,8],[1,0,8],[-1,0,8]]
  };
  const d=dirs[piece.p];
  const forward=piece.c===1?-1:1;
  if(piece.pro){
    if(piece.p==='B')d.push([0,1],[0,-1],[1,0],[-1,0]);
    if(piece.p==='R')d.push([1,1],[1,-1],[-1,1],[-1,-1]);
    if(['P','L','N','S'].includes(piece.p)){
      return generateMovesFor(x,y,{p:'G',c:piece.c,pro:false});
    }
  }
  d.forEach(v=>{
    const [dx,dy,range]=v;let nx=x,ny=y;let r=range||1;while(r--){nx+=dx;ny+=dy*forward; if(nx<0||nx>8||ny<0||ny>8)break;let t=game.board[ny][nx]; if(!t){moves.push({from:{x,y},to:{x:nx,y:ny},promote:false});}else{if(t.c!==piece.c)moves.push({from:{x,y},to:{x:nx,y:ny},promote:false});break;}}});
  // promotion
  const zone=piece.c===1? [0,1,2]:[6,7,8];
  if(['P','L','N','S','B','R'].includes(piece.p)){
    moves.forEach(m=>{
      if(zone.includes(m.from.y)||zone.includes(m.to.y))m.promote=true;
    });
  }
  return moves;
}

function aiTurn(){
  if(checkGameEnd())return;
  messageEl.textContent='考え中...';
  const worker=new Worker('aiWorker.js');
  worker.postMessage({type:'start',state:JSON.stringify(game)});
  const start=Date.now();
  worker.onmessage=e=>{
    const {move,time}=e.data;
    if(move)makeMove(move);
    messageEl.textContent='AI思考時間:'+((Date.now()-start)/1000).toFixed(2)+'秒';
    worker.terminate();
    checkGameEnd();
  };
}
function checkGameEnd(){
  // simple end: if no king
  let hasS=false,hasG=false;
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
    const p=game.board[y][x];
    if(p&&p.p==='K'){
      if(p.c===1)hasS=true;else hasG=true;
    }
  }
  if(!hasS||!hasG){
    messageEl.textContent=!hasS?'先手の負けです':'後手の負けです';
    return true;
  }
  return false;
}

document.getElementById('undo').addEventListener('click',()=>{
  if(game.history.length>=2){
    const prev=game.history.splice(-2,2)[0];
    Object.assign(game,JSON.parse(prev));
    render();
  }
});

document.getElementById('reset').addEventListener('click',()=>{
  game.reset();render();messageEl.textContent='';
});

render();
