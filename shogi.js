const pieceSymbols={
 '歩':'歩','香':'香','桂':'桂','銀':'銀','金':'金','角':'角','飛':'飛','王':'王',
 'と':'と','杏':'杏','圭':'圭','全':'全','馬':'馬','竜':'竜'
};

const board=[]; // 9x9
const hands={player:{},ai:{}};
let turn='player';
let selected=null; // {piece,x,y} or {drop:'歩'}
let history=[];
let worker=new Worker('aiWorker.js');
let thinking=false;

function initBoard(){
 for(let y=0;y<9;y++){board[y]=Array(9).fill(null);} // y rows
 // AI side (gote)
 board[0]=['香','桂','銀','金','王','金','銀','桂','香'].map(t=>({type:t,owner:'ai'}));
 board[1]=[null,'角',null,null,null,null,null,'飛',null]; // swapped
 board[2]=Array(9).fill('歩').map(t=>({type:t,owner:'ai'}));
 // empty rows
 for(let y=3;y<=5;y++) board[y]=Array(9).fill(null);
 // player side (sente)
 board[6]=Array(9).fill('歩').map(t=>({type:t,owner:'player'}));
 board[7]=[null,'飛',null,null,null,null,null,'角',null]; // swapped
 board[8]=['香','桂','銀','金','王','金','銀','桂','香'].map(t=>({type:t,owner:'player'}));
 hands.player={}; hands.ai={};
}

function pieceToChar(p){return pieceSymbols[p.type];}

function createBoard(){
 const b=document.getElementById('board');
 b.innerHTML='';
 for(let y=0;y<9;y++){
  for(let x=0;x<9;x++){
   const cell=document.createElement('div');
   cell.className='cell';
   cell.dataset.x=x;cell.dataset.y=y;
   cell.addEventListener('mousedown',onCellMouseDown);
   b.appendChild(cell);
  }
 }
 updateBoard();
}

function updateBoard(){
 const cells=document.querySelectorAll('#board .cell');
 cells.forEach(c=>{c.innerHTML='';c.classList.remove('highlight');});
 for(let y=0;y<9;y++){
  for(let x=0;x<9;x++){
   const p=board[y][x];
   if(p){
    const cell=document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
    const div=document.createElement('div');
    div.className='piece'+(p.owner==='ai'?' ai':'');
    div.textContent=pieceToChar(p);
    div.addEventListener('mousedown',e=>startDragPiece(e,p,x,y));
    cell.appendChild(div);
   }
  }
 }
 document.getElementById('turn').textContent='手番: '+(turn==='player'?'先手':'後手');
 updateHands();
 if(turn==='ai'&&!thinking){aiMove();}
}

function updateHands(){
 for(const pl of ['player','ai']){
  const div=document.getElementById('hand-'+pl);
  div.innerHTML='';
  for(const type in hands[pl]){
   for(let i=0;i<hands[pl][type];i++){
    const sp=document.createElement('span');
    sp.className='piece'+(pl==='ai'?' ai':'');
    sp.textContent=pieceSymbols[type];
    sp.addEventListener('mousedown',e=>startDrop(e,pl,type));
    div.appendChild(sp);
   }
  }
 }
}

function startDrop(e,owner,type){
 if(turn!==owner) return;
 selected={drop:type};
 highlightDrops(owner,type);
 e.stopPropagation();
}

function highlightDrops(owner,type){
 const cells=document.querySelectorAll('#board .cell');
 cells.forEach(c=>{
  const x=+c.dataset.x,y=+c.dataset.y;
  if(isLegalDrop(owner,type,x,y)) c.classList.add('highlight');
 });
}

function startDragPiece(e,piece,x,y){
 if(turn!==piece.owner) return;
 selected={piece,x,y};
 highlightMoves(piece,x,y);
 e.stopPropagation();
}

function highlightMoves(piece,x,y){
 const moves=generateMovesForPiece(piece,x,y,true);
 moves.forEach(m=>{
  const c=document.querySelector(`.cell[data-x="${m.x}"][data-y="${m.y}"]`);
  c.classList.add('highlight');
 });
}

function onCellMouseDown(e){
 if(!selected) return;
 const x=+this.dataset.x,y=+this.dataset.y;
 const target=board[y][x];
 if(selected.drop){
  if(isLegalDrop(turn,selected.drop,x,y)){
    makeMove({drop:selected.drop,x,y});
  }
 }else if(selected.piece){
  if(isLegalMove(selected.piece,selected.x,selected.y,x,y)){
    const promote=shouldPromote(selected.piece,selected.y,y)?confirm('成りますか?'):false;
    makeMove({piece:selected.piece,fromX:selected.x,fromY:selected.y,toX:x,toY:y,promote});
  }
 }
 selected=null;updateBoard();
}

document.getElementById('undo').onclick=undo;
document.getElementById('level').onchange=()=>{};

document.addEventListener('mouseup',()=>{selected=null;updateBoard();});

function makeMove(m){
 history.push(JSON.stringify({board,hands,turn}));
 if(m.drop){
  board[m.y][m.x]={type:m.drop,owner:turn};
  hands[turn][m.drop]--;
  if(hands[turn][m.drop]<=0) delete hands[turn][m.drop];
 }else{
  board[m.fromY][m.fromX]=null;
  let captured=board[m.toY][m.toX];
  if(captured){
   const base=unpromote(captured.type);
   hands[turn][base]=(hands[turn][base]||0)+1;
  }
  board[m.toY][m.toX]={type:m.promote?promote(m.piece.type):m.piece.type,owner:turn};
 }
 turn=turn==='player'?'ai':'player';
}

function undo(){
 if(history.length<2) return;
 const state=JSON.parse(history.splice(-2,2)[0]);
 Object.assign(board,state.board);
 hands.player=state.hands.player;hands.ai=state.hands.ai;
 turn=state.turn;
 updateBoard();
}

function aiMove(){
 thinking=true;
 const ms=+document.getElementById('level').value;
 const fen=toSFEN();
 worker.postMessage({type:'go',fen,ms});
}

worker.onmessage=e=>{
 if(e.data.type==='bestmove'){
   applyMoveString(e.data.move);
   thinking=false;
   updateBoard();
 }
};

function applyMoveString(str){
 // simple format: from-to like 7g7f or P*7f
 if(str.includes('*')){
  const [piece,to]=str.split('*');
  const x=8-(to.charCodeAt(0)-'1'.charCodeAt(0));
  const y='abcdefghi'.indexOf(to[1]);
  makeMove({drop:pieceFromChar(piece),x,y});
 }else{
  const [from,to]=[str.slice(0,2),str.slice(2,4)];
  const fx=8-(from.charCodeAt(0)-'1'.charCodeAt(0));
  const fy='abcdefghi'.indexOf(from[1]);
  const tx=8-(to.charCodeAt(0)-'1'.charCodeAt(0));
  const ty='abcdefghi'.indexOf(to[1]);
  const piece=board[fy][fx];
  const promote=str.endsWith('+');
  makeMove({piece,fromX:fx,fromY:fy,toX:tx,toY:ty,promote});
 }
}

function toSFEN(){
 const rows=board.map(row=>{
  let s='';let empties=0;
  for(const p of row){
   if(!p){empties++;continue;}
   if(empties){s+=empties;empties=0;}
   let ch=pieceToLetter(p.type);
   s+=(p.owner==='player'?ch:ch.toLowerCase());
  }
  if(empties) s+=empties;
  return s;
 });
 let sfen=rows.join('/')+' '+(turn==='player'?'b':'w')+' ';
 let handStr='';
 for(const pl of ['player','ai']){
  for(const [t,c] of Object.entries(hands[pl])){
   const ch=pieceToLetter(t);
   for(let i=0;i<c;i++) handStr+=(pl==='player'?ch:ch.toLowerCase());
  }
 }
 sfen+=handStr||'-';
 return sfen;
}

function pieceToLetter(t){
 switch(t){
  case '歩':return 'P';case '香':return 'L';case '桂':return 'N';case '銀':return 'S';
  case '金':return 'G';case '角':return 'B';case '飛':return 'R';case '王':return 'K';
  case 'と':return '+P';case '杏':return '+L';case '圭':return '+N';case '全':return '+S';
  case '馬':return '+B';case '竜':return '+R';
 }
}

function pieceFromChar(ch){
 switch(ch.toUpperCase()){
  case 'P':return '歩';case 'L':return '香';case 'N':return '桂';case 'S':return '銀';
  case 'G':return '金';case 'B':return '角';case 'R':return '飛';case 'K':return '王';
 }
}

function shouldPromote(piece,fromY,toY){
 if(piece.owner==='player'){if(fromY<=2||toY<=2) return canPromote(piece.type)&&!isForcedUnpromote(piece.type,toY);}
 else{if(fromY>=6||toY>=6) return canPromote(piece.type)&&!isForcedUnpromote(piece.type,8-toY);}
 return false;
}
function canPromote(t){return ['歩','香','桂','銀','角','飛'].includes(t);}
function isForcedUnpromote(t,toY){if(t==='歩'||t==='香') return toY===0; if(t==='桂') return toY<=1; return false;}
function promote(t){return {歩:'と',香:'杏',桂:'圭',銀:'全',角:'馬',飛:'竜'}[t]||t;}
function unpromote(t){return {と:'歩',杏:'香',圭:'桂',全:'銀',馬:'角',竜:'飛'}[t]||t;}

function generateMovesForPiece(piece,x,y,legal){
 const dir=piece.owner==='player'?-1:1;
 const moves=[];
 const add=(nx,ny)=>{if(nx<0||nx>8||ny<0||ny>8) return;const target=board[ny][nx];if(target&&target.owner===piece.owner) return;moves.push({x:nx,y:ny});};
 switch(piece.type){
  case '歩':add(x,y+dir);break;
  case '香':for(let ny=y+dir;ny>=0&&ny<9;ny+=dir){const target=board[ny][x];if(target){add(x,ny);break;}add(x,ny);}break;
  case '桂':add(x-1,y+2*dir);add(x+1,y+2*dir);break;
  case '銀':add(x-1,y+dir);add(x,y+dir);add(x+1,y+dir);add(x-1,y-dir);add(x+1,y-dir);break;
  case '金':
  case 'と':case '杏':case '圭':case '全':
   add(x-1,y);add(x+1,y);add(x,y+dir);add(x,y-dir);add(x-1,y+dir);add(x+1,y+dir);break;
  case '角':for(let dx=-1;dx<=1;dx+=2){for(let dy=-1;dy<=1;dy+=2){let nx=x+dx,ny=y+dy;while(nx>=0&&nx<9&&ny>=0&&ny<9){const t=board[ny][nx];add(nx,ny);if(t) break;nx+=dx;ny+=dy;}}}break;
  case '飛':for(let d of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+d[0],ny=y+d[1];while(nx>=0&&nx<9&&ny>=0&&ny<9){const t=board[ny][nx];add(nx,ny);if(t) break;nx+=d[0];ny+=d[1];}}break;
  case '王':add(x-1,y);add(x+1,y);add(x,y+1);add(x,y-1);add(x-1,y+1);add(x+1,y+1);add(x-1,y-1);add(x+1,y-1);break;
  case '馬':for(let dx=-1;dx<=1;dx+=2){for(let dy=-1;dy<=1;dy+=2){let nx=x+dx,ny=y+dy;while(nx>=0&&nx<9&&ny>=0&&ny<9){const t=board[ny][nx];add(nx,ny);if(t) break;nx+=dx;ny+=dy;}}}
   add(x+1,y);add(x-1,y);add(x,y+1);add(x,y-1);break;
  case '竜':for(let d of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+d[0],ny=y+d[1];while(nx>=0&&nx<9&&ny>=0&&ny<9){const t=board[ny][nx];add(nx,ny);if(t) break;nx+=d[0];ny+=d[1];}}
   add(x-1,y-1);add(x+1,y-1);add(x-1,y+1);add(x+1,y+1);break;
 }
 return legal?moves.filter(m=>wouldBeLegal(piece,x,y,m.x,m.y)):moves;
}

function wouldBeLegal(piece,x,y,tx,ty){
 const snap=JSON.stringify({board,hands});
 const captured=board[ty][tx];
 board[y][x]=null;board[ty][tx]=piece;
 const ok=!isKingInCheck(piece.owner);
 const data=JSON.parse(snap);
 Object.assign(board,data.board);hands.player=data.hands.player;hands.ai=data.hands.ai;
 return ok;
}

function isKingInCheck(owner){
 const pos=findKing(owner);
 if(!pos) return false;
 return isSquareAttacked(pos.x,pos.y,owner==='player'?'ai':'player');
}

function findKing(owner){
 for(let y=0;y<9;y++) for(let x=0;x<9;x++){const p=board[y][x];if(p&&p.owner===owner&&p.type==='王') return {x,y};}
 return null;
}

function isSquareAttacked(x,y,by){
 for(let yy=0;yy<9;yy++) for(let xx=0;xx<9;xx++){const p=board[yy][xx];if(p&&p.owner===by){const moves=generateMovesForPiece(p,xx,yy,false);if(moves.some(m=>m.x===x&&m.y===y)) return true;}}
 return false;
}

function isLegalMove(piece,x,y,tx,ty){
 return generateMovesForPiece(piece,x,y,true).some(m=>m.x===tx&&m.y===ty);
}

function isLegalDrop(owner,type,x,y){
 if(board[y][x]) return false;
 if(type==='歩'){
  for(let yy=0;yy<9;yy++) if(board[yy][x]&&board[yy][x].owner===owner&&board[yy][x].type==='歩') return false; // nifu
  board[y][x]={type:'歩',owner};
  const mate=owner==='player'?givesMate('player'):givesMate('ai');
  board[y][x]=null;
  if(mate) return false; // uchi-fu tsum
 }
 // king safety
 board[y][x]={type,type,owner};
 const ok=!isKingInCheck(owner);
 board[y][x]=null;
 return ok;
}

function givesMate(owner){
 // naive checkmate detection after pawn drop
 const enemy=owner==='player'?'ai':'player';
 const k=findKing(enemy);if(!k) return false;
 if(!isSquareAttacked(k.x,k.y,owner)) return false;
 const moves=generateMovesForPiece(board[k.y][k.x],k.x,k.y,true);
 if(moves.length>0) return false;
 return true;
}

initBoard();createBoard();

