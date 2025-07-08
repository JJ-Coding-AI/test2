const boardElem=document.getElementById('board');
const playerHandElem=document.getElementById('player-hand');
const aiHandElem=document.getElementById('ai-hand');
const turnElem=document.getElementById('turn');
const undoBtn=document.getElementById('undo');
const worker=new Worker('aiWorker.js');

const pieceSymbols={
 '歩':'歩','香':'香','桂':'桂','銀':'銀','金':'金','角':'角',
 '飛':'飛','王':'王','と':'と','杏':'杏','圭':'圭','全':'全',
 '馬':'馬','竜':'竜'
};

let state;let history=[];let selected=null;let dropPiece=null;let legalMoves=[];

function clone(obj){return JSON.parse(JSON.stringify(obj));}

function init(){
 state={
  board:Array.from({length:9},()=>Array(9).fill(null)),
  hands:{player:{},ai:{}},
  turn:'player'
 };
 const b=state.board;
 function place(x,y,type,owner){b[y][x]={type,owner};}
 // initial positions
 const piecesRow=['香','桂','銀','金','王','金','銀','桂','香'];
 piecesRow.forEach((p,i)=>{place(i,8,p,'player');place(8-i,0,p,'ai');});
 place(1,7,'飛','player');place(7,1,'飛','ai');
 place(7,7,'角','player');place(1,1,'角','ai');
 for(let i=0;i<9;i++){place(i,6,'歩','player');place(i,2,'歩','ai');}
 render();
}

function render(){
 boardElem.innerHTML='';
 for(let y=0;y<9;y++){
  for(let x=0;x<9;x++){
   const cell=document.createElement('div');
   cell.className='cell';
   cell.dataset.x=x;cell.dataset.y=y;
   const p=state.board[y][x];
   if(p){
    const piece=document.createElement('div');
    piece.className='piece '+(p.owner==='ai'? 'ai':'');
    piece.textContent=pieceSymbols[p.type];
    piece.addEventListener('click',()=>selectPiece(x,y));
    cell.appendChild(piece);
   }
   if(legalMoves.some(m=>m.x===x&&m.y===y))cell.classList.add('highlight');
   cell.addEventListener('click',()=>moveHere(x,y));
   boardElem.appendChild(cell);
  }
 }
 playerHandElem.innerHTML='';
 Object.entries(state.hands.player).forEach(([t,c])=>{
  for(let i=0;i<c;i++){
   const piece=document.createElement('div');
   piece.className='piece';
   piece.textContent=pieceSymbols[t];
   piece.addEventListener('click',()=>selectDrop(t));
   playerHandElem.appendChild(piece);
  }
 });
 aiHandElem.innerHTML='';
 Object.entries(state.hands.ai).forEach(([t,c])=>{
  for(let i=0;i<c;i++){
   const piece=document.createElement('div');
   piece.className='piece ai';
   piece.textContent=pieceSymbols[t];
   aiHandElem.appendChild(piece);
  }
 });
 turnElem.textContent=state.turn==='player'?'先手番':'後手番';
}

function selectPiece(x,y){
 if(state.turn!=='player')return;
 const p=state.board[y][x];
 if(!p||p.owner!=='player'){selected=null;legalMoves=[];render();return;}
 selected={x,y,piece:p};
 legalMoves=generateMoves(x,y,p);
 render();
}

function selectDrop(type){
 if(state.turn!=='player')return;
 if(!state.hands.player[type])return;
 dropPiece={type};
 legalMoves=generateDrops(type);
 render();
}

function moveHere(x,y){
 if(selected){
  const move=legalMoves.find(m=>m.x===x&&m.y===y);
  if(move){makeMove(selected.x,selected.y,x,y,move.promote);}
 }else if(dropPiece){
  const move=legalMoves.find(m=>m.x===x&&m.y===y);
  if(move){makeDrop(dropPiece.type,x,y);}
 }
}

function makeMove(sx,sy,dx,dy,promote){
 history.push(clone(state));
 const p=state.board[sy][sx];
 const target=state.board[dy][dx];
 if(target){state.hands[state.turn][demote(target.type)]=(state.hands[state.turn][demote(target.type)]||0)+1;}
 state.board[sy][sx]=null;
 state.board[dy][dx]=p;
 if(promote)p.type=promotePiece(p.type);
 toggleTurn();
 render();
 if(state.turn==='ai')aiTurn();
}

function makeDrop(type,x,y){
 history.push(clone(state));
 state.hands.player[type]--; if(state.hands.player[type]===0)delete state.hands.player[type];
 state.board[y][x]={type,owner:'player'};
 toggleTurn();
 render();
 if(state.turn==='ai')aiTurn();
}

function toggleTurn(){state.turn=state.turn==='player'?'ai':'player';}

function undo(){
 if(history.length>=2){history.pop();state=history.pop();render();worker.postMessage({type:'stop'});}
}

undoBtn.addEventListener('click',undo);
worker.onmessage=e=>{if(e.data.type==='bestmove'){applyAIMove(e.data.move);}};

function aiTurn(){
 const fen=toSFEN();
 worker.postMessage({type:'go',fen});
}

function applyAIMove(m){
 if(!m)return;
 if(m.drop){state.hands.ai[m.drop]--;state.board[m.y][m.x]={type:m.drop,owner:'ai'};}
 else {
  const p=state.board[m.sy][m.sx];
  const target=state.board[m.y][m.x];
  if(target){state.hands.ai[demote(target.type)]=(state.hands.ai[demote(target.type)]||0)+1;}
  state.board[m.sy][m.sx]=null;state.board[m.y][m.x]=p;if(m.promote)p.type=promotePiece(p.type);
 }
 toggleTurn();
 history.push(clone(state));
 render();
}

function promotePiece(t){return ({'歩':'と','香':'杏','桂':'圭','銀':'全','角':'馬','飛':'竜'})[t]||t;}
function demote(t){return ({'と':'歩','杏':'香','圭':'桂','全':'銀','馬':'角','竜':'飛'})[t]||t;}

function inside(x,y){return x>=0&&x<9&&y>=0&&y<9;}
function enemy(owner){return owner==='player'?'ai':'player';}

function generateMoves(x,y,p){
 const dir=p.owner==='player'?-1:1;
 const moves=[];
 const t=p.type;
 const patterns={
  '歩':[[0,dir]],
  '香':Array.from({length:8},(_,i)=>[0,dir*(i+1)]),
  '桂':[[1,2*dir],[-1,2*dir]],
  '銀':[[0,dir],[1,dir],[-1,dir],[1,-dir],[-1,-dir]],
  '金':[[0,dir],[1,dir],[-1,dir],[0,-dir],[1,0],[-1,0]],
  '王':[[0,1],[1,1],[-1,1],[0,-1],[1,0],[-1,0],[1,-1],[-1,-1]],
  '角':[[1,1],[-1,1],[1,-1],[-1,-1]],
  '飛':[[0,1],[1,0],[-1,0],[0,-1]],
  '馬':[[1,1],[-1,1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0],[0,-1]],
  '竜':[[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]],
  'と':[[0,dir],[1,0],[-1,0],[0,-dir],[1,dir],[-1,dir]],
  '杏':[[0,dir],[0,-dir],[1,0],[-1,0],[1,dir],[-1,dir]],
  '圭':[[0,dir],[0,-dir],[1,0],[-1,0],[1,dir],[-1,dir]],
  '全':[[0,dir],[0,-dir],[1,0],[-1,0],[1,dir],[-1,dir]]
 };
 const longRange=['香','角','飛','馬','竜'];
 const dirs=patterns[t];
 dirs.forEach(d=>{
  let nx=x+d[0],ny=y+d[1];
  while(inside(nx,ny)){
   const target=state.board[ny][nx];
   if(target&&target.owner===p.owner)break;
   if(isLegalAfterMove(x,y,nx,ny,p)){
    moves.push({x:nx,y:ny,promote:shouldPromote(p,x,y,nx,ny)?promotePiece(t):null});
    moves.push({x:nx,y:ny});
   }
   if(target)break;
   if(!longRange.includes(t))break;
   nx+=d[0];ny+=d[1];
  }
 });
 return moves;
}

function generateDrops(type){
 const moves=[];
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){
  if(!state.board[y][x]&&isLegalDrop(type,x,y))moves.push({x,y});
 }
 return moves;
}

function isLegalDrop(type,x,y){
 if(state.board[y][x])return false;
 if(type==='歩'){
  for(let ty=0;ty<9;ty++)if(state.board[ty][x]&&state.board[ty][x].owner==='player'&&state.board[ty][x].type==='歩')return false;
  if(y===0)return false;
 }
 return !wouldLeaveKingInCheckDrop(type,x,y);
}

function isLegalAfterMove(sx,sy,dx,dy,p){
 const snapshot=clone(state);
 const moving=state.board[sy][sx];
 const capture=state.board[dy][dx];
 state.board[sy][sx]=null;state.board[dy][dx]=moving;
 const kingPos=findKing(p.owner);
 const inCheck=isAttacked(kingPos.x,kingPos.y,enemy(p.owner));
 state.board[sy][sx]=moving;state.board[dy][dx]=capture;
 return !inCheck;
}

function wouldLeaveKingInCheckDrop(type,x,y){
 const snapshot=clone(state);
 state.board[y][x]={type,owner:'player'};
 const kingPos=findKing('player');
 const inCheck=isAttacked(kingPos.x,kingPos.y,'ai');
 state.board[y][x]=null;
 return inCheck;
}

function shouldPromote(p,sx,sy,dx,dy){
 const zone=p.owner==='player'?dy<=2||sy<=2:dy>=6||sy>=6;
 const promotable=['歩','香','桂','銀','角','飛'];
 return zone&&promotable.includes(p.type);
}

function isAttacked(x,y,by){
 for(let sy=0;sy<9;sy++)for(let sx=0;sx<9;sx++){
  const p=state.board[sy][sx];
  if(p&&p.owner===by){
   const moves=generateMoves(sx,sy,p);
   if(moves.some(m=>m.x===x&&m.y===y))return true;
  }
 }
 return false;
}

function findKing(owner){
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=state.board[y][x];if(p&&p.owner===owner&&p.type==='王')return {x,y};}
 return null;
}

function toSFEN(){
 let rows=[];
 for(let y=0;y<9;y++){
  let r='';let empty=0;
  for(let x=0;x<9;x++){
   const p=state.board[y][x];
   if(p){if(empty){r+=empty;empty=0;}let s=pieceCode(p.type);if(p.owner==='player')s=s.toUpperCase();r+=s;}
   else empty++;}
  if(empty)r+=empty;rows.push(r);
 }
 let hands='';
 ['player','ai'].forEach(o=>{
  Object.entries(state.hands[o]).forEach(([t,c])=>{const s=pieceCode(t);hands+=(o==='player'?s.toUpperCase():s)+c;});
 });
 if(!hands)hands='-';
 return rows.join('/')+' '+(state.turn==='player'?'b':'w')+' '+hands;
}

function pieceCode(t){return{'歩':'p','香':'l','桂':'n','銀':'s','金':'g','角':'b','飛':'r','王':'k','と':'+p','杏':'+l','圭':'+n','全':'+s','馬':'+b','竜':'+r'}[t];}

init();
