const boardEl=document.getElementById('board');
const handEls=[document.getElementById('hand0'),document.getElementById('hand1')];
const turnEl=document.getElementById('turn');
const moveCountEl=document.getElementById('moveCount');
const statusEl=document.getElementById('status');
const undoBtn=document.getElementById('undo');
const resetBtn=document.getElementById('reset');
let worker=new Worker('aiWorker.js');
let timer=null;let thinking=false;let currentHighlights=[];let selected=null;let promoteCallback=null;
const PIECES=['P','L','N','S','G','B','R','K'];
const PROMOTABLE=['P','L','N','S','B','R'];
const PROMOTED={'P':'+P','L':'+L','N':'+N','S':'+S','B':'+B','R':'+R'};
const PIECE_VALUE={P:100,L:300,N:300,S:400,G:500,B:700,R:800,K:10000,'+P':500,'+L':500,'+N':500,'+S':500,'+B':800,'+R':900};

const DIRS={
  P:[[-1,0]],
  L:[[-1,0]],
  N:[[-2,-1],[-2,1]],
  S:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,1]],
  G:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
  B:[[-1,-1],[-1,1],[1,-1],[1,1]],
  R:[[-1,0],[1,0],[0,-1],[0,1]],
  '+B':[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
  '+R':[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]],
  '+P':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
  '+L':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
  '+N':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
  '+S':[[ -1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]],
  K:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
};
let state={board:[],hand:[{},{}],turn:0,history:[],moveCount:0};

function initBoard(){
  state.board=new Array(81).fill(null);
  const bottom=['L','N','S','G','K','G','S','N','L'];
  for(let i=0;i<9;i++) state.board[72+i]={p:bottom[i],c:0,pr:false};
  state.board[63+1]={p:'B',c:0,pr:false};
  state.board[63+7]={p:'R',c:0,pr:false};
  for(let i=0;i<9;i++) state.board[54+i]={p:'P',c:0,pr:false};

  const top=['L','N','S','G','K','G','S','N','L'];
  for(let i=0;i<9;i++) state.board[i]={p:top[i],c:1,pr:false};
  state.board[9+1]={p:'R',c:1,pr:false};
  state.board[9+7]={p:'B',c:1,pr:false};
  for(let i=0;i<9;i++) state.board[18+i]={p:'P',c:1,pr:false};

  state.hand=[{},{},];
  for(let c=0;c<2;c++) for(let p of PIECES){state.hand[c][p]=0;}
  state.turn=0;state.history=[];state.moveCount=0;
  render();
}

function cellIndex(r,c){return r*9+c;}
function coords(i){return [Math.floor(i/9),i%9];}

function getDirs(pc){
  const key=pc.pr?'+'+pc.p:pc.p;
  return DIRS[key]||[];
}

function isLong(pc){
  if(pc.p==='L'&&!pc.pr) return true;
  if(pc.p==='B') return true;
  if(pc.p==='R') return true;
  return false;
}

function render(){
  boardEl.innerHTML='';handEls[0].innerHTML='';handEls[1].innerHTML='';
  for(let i=0;i<81;i++){
    const cell=document.createElement('div');
    cell.className='cell';
    cell.dataset.index=i;
    const piece=state.board[i];
    if(piece){
      const d=document.createElement('div');
      d.className='piece'+(piece.c? ' white':'')+(piece.pr?' promoted':'');
      d.textContent=piece.pr?PROMOTED[piece.p]:piece.p;
      cell.appendChild(d);
    }
    cell.addEventListener('click',onCellClick);
    boardEl.appendChild(cell);
  }
  for(let c=0;c<2;c++){
    const hand=state.hand[c];
    for(let p of PIECES){
      const count=hand[p];
      if(count>0){
        const h=document.createElement('div');
        h.className='handPiece'+(c? ' white':'');
        h.textContent=p+'x'+count;
        h.dataset.piece=p;h.dataset.color=c;
        h.addEventListener('click',onHandClick);
        handEls[c].appendChild(h);
      }
    }
  }
  turnEl.textContent=state.turn? '後手番':'先手番';
  moveCountEl.textContent='手数:'+state.moveCount;
}

function clearHighlights(){for(const el of currentHighlights)el.classList.remove('highlight');currentHighlights=[];}

function onCellClick(e){
  const idx=Number(e.currentTarget.dataset.index);
  const piece=state.board[idx];
  if(selected&&promoteCallback)return;
  if(selected&&selected.from!=null){
    const moves=generateLegalMoves(state, state.turn);
    for(const m of moves){
      if(m.from===selected.from&&m.to===idx&&(!m.drop||m.drop===selected.drop)){
        if(m.promote===2){showPromotion(m);return;}
        playMove(m);return;
      }
    }
    clearHighlights();selected=null;return;
  }
  if(piece&&piece.c===state.turn){
    selected={from:idx};
    highlightMoves(idx);
  }else{clearHighlights();selected=null;}
}

function onHandClick(e){
  const p=e.currentTarget.dataset.piece;
  const c=Number(e.currentTarget.dataset.color);
  if(c!==state.turn||promoteCallback)return;
  selected={drop:p};
  highlightDrops(p);
}

function highlightMoves(idx){
  clearHighlights();
  const moves=generateLegalMoves(state,state.turn).filter(m=>m.from===idx);
  for(const m of moves){
    const el=boardEl.children[m.to];
    el.classList.add('highlight');currentHighlights.push(el);
  }
}

function highlightDrops(p){
  clearHighlights();
  const moves=generateLegalMoves(state,state.turn).filter(m=>m.drop===p);
  for(const m of moves){
    const el=boardEl.children[m.to];
    el.classList.add('highlight');currentHighlights.push(el);
  }
}

function showPromotion(move){
  const modal=document.createElement('div');modal.className='modal';
  const box=document.createElement('div');box.className='modalContent';
  box.innerHTML='<p>成りますか？</p><button id="yes">はい</button><button id="no">いいえ</button>';
  modal.appendChild(box);document.body.appendChild(modal);
  document.getElementById('yes').onclick=()=>{document.body.removeChild(modal);move.promote=true;playMove(move);};
  document.getElementById('no').onclick=()=>{document.body.removeChild(modal);move.promote=false;playMove(move);};
  promoteCallback=()=>{document.body.removeChild(modal);};
}

function playMove(move){
  clearHighlights();selected=null;promoteCallback=null;
  state.history.push(JSON.stringify(state));
  if(move.drop){
    state.board[move.to]={p:move.drop,c:state.turn,pr:false};
    state.hand[state.turn][move.drop]--;}
  else{
    const piece=state.board[move.from];
    state.board[move.from]=null;
    if(state.board[move.to]){
      const cap=state.board[move.to];
      state.hand[state.turn][cap.pr?cap.p:cap.p]++;
    }
    if(move.promote){piece.pr=true;}
    state.board[move.to]=piece;
  }
  state.turn^=1;state.moveCount++;
  render();
  if(!generateLegalMoves(state,state.turn).length){
    statusEl.textContent=state.turn?'先手の勝ち':'後手の勝ち';
    resetBtn.style.display='inline';
    return;
  }
  if(state.turn===1){startThinking();}
}

function startThinking(){thinking=true;let t0=Date.now();statusEl.textContent='考え中…0.0 秒';
  timer=setInterval(()=>{let t=((Date.now()-t0)/1000).toFixed(1);statusEl.textContent='考え中…'+t+' 秒';},100);
  worker.postMessage({type:'start',state:serialize(state)});
}

worker.onmessage=e=>{
  if(e.data.best){
    clearInterval(timer);
    thinking=false;
    statusEl.textContent='思考時間:'+e.data.time+' 秒';
    playMove(e.data.best);
  }else if(e.data.stop){
  }
}
undoBtn.onclick=()=>{
  worker.postMessage({type:'stop'});
  if(state.history.length>=2){
    state=JSON.parse(state.history.splice(-2)[0]);
    render();
  }
}
resetBtn.onclick=()=>{resetBtn.style.display='none';statusEl.textContent='';initBoard();}

function serialize(s){return JSON.parse(JSON.stringify(s));}
function clone(s){return JSON.parse(JSON.stringify(s));}

function generateLegalMoves(s,turn){let moves=generateMoves(s,turn);return moves.filter(m=>!wouldBeCheck(s,m,turn));}
function wouldBeCheck(s,move,turn){let ns=apply(clone(s),move);return isCheck(ns,turn);} // apply returns new state
function apply(ns,m){
  if(m.drop){
    ns.board[m.to]={p:m.drop,c:ns.turn,pr:false};
    ns.hand[ns.turn][m.drop]--;
  }else{
    let pc=ns.board[m.from];
    ns.board[m.from]=null;
    if(ns.board[m.to]){
      let cap=ns.board[m.to];
      ns.hand[ns.turn][cap.p]++;
    }
    if(m.promote)pc.pr=true;
    ns.board[m.to]=pc;
  }
  ns.turn^=1;
  return ns;
}
function isCheck(s,turn){let king=-1;for(let i=0;i<81;i++){let p=s.board[i];if(p&&p.p==='K'&&p.c===turn){king=i;break;}}if(king<0)return false;let ops=generateMoves(s,turn^1,true);return ops.some(m=>m.to===king);} // true for attack only
function generateMoves(s,turn,attackOnly){
  let res=[];
  for(let i=0;i<81;i++){
    let pc=s.board[i];
    if(!pc||pc.c!==turn)continue;
    let dirs=getDirs(pc);
    for(let d of dirs){
      let [r,c]=coords(i);
      let step=0;
      while(true){
        r+=d[0]*(turn?1:-1);
        c+=d[1]*(turn?1:-1);
        if(r<0||r>8||c<0||c>8)break;
        let to=cellIndex(r,c);
        if(pc.p==='N'&&!pc.pr&&step>=1)break;
        step++;
        let target=s.board[to];
        res.push({from:i,to:to,promote:promoteState(pc,i,to,turn),drop:null});
        if(target){
          if(target.c===turn)res.pop();
          break;
        }
        if(!isLong(pc)||pc.pr)break;
      }
    }
  }
  if(!attackOnly){
    for(let p of PIECES){
      if(s.hand[turn][p]>0){
        for(let i=0;i<81;i++){
          if(!s.board[i]){
            let [r,c]=coords(i);
            if(!dropAllowed(p,turn,r,c,s))continue;
            res.push({from:null,to:i,drop:p});
          }
        }
      }
    }
  }
  return res;
}

function promoteState(pc,from,to,turn){if(pc.pr||!PROMOTABLE.includes(pc.p))return false;let [fr,fc]=coords(from);let [tr,tc]=coords(to);let zone=turn?tr>5:tr<3;if(zone||turn?fr>5:fr<3){if(pc.p==='P'||pc.p==='L'||pc.p==='N'){let last=turn?tr===8:tr===0;if(last)return 2;}return 1;}return false;}
function dropAllowed(p,turn,r,c,s){
  if(p==='P'){
    for(let i=0;i<9;i++){
      let idx=cellIndex(i,c);
      let q=s.board[idx];
      if(q&&q.c===turn&&q.p==='P'&&!q.pr)return false;
    }
    if(turn?r===8:r===0)return false;
    let temp=apply(clone(s),{drop:p,to:cellIndex(r,c)});
    if(isCheck(temp,turn^1)) return false; // no uchifuzume
  }
  if(p==='N'&&(turn?r>6:r<2))return false;
  if(p==='L'&&(turn?r===8:r===0))return false;
  return true;
}

initBoard();
