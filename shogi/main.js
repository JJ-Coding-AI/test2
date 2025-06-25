const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const handEls = [document.getElementById('hand0'), document.getElementById('hand1')];
const undoBtn = document.getElementById('undo');

const goldMoves = [
  [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]
];

const pieceInfo = {
  P: {name:'歩', moves:[[-1,0]], promoted:"G"},
  L: {name:'香', moves:[[-1,0,'slide']], promoted:"G"},
  N: {name:'桂', moves:[[-2,-1],[-2,1]], promoted:"G"},
  S: {name:'銀', moves:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]], promoted:"G"},
  G: {name:'金', moves:goldMoves},
  B: {name:'角', moves:[[-1,-1,'slide'],[-1,1,'slide'],[1,-1,'slide'],[1,1,'slide']], promotedExtra:[[ -1,0],[0,-1],[0,1],[1,0 ]]},
  R: {name:'飛', moves:[[-1,0,'slide'],[1,0,'slide'],[0,-1,'slide'],[0,1,'slide']], promotedExtra:[[-1,-1],[-1,1],[1,-1],[1,1]]},
  K: {name:'王', moves:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]}
};

let board = [];
let hands = [ {}, {} ];
let turn = 0; // 0=先手 1=後手
let history = [];

function inBounds(r,c){return r>=0 && r<9 && c>=0 && c<9;}

function setupBoard(){
  board = Array.from({length:9}, ()=>Array(9).fill(null));
  // gote pieces
  board[0] = [
    {type:'L',owner:1,p:false},
    {type:'N',owner:1,p:false},
    {type:'S',owner:1,p:false},
    {type:'G',owner:1,p:false},
    {type:'K',owner:1,p:false},
    {type:'G',owner:1,p:false},
    {type:'S',owner:1,p:false},
    {type:'N',owner:1,p:false},
    {type:'L',owner:1,p:false}
  ];
  board[1][1] = {type:'B',owner:1,p:false};
  board[1][7] = {type:'R',owner:1,p:false};
  for(let c=0;c<9;c++) board[2][c] = {type:'P',owner:1,p:false};
  // sente pieces
  board[8] = [
    {type:'L',owner:0,p:false},
    {type:'N',owner:0,p:false},
    {type:'S',owner:0,p:false},
    {type:'G',owner:0,p:false},
    {type:'K',owner:0,p:false},
    {type:'G',owner:0,p:false},
    {type:'S',owner:0,p:false},
    {type:'N',owner:0,p:false},
    {type:'L',owner:0,p:false}
  ];
  board[7][7] = {type:'B',owner:0,p:false};
  board[7][1] = {type:'R',owner:0,p:false};
  for(let c=0;c<9;c++) board[6][c] = {type:'P',owner:0,p:false};

  hands = [{}, {}];
  turn = 0;
  history = [];
}

function cloneState(){
  return {
    board: board.map(row => row.map(p=>p?{...p}:null)),
    hands: [ {...hands[0]}, {...hands[1]} ],
    turn
  };
}

function restoreState(s){
  board = s.board.map(row=>row.map(p=>p?{...p}:null));
  hands = [ {...s.hands[0]}, {...s.hands[1]} ];
  turn = s.turn;
  render();
}

function render(){
  boardEl.innerHTML='';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row=r;
      cell.dataset.col=c;
      cell.addEventListener('dragover',onDragOver);
      cell.addEventListener('drop',onDrop);
      boardEl.appendChild(cell);
      if(board[r][c]){
        cell.appendChild(createPieceElement(board[r][c], r, c));
      }
    }
  }
  for(let i=0;i<2;i++){
    handEls[i].innerHTML='';
    for(const t in hands[i]){
      for(let count=0;count<hands[i][t];count++){
        const piece={type:t,owner:i,p:false,hand:true};
        handEls[i].appendChild(createPieceElement(piece));
      }
    }
  }
  statusEl.textContent = turn===0? '先手の番':'後手の番';
}

function createPieceElement(piece, r, c){
  const el = document.createElement('div');
  el.className = 'piece';
  if(piece.owner===1) el.classList.add('gote');
  el.textContent = piece.p ? getPromotedChar(piece.type) : pieceInfo[piece.type].name;
  el.draggable=true;
  el.dataset.type=piece.type;
  el.dataset.owner=piece.owner;
  el.dataset.promoted=piece.p?1:0;
  if(piece.hand) el.dataset.hand=1;
  if(r!==undefined) el.dataset.row=r;
  if(c!==undefined) el.dataset.col=c;
  el.addEventListener('dragstart',onDragStart);
  el.addEventListener('dragend',clearHighlights);
  return el;
}

function onDragStart(e){
  const type=e.target.dataset.type;
  const owner=Number(e.target.dataset.owner);
  const promoted=e.target.dataset.promoted==='1';
  const row=e.target.dataset.row;
  const col=e.target.dataset.col;
  const hand=e.target.dataset.hand;
  e.dataTransfer.setData('text/plain', JSON.stringify({type,owner,promoted,row,col,hand}));
  const moves=row!==undefined?getLegalMoves({type,owner,p:promoted},Number(row),Number(col)):
                            getLegalDrops(type,owner);
  highlightCells(moves);
}

function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function highlightCells(cells){
  cells.forEach(([r,c])=>{
    const cell=document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if(cell) cell.classList.add('highlight');
  });
}

function onDragOver(e){
  e.preventDefault();
}

function onDrop(e){
  e.preventDefault();
  const data=JSON.parse(e.dataTransfer.getData('text/plain'));
  const r=Number(e.currentTarget.dataset.row);
  const c=Number(e.currentTarget.dataset.col);
  if(data.row!==undefined){ // move on board
    const fromR=Number(data.row);
    const fromC=Number(data.col);
    const piece=board[fromR][fromC];
    if(isMoveLegal(piece, fromR, fromC, r, c)){
      pushHistory();
      movePiece(piece, fromR, fromC, r, c);
    }
  }else{ // from hand
    const type=data.type;
    if(isDropLegal(type, data.owner, r, c)){
      pushHistory();
      dropPiece(type, data.owner, r, c);
    }
  }
  clearHighlights();
}

function pushHistory(){
  history.push(cloneState());
  if(history.length>100) history.shift();
}

function movePiece(piece, fromR, fromC, toR, toC){
  const target=board[toR][toC];
  if(target){
    addHand(piece.owner, target.type);
  }
  board[toR][toC]=piece;
  board[fromR][fromC]=null;
  maybePromote(piece, fromR, toR);
  turn=1-turn;
  render();
  checkCheckMate();
}

function maybePromote(piece, fromR, toR){
  const zone=piece.owner===0?2:6;
  const oppositeZone=piece.owner===0?0:6; //??? let's just use 2 and 6 for boundaries
  if(piece.type==='K' || piece.type==='G') return;
  const promote=(piece.owner===0 && (fromR<=2 || toR<=2 || fromR===undefined || toR<=2)) ||
                (piece.owner===1 && (fromR>=6 || toR>=6));
  if(promote){
    if(confirm('成りますか?')){
      piece.p=true;
    }
  }
}

function dropPiece(type, owner, r, c){
  board[r][c]={type,owner,p:false};
  removeHand(owner,type);
  turn=1-turn;
  render();
  checkCheckMate();
}

function addHand(owner,type){
  const o=1-owner; // captured piece becomes opponent's hand
  const base=unpromote(type);
  hands[o][base]=(hands[o][base]||0)+1;
}

function removeHand(owner,type){
  hands[owner][type]--; 
  if(hands[owner][type]<=0) delete hands[owner][type];
}

function unpromote(type){
  if(type==='P'||type==='L'||type==='N'||type==='S'||type==='G'||type==='K') return type;
  return type; // B and R remain same when captured; promoted state lost
}

function isMoveLegal(piece, fromR, fromC, toR, toC){
  const moves=getLegalMoves(piece,fromR,fromC);
  return moves.some(([r,c])=>r===toR && c===toC);
}

function isDropLegal(type, owner, r, c){
  if(board[r][c]) return false;
  // TODO: implement drop restrictions (pawn nifu etc)
  return true;
}

function getLegalDrops(type, owner){
  const cells=[];
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(isDropLegal(type, owner, r, c)) cells.push([r,c]);
    }
  }
  return cells;
}

function getLegalMoves(piece,r,c){
  const moves=[];
  const info=pieceInfo[piece.type];
  const baseMoves=piece.p && info.promoted==='G'?goldMoves:(piece.p && info.promotedExtra?info.moves.concat(info.promotedExtra):info.moves);
  for(const m of baseMoves){
    let dr=m[0];
    let dc=m[1];
    const slide=m[2]==='slide';
    if(piece.owner===1){dr*=-1;dc*=-1;}
    let nr=r+dr;let nc=c+dc;
    while(inBounds(nr,nc)){
      if(!board[nr][nc]){
        moves.push([nr,nc]);
      }else{
        if(board[nr][nc].owner!==piece.owner) moves.push([nr,nc]);
        break;
      }
      if(!slide) break;
      nr+=dr;nc+=dc;
    }
  }
  return moves;
}

function getPromotedChar(type){
  switch(type){
    case 'P': return 'と';
    case 'L': return '成香';
    case 'N': return '成桂';
    case 'S': return '成銀';
    case 'B': return '馬';
    case 'R': return '龍';
    default: return pieceInfo[type].name;
  }
}

function checkCheckMate(){
  const enemy=turn;
  if(isCheck(enemy)){
    alert('王手');
    if(isMate(enemy)){
      alert('詰み!');
    }
  }
}

function kingPosition(owner){
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p && p.type==='K' && p.owner===owner) return [r,c];
    }
  }
  return null;
}

function isCheck(owner){
  const [kr,kc]=kingPosition(owner);
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p && p.owner!==owner){
        const moves=getLegalMoves(p,r,c);
        if(moves.some(([mr,mc])=>mr===kr&&mc===kc)) return true;
      }
    }
  }
  return false;
}

function isMate(owner){
  if(!isCheck(owner)) return false;
  // try all moves for owner
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p && p.owner===owner){
        const moves=getLegalMoves(p,r,c);
        for(const [mr,mc] of moves){
          const saved=cloneState();
          movePieceSim(p,r,c,mr,mc);
          if(!isCheck(owner)){
            restoreState(saved);
            return false;
          }
          restoreState(saved);
        }
      }
    }
  }
  return true;
}

function movePieceSim(piece,fromR,fromC,toR,toC){
  const tgt=board[toR][toC];
  board[toR][toC]=piece;
  board[fromR][fromC]=null;
  if(tgt){addHand(piece.owner,tgt.type);}
}

undoBtn.addEventListener('click',()=>{
  const prev=history.pop();
  if(prev) restoreState(prev);
});

setupBoard();
render();
