const boardElem = document.getElementById('board');
const handElems = [document.getElementById('hand0'), document.getElementById('hand1')];
const turnElem = document.getElementById('turn');
const moveCountElem = document.getElementById('moveCount');
const undoBtn = document.getElementById('undo');
const resetBtn = document.getElementById('reset');

const PIECES = ['P','L','N','S','G','B','R','K'];
const PIECE_NAMES = {P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛',K:'王'};
const PROMOTED_NAMES = {P:'と',L:'成香',N:'成桂',S:'成銀',B:'馬',R:'龍'};

let board, hands, turn, moveCount, history;
let selected = null;
let worker = new Worker('aiWorker.js');
let aiThinking = false;
let thinkTimer;

function initGame(){
  board = Array.from({length:9},()=>Array(9).fill(null));
  hands = [[],[]];
  turn = 0; //0:human 1:AI
  moveCount = 0;
  history = [];
  setupInitial();
  render();
}

function setupInitial(){
  const set=(r,c,p,color,pr=false)=>board[r][c]={type:p,color,pr};
  //pawns
  for(let c=0;c<9;c++){set(2,c,'P',1);set(6,c,'P',0);} //inverted: r rows from top; row 0 top gote side
  //lance
  set(0,0,'L',1);set(0,8,'L',1);
  set(8,0,'L',0);set(8,8,'L',0);
  //knight
  set(0,1,'N',1);set(0,7,'N',1);
  set(8,1,'N',0);set(8,7,'N',0);
  //silver
  set(0,2,'S',1);set(0,6,'S',1);
  set(8,2,'S',0);set(8,6,'S',0);
  //gold
  set(0,3,'G',1);set(0,5,'G',1);
  set(8,3,'G',0);set(8,5,'G',0);
  //king
  set(0,4,'K',1);set(8,4,'K',0);
  //bishop & rook
  set(1,7,'B',1);set(1,1,'R',1);
  set(7,1,'B',0);set(7,7,'R',0);
}

function render(){
  boardElem.innerHTML='';
  boardElem.style.pointerEvents= aiThinking && turn===1 ? 'none':'auto';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.pos=r+','+c;
      const piece=board[r][c];
      if(piece){
        const d=document.createElement('div');
        d.className='piece';
        d.textContent=piece.pr?PROMOTED_NAMES[piece.type]||PIECE_NAMES[piece.type]:PIECE_NAMES[piece.type];
        if(piece.pr) d.classList.add('promoted');
        if(piece.color===1) d.classList.add('white');
        cell.appendChild(d);
      }
      cell.addEventListener('click',onCellClick);
      boardElem.appendChild(cell);
    }
  }
  for(let i=0;i<2;i++){
    handElems[i].innerHTML=(i==0?'先手持駒:':'後手持駒:')+hands[i].map(p=>PIECE_NAMES[p]).join('');
  }
  turnElem.textContent=turn===0?'先手番':'後手番';
  moveCountElem.textContent=moveCount+'手目';
}

function onCellClick(e){
  if(aiThinking || turn!==0) return;
  const [r,c]=e.currentTarget.dataset.pos.split(',').map(n=>+n);
  const piece=board[r][c];
  if(selected){
    if(highlighted.some(h=>h[0]===r&&h[1]===c)){
      movePiece(selected[0],selected[1],r,c);
      clearHighlights();
      selected=null;
    }else{
      clearHighlights();
      selected=null;
    }
  }else if(piece && piece.color===turn){
    selected=[r,c];
    highlightLegal(r,c);
  }
}

let highlighted=[];
function highlightLegal(r,c){
  clearHighlights();
  const moves=getLegalMoves(turn);
  highlighted=moves.filter(m=>m.from&&m.from[0]===r&&m.from[1]===c).map(m=>m.to);
  for(const [rr,cc] of highlighted){
    const idx=rr*9+cc;
    boardElem.children[idx].classList.add('highlight');
  }
}
function clearHighlights(){
  for(const h of highlighted){
    const idx=h[0]*9+h[1];
    boardElem.children[idx].classList.remove('highlight');
  }
  highlighted=[];
}

function movePiece(fr,fc,tr,tc,dropType=null,promote=false){
  const bcopy=JSON.parse(JSON.stringify(board));
  const hcopy=JSON.parse(JSON.stringify(hands));
  const move={board:bcopy,hands:hcopy,turn,fr,fc,tr,tc,drop:dropType,promote};
  history.push(move);
  if(dropType){
    const idx=hands[turn].indexOf(dropType);
    if(idx>=0) hands[turn].splice(idx,1);
    board[tr][tc]={type:dropType,color:turn,pr:false};
  }else{
    const piece=board[fr][fc];
    board[fr][fc]=null;
    if(board[tr][tc]) hands[turn].push(board[tr][tc].type);
    if(promote) piece.pr=true;
    board[tr][tc]=piece;
  }
  turn^=1;
  moveCount++;
  render();
  if(turn===1) requestAIMove();
}

undoBtn.onclick=()=>{
  if(history.length<2||aiThinking) return;
  // undo two plies
  for(let i=0;i<2;i++){
    const last=history.pop();
    if(!last) break;
    board=last.board;
    hands=last.hands;
    turn=last.turn;
    moveCount--;
  }
  render();
};

resetBtn.onclick=()=>{
  worker.postMessage({type:'stop'});
  aiThinking=false;
  initGame();
};

function requestAIMove(){
  aiThinking=true;
  let sec=0;
  turnElem.textContent='AI考え中...'+sec+'秒';
  thinkTimer=setInterval(()=>{
    sec++;turnElem.textContent='AI考え中...'+sec+'秒';
  },1000);
  worker.onmessage=e=>{
    clearInterval(thinkTimer);
    aiThinking=false;
    const m=e.data;
    if(m){
      applyAIMove(m);
    }else{
      alert('AIエラー');
    }
  };
  worker.postMessage({type:'move',board,hands,turn});
}

function applyAIMove(m){
  if(m.drop){
    movePiece(null,null,m.to[0],m.to[1],m.drop,false);
  }else{
    movePiece(m.from[0],m.from[1],m.to[0],m.to[1],null,m.promote);
  }
}

// Legal move generation
function inside(r,c){return r>=0&&r<9&&c>=0&&c<9;}
const DIR=[[[-1,0]],[[1,0]]]; // placeholder not used

function getLegalMoves(color){
  let moves=[];
  // drops
  for(const t of hands[color]){
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(board[r][c])continue;
      if(t==='P' && board.some(row=>row[c]&&row[c].color===color&&row[c].type==='P'&&!row[c].pr))continue; //nifu
      let m={from:null,to:[r,c],drop:t};
      if(!wouldBeSelfCheck(m,color)) moves.push(m);
    }
  }
  // moves
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=board[r][c];
    if(!p||p.color!==color) continue;
    const dirs=getPieceMoves(p);
    for(const [dr,dc,slide] of dirs){
      let rr=r+dr,cc=c+dc;
      while(inside(rr,cc)){
        const target=board[rr][cc];
        if(target && target.color===color) break;
        let promote=false;
        const zone=color===0?rr<=2||r<=2:rr>=6||r>=6;
        if(p.type!=='G'&&p.type!=='K'&&!p.pr&&zone){
          moves.push({from:[r,c],to:[rr,cc],promote:true});
        }
        moves.push({from:[r,c],to:[rr,cc],promote:false});
        if(target) break;
        if(!slide) break;
        rr+=dr;cc+=dc;
      }
    }
  }
  moves=moves.filter(m=>!wouldBeSelfCheck(m,color));
  return moves;
}

function getPieceMoves(p){
  const f=p.color===0?-1:1;
  const base={
    P:[[f,0,false]],
    L:[[f,0,true]],
    N:[[f*2,-1,false],[f*2,1,false]],
    S:[[f,0,false],[f,1,false],[f,-1,false],[-f,1,false],[-f,-1,false]],
    G:[[f,0,false],[f,1,false],[f,-1,false],[0,1,false],[0,-1,false],[-f,0,false]],
    B:[[1,1,true],[1,-1,true],[-1,1,true],[-1,-1,true]],
    R:[[1,0,true],[-1,0,true],[0,1,true],[0,-1,true]],
    K:[[1,0,false],[-1,0,false],[0,1,false],[0,-1,false],[1,1,false],[1,-1,false],[-1,1,false],[-1,-1,false]]
  }[p.type];
  if(p.pr){
    if(p.type==='B') base.push([1,0,false],[-1,0,false],[0,1,false],[0,-1,false]);
    else if(p.type==='R') base.push([1,1,false],[1,-1,false],[-1,1,false],[-1,-1,false]);
    else base.push([f,1,false],[f,-1,false],[0,1,false],[0,-1,false],[-f,0,false],[f,0,false]);
  }
  return base;
}

function cloneState(){
  return {board:JSON.parse(JSON.stringify(board)),hands:JSON.parse(JSON.stringify(hands)),turn};
}

function wouldBeSelfCheck(m,color){
  const st=cloneState();
  if(m.drop){
    const idx=st.hands[color].indexOf(m.drop);
    if(idx>=0) st.hands[color].splice(idx,1);
    st.board[m.to[0]][m.to[1]]={type:m.drop,color,pr:false};
  }else{
    const p=st.board[m.from[0]][m.from[1]];
    st.board[m.from[0]][m.from[1]]=null;
    if(st.board[m.to[0]][m.to[1]]) st.hands[color].push(st.board[m.to[0]][m.to[1]].type);
    if(m.promote) p.pr=true;
    st.board[m.to[0]][m.to[1]]=p;
  }
  return inCheck(st.board,st.hands,color);
}

function inCheck(b,h,color){
  const kingPos=findKing(b,color);
  const ops=getLegalMovesRaw(b,h,color^1);
  return ops.some(m=>m.to[0]===kingPos[0]&&m.to[1]===kingPos[1]);
}

function findKing(b,color){
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=b[r][c];
    if(p&&p.type==='K'&&p.color===color) return [r,c];
  }
  return null;
}

function getLegalMovesRaw(b,h,color){
  // simplified: not checking self check
  let moves=[];
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const p=b[r][c];
    if(!p||p.color!==color) continue;
    const dirs=getPieceMoves(p);
    for(const [dr,dc,slide] of dirs){
      let rr=r+dr,cc=c+dc;
      while(inside(rr,cc)){
        const target=b[rr][cc];
        if(target && target.color===color) break;
        moves.push({from:[r,c],to:[rr,cc],promote:false});
        if(target) break;
        if(!slide) break;
        rr+=dr;cc+=dc;
      }
    }
  }
  for(const t of h[color]){
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(!b[r][c]) moves.push({drop:t,to:[r,c]});
    }
  }
  return moves;
}

initGame();
