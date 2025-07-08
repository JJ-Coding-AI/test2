const pieceValue = {"王":10000,"飛":900,"角":850,"金":600,"銀":550,"桂":350,"香":300,"歩":100,
                    "竜":950,"馬":900,"全":600,"圭":400,"杏":450,"と":150};
let board=[],hands={P:{},E:{}},turn='P',searchDepth=3,history=[];
const pieces=["歩","香","桂","銀","金","角","飛","王","と","杏","圭","全","馬","竜"];
function initBoard(){
  board=[];
  for(let y=0;y<9;y++){board[y]=[];for(let x=0;x<9;x++)board[y][x]=null;}
  const set=(y,x,t,o)=>board[y][x]={piece:t,owner:o};
  const back=['香','桂','銀','金','王','金','銀','桂','香'];
  back.forEach((p,i)=>set(0,i,p,'E'));
  set(1,1,'飛','E');set(1,7,'角','E');for(let i=0;i<9;i++)set(2,i,'歩','E');
  for(let i=0;i<9;i++)set(6,i,'歩','P');set(7,1,'角','P');set(7,7,'飛','P');
  back.forEach((p,i)=>set(8,i,p,'P'));
  hands={P:{},E:{}};turn='P';history=[];render();
}
function cloneBoard(){return board.map(r=>r.map(c=>c?{...c}:null));}
function restoreBoard(b){board=b.map(r=>r.map(c=>c?{...c}:null));}
function inside(x,y){return x>=0&&x<9&&y>=0&&y<9;}
function addHand(o,p){hands[o][p]=(hands[o][p]||0)+1;}
function removeHand(o,p){if(hands[o][p])hands[o][p]--;}
function moveOffsets(piece,owner){const f=owner==='P'?-1:1;switch(piece){
case '歩':return [[0,f]];case '香':return [[0,f,9]];case '桂':return [[-1,2*f],[1,2*f]];
case '銀':return [[-1,f],[0,f],[1,f],[-1,-f],[1,-f]];
case '金':return [[-1,0],[1,0],[0,f],[-1,f],[1,f],[0,-f]];
case '角':return [[1,1,9],[1,-1,9],[-1,1,9],[-1,-1,9]];
case '飛':return [[0,1,9],[0,-1,9],[1,0,9],[-1,0,9]];
case '王':return [[1,1],[1,0],[1,-1],[0,1],[0,-1],[-1,1],[-1,0],[-1,-1]];
case 'と':case '杏':case '圭':case '全':return moveOffsets('金',owner);
case '馬':return moveOffsets('角',owner).concat([[1,0],[0,1],[-1,0],[0,-1]]);
case '竜':return moveOffsets('飛',owner).concat([[1,1],[1,-1],[-1,1],[-1,-1]]);
}
return [];}
function generateMoves(owner){let moves=[];
for(let y=0;y<9;y++)for(let x=0;x<9;x++){const c=board[y][x];if(!c||c.owner!==owner)continue;
 const offs=moveOffsets(c.piece,owner);offs.forEach(o=>{for(let i=1;i<=(o[2]||1);i++){
  const nx=x+o[0]*i,ny=y+o[1]*i;if(!inside(nx,ny))break;const t=board[ny][nx];
  if(t&&t.owner===owner)break;moves.push({from:[x,y],to:[nx,ny],capture:t});
  if(t)break;});});}
 for(const p of pieces.slice(0,7))if(hands[owner][p]){
  for(let x=0;x<9;x++)for(let y=0;y<9;y++)if(!board[y][x]){
   if(p==='歩'){
    if(board.some(r=>r[x]&&r[x].owner===owner&&r[x].piece==='歩'))continue;
    if((owner==='P'&&y===0)||(owner==='E'&&y===8))continue;
   }
   moves.push({drop:p,to:[x,y]});
  }}
 return moves.filter(m=>legalMove(m,owner));}
function legalMove(m,owner){const s=cloneBoard(),h=JSON.parse(JSON.stringify(hands));applyMove(m,false);const ok=!inCheck(owner);restoreBoard(s);hands=h;turn=owner;return ok;}
function applyMove(m,pushHist=true){const from=m.from;let moved;
 if(from){moved=board[from[1]][from[0]];board[from[1]][from[0]]=null;}
 if(m.drop){board[m.to[1]][m.to[0]]={piece:m.drop,owner:turn};removeHand(turn,m.drop);}
 else{const cap=board[m.to[1]][m.to[0]];if(cap)addHand(turn,unpromote(cap.piece));board[m.to[1]][m.to[0]]=moved;}
 if(needPromote(m)){if(confirm('成りますか?'))board[m.to[1]][m.to[0]].piece=promote(board[m.to[1]][m.to[0]].piece);}
 if(pushHist)history.push({b:cloneBoard(),h:JSON.parse(JSON.stringify(hands)),t:turn});
 turn=turn==='P'?'E':'P';}
function unpromote(p){return {竜:'飛',馬:'角',全:'銀',圭:'桂',杏:'香',と:'歩'}[p]||p;}
function promote(p){return {飛:'竜',角:'馬',銀:'全',桂:'圭',香:'杏',歩:'と'}[p]||p;}
function needPromote(m){if(!m.from)return false;const p=board[m.to[1]][m.to[0]].piece;
 if(!['歩','香','桂','銀','角','飛'].includes(p))return false;
 const s=turn==='P';const ty=m.to[1],fy=m.from[1];
 const zone=s?[2,2,2]:[6,6,6];
 return s?fy<=2||ty<=2:fy>=6||ty>=6;}
function inCheck(owner){const enemy=owner==='P'?'E':'P';const kingPos=findKing(owner);if(!kingPos)return false;return generateMoves(enemy).some(m=>m.to[0]===kingPos[0]&&m.to[1]===kingPos[1]);}
function findKing(owner){for(let y=0;y<9;y++)for(let x=0;x<9;x++){const c=board[y][x];if(c&&c.owner===owner&&c.piece==='王')return [x,y];}return null;}
function evaluate(){let v=0;for(let y=0;y<9;y++)for(let x=0;x<9;x++){const c=board[y][x];if(c){let val=pieceValue[c.piece]||0;if(c.owner==='P')v+=val;else v-=val;
 if(c.owner==='P'&&y<=2)v+=20;if(c.owner==='E'&&y>=6)v-=20;if(c.owner==='E'&&y<=2)v-=20;if(c.owner==='P'&&y>=6)v+=20;}}
 for(const o of['P','E'])for(const p in hands[o]){const val=(pieceValue[p]||0)*hands[o][p];v+=(o==='P'?val:-val);}return v;}
function minimax(depth,alpha,beta,maximizing){if(depth===0)return {score:evaluate()};const owner=maximizing?'E':'P';
 const moves=generateMoves(owner);let best={score:maximizing?-Infinity:Infinity};for(const m of moves){const s=cloneBoard(),h=JSON.parse(JSON.stringify(hands)),t=turn;turn=owner;applyMove(m,false);const r=minimax(depth-1,alpha,beta,!maximizing);restoreBoard(s);hands=h;turn=t;if(maximizing){if(r.score>best.score){best={score:r.score,move:m};}alpha=Math.max(alpha,r.score);if(beta<=alpha)break;}else{if(r.score<best.score){best={score:r.score,move:m};}beta=Math.min(beta,r.score);if(beta<=alpha)break;}}
 if(depth===searchDepth)return best;return {score:best.score};}
function makeAIMove(){const res=minimax(searchDepth,-Infinity,Infinity,true);if(res.move)applyMove(res.move);render();if(inCheck('P'))message('王手!');if(generateMoves('P').length===0)message('詰み!');}
function message(t){document.getElementById('message').textContent=t;setTimeout(()=>{document.getElementById('message').textContent='';},2000);}
function render(){const b=document.getElementById('board');b.innerHTML='';for(let y=0;y<9;y++)for(let x=0;x<9;x++){const c=document.createElement('div');c.className='cell '+((x+y)%2?'even':'odd');c.dataset.x=x;c.dataset.y=y;const p=board[y][x];if(p)c.textContent=p.piece;c.draggable=!!p;c.addEventListener('dragstart',dragStart);c.addEventListener('dragover',dragOver);c.addEventListener('drop',drop);b.appendChild(c);}renderHands();document.getElementById('turnText').textContent=turn==='P'?'先手':'後手';}
function renderHands(){const hp=document.getElementById('handP');const he=document.getElementById('handE');hp.innerHTML='';he.innerHTML='';for(const p of pieces.slice(0,7)){if(hands.P[p]){const s=document.createElement('span');s.textContent=p+hands.P[p];s.draggable=true;s.dataset.p=p;s.addEventListener('dragstart',handDrag);hp.appendChild(s);}if(hands.E[p]){const s=document.createElement('span');s.textContent=p+hands.E[p];s.draggable=true;s.dataset.p=p;s.addEventListener('dragstart',handDrag);he.appendChild(s);}}
}
let dragData=null;
function dragStart(e){const x=e.target.dataset.x,y=e.target.dataset.y;if(x===undefined)return;dragData={from:[+x,+y]};highlight(generateMoves(turn).filter(m=>m.from&&m.from[0]==x&&m.from[1]==y).map(m=>m.to));}
function handDrag(e){dragData={drop:e.target.dataset.p};highlight(generateMoves(turn).filter(m=>m.drop===e.target.dataset.p).map(m=>m.to));}
function dragOver(e){e.preventDefault();}
function drop(e){e.preventDefault();const x=+e.target.dataset.x,y=+e.target.dataset.y;if(dragData){const moves=generateMoves(turn).filter(m=>{
 if(dragData.from) return m.from&&m.from[0]==dragData.from[0]&&m.from[1]==dragData.from[1]&&m.to[0]==x&&m.to[1]==y;
 else return m.drop===dragData.drop&&m.to[0]==x&&m.to[1]==y;});if(moves.length){applyMove(moves[0]);render();if(turn==='E')makeAIMove();}dragData=null;clearHighlight();}}
function highlight(cells){document.querySelectorAll('.cell').forEach(e=>{const x=+e.dataset.x,y=+e.dataset.y;if(cells.some(t=>t[0]==x&&t[1]==y))e.classList.add('highlight');});}
function clearHighlight(){document.querySelectorAll('.cell').forEach(e=>e.classList.remove('highlight'));}
document.getElementById('undoBtn').onclick=()=>{const h=history.pop();if(h){restoreBoard(h.b);hands=h.h;turn=h.t;render();}};
document.getElementById('depthSelect').onchange=e=>{searchDepth=+e.target.value;};
window.onload=()=>{initBoard();};
