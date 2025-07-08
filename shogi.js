const pieceSymbols = {
  '歩':'歩','香':'香','桂':'桂','銀':'銀','金':'金','角':'角',
  '飛':'飛','王':'王','と':'と','杏':'杏','圭':'圭','全':'全',
  '馬':'馬','竜':'竜'
};

const pieceValues = {
  '歩':100,'香':300,'桂':300,'銀':400,'金':500,'角':850,'飛':900,'王':10000,
  'と':500,'杏':500,'圭':500,'全':500,'馬':950,'竜':1000
};

let state = initState();
let history = [clone(state)];
let selected = null;
let selectedHand = null;
const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const aiHandEl = document.getElementById('ai-hand');
const playerHandEl = document.getElementById('player-hand');
const undoBtn = document.getElementById('undo');
const worker = new Worker('aiWorker.js');
worker.onmessage = e => {
  if(e.data.type==='bestmove') {
    applyMove(state, e.data.move);
    history.push(clone(state));
    render();
  }
};
undoBtn.onclick = undo;
render();

function initState(){
  const b = Array.from({length:9}, () => Array(9).fill(null));
  // gote (AI) pieces on top
  b[0] = [
    {type:'香',owner:'ai'}, {type:'桂',owner:'ai'}, {type:'銀',owner:'ai'},
    {type:'金',owner:'ai'}, {type:'王',owner:'ai'},
    {type:'金',owner:'ai'}, {type:'銀',owner:'ai'},
    {type:'桂',owner:'ai'}, {type:'香',owner:'ai'}
  ];
  b[1][1] = {type:'角',owner:'ai'}; // ８二
  b[1][7] = {type:'飛',owner:'ai'}; // ２二
  for(let c=0;c<9;c++) b[2][c] = {type:'歩', owner:'ai'};

  // sente (player) pieces on bottom
  for(let c=0;c<9;c++) b[6][c] = {type:'歩', owner:'player'};
  b[7][7] = {type:'角',owner:'player'}; // ２八
  b[7][1] = {type:'飛',owner:'player'}; // ８八
  b[8] = [
    {type:'香',owner:'player'}, {type:'桂',owner:'player'}, {type:'銀',owner:'player'},
    {type:'金',owner:'player'}, {type:'王',owner:'player'},
    {type:'金',owner:'player'}, {type:'銀',owner:'player'},
    {type:'桂',owner:'player'}, {type:'香',owner:'player'}
  ];
  return {board:b, hands:{player:{}, ai:{}}, turn:'player'};
}

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

function render(){
  boardEl.innerHTML='';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell = document.createElement('div');
      cell.className='cell';
      cell.dataset.r=r;cell.dataset.c=c;
      const p = state.board[r][c];
      if(p){
        const div=document.createElement('div');
        div.textContent=p.type;
        div.className='piece'+(p.owner==='ai'?' ai':'');
        cell.appendChild(div);
      }
      cell.onclick=()=>onCellClick(r,c);
      boardEl.appendChild(cell);
    }
  }
  drawHands();
  turnEl.textContent = state.turn==='player'?'あなたの番':'AI考え中...';
  if(state.turn==='ai') worker.postMessage({type:'go', fen: toSFEN(state), ms:10000});
}

function drawHands(){
  aiHandEl.innerHTML='';
  playerHandEl.innerHTML='';
  for(const side of ['ai','player']){
    const handEl = side==='ai'?aiHandEl:playerHandEl;
    const h=state.hands[side];
    for(const k in pieceSymbols){
      if(h[k]){
        const span=document.createElement('span');
        span.textContent=k+'x'+h[k];
        span.className='piece'+(side==='ai'?' ai':'');
        if(side==='player') span.onclick=()=>onHandClick(k);
        handEl.appendChild(span);
      }
    }
  }
}

function onHandClick(type){
  if(state.turn!=='player') return;
  selectedHand=type;selected=null;
  highlightDrops(type);
}

function onCellClick(r,c){
  if(state.turn!=='player') return;
  if(selectedHand){
    const move={drop:true,type:selectedHand,to:[r,c]};
    if(isLegalDrop(state,move)){
      applyMove(state,move);
      history.push(clone(state));
      selectedHand=null;clearHighlights();
      render();
    }
    return;
  }
  const p=state.board[r][c];
  if(selected){
    const moves=generateMoves(state,selected.r,selected.c).filter(m=>m.to[0]===r && m.to[1]===c);
    if(moves.length){
      let move=moves[0];
      if(moves.length>1){
        if(confirm('成りますか?')) move=moves.find(m=>m.promote)||move;
      }
      applyMove(state,move);
      history.push(clone(state));
      selected=null;clearHighlights();
      render();
      return;
    }
    selected=null;clearHighlights();
    return;
  }
  if(p && p.owner==='player'){
    selected={r,c};
    highlightMoves(generateMoves(state,r,c));
  }
}

function highlightMoves(moves){
  clearHighlights();
  moves.forEach(m=>{
    const sel=document.querySelector(`.cell[data-r="${m.to[0]}"][data-c="${m.to[1]}"]`);
    if(sel) sel.classList.add('highlight');
  });
}
function highlightDrops(type){
  clearHighlights();
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(!state.board[r][c]){
        if(isLegalDrop(state,{drop:true,type,to:[r,c]})){
          const sel=document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
          if(sel) sel.classList.add('highlight');
        }
      }
    }
  }
}
function clearHighlights(){
  document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight'));
}

function applyMove(st,move){
  if(move.drop){
    st.board[move.to[0]][move.to[1]]={type:move.type,owner:st.turn,promoted:false};
    st.hands[st.turn][move.type]--; if(st.hands[st.turn][move.type]===0) delete st.hands[st.turn][move.type];
  }else{
    const p=st.board[move.from[0]][move.from[1]];
    st.board[move.from[0]][move.from[1]]=null;
    if(st.board[move.to[0]][move.to[1]]){
      const cap=st.board[move.to[0]][move.to[1]];
      const t=cap.promoted?demote(cap.type):cap.type;
      st.hands[st.turn][t]=(st.hands[st.turn][t]||0)+1;
    }
    if(move.promote) p.promoted=true;
    st.board[move.to[0]][move.to[1]]=p;
  }
  st.turn=st.turn==='player'?'ai':'player';
}

function undo(){
  if(history.length>1){
    history.pop();
    state=clone(history[history.length-1]);
    worker.postMessage({type:'stop'});
    render();
  }
}

function generateMoves(st,r,c){
  const p=st.board[r][c];
  if(!p) return [];
  const dir=p.owner==='player'?-1:1;
  const res=[];
  const add=(dr,dc,range)=>{
    for(let i=1;i<=range;i++){
      const nr=r+dr*i,nc=c+dc*i;
      if(nr<0||nr>=9||nc<0||nc>=9) break;
      const target=st.board[nr][nc];
      if(target && target.owner===p.owner) break;
      const promo = shouldPromote(p,r,nr);
      if(canPromotePiece(p.type) && promo){
        if(forcedPromotion(p.type,nr,p.owner)){
          res.push({from:[r,c],to:[nr,nc],promote:true});
        }else{
          res.push({from:[r,c],to:[nr,nc],promote:false});
          res.push({from:[r,c],to:[nr,nc],promote:true});
        }
      }else{
        res.push({from:[r,c],to:[nr,nc],promote:false});
      }
      if(target) break;
    }
  };
  const step=(dr,dc)=>{add(dr,dc,1);};
  const leaps={
    '歩':()=>step(dir,0),
    '香':()=>add(dir,0,8),
    '桂':()=>{
      const nr=r+dir*2;
      [-1,1].forEach(dc=>{
        const promo=shouldPromote(p,r,nr);
        if(canPromotePiece(p.type) && promo){
          if(forcedPromotion(p.type,nr,p.owner)){
            res.push({from:[r,c],to:[nr,c+dc],promote:true});
          }else{
            res.push({from:[r,c],to:[nr,c+dc],promote:false});
            res.push({from:[r,c],to:[nr,c+dc],promote:true});
          }
        }else{
          res.push({from:[r,c],to:[nr,c+dc],promote:false});
        }
      });
    },
    '銀':()=>{step(dir,-1);step(dir,0);step(dir,1);step(-dir,-1);step(-dir,1);},
    '金':()=>{step(dir,-1);step(dir,0);step(dir,1);step(0,-1);step(0,1);step(-dir,0);},
    '王':()=>{[-1,0,1].forEach(dr=>[-1,0,1].forEach(dc=>{if(dr||dc) step(dr,dc);}));},
    '角':()=>{add(1,1,8);add(1,-1,8);add(-1,1,8);add(-1,-1,8);},
    '飛':()=>{add(1,0,8);add(-1,0,8);add(0,1,8);add(0,-1,8);},
    '馬':()=>{leaps['角']();step(1,0);step(-1,0);step(0,1);step(0,-1);},
    '竜':()=>{leaps['飛']();step(1,1);step(1,-1);step(-1,1);step(-1,-1);},
    'と':()=>leaps['金'](),
    '杏':()=>leaps['金'](),
    '圭':()=>leaps['金'](),
    '全':()=>leaps['金']()
  };
  if(leaps[p.promoted?promoteName(p.type):p.type])
    leaps[p.promoted?promoteName(p.type):p.type]();
  return res.filter(m=>isLegalMove(st,m));
}

function promoteName(type){
  return {歩:'と',香:'杏',桂:'圭',銀:'全',角:'馬',飛:'竜'}[type]||type;
}
function demote(type){
  return {と:'歩',杏:'香',圭:'桂',全:'銀',馬:'角',竜:'飛'}[type]||type;
}
function canPromotePiece(type){
  return ['歩','香','桂','銀','角','飛'].includes(type);
}
function forcedPromotion(type,toR,owner){
  if(owner==='player'){
    if(type==='歩' && toR===0) return true;
    if(type==='香' && toR===0) return true;
    if(type==='桂' && toR<=1) return true;
  }else{
    if(type==='歩' && toR===8) return true;
    if(type==='香' && toR===8) return true;
    if(type==='桂' && toR>=7) return true;
  }
  return false;
}
function inPromZone(owner,r){
  return owner==='player'? r<=2 : r>=6;
}
function shouldPromote(p,fromR,toR){
  if(p.promoted) return false;
  return inPromZone(p.owner, fromR) || inPromZone(p.owner, toR);
}

function isLegalMove(st,m){
  const copy=clone(st);
  applyMove(copy,m);
  return !isCheck(copy,st.turn);
}

function isLegalDrop(st,m){
  const {type,to}=m;const [r,c]=to;
  if(st.board[r][c]) return false;
  if(type==='歩'){
    for(let i=0;i<9;i++){const p=st.board[i][c];if(p&&p.owner===st.turn&&p.type==='歩'&&!p.promoted)return false;}
    if((st.turn==='player'&&r===0)||(st.turn==='ai'&&r===8)) return false;
  }
  if(type==='香'&&((st.turn==='player'&&r===0)||(st.turn==='ai'&&r===8))) return false;
  if(type==='桂'&&((st.turn==='player'&&r<=1)||(st.turn==='ai'&&r>=7))) return false;
  const copy=clone(st);applyMove(copy,m);
  const enemy=copy.turn;
  if(type==='歩' && isCheck(copy,enemy) && generateMovesForSide(copy,enemy).length===0) return false;
  return !isCheck(copy,st.turn);
}

function isCheck(st,side){
  const enemy=side==='player'?'ai':'player';
  let kr,kc;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=st.board[r][c];if(p&&p.owner===side&&p.type==='王'){kr=r;kc=c;}}
  return generateMovesForSide(st,enemy).some(m=>m.to[0]===kr&&m.to[1]===kc);
}
function generateMovesForSide(st,side){
  const res=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=st.board[r][c];if(p&&p.owner===side)res.push(...generateMoves(st,r,c));}
  for(const type in st.hands[side]){
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      if(isLegalDrop(st,{drop:true,type,to:[r,c]}))res.push({drop:true,type,to:[r,c]});
    }
  }
  return res;
}

function toSFEN(st){
  let boardStr='';
  for(let r=0;r<9;r++){
    let empty=0;
    for(let c=0;c<9;c++){
      const p=st.board[r][c];
      if(p){
        if(empty){boardStr+=empty;empty=0;}
        const sym=toSFENChar(p);
        boardStr+=sym;
      }else empty++;
    }
    if(empty) boardStr+=empty;
    if(r<8) boardStr+='/';
  }
  const turn=st.turn==='player'?'b':'w';
  const handsStr=handsToSFEN(st.hands);
  return boardStr+' '+turn+' '+(handsStr||'-');
}
function toSFENChar(p){
  const map={歩:'P',香:'L',桂:'N',銀:'S',金:'G',角:'B',飛:'R',王:'K',
    と:'+P',杏:'+L',圭:'+N',全:'+S',馬:'+B',竜:'+R'};
  return p.owner==='player'?map[p.promoted?promoteName(p.type):p.type]:map[p.promoted?promoteName(p.type):p.type].toLowerCase();
}
function handsToSFEN(hands){
  let s='';
  ['ai','player'].forEach(side=>{for(const k in hands[side]){const code=toSFENChar({type:k,owner:side,promoted:false}).replace('+','');s+=code+(hands[side][k]>1?hands[side][k]:'');}});
  return s;
}
function fromSFEN(fen){
  const [boardStr,turn,handsStr] = fen.split(' ');
  const rows=boardStr.split('/');
  const b=Array.from({length:9},()=>Array(9).fill(null));
  for(let r=0;r<9;r++){
    let c=0; const row=rows[r];
    for(let i=0;i<row.length;i++){
      const ch=row[i];
      if(!isNaN(ch)){ c+=parseInt(ch); continue; }
      let promo=false, sym=ch;
      if(ch==='+'){ promo=true; sym=row[++i]; }
      const owner = ch===ch.toUpperCase()?'player':'ai';
      const type=fromSFENChar(sym.toUpperCase());
      b[r][c++]={type,owner,promoted:promo};
    }
  }
  const hands = {player:{}, ai:{}};
  if(handsStr && handsStr!=='-'){
    let i=0;
    while(i<handsStr.length){
      let ch = handsStr[i++];
      let num='';
      while(i<handsStr.length && !isNaN(handsStr[i])) num+=handsStr[i++];
      const owner = ch===ch.toUpperCase()?'player':'ai';
      const type = fromSFENChar(ch.toUpperCase());
      const cnt = num?parseInt(num):1;
      hands[owner][type]=cnt;
    }
  }
  return {board:b,hands,turn: turn==='b'?'player':'ai'};
}
function fromSFENChar(ch){
  const map={P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛',K:'王'};
  return map[ch];
}
