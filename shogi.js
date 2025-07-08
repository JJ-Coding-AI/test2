const boardElem=document.getElementById('board');
const handElems=[document.getElementById('hand0'),document.getElementById('hand1')];
const turnElem=document.getElementById('turn');
const moveElem=document.getElementById('moveCount');
const statusElem=document.getElementById('status');
const undoBtn=document.getElementById('undo');
const resetBtn=document.getElementById('reset');

const pieceNames={P:'\u6b69',L:'\u9999',N:'\u6842',S:'\u9280',G:'\u91d1',B:'\u89d2',R:'\u98db',K:'\u7389',
  '+P':'\u3068','+L':'\u674f','+N':'\u572d','+S':'\u5168','+B':'\u99ac','+R':'\u7adc'};
const promotable={P:1,L:1,N:1,S:1,B:1,R:1};
const goldLike={'+P':1,'+L':1,'+N':1,'+S':1};

const startPos='lnsgkgsnl.r.....b.ppppppppp.........'+
               '.........'+'.........'+'PPPPPPPPP'+'.B.....R.'+'LNSGKGSNL';

let worker=new Worker('aiWorker.js');
let timer=null;let thinkStart=0;let bestMove=null;

let state={board:[],hand:[{},{}],turn:0,history:[]};

function init(){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.dataset.index=y*9+x;
      cell.addEventListener('click',onCellClick);
      boardElem.appendChild(cell);
    }
  }
  undoBtn.onclick=undo;
  resetBtn.onclick=resetGame;
  handElems.forEach((h,i)=>h.addEventListener('click',e=>onHandClick(e,i)));
  worker.onmessage=e=>onAIMove(e.data);
  resetGame();
}

function resetGame(){
  state.board=[];state.hand=[{},{}];state.turn=0;state.history=[];bestMove=null;
  for(let i=0;i<81;i++){
    const ch=startPos[i];
    if(ch==='.') state.board[i]=null; else {
      const c=ch>='a'&&ch<='z'?1:0;
      const t=ch.toUpperCase();
      state.board[i]={type:t,c};
    }
  }
  render();
  resetBtn.style.display='none';
  statusElem.textContent='';
  moveElem.textContent='手数:0';
  turnElem.textContent='先手番';
  worker.postMessage({type:'start',state:serialize(state)}); // start AI after initial? Actually player first so we start? Wait we may not.
}

function serialize(s){
  return {board:s.board.map(p=>p?{type:p.type,c:p.c}:null),hand:[{...s.hand[0]},{...s.hand[1]}],turn:s.turn};
}

function render(){
  boardElem.querySelectorAll('.piece').forEach(p=>p.remove());
  for(let i=0;i<81;i++){
    const cell=boardElem.children[i];
    cell.classList.remove('highlight');
    const p=state.board[i];
    if(p){
      const div=document.createElement('div');
      div.className='piece'+(p.c?" white":"")+(p.type.startsWith('+')?" promoted":"");
      div.textContent=pieceNames[p.type];
      div.dataset.index=i;
      div.addEventListener('click',onPieceClick);
      cell.appendChild(div);
    }
  }
  for(let c=0;c<2;c++){
    handElems[c].innerHTML='';
    const h=state.hand[c];
    Object.keys(h).forEach(t=>{
      for(let n=0;n<h[t];n++){
        const div=document.createElement('span');
        div.className='handPiece'+(c?" white":"");
        div.textContent=pieceNames[t];
        div.dataset.piece=t;
        div.dataset.color=c;
        handElems[c].appendChild(div);
      }
    });
  }
  turnElem.textContent=state.turn?"後手番":"先手番";
  moveElem.textContent='手数:'+state.history.length;
}

let selected=null; // {from:index,piece}
let dropPiece=null; // type when dropping from hand

function onPieceClick(e){
  e.stopPropagation();
  const idx=+e.currentTarget.dataset.index;
  const p=state.board[idx];
  if(p.c!==state.turn) return;
  selected={from:idx,piece:p};
  highlight(generateMovesForPiece(idx));
}

function onCellClick(e){
  const idx=+e.currentTarget.dataset.index;
  if(dropPiece){
    const move={from:null,to:idx,piece:{type:dropPiece,c:state.turn}};
    playMove(move);
    dropPiece=null;clearHighlight();
  }else if(selected){
    const legal=generateMovesForPiece(selected.from);
    if(legal.includes(idx)){
      let promote=false;
      const destY=Math.floor(idx/9);
      const fromY=Math.floor(selected.from/9);
      if(promotable[selected.piece.type]){
        const zone=selected.piece.c?destY>=6||fromY>=6:destY<=2||fromY<=2;
        const lastRank=selected.piece.c?destY===8:destY===0;
        if(zone||lastRank){
          if(lastRank&&['P','L','N'].includes(selected.piece.type)) promote=true;
          else {
            showPromoteConfirm(res=>{playMove({from:selected.from,to:idx,piece:selected.piece,promote:res});});
            selected=null;clearHighlight();
            return;
          }
        }
      }
      const move={from:selected.from,to:idx,piece:selected.piece,promote};
      playMove(move);
    }
    selected=null;clearHighlight();
  }
}

function onHandClick(e,c){
  if(e.target.classList.contains('handPiece')){
    if(c!==state.turn)return;
    dropPiece=e.target.dataset.piece;
    highlight(generateDrops(dropPiece));
  }
}

function clearHighlight(){
  boardElem.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function highlight(idxs){
  clearHighlight();
  idxs.forEach(i=>boardElem.children[i].classList.add('highlight'));
}

function showPromoteConfirm(cb){
  const modal=document.createElement('div');
  modal.className='modal';
  const inner=document.createElement('div');
  inner.className='modalContent';
  inner.textContent='成りますか？';
  const yes=document.createElement('button');
  yes.textContent='はい';
  const no=document.createElement('button');
  no.textContent='いいえ';
  yes.onclick=()=>{document.body.removeChild(modal);cb(true);};
  no.onclick=()=>{document.body.removeChild(modal);cb(false);};
  inner.appendChild(document.createElement('br'));
  inner.appendChild(yes);
  inner.appendChild(no);
  modal.appendChild(inner);
  document.body.appendChild(modal);
}

function playMove(m){
  state.history.push(serialize(state));
  if(m.from!==null){
    const p=state.board[m.from];
    if(m.promote) p.type='+'+p.type;
    state.board[m.from]=null;
    if(state.board[m.to]){
      const cap=state.board[m.to];
      const t=cap.type.replace('+','');
      state.hand[state.turn][t]=(state.hand[state.turn][t]||0)+1;
    }
    state.board[m.to]=p;
  }else{
    state.hand[state.turn][m.piece.type]--; if(state.hand[state.turn][m.piece.type]===0) delete state.hand[state.turn][m.piece.type];
    state.board[m.to]={type:m.piece.type,c:state.turn};
  }
  state.turn=1-state.turn;
  render();
  if(checkGameEnd())return;
  if(state.turn===1){
    startThinking();
    worker.postMessage({type:'start',state:serialize(state)});
  }
}

function undo(){
  worker.postMessage({type:'stop'});
  if(state.history.length<2)return;
  state.history.pop();
  const prev=state.history.pop();
  state.board=prev.board.map(p=>p?{type:p.type,c:p.c}:null);
  state.hand=[{...prev.hand[0]},{...prev.hand[1]}];
  state.turn=prev.turn;
  render();
  statusElem.textContent='';
  if(state.turn===1){
    startThinking();
    worker.postMessage({type:'start',state:serialize(state)});
  }
}

function checkGameEnd(){
  const moves=generateLegalMoves(state);
  if(moves.length===0){
    statusElem.textContent=state.turn?"先手の勝ち":"後手の勝ち";
    resetBtn.style.display='inline';
    return true;
  }
  return false;
}

function startThinking(){
  thinkStart=Date.now();
  statusElem.textContent='考え中...0.0 秒';
  if(timer)clearInterval(timer);
  timer=setInterval(()=>{
    const t=((Date.now()-thinkStart)/100)/10;
    statusElem.textContent=`考え中...${t.toFixed(1)} 秒`;
  },100);
}

function onAIMove(data){
  if(timer){clearInterval(timer);timer=null;}
  const t=((Date.now()-thinkStart)/100)/10;
  statusElem.textContent=`${t.toFixed(1)} 秒`;
  if(!data.move){statusElem.textContent+=' 詰み';return;}
  playMove(data.move);
}

// ---------------- move generation ----------------
const moveTable={
  P:[[0,-1]],L:[[0,-1,8]],N:[[ -1,-2],[1,-2]],S:[[0,-1],[-1,-1],[1,-1],[-1,1],[1,1],[0,1]],
  G:[[0,-1],[-1,-1],[1,-1],[0,1],[-1,0],[1,0]],
  K:[[0,-1],[-1,-1],[1,-1],[0,1],[-1,1],[1,1],[-1,0],[1,0]],
  B:[[ -1,-1,8],[1,-1,8],[-1,1,8],[1,1,8]],
  R:[[0,-1,8],[0,1,8],[-1,0,8],[1,0,8]],
};

function generateMovesForPiece(idx,board=state.board){
  const p=board[idx];
  if(!p) return [];
  const dirs=goldLike[p.type]?moveTable['G']:moveTable[p.type.replace('+','')]||[];
  const moves=[];const x=idx%9,y=Math.floor(idx/9);
  for(const d of dirs){
    let nx=x,ny=y;let step=0;while(true){
      nx+=d[0]* (p.c? -1:1);
      ny+=d[1]* (p.c? -1:1);
      if(nx<0||nx>=9||ny<0||ny>=9)break;
      const n=ny*9+nx;const q=board[n];
      if(q&&q.c===p.c)break;
      moves.push(n);
      if(q||!d[2])break; // stop if capture or not sliding
      if(step>=d[2])break;
    }
  }
  return moves;
}

function generateDrops(piece){
  const res=[];
  for(let i=0;i<81;i++){
    if(state.board[i]) continue;
    const y=Math.floor(i/9);
    if(piece==='P'){
      const col=i%9;
      let hasPawn=false;
      for(let r=0;r<9;r++){
        const p=state.board[r*9+col];
        if(p&&p.c===state.turn&&p.type==='P') {hasPawn=true;break;}
      }
      if(hasPawn) continue;
      if((state.turn===0&&y===0)||(state.turn===1&&y===8)) continue;
    }
    if(piece==='L'&&((state.turn===0&&y===0)||(state.turn===1&&y===8))) continue;
    if(piece==='N'&&((state.turn===0&&y<=1)||(state.turn===1&&y>=7))) continue;
    res.push(i);
  }
  return res;
}

function generateLegalMoves(s){
  const moves=[];
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(p&&p.c===s.turn){
      const ms=generateMovesForPiece(i,s.board);
      for(const t of ms){
        const newState=applyMove(s,{from:i,to:t,piece:p,promote:false});
        if(!isCheck(newState,s.turn)) moves.push({from:i,to:t,piece:p,promote:false});
      }
    }
  }
  Object.keys(s.hand[s.turn]).forEach(t=>{
    for(let i=0;i<81;i++)if(!s.board[i]){
      const newState=applyMove(s,{from:null,to:i,piece:{type:t,c:s.turn}});
      if(!isCheck(newState,s.turn)) moves.push({from:null,to:i,piece:{type:t,c:s.turn}});
    }
  });
  return moves;
}

function applyMove(s,m){
  const ns={board:s.board.map(p=>p?{type:p.type,c:p.c}:null),hand:[{...s.hand[0]},{...s.hand[1]}],turn:1-s.turn};
  if(m.from!==null){
    const p=ns.board[m.from];
    ns.board[m.from]=null;
    if(ns.board[m.to]){
      const cap=ns.board[m.to];
      const t=cap.type.replace('+','');
      ns.hand[s.turn][t]=(ns.hand[s.turn][t]||0)+1;
    }
    ns.board[m.to]={type:m.promote?('+'+p.type):p.type,c:p.c};
  }else{
    ns.hand[s.turn][m.piece.type]--;if(ns.hand[s.turn][m.piece.type]===0) delete ns.hand[s.turn][m.piece.type];
    ns.board[m.to]={type:m.piece.type,c:s.turn};
  }
  return ns;
}

function findKing(board,color){
  for(let i=0;i<81;i++){const p=board[i];if(p&&p.c===color&&p.type==='K')return i;}
  return -1;
}

function isCheck(s,color){
  const king=findKing(s.board,color);
  if(king<0) return false;
  const opp=1-color;
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(p&&p.c===opp){
      const ms=generateMovesForPiece(i,s.board);
      if(ms.includes(king)) return true;
    }
  }
  return false;
}

window.onload=init;
