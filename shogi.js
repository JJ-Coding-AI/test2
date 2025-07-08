const boardElem=document.getElementById('board');
const playerHandElem=document.getElementById('player-hand');
const aiHandElem=document.getElementById('ai-hand');
const turnElem=document.getElementById('turn');
const levelElem=document.getElementById('level');
const undoBtn=document.getElementById('undo');
let worker=new Worker('aiWorker.js');
const pieceSymbols={"歩":"歩","香":"香","桂":"桂","銀":"銀","金":"金","角":"角","飛":"飛","王":"王","と":"と","杏":"杏","圭":"圭","全":"全","馬":"馬","龍":"龍"};


let board=[]; // 9x9
let hands={player:[],ai:[]};
let history=[];
let current='player';
let selected=null;
let legal=[];

function initBoard(){
  board=[];
  for(let r=0;r<9;r++){board[r]=Array(9).fill(null);}
  const setup=[
    ['香','桂','銀','金','王','金','銀','桂','香'],
    [null,'飛',null,null,null,null,null,'角',null],
    Array(9).fill('歩'),
    ...Array(3).fill(Array(9).fill(null)),
    Array(9).fill('歩').map(x=>x),
    [null,'角',null,null,null,null,null,'飛',null],
    ['香','桂','銀','金','王','金','銀','桂','香']
  ];
  // place pieces
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      let p=setup[r][c];
      if(!p)continue;
      let owner=r<3?'ai':r>5?'player':null;
      if(owner)board[r][c]={type:p,owner,prom:false};
    }
  }
  hands={player:[],ai:[]};
  history=[];
}

function render(){
  boardElem.innerHTML='';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      let cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.r=r;cell.dataset.c=c;
      let p=board[r][c];
      if(p){
        let div=document.createElement('div');
        div.className='piece'+(p.owner==='ai'?' ai':'');
        div.textContent=pieceSymbols[p.type];
        div.draggable=p.owner==='player';
        div.addEventListener('dragstart',onDragStart);
        div.addEventListener('click',onSelect);
        cell.appendChild(div);
      }
      if(selected&&legal.some(m=>m.to&&m.to.r==r&&m.to.c==c))cell.classList.add('highlight');
      cell.addEventListener('dragover',onDragOver);
      cell.addEventListener('drop',onDrop);
      boardElem.appendChild(cell);
    }
  }
  renderHands();
  turnElem.textContent='手番: '+(current==='player'?'先手':'後手');
}

function renderHands(){
  playerHandElem.innerHTML='';
  hands.player.forEach((p,i)=>{
    let div=document.createElement('div');
    div.className='piece';
    div.textContent=pieceSymbols[p.type];
    div.draggable=true;
    div.dataset.hand=i;
    div.addEventListener('dragstart',onDragStart);
    playerHandElem.appendChild(div);
  });
  aiHandElem.innerHTML='';
  hands.ai.forEach(p=>{
    let div=document.createElement('div');
    div.className='piece ai';
    div.textContent=pieceSymbols[p.type];
    aiHandElem.appendChild(div);
  });
}

function onSelect(e){
  if(current!=='player')return;
  const pieceElem=e.currentTarget;
  const cell=pieceElem.parentElement;
  const r=+cell.dataset.r,c=+cell.dataset.c;
  const piece=board[r][c];
  if(piece.owner!=='player')return;
  selected={r,c};
  legal=legalMoves(r,c,piece,true);
  render();
}

function onDragStart(e){
  if(current!=='player')return e.preventDefault();
  const hand=e.target.dataset.hand;
  if(hand!==undefined){
    selected={hand:parseInt(hand,10)};
    legal=legalDrops(hands.player[hand]);
  }else{
    const r=+e.target.parentElement.dataset.r;
    const c=+e.target.parentElement.dataset.c;
    const piece=board[r][c];
    if(piece.owner!=='player'){e.preventDefault();return;}
    selected={r,c};
    legal=legalMoves(r,c,piece,true);
  }
  render();
}

function onDragOver(e){
  if(!selected)return;
  e.preventDefault();
}

function onDrop(e){
  if(!selected)return;
  e.preventDefault();
  const r=+e.currentTarget.dataset.r;
  const c=+e.currentTarget.dataset.c;
  let move;
  if(selected.hand!==undefined){
    const piece=hands.player[selected.hand];
    move={drop:true,piece,r,c};
  }else{
    const piece=board[selected.r][selected.c];
    move={from:{r:selected.r,c:selected.c},to:{r,c},piece};
  }
  if(isLegalMoveObj(move)){
    makeMove(move);
    selected=null;legal=[];render();
    setTimeout(aiTurn,200);
  }
}

function legalMoves(r,c,piece,filter){
  const moves=[];
  const dir=piece.owner==='player'?-1:1;
  const add=(dr,dc)=>{
    const nr=r+dr, nc=c+dc;
    if(nr<0||nr>8||nc<0||nc>8)return;
    const target=board[nr][nc];
    if(!target||target.owner!==piece.owner)moves.push({from:{r,c},to:{r:nr,c:nc},piece});
  };
  switch(piece.type){
    case '歩':add(dir,0);break;
    case '香':for(let i=1;i<9;i++){if(!add(dir*i,0)||board[r+dir*i][c])break;}break;
    case '桂':add(dir*2,-1);add(dir*2,1);break;
    case '銀':add(dir,-1);add(dir,0);add(dir,1);add(-dir,-1);add(-dir,1);break;
    case '金':
    case 'と':
    case '杏':
    case '圭':
    case '全':add(dir,-1);add(dir,0);add(dir,1);add(0,-1);add(0,1);add(-dir,0);break;
    case '角':for(let i=1;i<9;i++){if(add(i,i)&&board[r+i][c+i])break;}for(let i=1;i<9;i++){if(add(-i,-i)&&board[r-i][c-i])break;}for(let i=1;i<9;i++){if(add(i,-i)&&board[r+i][c-i])break;}for(let i=1;i<9;i++){if(add(-i,i)&&board[r-i][c+i])break;}break;
    case '飛':for(let i=1;i<9;i++){if(add(i,0)&&board[r+i][c])break;}for(let i=1;i<9;i++){if(add(-i,0)&&board[r-i][c])break;}for(let i=1;i<9;i++){if(add(0,i)&&board[r][c+i])break;}for(let i=1;i<9;i++){if(add(0,-i)&&board[r][c-i])break;}break;
    case '馬':
      for(let i=1;i<9;i++){if(add(i,i)&&board[r+i][c+i])break;}for(let i=1;i<9;i++){if(add(-i,-i)&&board[r-i][c-i])break;}for(let i=1;i<9;i++){if(add(i,-i)&&board[r+i][c-i])break;}for(let i=1;i<9;i++){if(add(-i,i)&&board[r-i][c+i])break;}
      add(1,0);add(-1,0);add(0,1);add(0,-1);
      break;
    case '龍':
      for(let i=1;i<9;i++){if(add(i,0)&&board[r+i][c])break;}for(let i=1;i<9;i++){if(add(-i,0)&&board[r-i][c])break;}for(let i=1;i<9;i++){if(add(0,i)&&board[r][c+i])break;}for(let i=1;i<9;i++){if(add(0,-i)&&board[r][c-i])break;}
      add(1,1);add(1,-1);add(-1,1);add(-1,-1);
      break;
    case '王':
      add(1,0);add(-1,0);add(0,1);add(0,-1);add(1,1);add(1,-1);add(-1,1);add(-1,-1);
      break;
  }
  if(filter)moves.filter(isLegalMoveObj);
  return moves;
}

function legalDrops(piece){
  const moves=[];
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(board[r][c])continue;
    let move={drop:true,piece,r,c};
    if(isLegalMoveObj(move))moves.push(move);
  }
  return moves;
}

function isLegalMoveObj(move){
  let tmp=JSON.parse(JSON.stringify({board,hands}));
  if(move.drop){
    board[move.r][move.c]={type:move.piece.type,owner:'player',prom:false};
    hands.player.splice(selected.hand,1);
  }else{
    const p=board[move.from.r][move.from.c];
    if(board[move.to.r][move.to.c])hands.player.push(board[move.to.r][move.to.c]);
    board[move.to.r][move.to.c]=p;
    board[move.from.r][move.from.c]=null;
  }
  const legal=!inCheck('player');
  board=tmp.board;hands=tmp.hands;
  return legal;
}

function inCheck(side){
  let king=null;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){let p=board[r][c];if(p&&p.owner===side&&p.type==='王')king={r,c};}
  if(!king)return false;
  let enemy=side==='player'?'ai':'player';
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){let p=board[r][c];if(p&&p.owner===enemy){let moves=legalMoves(r,c,p,false);if(moves.some(m=>m.to&&m.to.r===king.r&&m.to.c===king.c))return true;}}
  return false;
}

function makeMove(move){
  history.push(JSON.parse(JSON.stringify({board,hands,current})));
  if(move.drop){
    const p=hands[current].splice(selected.hand,1)[0];
    p.owner=current;board[move.r][move.c]=p;
  }else{
    const p=board[move.from.r][move.from.c];
    if(board[move.to.r][move.to.c]){
      const cap=board[move.to.r][move.to.c];
      cap.owner=current;
      cap.prom=false;
      hands[current].push(cap);
    }
    board[move.to.r][move.to.c]=p;
    board[move.from.r][move.from.c]=null;
    // promotion simple auto
    const enemyZone=current==='player'?0:6;
    if(move.to.r<=2||move.from.r<=2||move.to.r>=6||move.from.r>=6){
      if(['歩','香','桂','銀','角','飛'].includes(p.type))p.prom=true;
    }
  }
  current=current==='player'?'ai':'player';
}

function undo(){
  if(history.length){
    let prev=history.splice(-2,2)[0];
    if(prev){board=prev.board;hands=prev.hands;current='player';render();}
  }
}

function aiTurn(){
  const ms=parseInt(levelElem.value,10);
  const fen=toFEN();
  worker.postMessage({type:'go',fen,ms});
}

worker.onmessage=e=>{
  if(e.data.type==='bestmove'){
    const mv=e.data.move;
    applyAIMove(mv);
  }
};

function applyAIMove(move){
  if(move.drop){
    const idx=hands.ai.findIndex(p=>p.type===move.piece);
    const p=hands.ai.splice(idx,1)[0];
    p.owner='ai';
    board[move.to[0]][move.to[1]]=p;
  }else{
    const p=board[move.from[0]][move.from[1]];
    if(move.capture){
      const cap=board[move.to[0]][move.to[1]];
      cap.owner='ai';
      cap.prom=false;
      hands.ai.push(cap);
    }
    board[move.to[0]][move.to[1]]=p;
    board[move.from[0]][move.from[1]]=null;
    if(move.promote)p.prom=true;
  }
  current='player';
  render();
};

function toFEN(){
  let s='';
  for(let r=0;r<9;r++){
    let empty=0;
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(!p){empty++;continue;}
      if(empty){s+=empty;empty=0;}
      s+=pieceToChar(p);
    }
    if(empty)s+=empty;
    if(r!==8)s+='/';
  }
  s+=' '+(current==='player'?'b':'w');
  return s;
}

function pieceToChar(p){
  const map={'歩':'P','香':'L','桂':'N','銀':'S','金':'G','角':'B','飛':'R','王':'K','馬':'+B','龍':'+R','と':'+P','杏':'+L','圭':'+N','全':'+S'};
  const ch=map[p.type]||'P';
  return p.owner==='player'?ch:ch.toLowerCase();
}

undoBtn.onclick=()=>undo();

initBoard();
render();
