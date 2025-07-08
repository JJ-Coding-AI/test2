const pieceSymbols = {
  '歩':'歩','香':'香','桂':'桂','銀':'銀','金':'金','角':'角',
  '飛':'飛','王':'王','と':'と','杏':'杏','圭':'圭','全':'全',
  '馬':'馬','竜':'竜'
};

const boardElem = document.getElementById('board');
const turnElem = document.getElementById('turn');
const playerHandElem = document.getElementById('player-hand');
const aiHandElem = document.getElementById('ai-hand');
const levelElem = document.getElementById('level');
const undoBtn = document.getElementById('undo');

const worker = new Worker('aiWorker.js');
let currentTurn = 'player';
let board = [];
let hands = { player: {}, ai: {} };
let history = [];
let selected = null;
let legalMoves = [];

function initBoard() {
  board = Array(9).fill(0).map(() => Array(9).fill(null));
  hands = { player: {}, ai: {} };
  // pieces initial setup
  const back = ['香','桂','銀','金','王','金','銀','桂','香'];
  for(let i=0;i<9;i++) {
    board[8][i] = {type:back[i],owner:'player'};
    board[0][8-i] = {type:back[i],owner:'ai'};
  }
  board[7][1] = {type:'飛',owner:'player'};
  board[7][7] = {type:'角',owner:'player'};
  board[1][7] = {type:'飛',owner:'ai'};
  board[1][1] = {type:'角',owner:'ai'};
  for(let i=0;i<9;i++) {
    board[6][i] = {type:'歩',owner:'player'};
    board[2][i] = {type:'歩',owner:'ai'};
  }
}

function render() {
  boardElem.innerHTML = '';
  for(let r=0;r<9;r++) {
    for(let c=0;c<9;c++) {
      const sq = document.createElement('div');
      sq.className = 'square';
      sq.dataset.r = r;
      sq.dataset.c = c;
      const p = board[r][c];
      if(p) {
        const pe = document.createElement('div');
        pe.className = 'piece';
        if(p.owner==='ai') pe.classList.add('ai');
        pe.textContent = pieceSymbols[p.type];
        sq.appendChild(pe);
      }
      boardElem.appendChild(sq);
    }
  }
  renderHands();
  turnElem.textContent = currentTurn==='player'?'あなたの手番':'AIの手番';
}

function renderHands() {
  playerHandElem.innerHTML='';
  aiHandElem.innerHTML='';
  for(const [t,n] of Object.entries(hands.player)) {
    for(let i=0;i<n;i++){
      const pe=document.createElement('div');
      pe.className='piece';
      pe.textContent=pieceSymbols[t];
      pe.dataset.type=t;
      playerHandElem.appendChild(pe);
    }
  }
  for(const [t,n] of Object.entries(hands.ai)) {
    for(let i=0;i<n;i++){
      const pe=document.createElement('div');
      pe.className='piece ai';
      pe.textContent=pieceSymbols[t];
      pe.dataset.type=t;
      aiHandElem.appendChild(pe);
    }
  }
}

function cloneBoard(b){return b.map(row=>row.map(p=>p?{...p}:null));}
function cloneHands(h){return {player:{...h.player},ai:{...h.ai}};}

function addHand(owner,type){const h=hands[owner];h[type]=(h[type]||0)+1;}
function removeHand(owner,type){const h=hands[owner];h[type]--;if(!h[type])delete h[type];}

const directions = {
  '歩':[[1,0]],
  '香':[[1,0,9]],
  '桂':[[2,-1],[2,1]],
  '銀':[[1,-1],[1,0],[1,1],[-1,-1],[-1,1]],
  '金':[[1,0],[0,-1],[0,1],[-1,0],[1,-1],[1,1]],
  '角':[[1,1,9],[1,-1,9],[-1,1,9],[-1,-1,9]],
  '飛':[[1,0,9],[-1,0,9],[0,1,9],[0,-1,9]],
  '王':[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
};
const promoteMap={'歩':'と','香':'杏','桂':'圭','銀':'全','角':'馬','飛':'竜'};

function isKingInCheck(b,owner){
  let kr=-1,kc=-1;
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=b[r][c];
      if(p&&p.type==='王'&&p.owner===owner){kr=r;kc=c;}
    }
  }
  const enemy=owner==='player'?'ai':'player';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=b[r][c];
      if(p&&p.owner===enemy){
        const dir=(enemy==='player')?-1:1;
        const dlist=directions[p.type]||[];
        for(const d of dlist){
          const limit=d[2]||1;
          for(let k=1;k<=limit;k++){
            const nr=r+d[0]*dir*k;
            const nc=c+d[1]*dir*k;
            if(!inBoard(nr,nc)) break;
            if(nr===kr&&nc===kc) return true;
            if(b[nr][nc]){ if(b[nr][nc].owner!==enemy) break; else break; }
          }
        }
      }
    }
  }
  return false;
}

function applyTempMove(b,h,move,owner){
  b=cloneBoard(b);h=cloneHands(h);
  if(move.drop){
    b[move.to[0]][move.to[1]]={type:move.drop,owner};
    h[owner][move.drop]--; if(!h[owner][move.drop]) delete h[owner][move.drop];
  }else{
    const p=b[move.from[0]][move.from[1]];
    b[move.from[0]][move.from[1]]=null;
    if(b[move.to[0]][move.to[1]]){
      const cap=b[move.to[0]][move.to[1]];
      const base=cap.type.replace(/[と杏圭全馬竜]/,m=>({'と':'歩','杏':'香','圭':'桂','全':'銀','馬':'角','竜':'飛'}[m]));
      h[owner][base]=(h[owner][base]||0)+1;
    }
    b[move.to[0]][move.to[1]]=p;
    if(move.promote) p.type=promoteMap[p.type];
  }
  return {board:b,hands:h};
}

function isLegalMove(move,owner){
  const {board:nb,hands:nh}=applyTempMove(board,hands,move,owner);
  return !isKingInCheck(nb,owner);
}

function isLegalDrop(move,owner){
  if(move.drop==='歩'){
    if((owner==='player'&&move.to[0]===0)||(owner==='ai'&&move.to[0]===8)) return false;
    for(let r=0;r<9;r++){
      const p=board[r][move.to[1]];
      if(p&&p.owner===owner&&p.type==='歩') return false;
    }
  }
  const {board:nb,hands:nh}=applyTempMove(board,hands,move,owner);
  if(move.drop==='歩'&&isKingInCheck(nb,owner==='player'?'ai':'player')){
    const oppMoves=generatePseudoMoves(owner==='player'?'ai':'player',nb,nh);
    if(!oppMoves.some(m=>isLegalAfter(nb,nh,m,owner==='player'?'ai':'player'))) return false;
  }
  return !isKingInCheck(nb,owner);
}

function isLegalAfter(b,h,move,owner){
  const {board:nb}=applyTempMove(b,h,move,owner);
  return !isKingInCheck(nb,owner);
}

function generatePseudoMoves(owner,b=board,h=hands){
  const moves=[];
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=b[r][c];
      if(p&&p.owner===owner){
        const dir=(owner==='player')?-1:1;
        const dlist=directions[p.type]||[];
        for(const d of dlist){
          const limit=d[2]||1;
          for(let k=1;k<=limit;k++){
            const nr=r+d[0]*dir*k;
            const nc=c+d[1]*dir*k;
            if(!inBoard(nr,nc)) break;
            const dst=b[nr][nc];
            if(dst&&dst.owner===owner) break;
            const m={from:[r,c],to:[nr,nc],promote:false};
            moves.push(m);
            if(dst) break;
          }
        }
        if(promoteMap[p.type]){
          for(const m of moves.filter(mm=>mm.from&&mm.from[0]===r&&mm.from[1]===c)){
            if(isInEnemyZone(owner,r)||isInEnemyZone(owner,m.to[0])) m.canPromote=true;
          }
        }
      }
    }
  }
  for(const [type,count] of Object.entries(h[owner])){
    for(let r=0;r<9;r++){
      for(let c=0;c<9;c++){
        if(!b[r][c]) moves.push({drop:type,to:[r,c]});
      }
    }
  }
  return moves;
}

function inBoard(r,c){return r>=0&&r<9&&c>=0&&c<9;}

function generateMoves(owner){
  const raw=generatePseudoMoves(owner);
  return raw.filter(m=>m.drop?isLegalDrop(m,owner):isLegalMove(m,owner));
}

function isInEnemyZone(owner,r){return owner==='player'?r<=2:r>=6;}

function applyMove(move){
  const snapshot={board:cloneBoard(board),hands:cloneHands(hands),turn:currentTurn};
  history.push(snapshot);
  if(move.drop){
    board[move.to[0]][move.to[1]]={type:move.drop,owner:currentTurn};
    removeHand(currentTurn,move.drop);
  }else{
    const p=board[move.from[0]][move.from[1]];
    board[move.from[0]][move.from[1]]=null;
    if(board[move.to[0]][move.to[1]]){
      const cap=board[move.to[0]][move.to[1]];
      addHand(currentTurn,cap.type.replace(/[と杏圭全馬竜]/,m=>({'と':'歩','杏':'香','圭':'桂','全':'銀','馬':'角','竜':'飛'}[m]||m)));
    }
    board[move.to[0]][move.to[1]]=p;
    if(move.promote){p.type=promoteMap[p.type];}
  }
  currentTurn=currentTurn==='player'?'ai':'player';
  render();
  nextTurn();
}

function undo(){
  if(history.length<2) return;
  const last=history.splice(history.length-2,2)[0];
  board=last.board;
  hands=last.hands;
  currentTurn=last.turn;
  render();
}

boardElem.addEventListener('click',e=>{
  if(currentTurn!=='player') return;
  const sq=e.target.closest('.square');
  if(!sq) return;
  const r=+sq.dataset.r,c=+sq.dataset.c;
  const p=board[r][c];
  if(selected){
    if(legalMoves.some(m=>m.to[0]===r&&m.to[1]===c&&(!m.from||m.from[0]===selected.r&&m.from[1]===selected.c))){
      const move=legalMoves.find(m=>m.to[0]===r&&m.to[1]===c&&(m.drop||m.from[0]===selected.r&&m.from[1]===selected.c));
      if(move && move.canPromote){
        if(confirm('成りますか?')) move.promote=true;
      }
      applyMove(move);
      selected=null;legalMoves=[];
    }else{selected=null;legalMoves=[];render();}
  }else if(p&&p.owner==='player'){
    selected={r,c};
    legalMoves=generateMoves('player').filter(m=>m.drop||m.from[0]===r&&m.from[1]===c);
    highlight();
  }
});

playerHandElem.addEventListener('click',e=>{
  if(currentTurn!=='player') return;
  const pe=e.target.closest('.piece');
  if(!pe) return;
  selected={drop:pe.dataset.type};
  legalMoves=generateMoves('player').filter(m=>m.drop===selected.drop);
  highlight();
});

function highlight(){
  document.querySelectorAll('.square').forEach(s=>s.classList.remove('highlight'));
  legalMoves.forEach(m=>{
    const idx=m.to[0]*9+m.to[1];
    boardElem.children[idx].classList.add('highlight');
  });
}

undoBtn.addEventListener('click',undo);

worker.onmessage=e=>{
  if(e.data.type==='bestmove'){
    applyMove(e.data.move);
  }
};

function startAi(){
  const fen=toSFEN();
  const ms=parseInt(levelElem.value,10);
  worker.postMessage({type:'go',fen,ms});
}

function toSFEN(){
  let rows=[];
  for(let r=0;r<9;r++){
    let cnt=0,row='';
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p){
        if(cnt){row+=cnt;cnt=0;}
        let code=pieceToCode(p.type);
        if(p.owner==='player') code=code.toUpperCase();
        row+=code;
      }else cnt++;
    }
    if(cnt) row+=cnt;
    rows.push(row);
  }
  let handStr='';
  const order=['P','L','N','S','G','B','R'];
  const map={'歩':'P','香':'L','桂':'N','銀':'S','金':'G','角':'B','飛':'R'};
  order.forEach(k=>{
    const n=hands.ai[revMap(k)]||0;
    if(n) handStr+=n>1?n+k:k;
  });
  if(handStr==='') handStr='-';
  return rows.join('/')+' '+(currentTurn==='player'?'b':'w')+' '+handStr+' 1';
}

function pieceToCode(t){
  const map={'歩':'P','香':'L','桂':'N','銀':'S','金':'G','角':'B','飛':'R','王':'K','と':'+P','杏':'+L','圭':'+N','全':'+S','馬':'+B','竜':'+R'};
  return map[t];
}
function revMap(c){
  const m={P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛'};return m[c];
}

function nextTurn(){
  if(currentTurn==='ai') startAi();
}

function start(){
  initBoard();
  render();
  nextTurn();
}
start();

