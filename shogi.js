const pieceValue = {
  '王':10000,'飛':900,'角':850,'金':600,'銀':550,'桂':350,'香':300,'歩':100,
  '竜':950,'馬':900,'全':600,'圭':400,'杏':450,'と':150
};
const promoteMap = {'歩':'と','香':'杏','桂':'圭','銀':'全','角':'馬','飛':'竜'};
const demoteMap = {'と':'歩','杏':'香','圭':'桂','全':'銀','馬':'角','竜':'飛'};

let board = [];
let hands = [ {}, {} ];
let turn = 0;
let history = [];
let searchDepth = 3;

const dirs = {
  '歩': [[0,-1]],
  '香': [[0,-1,'slide']],
  '桂': [[-1,-2],[1,-2]],
  '銀': [[0,-1],[-1,-1],[1,-1],[-1,1],[1,1]],
  '金': [[0,-1],[-1,-1],[1,-1],[0,1],[-1,0],[1,0]],
  '王': [[0,-1],[-1,-1],[1,-1],[0,1],[-1,1],[1,1],[-1,0],[1,0]],
  '角': [[-1,-1,'slide'],[1,-1,'slide'],[-1,1,'slide'],[1,1,'slide']],
  '飛': [[0,-1,'slide'],[0,1,'slide'],[-1,0,'slide'],[1,0,'slide']],
  '馬': [[-1,-1,'slide'],[1,-1,'slide'],[-1,1,'slide'],[1,1,'slide'],[0,-1],[0,1],[-1,0],[1,0]],
  '竜': [[0,-1,'slide'],[0,1,'slide'],[-1,0,'slide'],[1,0,'slide'],[-1,-1],[1,-1],[-1,1],[1,1]],
  'と':'gold','杏':'gold','圭':'gold','全':'gold'
};

function cloneBoard(b){
  return b.map(r=>r.map(c=>c?{type:c.type,owner:c.owner}:null));
}
function cloneHands(h){
  return h.map(o=>Object.assign({},o));
}

function initBoard(){
  board=[
    [{type:'香',owner:1},{type:'桂',owner:1},{type:'銀',owner:1},{type:'金',owner:1},{type:'王',owner:1},{type:'金',owner:1},{type:'銀',owner:1},{type:'桂',owner:1},{type:'香',owner:1}],
    [null,{type:'飛',owner:1},null,null,null,null,null,{type:'角',owner:1},null],
    [{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1},{type:'歩',owner:1}],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null,null],
    [{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0},{type:'歩',owner:0}],
    [null,{type:'角',owner:0},null,null,null,null,null,{type:'飛',owner:0},null],
    [{type:'香',owner:0},{type:'桂',owner:0},{type:'銀',owner:0},{type:'金',owner:0},{type:'王',owner:0},{type:'金',owner:0},{type:'銀',owner:0},{type:'桂',owner:0},{type:'香',owner:0}]
  ];
  hands=[{},{}];
  turn=0;
  history=[];
  render();
}

function inZone(y,owner){
  return owner===0? y<=2 : y>=6;
}
function canPromote(type){
  return ['歩','香','桂','銀','角','飛'].includes(type);
}

function evaluate(b){
  let score=0;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      let c=b[y][x];
      if(!c) continue;
      let val=pieceValue[c.type]||0;
      if(c.owner===1) score+=val; else score-=val;
      if(c.owner===1 && inZone(y,0)) score+=20;
      if(c.owner===0 && inZone(y,1)) score-=20;
    }
  }
  for(let o=0;o<2;o++){
    for(let p in hands[o]){
      let val=(pieceValue[p]||0)*hands[o][p];
      if(o===1) score+=val; else score-=val;
    }
  }
  return score;
}

function generateAllMoves(owner){
  let moves=[];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      let c=board[y][x];
      if(!c || c.owner!==owner) continue;
      moves.push(...generatePieceMoves(x,y,c));
    }
  }
  let hand=hands[owner];
  for(let p in hand){
    if(hand[p]>0){
      for(let y=0;y<9;y++){
        for(let x=0;x<9;x++){
          if(board[y][x]) continue;
          if(!canDrop(p,owner,y)) continue;
          let mv={drop:true,piece:p,to:{x,y}};
          if(p==='歩' && causesImmediateMate(owner,mv)) continue;
          if(canPromote(p)){
            moves.push({...mv, promote:false});
            moves.push({...mv, promote:true});
          }else{
            moves.push({...mv, promote:false});
          }
        }
      }
    }
  }
  return moves;
}

function canDrop(p,owner,y){
  if(p==='歩'){
    if(owner===0 && y===0) return false;
    if(owner===1 && y===8) return false;
  }
  if(p==='香'){
    if(owner===0 && y===0) return false;
    if(owner===1 && y===8) return false;
  }
  if(p==='桂'){
    if(owner===0 && y<=1) return false;
    if(owner===1 && y>=7) return false;
  }
  return true;
}

function demote(t){
  return demoteMap[t]||t;
}

function generatePieceMoves(x,y,c){
  let type=c.type;
  if(dirs[type]==='gold') type='金';
  let arr=dirs[type];
  let moves=[];
  arr.forEach(d=>{
    let dx=d[0];
    let dy=d[1];
    if(c.owner===1){dx=-dx; dy=-dy;}
    let nx=x+dx;
    let ny=y+dy;
    while(nx>=0 && nx<9 && ny>=0 && ny<9){
      let target=board[ny][nx];
      if(target && target.owner===c.owner) break;
      let mv={from:{x,y},to:{x:nx,y:ny},promote:false};
      if(target) mv.capture=target.type;
      if(canPromote(c.type) && (inZone(y,c.owner) || inZone(ny,c.owner))){
        moves.push({...mv,promote:false});
        moves.push({...mv,promote:true});
      }else{
        moves.push(mv);
      }
      if(target || d[2]!=='slide') break;
      nx+=dx; ny+=dy;
    }
  });
  return moves;
}

function applyMove(move){
  history.push({board:cloneBoard(board),hands:cloneHands(hands),turn});
  if(move.drop){
    board[move.to.y][move.to.x]={type:move.promote?promoteMap[move.piece]||move.piece:move.piece,owner:turn};
    hands[turn][move.piece]--;
    if(hands[turn][move.piece]===0) delete hands[turn][move.piece];
  }else{
    let piece=board[move.from.y][move.from.x];
    board[move.from.y][move.from.x]=null;
    if(board[move.to.y][move.to.x]){
      let cap=board[move.to.y][move.to.x];
      let base=demote(cap.type);
      hands[turn][base]=(hands[turn][base]||0)+1;
    }
    if(move.promote) piece.type=promoteMap[piece.type]||piece.type;
    board[move.to.y][move.to.x]=piece;
  }
  turn=1-turn;
}

function undo(){
  if(history.length===0) return;
  let last=history.pop();
  board=last.board; hands=last.hands; turn=last.turn;
}

function isCheck(owner){
  let kingPos=null;
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      let c=board[y][x];
      if(c && c.owner===owner && c.type==='王') kingPos={x,y};
    }
  }
  if(!kingPos) return false;
  let opp=1-owner;
  let moves=generateAllMoves(opp);
  return moves.some(m=>m.to && m.to.x===kingPos.x && m.to.y===kingPos.y);
}

function causesImmediateMate(owner,dropMove){
  applyMove(dropMove);
  let check=isCheck(1-owner) && generateAllMoves(1-owner).length===0;
  undo();
  return check;
}

function minimax(depth,alpha,beta,maximizing){
  if(depth===0) return evaluate(board);
  let owner=maximizing?1:0;
  let moves=generateAllMoves(owner);
  if(moves.length===0) return evaluate(board);
  if(maximizing){
    let max=-Infinity;
    for(let mv of moves){
      applyMove(mv);
      let val=minimax(depth-1,alpha,beta,false);
      undo();
      if(val>max) max=val;
      if(val>alpha) alpha=val;
      if(beta<=alpha) break;
    }
    return max;
  }else{
    let min=Infinity;
    for(let mv of moves){
      applyMove(mv);
      let val=minimax(depth-1,alpha,beta,true);
      undo();
      if(val<min) min=val;
      if(val<beta) beta=val;
      if(beta<=alpha) break;
    }
    return min;
  }
}

function bestMove(){
  let moves=generateAllMoves(1);
  let best=null;
  let bestVal=-Infinity;
  moves.forEach(mv=>{
    applyMove(mv);
    let val=minimax(searchDepth-1,-Infinity,Infinity,false);
    undo();
    if(val>bestVal || (val===bestVal && Math.random()<0.5)){
      bestVal=val; best=mv;
    }
  });
  return best;
}

function makeAIMove(){
  searchDepth=parseInt(document.getElementById('depth').value,10);
  let mv=bestMove();
  if(mv){ applyMove(mv); }
  render();
  checkResult();
}

function render(){
  const boardDiv=document.getElementById('board');
  boardDiv.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const sq=document.createElement('div');
      sq.className='square';
      sq.dataset.x=x; sq.dataset.y=y;
      const piece=board[y][x];
      if(piece){
        const p=document.createElement('div');
        p.className='piece';
        p.textContent=piece.type;
        p.draggable=true;
        p.dataset.x=x; p.dataset.y=y;
        p.addEventListener('dragstart',onDragStart);
        p.addEventListener('dragend',onDragEnd);
        sq.appendChild(p);
      }
      sq.addEventListener('dragover',ev=>ev.preventDefault());
      sq.addEventListener('drop',onDrop);
      boardDiv.appendChild(sq);
    }
  }
  renderHand(0);
  renderHand(1);
  document.getElementById('turn').textContent=turn===0?'先手番':'後手番';
}

function renderHand(owner){
  const id=owner===0?'black-hand':'white-hand';
  const container=document.getElementById(id);
  container.innerHTML=owner===0?'先手持ち駒:':'後手持ち駒:';
  for(let p in hands[owner]) {
    for(let i=0;i<hands[owner][p];i++){
      const span=document.createElement('span');
      span.textContent=p;
      span.className='piece';
      span.draggable=true;
      span.dataset.hand=p;
      span.addEventListener('dragstart',onDragStart);
      span.addEventListener('dragend',onDragEnd);
      container.appendChild(span);
    }
  }
}

let dragging=null;
let legal=[];

function onDragStart(ev){
  const hand=ev.target.dataset.hand;
  if(hand){
    dragging={dropPiece:hand};
    legal=generateDropMoves(hand);
  }else{
    const x=parseInt(ev.target.dataset.x); const y=parseInt(ev.target.dataset.y);
    const piece=board[y][x];
    if(piece.owner!==turn){ ev.preventDefault(); return; }
    dragging={from:{x,y},piece:piece.type};
    legal=generatePieceMoves(x,y,piece);
  }
  highlightLegal();
}

function generateDropMoves(p){
  let mv=[];
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      if(board[y][x]) continue;
      if(!canDrop(p,turn,y)) continue;
      if(p==='歩'){
        let has=false;
        for(let yy=0;yy<9;yy++){
          let c=board[yy][x];
          if(c && c.owner===turn && c.type==='歩'){has=true;break;}
        }
        if(has) continue;
      }
      let m={drop:true,piece:p,to:{x,y},promote:false};
      if(p==='歩' && causesImmediateMate(turn,m)) continue;
      mv.push(m);
    }
  }
  return mv;
}

function highlightLegal(){
  document.querySelectorAll('.square').forEach(s=>s.classList.remove('highlight'));
  legal.forEach(m=>{
    const selector=`.square[data-x="${m.to.x}"][data-y="${m.to.y}"]`;
    const el=document.querySelector(selector);
    if(el) el.classList.add('highlight');
  });
}

function onDragEnd(){
  dragging=null;
  legal=[];
  highlightLegal();
}

function onDrop(ev){
  ev.preventDefault();
  if(!dragging) return;
  const x=parseInt(this.dataset.x); const y=parseInt(this.dataset.y);
  const move=legal.find(m=>m.to.x===x && m.to.y===y);
  if(!move){ dragging=null; highlightLegal(); return; }
  if(dragging.from){ move.from=dragging.from; move.piece=board[dragging.from.y][dragging.from.x].type; }
  let promote=false;
  if(canPromote(move.piece) && (move.drop || inZone(move.from.y,turn) || inZone(y,turn))) {
    promote=confirm('成りますか?');
  }
  move.promote=promote;
  applyMove(move);
  dragging=null;
  render();
  if(checkResult()) return;
  if(turn===1) makeAIMove();
}

function checkResult(){
  if(isCheck(turn) && generateAllMoves(turn).length===0){
    alert((turn===0?'後手':'先手')+'の勝ち');
    initBoard();
    return true;
  }
  return false;
}

document.getElementById('undo').addEventListener('click',()=>{
  if(history.length>=2){undo();undo();}
  render();
});

window.onload=initBoard;
