const boardEl=document.getElementById('board');
const handEls=[document.getElementById('hand0'),document.getElementById('hand1')];
const turnEl=document.getElementById('turn');
const moveEl=document.getElementById('moveCount');
const statusEl=document.getElementById('status');
const undoBtn=document.getElementById('undo');
const resetBtn=document.getElementById('reset');

const modal=document.getElementById("modal");
const promoteYes=document.getElementById("promoteYes");
const promoteNo=document.getElementById("promoteNo");

const worker=new Worker('aiWorker.js');
let thinkingTimer=null,startTime=0;

const promoteMap={R:'+R',B:'+B',S:'+S',N:'+N',L:'+L',P:'+P'};
const demoteMap={'+R':'R','+B':'B','+S':'S','+N':'N','+L':'L','+P':'P'};

const initialPieces=[
  'L','N','S','G','K','G','S','N','L',
  null,'R',null,null,null,null,'B',null,null,
  'P','P','P','P','P','P','P','P','P',
  null,null,null,null,null,null,null,null,null,
  null,null,null,null,null,null,null,null,null,
  null,null,null,null,null,null,null,null,null,
  'P','P','P','P','P','P','P','P','P',
  null,'B',null,null,null,null,'R',null,null,
  'L','N','S','G','K','G','S','N','L'
];

function createState(){
  const board=initialPieces.map((p,i)=>{
    if(!p) return null;
    const row=Math.floor(i/9);
    if(row<3) return {type:p,c:1}; // gote
    if(row>5) return {type:p,c:0}; // sente
    return null;
  });
  const hand=[{},{}];
  return {board,hand,turn:0,history:[],moveCount:0};
}

let state=createState();
let selected=null; // {from:i, piece:{type,c}} or {drop:type}
let highlights=[];
let pendingMove=null;

function render(){
  boardEl.innerHTML='';
  for(let i=0;i<81;i++){
    const cell=document.createElement('div');
    cell.className='cell';
    cell.dataset.index=i;
    const piece=state.board[i];
    if(piece){
      const d=document.createElement('div');
      d.className='piece'+(piece.c? ' white':'')+(piece.type.startsWith('+')?' promoted':'');
      d.textContent=piece.type.replace('+','');
      cell.appendChild(d);
    }
    boardEl.appendChild(cell);
  }
  for(let p of highlights){
    boardEl.children[p].classList.add('highlight');
  }
  for(let c=0;c<2;c++){
    handEls[c].innerHTML='';
    const h=state.hand[c];
    for(let t of Object.keys(h)){
      if(h[t]>0){
        const span=document.createElement('span');
        span.className='handPiece'+(c? ' white':'');
        span.textContent=t;
        span.dataset.type=t;
        span.dataset.color=c;
        span.dataset.count=h[t];
        handEls[c].appendChild(span);
      }
    }
  }
  turnEl.textContent=state.turn? '後手番':'先手番';
  moveEl.textContent='手数:'+state.moveCount;
}

function onCellClick(e){
  const idx=parseInt(e.currentTarget.dataset.index);
  const piece=state.board[idx];
  if(selected){
    if(highlights.includes(idx)){
      if(selected.drop){
        playMove({from:null,to:idx,drop:selected.drop});
      }else{
        maybeMove(selected.from,idx);
      }
      clearSelection();
    }else if(piece && piece.c===state.turn){
      selectFrom(idx);
    }else{
      clearSelection();
    }
  }else if(piece && piece.c===state.turn){
    selectFrom(idx);
  }
}

function selectFrom(idx){
  selected={from:idx,piece:state.board[idx]};
  highlights=legalMoves(idx);
  render();
}

function onHandClick(e){
  const t=e.target;
  if(!t.classList.contains('handPiece'))return;
  const type=t.dataset.type;
  const color=parseInt(t.dataset.color);
  if(color!==state.turn)return;
  selected={drop:type};
  highlights=legalDrops(type);
  render();
}

function clearSelection(){
  selected=null;highlights=[];render();
}

function inside(x,y){return x>=0&&x<9&&y>=0&&y<9;}
function idx(x,y){return y*9+x;}
function coords(i){return [i%9,Math.floor(i/9)];}

const moveTable={
  K:[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]],
  G:[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
  S:[[0,1],[1,1],[-1,1],[1,-1],[-1,-1]],
  '+S':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
  N:[[1,2],[-1,2]],
  '+N':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
  L:[[0,1]],
  '+L':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]],
  P:[[0,1]],
  '+P':[[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]]
};

const rangePieces={R:[[0,1],[1,0],[0,-1],[-1,0]],B:[[1,1],[1,-1],[-1,1],[-1,-1]],'+R':[[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]],'+B':[[1,1],[1,-1],[-1,1],[-1,-1],[0,1],[1,0],[0,-1],[-1,0]]};

function legalMoves(pos){
  const piece=state.board[pos];
  if(!piece)return[];
  const res=[];
  const [x,y]=coords(pos);
  const moves=moveTable[piece.type]||[];
  for(const d of moves){
    let nx=x+(piece.c? -d[0]:d[0]);
    let ny=y+(piece.c? -d[1]:d[1]);
    if(!inside(nx,ny))continue;
    const ni=idx(nx,ny);
    const target=state.board[ni];
    if(!target||target.c!==piece.c) res.push(ni);
  }
  const ranges=rangePieces[piece.type];
  if(ranges){
    for(const d of ranges){
      for(let step=1;;step++){
        let nx=x+(piece.c? -d[0]*step:d[0]*step);
        let ny=y+(piece.c? -d[1]*step:d[1]*step);
        if(!inside(nx,ny))break;
        const ni=idx(nx,ny);
        const target=state.board[ni];
        if(target){
          if(target.c!==piece.c) res.push(ni);
          break;
        }else res.push(ni);
      }
    }
  }
  return res;
}

function legalDrops(type){
  const res=[];
  for(let i=0;i<81;i++){
    if(state.board[i])continue;
    const [x,y]=coords(i);
    if(type==='P'){ // ni-fu check
      if(hasPawnInFile(state.turn,x))continue;
      if((state.turn===0 && y===0)||(state.turn===1&&y===8))continue; // no drop to last rank
    }
    if(type==='N'){
      if((state.turn===0&&y>=7)||(state.turn===1&&y<=1))continue;
    }
    if(type==='L'){
      if((state.turn===0&&y===0)||(state.turn===1&&y===8))continue;
    }
    res.push(i);
  }
  return res;
}

function hasPawnInFile(color,x){
  for(let y=0;y<9;y++){
    const p=state.board[idx(x,y)];
    if(p&&p.c===color&&p.type==='P')return true;
  }
  return false;
}

function isPromotionZone(c,y){return c===0? y<=2:y>=6;}
function maybeMove(from,to){
  const piece=state.board[from];
  const [xFrom,yFrom]=coords(from);
  const [xTo,yTo]=coords(to);
  if(piece.type in promoteMap && (isPromotionZone(piece.c,yFrom)||isPromotionZone(piece.c,yTo))){
    if((piece.type==="P"&&((piece.c===0&&yTo===0)||(piece.c===1&&yTo===8)))||
       (piece.type=="L"&&((piece.c===0&&yTo===0)||(piece.c===1&&yTo===8)))||
       (piece.type=="N"&&((piece.c===0&&yTo<=1)||(piece.c===1&&yTo>=7)))){
      playMove({from,to,promote:true});
    }else{
      pendingMove={from,to,promote:false};
      modal.style.display="flex";
    }
  }else{
    playMove({from,to,promote:false});
  }
}


function clone(obj){return JSON.parse(JSON.stringify(obj));}

function playMove(m){
  const s=clone(state);
  s.history.push(clone(state));
  if(m.drop){
    s.board[m.to]={type:m.drop,c:s.turn};
    s.hand[s.turn][m.drop]--;
  }else{
    const piece=s.board[m.from];
    s.board[m.from]=null;
    let type=piece.type;
    if(m.promote) type=promoteMap[type];
    const target=s.board[m.to];
    if(target){
      const base=demoteMap[target.type]||target.type;
      s.hand[piece.c][base]=(s.hand[piece.c][base]||0)+1;
    }
    s.board[m.to]={type,c:piece.c};
  }
  s.turn=1-s.turn;
  s.moveCount++;
  state=s;
  render();
  if(generateLegalMoves().length===0){
    statusEl.textContent=state.turn?"あなたの勝ち":"コンピュータの勝ち";
    resetBtn.style.display="inline";
  } else if(state.turn===1){
    startAI();
  }
}

function startAI(){
  startTime=Date.now();
  statusEl.textContent='考え中…0.0秒';
  thinkingTimer=setInterval(()=>{
    const t=((Date.now()-startTime)/1000).toFixed(1);
    statusEl.textContent='考え中…'+t+'秒';
  },100);
  worker.postMessage({type:'start',state:serialize(state)});
}

worker.onmessage=e=>{
  const {move,time}=e.data;
  if(thinkingTimer){
    clearInterval(thinkingTimer);thinkingTimer=null;
  }
  statusEl.textContent=time.toFixed(1)+'秒';
  if(move){
    playMove(move);
  }
};

undoBtn.onclick=()=>{
  worker.postMessage({type:'stop'});
  if(state.history.length>=2){
    state=state.history[state.history.length-2];
    state.history=state.history.slice(0,-2);
    render();
  }
};

resetBtn.onclick=()=>{
  state=createState();
  resetBtn.style.display='none';
  statusEl.textContent='';
  render();
};

function serialize(s){return JSON.stringify(s);}

function generateLegalMoves(){
  const res=[];
  for(let i=0;i<81;i++){
    const p=state.board[i];
    if(p&&p.c===state.turn){
      for(const t of legalMoves(i)){
        res.push({from:i,to:t});
      }
    }
  }
  const hand=state.hand[state.turn];
  for(let k in hand){
    if(hand[k]>0){
      for(const t of legalDrops(k))res.push({from:null,to:t,drop:k});
    }
  }
  return res;
}

boardEl.addEventListener('click',onCellClick);
handEls[0].addEventListener('click',onHandClick);
handEls[1].addEventListener('click',onHandClick);

promoteYes.onclick=()=>{modal.style.display="none";pendingMove.promote=true;playMove(pendingMove);pendingMove=null;};
promoteNo.onclick=()=>{modal.style.display="none";playMove(pendingMove);pendingMove=null;};
render();
