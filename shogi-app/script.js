const boardElement = document.getElementById('board');
const turnElement = document.getElementById('turn');
const capturedB = document.getElementById('captured-b');
const capturedW = document.getElementById('captured-w');
const undoBtn = document.getElementById('undo');

const PIECES = {
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '王',
  '+P': 'と', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '龍'
};

let board = [];
let hands = { b: [], w: [] };
let turn = 'b';
let history = [];

function initBoard() {
  // empty board
  board = Array.from({length:9}, () => Array(9).fill(null));
  hands = { b: [], w: [] };
  // set up initial pieces (simplified)
  const backRow = ['L','N','S','G','K','G','S','N','L'];
  backRow.forEach((p,i)=>{board[0][i]={type:p,owner:'w'};});
  board[1][1]={type:'B',owner:'w'}; board[1][7]={type:'R',owner:'w'};
  for(let i=0;i<9;i++) board[2][i]={type:'P',owner:'w'};

  backRow.forEach((p,i)=>{board[8][8-i]={type:p,owner:'b'};});
  board[7][7]={type:'B',owner:'b'}; board[7][1]={type:'R',owner:'b'};
  for(let i=0;i<9;i++) board[6][i]={type:'P',owner:'b'};
  turn='b';
  history=[];
  render();
}

function render() {
  boardElement.innerHTML='';
  for(let r=0;r<9;r++) {
    for(let c=0;c<9;c++) {
      const sq=document.createElement('div');
      sq.className='square'+(((r+c)%2)?' dark':'');
      sq.dataset.pos=`${r},${c}`;
      sq.addEventListener('dragover',ev=>ev.preventDefault());
      sq.addEventListener('drop',onDrop);
      const piece=board[r][c];
      if(piece) {
        const el=createPieceElement(piece,r,c);
        sq.appendChild(el);
      }
      boardElement.appendChild(sq);
    }
  }
  renderHands();
  turnElement.textContent = turn==='b'?'先手番':'後手番';
}

function renderHands() {
  [capturedB,capturedW].forEach(el=>el.innerHTML='');
  hands.b.forEach((p,i)=>{const el=createPieceElement(p,null,null,i);capturedB.appendChild(el);});
  hands.w.forEach((p,i)=>{const el=createPieceElement(p,null,null,i);capturedW.appendChild(el);});
}

function createPieceElement(piece,row,col,handIndex) {
  const el=document.createElement('div');
  el.className='piece'+(piece.owner==='w'?' white':'');
  el.textContent=PIECES[piece.type];
  el.draggable=true;
  el.dataset.owner=piece.owner;
  if(row!==null) {
    el.dataset.from=`${row},${col}`;
  } else {
    el.dataset.from=`hand-${piece.owner}-${handIndex}`;
  }
  el.addEventListener('dragstart',onDragStart);
  el.addEventListener('click',()=>highlightMoves(piece,row,col,handIndex));
  return el;
}

let dragData=null;
function onDragStart(e){
  dragData=e.target.dataset;
}

function onDrop(e){
  e.preventDefault();
  if(!dragData) return;
  const [r,c]=e.currentTarget.dataset.pos.split(',').map(Number);
  const from=dragData.from;
  let piece;
  if(from.startsWith('hand')){
    const [,owner,idx]=from.split('-');
    if(owner!==turn) return;
    piece=hands[owner].splice(Number(idx),1)[0];
    if(!isLegalDrop(piece,r,c,owner)) {hands[owner].splice(Number(idx),0,piece);return;}
  }else{
    const [fr,fc]=from.split(',').map(Number);
    piece=board[fr][fc];
    if(piece.owner!==turn) return;
    if(!isLegalMove(piece,fr,fc,r,c)) return;
    board[fr][fc]=null;
  }
  if(board[r][c]){ // capture
    hands[turn].push({type:board[r][c].type.replace('+',''),owner:turn});
  }
  board[r][c]=piece;
  promoteIfNeeded(piece,r);
  history.push(JSON.stringify({board,hands,turn}));
  turn=turn==='b'?'w':'b';
  dragData=null;
  clearHighlight();
  if(isKingCaptured()) initBoard();
  else render();
}

function promoteIfNeeded(piece,row){
  if(piece.type==='P' && ((piece.owner==='b' && row<=2)||(piece.owner==='w' && row>=6)))
    piece.type='+P';
  if(piece.type==='B' && ((piece.owner==='b' && row<=2)||(piece.owner==='w' && row>=6)))
    piece.type='+B';
  if(piece.type==='R' && ((piece.owner==='b' && row<=2)||(piece.owner==='w' && row>=6)))
    piece.type='+R';
}

function isLegalMove(p,fr,fc,tr,tc){
  if(board[tr][tc] && board[tr][tc].owner===p.owner) return false;
  const dir=p.owner==='b'? -1:1;
  const dr=tr-fr, dc=tc-fc;
  switch(p.type){
    case 'P':
      return dr===dir && dc===0;
    case 'L':
      return dc===0 && Math.sign(dr)===dir && clearPath(fr,fc,tr,tc);
    case 'N':
      return dr===2*dir && Math.abs(dc)===1;
    case 'S':
      return (dr===dir && Math.abs(dc)<=1) || (dr===-dir && Math.abs(dc)===1);
    case 'G':
    case '+P':
      return (dr===dir && Math.abs(dc)<=1) || (dr===0 && Math.abs(dc)===1) || (dr===-dir && dc===0);
    case 'K':
      return Math.abs(dr)<=1 && Math.abs(dc)<=1;
    case 'B':
    case '+B':
      if(Math.abs(dr)===Math.abs(dc) && clearPath(fr,fc,tr,tc)) return true;
      if(p.type==='+B' && Math.abs(dr)<=1 && Math.abs(dc)<=1) return true;
      break;
    case 'R':
    case '+R':
      if((dr===0||dc===0) && clearPath(fr,fc,tr,tc)) return true;
      if(p.type==='+R' && Math.abs(dr)<=1 && Math.abs(dc)<=1) return true;
      break;
  }
  return false;
}

function isLegalDrop(p,r,c,owner){
  if(board[r][c]) return false;
  if(p.type==='P'){
    if((owner==='b' && r===0)||(owner==='w' && r===8)) return false;
  }
  return true;
}

function clearPath(fr,fc,tr,tc){
  const dr=Math.sign(tr-fr);const dc=Math.sign(tc-fc);
  let r=fr+dr,c=fc+dc;
  while(r!==tr||c!==tc){
    if(board[r][c]) return false;
    r+=dr;c+=dc;
  }
  return true;
}

function isKingCaptured(){
  let bk=false,wk=false;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=board[r][c];if(p){if(p.type==='K'&&p.owner==='b')bk=true;if(p.type==='K'&&p.owner==='w')wk=true;}}
  return !(bk&&wk);
}

function highlightMoves(piece,row,col,handIdx){
  clearHighlight();
  const squares=document.querySelectorAll('.square');
  squares.forEach(sq=>{
    const [r,c]=sq.dataset.pos.split(',').map(Number);
    let ok=false;
    if(row!==null){
      if(isLegalMove(piece,row,col,r,c)) ok=true;
    }else{
      if(isLegalDrop(piece,r,c,piece.owner)) ok=true;
    }
    if(ok) sq.classList.add('highlight');
  });
}

function clearHighlight(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

undoBtn.addEventListener('click',()=>{
  if(history.length===0) return;
  const prev=JSON.parse(history.pop());
  board=prev.board;
  hands=prev.hands;
  turn=prev.turn;
  render();
});

initBoard();
