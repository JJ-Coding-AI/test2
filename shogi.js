const board=[];
const holds={b:{},w:{}};
let turn='b';
let history=[];
let searchDepth=3;
const pieceValue={
  '王':10000,'飛':900,'角':850,'金':600,'銀':550,'桂':350,'香':300,'歩':100,
  '竜':950,'馬':900,'全':600,'圭':400,'杏':450,'と':150
};
const promotionMap={
  '歩':'と','香':'杏','桂':'圭','銀':'全','飛':'竜','角':'馬'
};
function initBoard(){
  for(let y=0;y<9;y++){board[y]=Array(9).fill(null);}
  const back=['香','桂','銀','金','王','金','銀','桂','香'];
  for(let i=0;i<9;i++){board[0][i]={type:back[i],owner:'w'};}
  board[1][1]={type:'角',owner:'w'};board[1][7]={type:'飛',owner:'w'};
  for(let i=0;i<9;i++){board[2][i]={type:'歩',owner:'w'};}
  for(let i=0;i<9;i++){board[6][i]={type:'歩',owner:'b'};}
  board[7][1]={type:'飛',owner:'b'};board[7][7]={type:'角',owner:'b'};
  for(let i=0;i<9;i++){board[8][i]={type:back[i],owner:'b'};}
  render();
}
function render(){
  const b=document.getElementById('board');b.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.x=x;cell.dataset.y=y;
      const p=board[y][x];
      if(p){
        const d=document.createElement('div');
        d.className='piece '+p.owner;
        d.textContent=p.type;
        d.draggable=true;
        d.addEventListener('dragstart',dragStart);
        cell.appendChild(d);
      }
      cell.addEventListener('dragover',e=>e.preventDefault());
      cell.addEventListener('drop',dropPiece);
      b.appendChild(cell);
    }
  }
  renderHolds();
  document.getElementById('turn').textContent='手番: '+(turn==='b'?'先手':'後手');
}
function renderHolds(){
  ['b','w'].forEach(o=>{for(let k in holds[o]){if(holds[o][k]===0)delete holds[o][k];}});
  const ph=document.getElementById('player-hold');const ah=document.getElementById('ai-hold');
  ph.innerHTML='';ah.innerHTML='';
  for(let k in holds['b']){
    for(let i=0;i<holds['b'][k];i++){
      const d=document.createElement('div');d.className='piece b';d.textContent=k;d.draggable=true;
      d.dataset.piece=k;d.addEventListener('dragstart',dragStartHold);ph.appendChild(d);
    }
  }
  for(let k in holds['w']){
    for(let i=0;i<holds['w'][k];i++){
      const d=document.createElement('div');d.className='piece w';d.textContent=k;ah.appendChild(d);
    }
  }
}
function dragStart(e){
  const x=e.target.parentNode.dataset.x;y=e.target.parentNode.dataset.y;
  const moves=legalMovesFrom(parseInt(x),parseInt(y));
  highlight(moves);
  e.dataTransfer.setData('text/plain',JSON.stringify({from:{x:+x,y:+y}}));
}
function dragStartHold(e){
  const piece=e.target.dataset.piece;const moves=legalDrops(piece,'b');
  highlight(moves);
  e.dataTransfer.setData('text/plain',JSON.stringify({drop:piece}));
}
function dropPiece(e){
  e.preventDefault();
  clearHighlight();
  const data=JSON.parse(e.dataTransfer.getData('text/plain'));
  const x=parseInt(e.currentTarget.dataset.x),y=parseInt(e.currentTarget.dataset.y);
  if(data.from){
    const moves=legalMovesFrom(data.from.x,data.from.y);
    if(!moves.some(m=>m.x===x&&m.y===y))return;
    pushHistory();
    movePiece(data.from.x,data.from.y,x,y);
  }else if(data.drop){
    const moves=legalDrops(data.drop,'b');
    if(!moves.some(m=>m.x===x&&m.y===y))return;
    pushHistory();
    dropHeldPiece(data.drop,x,y,'b');
  }
  turn='w';render();
  setTimeout(makeAIMove,10);
}
function highlight(moves){
  moves.forEach(m=>{
    const c=document.querySelector(`.cell[data-x='${m.x}'][data-y='${m.y}']`);
    if(c)c.classList.add('highlight');
  });
}
function clearHighlight(){
  document.querySelectorAll('.highlight').forEach(c=>c.classList.remove('highlight'));
}
function movePiece(sx,sy,tx,ty){
  const p=board[sy][sx];
  let captured=board[ty][tx];
  board[sy][sx]=null;board[ty][tx]=p;
  if(captured) addHold('b',demote(captured.type));
  if(shouldPromote(p,sy,ty,'b')){
    if(confirm('成りますか?')) p.type=promotionMap[p.type]||p.type;
  }
  checkEnd();
}
function dropHeldPiece(piece,x,y,owner){
  if(piece==='歩'&&illegalPawnDrop(x,y,owner)) return alert('二歩または打ち歩詰めで禁止');
  removeHold(owner,piece);board[y][x]={type:piece,owner};
  checkEnd();
}
function illegalPawnDrop(x,y,o){
  if(o==='b'){
    for(let yy=0;yy<9;yy++) if(board[yy][x]&&board[yy][x].owner==='b'&&board[yy][x].type==='歩') return true;
  }else{
    for(let yy=0;yy<9;yy++) if(board[yy][x]&&board[yy][x].owner==='w'&&board[yy][x].type==='歩') return true;
  }
  board[y][x]={type:'歩',owner:o};
  const mate=isCheckmate(o==='b'?'w':'b');
  board[y][x]=null;
  return mate;
}
function addHold(o,t){holds[o][t]=(holds[o][t]||0)+1;}
function removeHold(o,t){if(holds[o][t])holds[o][t]--;}
function demote(t){for(let k in promotionMap){if(promotionMap[k]===t)return k;}return t;}
function shouldPromote(p,sy,ty,o){
  const zone=o==='b'?2:6;
  if(p.type==='金'||p.type==='王'||p.type==='と'||p.type==='杏'||p.type==='圭'||p.type==='全'||p.type==='竜'||p.type==='馬')return false;
  if(o==='b') return sy<=zone||ty<=zone;
  return sy>=zone||ty>=zone;
}
function legalMovesFrom(x,y){
  const p=board[y][x];if(!p||p.owner!==turn)return[];
  const dirs=pieceDirs(p);
  const moves=[];const dir=p.owner==='b'? -1:1;
  dirs.forEach(d=>{
    let nx=x+d.dx,ny=y+d.dy*dir;
    while(nx>=0&&nx<9&&ny>=0&&ny<9){
      const t=board[ny][nx];
      if(t&&t.owner===p.owner)break;
      moves.push({x:nx,y:ny});
      if(t)break;
      if(!d.slide)break;
      nx+=d.dx;ny+=d.dy*dir;
    }
  });
  return moves;
}
function legalDrops(piece,o){
  const res=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++) if(!board[y][x]){
    if(piece==='歩'){
      if(o==='b'&&y===0)continue;
      if(o==='w'&&y===8)continue;
      if(illegalPawnDrop(x,y,o))continue;
    }
    res.push({x,y});
  }
  return res;
}
function pieceDirs(p){
  const d={};
  const G=[{dx:0,dy:1},{dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:-1}];
  switch(p.type){
    case '歩': return [{dx:0,dy:1}];
    case '香': return [{dx:0,dy:1,slide:true}];
    case '桂': return [{dx:-1,dy:2},{dx:1,dy:2}];
    case '銀': return [{dx:0,dy:1},{dx:-1,dy:1},{dx:1,dy:1},{dx:-1,dy:-1},{dx:1,dy:-1}];
    case '金': return G;
    case '王': return [{dx:0,dy:1},{dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:-1},{dx:1,dy:-1},{dx:-1,dy:-1}];
    case '飛': return [{dx:0,dy:1,slide:true},{dx:0,dy:-1,slide:true},{dx:1,dy:0,slide:true},{dx:-1,dy:0,slide:true}];
    case '角': return [{dx:1,dy:1,slide:true},{dx:-1,dy:1,slide:true},{dx:1,dy:-1,slide:true},{dx:-1,dy:-1,slide:true}];
    case '竜': return pieceDirs({type:'飛'}).concat([{dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}]);
    case '馬': return pieceDirs({type:'角'}).concat([{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:0},{dx:-1,dy:0}]);
    case 'と':case '杏':case '圭':case '全': return G;
  }
  return [];
}
function pushHistory(){
  history.push({board:cloneBoard(),holds:JSON.parse(JSON.stringify(holds)),turn});
}
function undo(){
  const h=history.pop();
  if(h){
    for(let y=0;y<9;y++)for(let x=0;x<9;x++)board[y][x]=h.board[y][x];
    holds.b=h.holds.b;holds.w=h.holds.w;turn=h.turn;
    render();
  }
}
function cloneBoard(){
  return board.map(r=>r.map(c=>c?{type:c.type,owner:c.owner}:null));
}
function evaluate(bd){
  let score=0;
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
    const p=bd[y][x];if(!p)continue;
    let val=pieceValue[p.type];
    if(p.owner==='b'){score+=val;if(y<=2)score+=20;if(y>=6)score-=20;}
    else{score-=val;if(y>=6)score+=20;if(y<=2)score-=20;}
  }
  return score;
}
function generateAllMoves(o){
  const res=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p&&p.owner===o){
    legalMovesFrom(x,y).forEach(m=>res.push({from:{x,y},to:{x:m.x,y:m.y}}));
  }}
  for(let k in holds[o]){
    if(holds[o][k]>0){
      legalDrops(k,o).forEach(m=>res.push({drop:k,to:{x:m.x,y:m.y}}));
    }
  }
  return res;
}
function applyMove(m){
  if(m.from){movePiece(m.from.x,m.from.y,m.to.x,m.to.y);}else{dropHeldPiece(m.drop,m.to.x,m.to.y,turn);} }
function restoreBoard(bd){for(let y=0;y<9;y++)for(let x=0;x<9;x++)board[y][x]=bd[y][x]?{type:bd[y][x].type,owner:bd[y][x].owner}:null;}
function minimax(depth,alpha,beta,maxim){
  if(depth===0) return evaluate(board);
  const moves=generateAllMoves(maxim?'w':'b');
  if(moves.length===0)return evaluate(board);
  let best=maxim?-Infinity:Infinity;
  const save=cloneBoard();const holdsSave=JSON.parse(JSON.stringify(holds));
  for(const m of moves){
    applyPseudoMove(m,maxim?'w':'b');
    const val=minimax(depth-1,alpha,beta,!maxim);
    restoreBoard(save);holds.b=holdsSave.b;holds.w=holdsSave.w;
    if(maxim){
      if(val>best){best=val;} if(best>alpha)alpha=best; if(alpha>=beta)break;
    }else{
      if(val<best){best=val;} if(best<beta)beta=best; if(alpha>=beta)break;
    }
  }
  return best;
}
function applyPseudoMove(m,o){
  if(m.from){
    const p=board[m.from.y][m.from.x];
    let cap=board[m.to.y][m.to.x];
    board[m.from.y][m.from.x]=null;board[m.to.y][m.to.x]={type:p.type,owner:o};
    if(cap)addHold(o,demote(cap.type));
  }else{removeHold(o,m.drop);board[m.to.y][m.to.x]={type:m.drop,owner:o};}
}
function bestAIMove(){
  const moves=generateAllMoves('w');
  let best=-Infinity, bestMoves=[];
  const save=cloneBoard();const holdsSave=JSON.parse(JSON.stringify(holds));
  for(const m of moves){
    applyPseudoMove(m,'w');
    let val=minimax(searchDepth-1,-Infinity,Infinity,false);
    restoreBoard(save);holds.b=holdsSave.b;holds.w=holdsSave.w;
    if(val>best){best=val;bestMoves=[m];}
    else if(val===best)bestMoves.push(m);
  }
  return bestMoves[Math.floor(Math.random()*bestMoves.length)];
}
function makeAIMove(){
  const m=bestAIMove();
  pushHistory();
  if(m.from){movePiece(m.from.x,m.from.y,m.to.x,m.to.y);}else{dropHeldPiece(m.drop,m.to.x,m.to.y,'w');}
  turn='b';render();
}
function checkEnd(){
  if(isCheck('w')) alert('王手!');
  if(isCheckmate('w')){alert('先手の勝ち!');initBoard();}
  if(isCheckmate('b')){alert('後手の勝ち!');initBoard();}
}
function isCheck(o){
  const king=findKing(o);if(!king)return false;
  turn=o==='b'?'w':'b';
  const ms=generateAllMoves(turn);
  turn=o;
  return ms.some(m=>m.to.x===king.x&&m.to.y===king.y);
}
function isCheckmate(o){
  turn=o;const ms=generateAllMoves(o);if(ms.length===0)return true;
  for(const m of ms){
    const save=cloneBoard();const h=JSON.parse(JSON.stringify(holds));
    applyPseudoMove(m,o);turn=o==='b'?'w':'b';
    if(!isCheck(o)){restoreBoard(save);holds.b=h.b;holds.w=h.w;turn=o;return false;}
    restoreBoard(save);holds.b=h.b;holds.w=h.w;turn=o;
  }
  return true;
}
function findKing(o){
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
    const p=board[y][x];if(p&&p.owner===o&&p.type==='王')return{x,y};
  }
  return null;
}
window.addEventListener('DOMContentLoaded',()=>{
  initBoard();
  document.getElementById('undo').addEventListener('click',()=>{undo();undo();});
  document.getElementById('difficulty').addEventListener('change',e=>{searchDepth=parseInt(e.target.value);});
});
