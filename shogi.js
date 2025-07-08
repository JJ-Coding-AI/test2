const worker = new Worker('aiWorker.js');
let thinkMs = 1000;
let board = {};
let history = [];
const boardDiv = document.getElementById('board');
const statusSpan = document.getElementById('status');
const senteHandDiv = document.getElementById('sente-hand');
const goteHandDiv = document.getElementById('gote-hand');

const PIECES = ['','王','飛','角','金','銀','桂','香','歩','竜','馬','全','圭','杏','と'];
const DIR = {
  K:[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],
  R:[[1,0],[-1,0],[0,1],[0,-1]],
  B:[[1,1],[1,-1],[-1,1],[-1,-1]],
  G:[[1,0],[0,1],[-1,0],[0,-1],[1,-1],[-1,-1]],
  S:[[1,0],[1,1],[-1,1],[1,-1],[-1,-1]],
  N:[[2,1],[2,-1]],
  L:[[1,0]],
  P:[[1,0]],
};
const START_SFEN =
  'lnsgkgsnl/1r5b1/p1pppp1pp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

function parseSFEN(sfen){
  const [piecePart, turn, hand] = sfen.split(' ');
  let squares=[];
  piecePart.split('/').forEach(r=>{
    for(const c of r){
      if(/[1-9]/.test(c)) for(let i=0;i<+c;i++) squares.push('');
      else squares.push(c);
    }
  });
  const hands={0:{},1:{}};
  if(hand!=='-'){
    let n='';
    for(const c of hand){
      if(/[1-9]/.test(c)) n+=c; else{
        const count=n?+n:1; n='';
        (c===c.toUpperCase()?hands[0]:hands[1])[c.toUpperCase()]=count;
      }
    }
  }
  return {squares, hands, turn:turn==='b'?0:1};
}

function toSFEN(b){
  let p='';
  for(let r=0;r<9;r++){
    let empty=0;
    for(let c=0;c<9;c++){
      const piece=b.squares[r*9+c];
      if(piece==='') empty++; else{
        if(empty){p+=empty;empty=0;}
        p+=piece;
      }
    }
    if(empty) p+=empty;
    if(r<8) p+='/';
  }
  let hand='';
  for(const col of [0,1]){
    const h=b.hands[col];
    for(const k in h){
      const v=h[k];
      if(v>0){hand+=v>1?v:'';hand+=col===0?k:k.toLowerCase();}
    }
  }
  return p+' '+(b.turn? 'w':'b')+' '+(hand||'-')+' 1';
}

function newGame(){
  board=parseSFEN(START_SFEN);
  history=[];
  draw();
  statusSpan.textContent='あなたの番です';
}

function draw(){
  boardDiv.innerHTML='';
  for(let i=0;i<81;i++){
    const cell=document.createElement('div');
    cell.className='cell';
    cell.dataset.index=i;
    cell.addEventListener('dragover',e=>e.preventDefault());
    cell.addEventListener('drop',onDrop);
    const p=board.squares[i];
    if(p){
      const piece=document.createElement('div');
      piece.className='piece';
      piece.draggable=true;
      piece.textContent=PIECES[p.toUpperCase().charCodeAt(0)-64];
      piece.dataset.from=i;
      piece.addEventListener('dragstart',onDrag);
      cell.appendChild(piece);
    }
    boardDiv.appendChild(cell);
  }
  senteHandDiv.innerHTML=handHTML(0);
  goteHandDiv.innerHTML=handHTML(1);
}

function handHTML(col){
  const h=board.hands[col];
  return Object.entries(h).map(([k,v])=>PIECES[k.charCodeAt(0)-64]+(v>1?'x'+v:''))
    .join(' ');
}

function legalMoves(from){
  const piece=board.squares[from];
  if(!piece) return [];
  const col=piece===piece.toUpperCase()?0:1;
  if(col!==board.turn) return [];
  const type=piece.toUpperCase();
  const moves=[];
  const dirs=DIR[type==='K'?'K':type==='R'?'R':type==='B'?'B':
    type==='G'?'G':type==='S'?'S':type==='N'?'N':type==='L'?'L':'P'];
  const forward=col===0?1:-1;
  for(const [dr,dc] of dirs){
    let r=Math.floor(from/9)+dr*(col===0?1:-1);
    let c=from%9+dc*(col===0?1:-1);
    while(r>=0&&r<9&&c>=0&&c<9){
      const idx=r*9+c;
      const target=board.squares[idx];
      if(!target||target&&(target.toUpperCase()!==target)===col){
        moves.push({from,to:idx});
      }
      if(target) break;
      if(['R','B','L'].includes(type)){
        r+=dr*(col===0?1:-1);
        c+=dc*(col===0?1:-1);
      }else break;
    }
  }
  return moves;
}

function onDrag(e){
  const from=+e.target.dataset.from;
  highlight(legalMoves(from).map(m=>m.to));
  e.dataTransfer.setData('from',from);
}

function highlight(arr){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
  arr.forEach(i=>boardDiv.children[i].classList.add('highlight'));
}

function onDrop(e){
  const from=+e.dataTransfer.getData('from');
  const to=+e.currentTarget.dataset.index;
  const moves=legalMoves(from);
  if(moves.some(m=>m.to===to)){
    movePiece(from,to);
  }
  highlight([]);
}

function movePiece(from,to){
  history.push(JSON.stringify(board));
  board.squares[to]=board.squares[from];
  board.squares[from]='';
  board.turn^=1;
  draw();
  statusSpan.textContent='AI 考慮中...';
  worker.postMessage({type:'go',fen:toSFEN(board),ms:thinkMs});
}

document.getElementById('level').addEventListener('change',e=>{
  thinkMs=+e.target.value;
});
document.getElementById('undo').addEventListener('click',()=>{
  worker.postMessage({type:'stop'});
  if(history.length){
    board=JSON.parse(history.pop());
    draw();
    statusSpan.textContent='あなたの番です';
  }
});

worker.onmessage=e=>{
  if(e.data.type==='bestmove'){
    const [from,to]=e.data.move.split('-').map(Number);
    if(board.squares[from]) movePiece(from,to);
    statusSpan.textContent='あなたの番です';
  }
};

newGame();
