const boardElem = document.getElementById('board');
const statusElem = document.getElementById('status');
const hands = [document.getElementById('hand0'), document.getElementById('hand1')];
let board = [];
let turn = 0; // 0: sente, 1: gote
let selected = null;
let history = [];
const pieceNames = { 'K':'王', 'R':'飛', 'B':'角', 'G':'金', 'S':'銀', 'N':'桂', 'L':'香', 'P':'歩',
                     '+R':'龍', '+B':'馬', '+S':'全', '+N':'圭', '+L':'杏', '+P':'と' };
const pieceValues = { 'K':10000,'R':500,'B':400,'G':300,'S':250,'N':150,'L':100,'P':80,
                      '+R':550,'+B':450,'+S':300,'+N':200,'+L':150,'+P':120 };
function init() {
  boardElem.innerHTML = '';
  board = Array(9).fill(0).map(()=>Array(9).fill(null));
  // set pieces
  const setup = [
    ['L','N','S','G','K','G','S','N','L'],
    [null,'R',null,null,null,null,null,'B',null],
    ['P','P','P','P','P','P','P','P','P']
  ];
  for(let x=0;x<9;x++) {
    board[0][x] = {type:setup[0][x],owner:1};
    board[1][x] = setup[1][x]?{type:setup[1][x],owner:1}:null;
    board[2][x] = {type:setup[2][x],owner:1};
    board[6][x] = {type:setup[2][x],owner:0};
    board[7][x] = setup[1][x]?{type:setup[1][x],owner:0}:null;
    board[8][x] = {type:setup[0][x],owner:0};
  }
  render();
  status();
}
function status(msg='') {
  statusElem.textContent = msg + (turn===0?' 先手番':' 後手番');
}
function render() {
  boardElem.innerHTML = '';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell=document.createElement('div');
      cell.className='cell '+((x+y)%2?'white':'black');
      cell.dataset.x=x;cell.dataset.y=y;
      cell.ondragover=allowDrop;
      cell.ondrop=cellDrop;
      const p=board[y][x];
      if(p){
        const piece=document.createElement('div');
        piece.textContent=pieceNames[p.type];
        piece.className='piece';
        piece.draggable=true;
        piece.dataset.x=x;piece.dataset.y=y;
        piece.ondragstart=drag;
        if(p.owner===1) piece.style.transform='rotate(180deg)';
        cell.appendChild(piece);
      }
      boardElem.appendChild(cell);
    }
  }
  hands.forEach((handElem,i)=>{handElem.innerHTML=(i===0?'先手持ち駒:':'後手持ち駒:');
    if(!hand[i]) return;
    hand[i].forEach((p,idx)=>{
      const piece=document.createElement('div');
      piece.textContent=pieceNames[p.type];
      piece.className='piece';
      piece.draggable=true;
      piece.dataset.hand=i;
      piece.dataset.index=idx;
      piece.ondragstart=dragFromHand;
      if(p.owner===1) piece.style.transform='rotate(180deg)';
      handElem.appendChild(piece);
    });
  });
}
let hand=[[],[]];
function drag(ev){
  const x=ev.target.dataset.x, y=ev.target.dataset.y;
  selected={from:[+x,+y], piece:board[y][x]};
  showMoves(selected.from[0],selected.from[1]);
}
function allowDrop(ev){ev.preventDefault();}
function cellDrop(ev){
  ev.preventDefault();
  const x=+ev.target.dataset.x, y=+ev.target.dataset.y;
  if(!selected) return;
  if(selected.from==='hand') {
    dropPiece([x,y]);
  } else {
    const moves=legalMoves(selected.piece,selected.from[0],selected.from[1]);
    if(moves.find(m=>m[0]===x && m[1]===y)){
      movePiece(selected.from,[x,y]);
    }
  }
  clearHighlights();
  selected=null;
}
function dragFromHand(ev){
  const i=+ev.target.dataset.hand;
  const idx=+ev.target.dataset.index;
  selected={from:'hand',hand:i,index:idx,piece:hand[i][idx]};
  showDropMoves(selected.piece.type);
}
function dropPiece(to){
  const [x,y]=to;
  const p=selected.piece;
  if(p.owner!==turn) return;
  const moves=dropMoves(p.type,turn);
  if(moves.find(m=>m[0]===x && m[1]===y)){
    history.push(JSON.stringify({board,hand,turn}));
    board=board.map(row=>row.slice());
    hand=hand.map(h=>h.slice());
    board[y][x]={type:p.type,owner:turn};
    hand[turn].splice(selected.index,1);
    turn=1-turn;
    render();
    checkEnd();
  }
}
function showMoves(x,y){
  clearHighlights();
  const p=board[y][x];
  if(!p || p.owner!==turn) return;
  const moves=legalMoves(p,x,y);
  moves.forEach(m=>{
    const idx=m[1]*9+m[0];
    boardElem.children[idx].classList.add('highlight');
  });
}
function showDropMoves(type){
  clearHighlights();
  const moves=dropMoves(type,turn);
  moves.forEach(m=>{
    const idx=m[1]*9+m[0];
    boardElem.children[idx].classList.add('highlight');
  });
}
function clearHighlights(){
  Array.from(document.querySelectorAll('.highlight')).forEach(el=>el.classList.remove('highlight'));
}
function movePiece(from,to){
  history.push(JSON.stringify({board,hand,turn}));
  board=board.map(row=>row.slice());
  hand=hand.map(h=>h.slice());
  const p=board[from[1]][from[0]];
  const target=board[to[1]][to[0]];
  if(target){
    hand[turn].push({type:baseType(target.type),owner:turn});
  }
  p.owner=turn;
  board[to[1]][to[0]]=p;
  board[from[1]][from[0]]=null;
  if(shouldPromote(p,from,to)){
    if(confirm('成りますか？')) p.type=promoteType(p.type);
  }
  turn=1-turn;
  render();
  checkEnd();
}
function undo(){
  const last=history.pop();
  if(!last) return;
  const state=JSON.parse(last);
  board=state.board;hand=state.hand;turn=state.turn;
  render();status();
}
function baseType(t){return t.startsWith('+')?t.slice(1):t;}
function promoteType(t){return t.startsWith('+')?t:'+'+t;}
function canPromote(t){return ['P','L','N','S','B','R'].includes(baseType(t));}
function shouldPromote(p,from,to){
  if(!canPromote(p.type)) return false;
  const zone = p.owner===0? [0,1,2]:[6,7,8];
  return zone.includes(from[1]) || zone.includes(to[1]);
}
function legalMoves(p,x,y){
  let moves=[];
  const dir=p.owner===0?-1:1; // sente moves up (-1)
  const add=(dx,dy,slide=false)=>{
    let nx=x+dx, ny=y+dy;
    while(nx>=0&&nx<9&&ny>=0&&ny<9){
      if(board[ny][nx]){if(board[ny][nx].owner!==p.owner)moves.push([nx,ny]);break;}
      else moves.push([nx,ny]);
      if(!slide) break;
      nx+=dx;ny+=dy;
    }
  };
  switch(p.type){
    case 'P': add(0,dir); break;
    case '+P':case '+L':case '+N':case '+S': add(0,dir);add(1,dir);add(-1,dir);add(1,0);add(-1,0);add(0,-dir);break;
    case 'L': add(0,dir,true); break;
    case 'N': add(-1,2*dir);add(1,2*dir);break;
    case 'S': add(0,dir);add(-1,dir);add(1,dir);add(-1,-dir);add(1,-dir);break;
    case 'G': add(0,dir);add(-1,dir);add(1,dir);add(0,-dir);add(-1,0);add(1,0);break;
    case 'K': add(0,dir);add(0,-dir);add(1,0);add(-1,0);add(1,dir);add(-1,dir);add(1,-dir);add(-1,-dir);break;
    case 'B': add(1,1,true);add(1,-1,true);add(-1,1,true);add(-1,-1,true);break;
    case '+B': add(1,1,true);add(1,-1,true);add(-1,1,true);add(-1,-1,true);add(1,0);add(-1,0);add(0,1);add(0,-1);break;
    case 'R': add(1,0,true);add(-1,0,true);add(0,1,true);add(0,-1,true);break;
    case '+R': add(1,0,true);add(-1,0,true);add(0,1,true);add(0,-1,true);add(1,1);add(1,-1);add(-1,1);add(-1,-1);break;
  }
  return moves.filter(m=>!wouldBeSelfCheck(p,x,y,m[0],m[1]));
}
function dropMoves(type,owner){
  let moves=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
    if(board[y][x]) continue;
    if(type==='P'){
      if((owner===0 && y===0)||(owner===1 && y===8)) continue;
      if(board.some((row,ry)=>ry!==y && row[x] && row[x].owner===owner && baseType(row[x].type)==='P')) continue;
    }
    moves.push([x,y]);
  }
  return moves;
}
function isCheck(owner){
  let kingPos=null;
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p&&p.type==='K'&&p.owner===owner)kingPos=[x,y];}
  if(!kingPos) return false;
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p&&p.owner!==owner){const moves=legalMoves(p,x,y);if(moves.find(m=>m[0]===kingPos[0]&&m[1]===kingPos[1]))return true;}}
  return false;
}
function wouldBeSelfCheck(p,x,y,tx,ty){
  const saved=board[ty][tx];
  board[y][x]=null;board[ty][tx]=p;
  const check=isCheck(p.owner);
  board[y][x]=p;board[ty][tx]=saved;
  return check;
}
function hasLegalMoves(owner){
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p&&p.owner===owner){if(legalMoves(p,x,y).length>0)return true;}}
  for(const p of hand[owner]){if(dropMoves(p.type,owner).length>0)return true;}
  return false;
}
function checkEnd(){
  if(isCheck(1-turn)&&!hasLegalMoves(1-turn)){
    alert((turn===0?'後手':'先手')+'の勝ち');
    init();
    hand=[[],[]];history=[];turn=0;
  } else {
    status(isCheck(turn)?'王手！':'');
    if(turn===1) aiMove();
  }
}
function aiMove(){
  status('考え中...');
  setTimeout(()=>{
    const moves=[];
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p&&p.owner===1){for(const m of legalMoves(p,x,y)){moves.push({from:[x,y],to:m,p})}}}
    for(const piece of hand[1]){for(const m of dropMoves(piece.type,1)){moves.push({from:'hand',piece,to:m})}}
    let best=-Infinity,bestMove=null;
    for(const m of moves){const eval=simulate(m);if(eval>best){best=eval;bestMove=m;}}
    if(bestMove.from==='hand'){selected={from:'hand',hand:1,index:hand[1].indexOf(bestMove.piece),piece:bestMove.piece};dropPiece(bestMove.to);}else{selected={from:bestMove.from,piece:bestMove.piece};movePiece(bestMove.from,bestMove.to);}
  },500);
}
function simulate(move){
  const state=JSON.stringify({board,hand,turn});
  if(move.from==='hand'){selected={from:'hand',hand:1,index:hand[1].indexOf(move.piece),piece:move.piece};dropSim(move.to);
  } else {selected={from:move.from,piece:move.piece};moveSim(move.from,move.to);}
  const val=evaluate();
  const s=JSON.parse(state);board=s.board;hand=s.hand;turn=s.turn;
  return val;
}
function evaluate(){
  let val=0;
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x];if(p)val+=(p.owner===1?1:-1)*pieceValues[p.type];}
  for(const p of hand[1])val+=pieceValues[p.type];
  for(const p of hand[0])val-=pieceValues[p.type];
  return val;
}
function moveSim(from,to){
  const p=board[from[1]][from[0]];
  const target=board[to[1]][to[0]];
  if(target){hand[turn].push({type:baseType(target.type),owner:turn});}
  board[to[1]][to[0]]=p;board[from[1]][from[0]]=null;
  if(shouldPromote(p,from,to))p.type=promoteType(p.type);
}
function dropSim(to){board[to[1]][to[0]]=selected.piece;hand[1].splice(selected.index,1);}
init();
