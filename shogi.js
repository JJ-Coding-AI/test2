const SIZE=9;
const pieceSymbols={
  '歩':'歩','香':'香','桂':'桂','銀':'銀','金':'金','角':'角','飛':'飛','王':'王',
  'と':'と','成香':'成香','成桂':'成桂','成銀':'成銀','馬':'馬','竜':'竜'
};
const promoteMap={'歩':'と','香':'成香','桂':'成桂','銀':'成銀','角':'馬','飛':'竜'};
const demoteMap={'と':'歩','成香':'香','成桂':'桂','成銀':'銀','馬':'角','竜':'飛'};
let board=[];
let hands={player:[],ai:[]};
let turn='player';
let worker=null;
let history=[];

function initBoard(){
  board=[
    ['香','桂','銀','金','王','金','銀','桂','香'].map(t=>({type:t,owner:'ai'})),
    [null,{type:'飛',owner:'ai'},null,null,null,null,null,{type:'角',owner:'ai'},null],
    Array(SIZE).fill('歩').map(t=>({type:t,owner:'ai'})),
    Array(SIZE).fill(null),
    Array(SIZE).fill(null),
    Array(SIZE).fill(null),
    Array(SIZE).fill('歩').map(t=>({type:t,owner:'player'})),
    [null,{type:'角',owner:'player'},null,null,null,null,null,{type:'飛',owner:'player'},null],
    ['香','桂','銀','金','王','金','銀','桂','香'].map(t=>({type:t,owner:'player'}))
  ];
}

function createBoard(){
  const b=document.getElementById('board');
  b.innerHTML='';
  for(let y=0;y<SIZE;y++){
    for(let x=0;x<SIZE;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.x=x;cell.dataset.y=y;
      cell.addEventListener('click',onCellClick);
      b.appendChild(cell);
    }
  }
}

function updateBoard(){
  for(let y=0;y<SIZE;y++){
    for(let x=0;x<SIZE;x++){
      const cell=document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
      cell.innerHTML='';
      const p=board[y][x];
      if(p){
        const div=document.createElement('div');
        div.className='piece'+(p.owner==='ai'?' ai':'');
        div.textContent=pieceSymbols[p.type];
        div.dataset.x=x;div.dataset.y=y;
        if(p.owner==='player') div.addEventListener('click',onPieceClick);
        cell.appendChild(div);
      }
    }
  }
  updateHands();
  document.getElementById('turn').textContent='手番: '+(turn==='player'?'先手':'後手');
}

function updateHands(){
  const ph=document.getElementById('player-hand');
  const ah=document.getElementById('ai-hand');
  ph.innerHTML='';ah.innerHTML='';
  for(const t of hands.player){
    const div=document.createElement('div');
    div.className='piece';
    div.textContent=pieceSymbols[t];
    div.dataset.type=t;
    div.addEventListener('click',onHandClick);
    ph.appendChild(div);
  }
  for(const t of hands.ai){
    const div=document.createElement('div');
    div.className='piece ai';
    div.textContent=pieceSymbols[t];
    ah.appendChild(div);
  }
}

let selected=null;
let legal=[];
function clearHighlight(){
  document.querySelectorAll('.highlight').forEach(e=>e.classList.remove('highlight'));
}

function onPieceClick(e){
  e.stopPropagation();
  const x=+e.target.dataset.x;
  const y=+e.target.dataset.y;
  const p=board[y][x];
  if(turn!=='player'||!p||p.owner!=='player')return;
  selected={from:{x,y},piece:p};
  showLegalMoves(p,x,y);
}

function onHandClick(e){
  const type=e.target.dataset.type;
  if(turn!=='player')return;
  selected={from:null,type};
  showDropMoves(type);
}

function onCellClick(e){
  if(!selected)return;
  const x=+e.currentTarget.dataset.x;
  const y=+e.currentTarget.dataset.y;
  for(const m of legal){
    if(m.to.x===x&&m.to.y===y){
      makeMove(m);
      clearHighlight();
      selected=null;legal=[];
      return;
    }
  }
  selected=null;clearHighlight();
}

function showLegalMoves(p,x,y){
  clearHighlight();
  legal=generateMoves(p,x,y);
  for(const m of legal){
    const cell=document.querySelector(`.cell[data-x="${m.to.x}"][data-y="${m.to.y}"]`);
    cell.classList.add('highlight');
  }
}

function showDropMoves(type){
  clearHighlight();
  legal=generateDrops(type);
  for(const m of legal){
    const cell=document.querySelector(`.cell[data-x="${m.to.x}"][data-y="${m.to.y}"]`);
    cell.classList.add('highlight');
  }
}

function dir(owner){return owner==='player'?-1:1;}

function inside(x,y){return x>=0&&x<SIZE&&y>=0&&y<SIZE;}

function generateMoves(p,x,y){
  const moves=[];
  const d=dir(p.owner);
  const add=(nx,ny)=>{if(!inside(nx,ny))return;const tgt=board[ny][nx];if(!tgt||tgt.owner!==p.owner)moves.push({from:{x,y},to:{x:nx,y:ny},capture:tgt});};
  switch(p.type){
    case '歩':add(x,y+d);break;
    case '香':for(let ny=y+d;inside(x,ny);ny+=d){const tgt=board[ny][x];add(x,ny);if(tgt)break;}break;
    case '桂':add(x-1,y+2*d);add(x+1,y+2*d);break;
    case '銀':['-1,1','0,1','1,1','-1,-1','1,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '金':['0,1','-1,1','1,1','0,-1','-1,0','1,0'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '王':['-1,1','0,1','1,1','-1,0','1,0','-1,-1','0,-1','1,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '角':for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(board[ny][nx])break;}}break;
    case '飛':for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(board[ny][nx])break;}}break;
    case 'と':
    case '成香':
    case '成桂':
    case '成銀':['0,1','-1,1','1,1','0,-1','-1,0','1,0'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '馬':for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(board[ny][nx])break;}}['-1,0','1,0','0,1','0,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '竜':for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(board[ny][nx])break;}}['-1,1','1,1','-1,-1','1,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
  }
  // promotion
  for(const m of moves){
    m.promote=false;
    const zone=p.owner==='player'?[0,1,2]:[6,7,8];
    if(promoteMap[p.type]&&(zone.includes(y)||zone.includes(m.to.y))){
      m.canPromote=true;
    }
  }
  return moves.filter(isLegalMove);
}

function generateDrops(type){
  const moves=[];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(!board[y][x]){
    const move={from:null,to:{x,y},drop:type};
    if(isLegalDrop(move))moves.push(move);
  }
  return moves;
}

function cloneBoard(b){return b.map(row=>row.map(p=>p?{type:p.type,owner:p.owner}:null));}

function makeMove(m){
  history.push({board:cloneBoard(board),hands:JSON.parse(JSON.stringify(hands)),turn});
  if(m.drop){
    board[m.to.y][m.to.x]={type:m.drop,owner:turn};
    const idx=hands[turn].indexOf(m.drop);
    if(idx>=0)hands[turn].splice(idx,1);
  }else{
    const p=board[m.from.y][m.from.x];
    board[m.from.y][m.from.x]=null;
    if(m.capture){
      const base=demoteMap[m.capture.type]||m.capture.type;
      hands[turn].push(base);
    }
    if(m.promote)p.type=promoteMap[p.type];
    board[m.to.y][m.to.x]=p;
    p.owner=turn;
  }
  turn=turn==='player'?'ai':'player';
  updateBoard();
  if(turn==='ai')sendAI();
}

document.getElementById('undo').onclick=function(){
  if(history.length>=2){
    const last=history.splice(history.length-2,2)[0];
    board=last.board;hands=last.hands;turn=last.turn;
    updateBoard();
  }
};

targetTime=1000;
function sendAI(){
  worker.postMessage({type:'go',fen:toSFEN(),ms:targetTime});
}

function onAIResult(e){
  const m=e.data;
  if(m.bestmove){
    applyAIMove(m.bestmove);
  }
}

function applyAIMove(str){
  const move=parseMoveString(str);
  makeMove(move);
}

function parseMoveString(str){
  if(str.includes('*')){
    const [p,xy]=str.split('*');
    const x=+xy[0]-1,y=+xy[1]-1;
    return {drop:fromLetter(p),to:{x,y}};
  }else{
    const [sx,sy,tx,ty,pro]=str.match(/(\d)(\d)(\d)(\d)(\+?)/).slice(1);
    const m={from:{x:+sx-1,y:+sy-1},to:{x:+tx-1,y:+ty-1}};
    m.promote=pro==='+';m.capture=board[m.to.y][m.to.x];
    return m;
  }
}

function fromLetter(l){switch(l){case 'P':return '歩';case 'L':return '香';case 'N':return '桂';case 'S':return '銀';case 'G':return '金';case 'B':return '角';case 'R':return '飛';case 'K':return '王';}}

function toLetter(t){switch(t){case '歩':return 'P';case '香':return 'L';case '桂':return 'N';case '銀':return 'S';case '金':return 'G';case '角':return 'B';case '飛':return 'R';case '王':return 'K';case 'と':return '+P';case '成香':return '+L';case '成桂':return '+N';case '成銀':return '+S';case '馬':return '+B';case '竜':return '+R';}}

function toSFEN(){
  const rows=[];
  for(let y=0;y<SIZE;y++){
    let row='';let empty=0;
    for(let x=0;x<SIZE;x++){
      const p=board[y][x];
      if(p){
        if(empty){row+=empty;empty=0;}
        const l=toLetter(p.type);
        row+=p.owner==='player'?l:l.toLowerCase();
      }else empty++;
    }
    if(empty)row+=empty;
    rows.push(row);
  }
  let hand='-';
  const pieces=['P','L','N','S','G','B','R'];
  let h='';
  for(const o of ['player','ai']){
    const arr=hands[o];
    for(const p of pieces){
      const t=fromLetter(p);
      const c=arr.filter(x=>x===t).length;
      if(c)h+=(o==='player'?p:p.toLowerCase())+(c>1?c:'');
    }
  }
  if(h)hand=h;
  return rows.join('/')+' '+(turn==='player'?'b':'w')+' '+hand+' 1';
}

function isLegalMove(m){
  const b=cloneBoard(board);
  const h=JSON.parse(JSON.stringify(hands));
  const t=turn;
  if(m.drop){
    b[m.to.y][m.to.x]={type:m.drop,owner:t};
    const idx=h[t].indexOf(m.drop);if(idx>=0)h[t].splice(idx,1);
  }else{
    const p=b[m.from.y][m.from.x];
    b[m.from.y][m.from.x]=null;
    if(m.capture){
      const base=demoteMap[m.capture.type]||m.capture.type;
      h[t].push(base);
    }
    b[m.to.y][m.to.x]=p; p.owner=t; if(m.promote)p.type=promoteMap[p.type];
  }
  return !inCheck(b,t);
}

function isLegalDrop(m){
  if(m.drop==='歩'){
    for(let y=0;y<SIZE;y++)if(board[y][m.to.x]&&board[y][m.to.x].owner===turn&&board[y][m.to.x].type==='歩')return false; // nifu
  }
  if(!isLegalMove(m))return false;
  if(m.drop==='歩'){
    // check uchifuzume
    const b=cloneBoard(board);
    b[m.to.y][m.to.x]={type:'歩',owner:turn};
    if(givesMate(b,turn==='player'?'ai':'player'))return false;
  }
  return true;
}

function givesMate(b,opponent){
  // naive mate check
  return inCheck(b,opponent)&&!hasEscape(b,opponent);
}

function hasEscape(b,player){
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p=b[y][x];
    if(p&&p.owner===player){
      const moves=generateMovesSimple(b,p,x,y,player);
      for(const m of moves){
        const nb=applySimpleMove(b,m);
        if(!inCheck(nb,player))return true;
      }
    }
  }
  return false;
}

function generateMovesSimple(b,p,x,y,owner){
  // simplified for self-check; ignore promotions
  const d=owner==='player'? -1:1;const moves=[];const add=(nx,ny)=>{if(!inside(nx,ny))return;const t=b[ny][nx];if(!t||t.owner!==owner)moves.push({from:{x,y},to:{x:nx,y:ny},capture:t});};
  switch(p.type){
    case '歩':add(x,y+d);break;
    case '香':for(let ny=y+d;inside(x,ny);ny+=d){add(x,ny);if(b[ny][x])break;}break;
    case '桂':add(x-1,y+2*d);add(x+1,y+2*d);break;
    case '銀':['-1,1','0,1','1,1','-1,-1','1,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '金':['0,1','-1,1','1,1','0,-1','-1,0','1,0'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '王':['-1,1','0,1','1,1','-1,0','1,0','-1,-1','0,-1','1,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '角':for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(b[ny][nx])break;}}break;
    case '飛':for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(b[ny][nx])break;}}break;
    case 'と':
    case '成香':
    case '成桂':
    case '成銀':['0,1','-1,1','1,1','0,-1','-1,0','1,0'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '馬':for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(b[ny][nx])break;}}['-1,0','1,0','0,1','0,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
    case '竜':for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){for(let nx=x+dx,ny=y+dy;inside(nx,ny);nx+=dx,ny+=dy){add(nx,ny);if(b[ny][nx])break;}}['-1,1','1,1','-1,-1','1,-1'].forEach(s=>{const [dx,dy]=s.split(',').map(Number);add(x+dx,y+dy*d);});break;
  }
  return moves;
}

function applySimpleMove(b,m){
  const nb=cloneBoard(b);
  const p=nb[m.from.y][m.from.x];
  nb[m.from.y][m.from.x]=null;
  nb[m.to.y][m.to.x]=p;
  return nb;
}

function inCheck(b,player){
  let kx=-1,ky=-1;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const p=b[y][x];if(p&&p.owner===player&&p.type==='王'){kx=x;ky=y;}}
  const opp=player==='player'?'ai':'player';
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const p=b[y][x];if(p&&p.owner===opp){const moves=generateMovesSimple(b,p,x,y,opp);for(const m of moves){if(m.to.x===kx&&m.to.y===ky)return true;}}}
  return false;
}

function start(){
  initBoard();
  createBoard();
  updateBoard();
  worker=new Worker('aiWorker.js');
  worker.onmessage=onAIResult;
  document.getElementById('level').onchange=e=>{targetTime=+e.target.value;};
}

start();
