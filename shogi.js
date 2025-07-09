const PIECE_NAMES={
  P:'\u6b69',L:'\u9999',N:'\u6842',S:'\u9280',G:'\u91d1',B:'\u89d2',R:'\u98db',K:'\u7389',
  '+P':'\u3068','+L':'\u6210\u9999','+N':'\u6210\u6842','+S':'\u6210\u9280','+B':'\u99ac','+R':'\u7adc'
};
const PROMOTABLE={P:1,L:1,N:1,S:1,B:1,R:1};
const PROMOTE={'P':'+P','L':'+L','N':'+N','S':'+S','B':'+B','R':'+R'};
const UNPROMOTE={'+P':'P','+L':'L','+N':'N','+S':'S','+B':'B','+R':'R'};
let HUMAN=0; // player side, -1 when AI vs AI
let aiMode=false;
function initialState(){
  const b=Array(81).fill(null);
  const s=['L','N','S','G','K','G','S','N','L',null,'R',null,null,null,null,null,'B',null];
  for(let i=0;i<9;i++){b[i]= {type:s[i],c:1};}
  b[10]={type:'R',c:1}; b[16]={type:'B',c:1};
  for(let i=18;i<27;i++)b[i]={type:'P',c:1};
  for(let i=54;i<63;i++)b[i]={type:'P',c:0};
  b[64]={type:'B',c:0}; b[70]={type:'R',c:0};
  const t=['L','N','S','G','K','G','S','N','L'];
  for(let i=72;i<81;i++)b[i]={type:t[i-72],c:0};
  return {board:b,hand:[{},{}],turn:0,history:[]};
}
let state=initialState();
const boardEl=document.getElementById('board');
const handEls=[document.getElementById('hand0'),document.getElementById('hand1')];
const statusEl=document.getElementById('status');
const moveEl=document.getElementById('moveCount');
const logEl=document.getElementById('log');
let logs=[];
let timerId=null;
let thinkStart=0;
function render(){
  boardEl.innerHTML='';
  for(let i=0;i<81;i++){
    const cell=document.createElement('div');
    cell.className='cell';
    cell.dataset.index=i;
    const p=state.board[i];
    if(p){
      const el=document.createElement('div');
      el.className='piece'+(p.c? ' white':'')+(p.type[0]==='+'?' promoted':'');
      el.textContent=PIECE_NAMES[p.type];
      el.onclick=()=>selectFrom(i);
      cell.appendChild(el);
    }
    boardEl.appendChild(cell);
  }
  for(let c=0;c<2;c++){
    const h=handEls[c];
    h.innerHTML='';
    const hand=state.hand[c];
    for(let k in hand){
      if(hand[k]>0){
        const el=document.createElement('span');
        el.className='handPiece'+(c? ' white':'');
        el.textContent=PIECE_NAMES[k]+(hand[k]>1?hand[k]:'');
        el.onclick=()=>selectHand(k,c);
        h.appendChild(el);
      }
    }
  }
  document.getElementById('turn').textContent=state.turn? '後手番':'先手番';
  moveEl.textContent='手数:' + state.history.length;
}
let selected=null;
let legal=[];
let ignore=false;
function startThinking(){
  thinkStart=Date.now();
  statusEl.textContent='考え中...0.0秒';
  timerId=setInterval(()=>{
    statusEl.textContent='考え中...'+((Date.now()-thinkStart)/1000).toFixed(1)+'秒';
  },100);
}
function stopThinking(ms){
  clearInterval(timerId);
  statusEl.textContent='思考時間:'+ (ms/1000).toFixed(1)+'秒';
}
function selectFrom(i){
  if(state.turn!==HUMAN)return;
  const p=state.board[i];
  if(!p||p.c!==HUMAN)return;
  selected={from:i,piece:p};
  legal=generateLegalMoves(state,p.c).filter(m=>m.from===i);
  highlight();
}
function selectHand(type,c){
  if(c!==HUMAN||state.turn!==HUMAN)return;
  selected={from:-1,type};
  legal=generateLegalMoves(state,c).filter(m=>m.drop===type);
  highlight();
}
function highlight(){
  document.querySelectorAll('.cell').forEach(cell=>cell.classList.remove('highlight'));
  legal.forEach(m=>{
    const idx=m.to;
    boardEl.children[idx].classList.add('highlight');
  });
}

function idxToString(i){
  const file=9-(i%9);
  const rank=Math.floor(i/9)+1;
  return file+''+rank;
}

function moveToString(m){
  if(m.from>=0){
    const from=idxToString(m.from);
    const to=idxToString(m.to);
    const p=state.board[m.to];
    const name=PIECE_NAMES[p.type];
    const cap=m.captured? 'x'+PIECE_NAMES[m.captured.type]:'';
    const promo=m.promote? '成':'';
    return name+from+cap+'-'+to+promo;
  }else{
    return PIECE_NAMES[m.drop]+'*'+idxToString(m.to);
  }
}

function renderLog(){
  logEl.innerHTML=logs.map(l=>'<div>'+l+'</div>').join('');
  logEl.scrollTop=logEl.scrollHeight;
}

function addLog(player,m){
  logs.push((player===0?'先手:':'後手:')+moveToString(m));
  renderLog();
}
boardEl.onclick=e=>{
  if(state.turn!==HUMAN)return;
  const idx=Number(e.target.closest('.cell')?.dataset.index);
  if(selected){
    const mv=legal.find(m=>m.to===idx);
    if(mv){
      playMove(mv);
      selected=null;legal=[];highlight();
    }
  }
};
document.getElementById('undo').onclick=()=>{
  if(state.history.length<2)return;
  ignore=true;
  worker.postMessage({type:'stop'});
  stopThinking(Date.now()-thinkStart);
  undo();undo();
  render();
  renderLog();
};

function resetGame(){
  ignore=true;
  worker.postMessage({type:'stop'});
  stopThinking(Date.now()-thinkStart);
  state=initialState();
  logs=[];
  render();
  renderLog();
  if(aiMode && state.turn!==HUMAN){
    startThinking();
    worker.postMessage({type:'start',state:serialize(state)});
  }
}
document.getElementById('reset').onclick=resetGame;
document.getElementById('toggle').onclick=()=>{
  aiMode=!aiMode;
  const btn=document.getElementById('toggle');
  if(aiMode){
    HUMAN=-1;
    btn.textContent='人間対AI';
    if(state.turn!==HUMAN){
      startThinking();
      worker.postMessage({type:'start',state:serialize(state)});
    }
  }else{
    HUMAN=0;
    btn.textContent='AI対AI';
  }
};
function playMove(m){
  applyMove(state,m);
  addLog(HUMAN,m);
  render();
  state.history.push(m);
  if(state.turn!==HUMAN){
    startThinking();
    worker.postMessage({type:'start',state:serialize(state)});
  }
}
function inZone(color,idx){
  const y=8-Math.floor(idx/9);
  return color?y<3:y>5;
}
function applyMove(s,m){
  if(m.from>=0){
    const p=s.board[m.from];
    s.board[m.from]=null;
    const toPiece=s.board[m.to];
    if(toPiece){
      m.captured={type:toPiece.type,c:toPiece.c};
      const t=UNPROMOTE[toPiece.type]||toPiece.type;
      s.hand[p.c][t]=(s.hand[p.c][t]||0)+1;
    } else m.captured=null;
    if(PROMOTABLE[p.type]&&(inZone(p.c,m.from)||inZone(p.c,m.to)))m.promote=true;
    if(m.promote)p.type= PROMOTE[p.type];
    s.board[m.to]=p;
  }else{
    s.hand[s.turn][m.drop]--;
    s.board[m.to]={type:m.drop,c:s.turn};
  }
  s.turn^=1;
}
function undo(){
  const m=state.history.pop();
  state.turn^=1;
  if(m.from>=0){
    const p=state.board[m.to];
    state.board[m.to]=null;
    if(m.promote)p.type=UNPROMOTE[p.type];
    state.board[m.from]=p;
    if(m.captured){
      const t=UNPROMOTE[m.captured.type]||m.captured.type;
      state.hand[state.turn][t]--;
      state.board[m.to]={type:m.captured.type,c:state.turn^1};
    }
  }else{
    state.board[m.to]=null;
    state.hand[state.turn][m.drop]=(state.hand[state.turn][m.drop]||0)+1;
  }
  logs.pop();
}
function generateLegalMoves(s,color){
  const moves=generateMoves(s,color);
  return moves.filter(m=>{const ns=clone(s);applyMove(ns,m);return !isCheck(ns,color);});
}
function generateMoves(s,color){
  const moves=[];
  for(let i=0;i<81;i++){
    const p=s.board[i];
    if(!p||p.c!==color)continue;
    const piece=p.type;
    genPieceMoves(i,piece,color,s.board,moves);
  }
  const hand=s.hand[color];
  for(let k in hand){
    if(hand[k]>0){
      for(let i=0;i<81;i++)if(!s.board[i]){
        if(k==='P'&&invalidPawnDrop(i,color,s))continue;
        const m={from:-1,to:i,drop:k};
        moves.push(m);
      }
    }
  }
  return moves;
}
function invalidPawnDrop(to,color,s){
  const file=to%9;
  for(let r=0;r<9;r++){
    const p=s.board[r*9+file];
    if(p&&p.c===color&&p.type==='P')return true;
  }
  const ns=clone(s);applyMove(ns,{from:-1,to,drop:'P'});return isMate(ns,color^1);
}
function genPieceMoves(idx,type,c,b,moves){
  const dirs={
    P:[[0,1]],
    L:[[0,1,true]],
    N:[[1,2],[-1,2]],
    S:[[0,1],[1,1],[-1,1],[1,-1],[-1,-1]],
    G:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1]],
    K:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1],[1,-1],[-1,-1]],
    B:[[1,1,true],[-1,1,true],[1,-1,true],[-1,-1,true]],
    R:[[0,1,true],[0,-1,true],[1,0,true],[-1,0,true]]
  };
  const add=(dx,dy,slide)=>{
    let x=idx%9,y=8-Math.floor(idx/9); if(c)dy=-dy;
    for(let n=1;;n++){
      const nx=x+dx*n,ny=y+dy*n; if(nx<0||nx>8||ny<0||ny>8)break;
      const ni=(8-ny)*9+nx; const t=b[ni];
      if(!t){moves.push({from:idx,to:ni,promote:needPromote(type,c,idx,ni)})}else{if(t.c!==c)moves.push({from:idx,to:ni,promote:needPromote(type,c,idx,ni),capture:UNPROMOTE[t.type]||t.type});break;}if(!slide)break;
    }
  };
  let ps=dirs[type];
  if(!ps && type[0]==='+'){
    ps=dirs.G;
  }
  if(type==='+B'){
    ps=dirs.B.concat([[0,1],[0,-1],[1,0],[-1,0]]);
  }
  if(type==='+R'){
    ps=dirs.R.concat([[1,1],[-1,1],[1,-1],[-1,-1]]);
  }
  if(!ps)return;
  for(const d of ps)add(d[0],d[1],d[2]);
}
function needPromote(type,c,from,to){
  if(!PROMOTABLE[type])return false;
  const zy=(y)=>c?y<3:y>5;
  const fy=8-Math.floor(from/9),ty=8-Math.floor(to/9);
  return zy(fy)||zy(ty);
}
function isCheck(s,color){
  const k=findKing(s,color);return attacksTo(s,k,color^1).length>0;
}
function findKing(s,color){
  for(let i=0;i<81;i++){const p=s.board[i]; if(p&&p.c===color&&p.type==='K')return i;}return -1;}
function attacksTo(s,idx,attacker){
  const b=s.board; const moves=[]; for(let i=0;i<81;i++){const p=b[i]; if(p&&p.c===attacker)genPieceMoves(i,p.type,attacker,b,moves);} return moves.filter(m=>m.to===idx);
}
function isMate(s,color){
  if(!isCheck(s,color))return false; return generateLegalMoves(s,color).length===0;
}
function clone(s){
  return {board:s.board.map(p=>p?{type:p.type,c:p.c}:null),hand:[{...s.hand[0]},{...s.hand[1]}],turn:s.turn};
}
function serialize(s){
  return {board:s.board.map(p=>p?{t:p.type,c:p.c}:null),hand:s.hand.map(h=>({...h})),turn:s.turn};
}

render();
const worker=new Worker('aiWorker.js');
worker.onmessage=e=>{
  if(ignore){ignore=false;return;}
  const {move,time}=e.data;
  stopThinking(time);
  if(!move){
    statusEl.textContent='後手の負けです';
    return;
  }
  applyMove(state,move);
  addLog(state.turn^1,move);
  state.history.push(move);
  render();
  if(state.turn!==HUMAN){
    startThinking();
    worker.postMessage({type:'start',state:serialize(state)});
  }
};
