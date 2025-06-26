const boardElement = document.getElementById('board');
const turnElement = document.getElementById('turn');
const undoBtn = document.getElementById('undo');
const blackHold = document.getElementById('black-hold');
const whiteHold = document.getElementById('white-hold');

let board = [];
let turn = 'black'; // 'black' = 先手, 'white' = 後手
let history = [];

const pieces = {
  'p': {name:'歩', moves:[[0,-1]], promote:'+p'},
  '+p':{name:'と', moves:[[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1]]},
  'l': {name:'香', moves:[[0,-1,true]], promote:'+l'},
  '+l':{name:'成香', moves:[[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1]]},
  'n': {name:'桂', moves:[[1,-2],[ -1,-2]], promote:'+n'},
  '+n':{name:'成桂', moves:[[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1]]},
  's': {name:'銀', moves:[[0,-1],[1,-1],[-1,-1],[1,1],[-1,1]], promote:'+s'},
  '+s':{name:'成銀', moves:[[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1]]},
  'g': {name:'金', moves:[[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1]]},
  'b': {name:'角', moves:[[1,1,true],[1,-1,true],[-1,1,true],[-1,-1,true]], promote:'+b'},
  '+b':{name:'馬', moves:[[1,1,true],[1,-1,true],[-1,1,true],[-1,-1,true],[0,-1],[0,1],[1,0],[-1,0]]},
  'r': {name:'飛', moves:[[0,1,true],[0,-1,true],[1,0,true],[-1,0,true]], promote:'+r'},
  '+r':{name:'龍', moves:[[0,1,true],[0,-1,true],[1,0,true],[-1,0,true],[1,1],[-1,1],[1,-1],[-1,-1]]},
  'k': {name:'王', moves:[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]}
};

function initBoard(){
  board = Array.from({length:9},()=>Array(9).fill(null));
  const setup = [
    ['l','n','s','g','k','g','s','n','l'],
    [null,'r',null,null,null,null,null,'b',null],
    ['p','p','p','p','p','p','p','p','p'],
    [],[],[],
    ['p','p','p','p','p','p','p','p','p'],
    [null,'b',null,null,null,null,null,'r',null],
    ['l','n','s','g','k','g','s','n','l']
  ];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      let p=setup[y][x];
      if(p){
        if(y<3) board[y][x]={type:p, color:'white'}; else if(y>5) board[y][x]={type:p, color:'black'};
      }
    }
  }
  render();
}

function render(){
  boardElement.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const sq=document.createElement('div');
      sq.className='square '+((x+y)%2?'white':'black');
      sq.dataset.x=x; sq.dataset.y=y;
      sq.addEventListener('dragover',e=>e.preventDefault());
      sq.addEventListener('drop',onDrop);
      const p=board[y][x];
      if(p){
        const el=createPieceEl(p);
        sq.appendChild(el);
      }
      boardElement.appendChild(sq);
    }
  }
  turnElement.textContent = turn==='black'?'先手番':'後手番';
  renderHoldings();
}

function createPieceEl(p){
  const el=document.createElement('div');
  el.className='piece';
  el.textContent=pieces[p.type].name;
  if(p.color==='white') el.style.transform='rotate(180deg)';
  el.draggable=true;
  el.dataset.type=p.type; el.dataset.color=p.color;
  el.addEventListener('dragstart',onDrag);
  return el;
}

function onDrag(e){
  const x=e.target.parentElement.dataset.x;
  const y=e.target.parentElement.dataset.y;
  e.dataTransfer.setData('text/plain', JSON.stringify({fromX:x,fromY:y,type:e.target.dataset.type,color:e.target.dataset.color}));
  highlightMoves(parseInt(x),parseInt(y));
}

function onDrop(e){
  const data=JSON.parse(e.dataTransfer.getData('text'));
  const toX=parseInt(e.currentTarget.dataset.x);
  const toY=parseInt(e.currentTarget.dataset.y);

  if(data.from==='hold'){ // drop from holdings
    if(movePiece(null,null,toX,toY,data.type,data.color))
      removeFromHold(data.color,data.type);
  }else{
    const fromX=parseInt(data.fromX); const fromY=parseInt(data.fromY);
    movePiece(fromX,fromY,toX,toY,data.type,data.color);
  }
  clearHighlights();
}

function movePiece(fx,fy,tx,ty,type,color){
  if(color!==turn) return false;
  const valid=legalMoves(fx,fy,type,color).some(m=>m.x===tx && m.y===ty);
  if(!valid) return false;
  history.push(JSON.parse(JSON.stringify(board)));
  if(board[ty][tx]) addToHold(color,board[ty][tx].type);
  board[ty][tx]={type,type,color};
  if(fx!==null) board[fy][fx]=null;
  // promotion check
  if(shouldPromote(type,color,fy,ty)){
    const promote=confirm('成りますか?');
    if(promote) board[ty][tx]={type:pieces[type].promote,color};
  }
  if(board[ty][tx].type==='k' && board[ty][tx].color!=='white' && board.some(row=>row.some(p=>p&&p.type==='k'&&p.color==='white'))){
    const winner=color==='black'?'先手':'後手';
    alert(winner+'の勝ち');
    initBoard();
    blackHold.innerHTML='';
    whiteHold.innerHTML='';
    history=[];
    return true;
  }
  turn=turn==='black'?'white':'black';
  render();
  return true;
}

function shouldPromote(type,color,fromY,toY){
  const zone=color==='black'?2:6;
  if(pieces[type].promote && (fromY===null || fromY<=zone || toY<=zone || fromY>=6 || toY>=6)){
    if(type==='p' && ((color==='black'&&toY===0)||(color==='white'&&toY===8))) return true;
    if(type==='l' && ((color==='black'&&toY===0)||(color==='white'&&toY===8))) return true;
    if(type==='n' && ((color==='black'&&toY<=1)||(color==='white'&&toY>=7))) return true;
    return true;
  }
  return false;
}

function addToHold(color,type){
  const hold=color==='black'?whiteHold:blackHold;
  const el=document.createElement('div');
  el.className='piece';
  el.textContent=pieces[type].name;
  el.draggable=true;
  el.dataset.type=type;
  el.dataset.color=color==='black'?'white':'black';
  el.addEventListener('dragstart',e=>{
    e.dataTransfer.setData('text/plain', JSON.stringify({from:'hold',type:type,color:el.dataset.color}));
  });
  hold.appendChild(el);
}

function removeFromHold(color,type){
  const hold=color==='black'?whiteHold:blackHold;
  const el=Array.from(hold.children).find(c=>c.dataset.type===type);
  if(el) hold.removeChild(el);
}

function renderHoldings(){
  // already handled in add/remove
}

function highlightMoves(x,y){
  clearHighlights();
  const p=board[y][x];
  if(!p || p.color!==turn) return;
  const moves=legalMoves(x,y,p.type,p.color);
  moves.forEach(m=>{
    const sq=document.querySelector(`.square[data-x='${m.x}'][data-y='${m.y}']`);
    if(sq) sq.classList.add('highlight');
  });
}

function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function legalMoves(x,y,type,color){
  const dirs=pieces[type].moves;
  const moves=[];
  dirs.forEach(d=>{
    let dx=d[0]; let dy=d[1];
    let repeat=d[2];
    if(color==='white'){dx=-dx; dy=-dy;}
    let nx=x+dx, ny=y+dy;
    while(nx>=0&&nx<9&&ny>=0&&ny<9){
      if(board[ny][nx] && board[ny][nx].color===color) break;
      moves.push({x:nx,y:ny});
      if(board[ny][nx]) break;
      if(!repeat) break;
      nx+=dx; ny+=dy;
    }
  });
  return moves;
}

undoBtn.addEventListener('click',()=>{
  if(history.length){
    board=history.pop();
    turn=turn==='black'?'white':'black';
    render();
  }
});

initBoard();
