const pieceValue = {"王":10000,"飛":900,"角":850,"金":600,"銀":550,"桂":350,"香":300,"歩":100,
                    "竜":950,"馬":900,"全":600,"圭":400,"杏":450,"と":150};
const pieceMap = {
  'P':'歩','L':'香','N':'桂','S':'銀','G':'金','B':'角','R':'飛','K':'王',
  '+P':'と','+L':'杏','+N':'圭','+S':'全','+B':'馬','+R':'竜'
};
let board = [], hands=[{},{}], turn=0, history=[], searchDepth=3;
function cloneState(){return {board:board.map(r=>r.map(c=>c?{...c}:null)),hands:[{...hands[0]},{...hands[1]}],turn};}
function restoreState(s){board=s.board.map(r=>r.map(c=>c?{...c}:null));hands=[{...s.hands[0]},{...s.hands[1]}];turn=s.turn;}
function initBoard(){board=[];for(let r=0;r<9;r++){board[r]=Array(9).fill(null);}hands=[{},{ }];turn=0;
  const set=(r,c,t,o)=>board[r][c]={type:t,owner:o};
  // initial pieces
  ['L','N','S','G','K','G','S','N','L'].forEach((p,i)=>{set(0,i,p,1);set(8,8-i,p,0);});
  set(1,1,'B',1);set(7,7,'B',0);set(1,7,'R',1);set(7,1,'R',0);
  for(let i=0;i<9;i++){set(2,i,'P',1);set(6,8-i,'P',0);}render();updateTurn();}
function render(){const b=document.getElementById('board');b.innerHTML='';for(let r=0;r<9;r++)for(let c=0;c<9;c++){const sq=document.createElement('div');sq.dataset.row=r;sq.dataset.col=c;sq.className='square';const p=board[r][c];
  if(p){const el=document.createElement('div');el.textContent=pieceMap[p.type];el.className='piece';el.draggable=true;el.dataset.owner=p.owner;el.dataset.type=p.type;el.addEventListener('dragstart',onDragStart);sq.appendChild(el);}sq.addEventListener('dragover',e=>e.preventDefault());sq.addEventListener('drop',onDrop);b.appendChild(sq);}renderHands();}
function renderHands(){[0,1].forEach(o=>{const h=document.getElementById('hand'+o);h.innerHTML=(o==0?'持ち駒: ':'AI 持ち駒: ');for(let t of ['P','L','N','S','G','B','R']){const n=hands[o][t]||0;if(n>0){const el=document.createElement('span');el.textContent=pieceMap[t]+'x'+n;el.className='piece';el.draggable=true;el.dataset.owner=o;el.dataset.fromhand=t;el.addEventListener('dragstart',onDragStart);h.appendChild(el);}}});}
function onDragStart(e){const o=+e.target.dataset.owner;if(o!==turn)return e.preventDefault();const r=e.target.parentElement.dataset.row;const c=e.target.parentElement.dataset.col;e.dataTransfer.setData('text/plain',JSON.stringify({from:{row:r, col:c},type:e.target.dataset.type,fromhand:e.target.dataset.fromhand}));
  highlightMoves(e.dataTransfer.getData('text/plain'));}
function highlightMoves(data){clearHighlight();const d=JSON.parse(data);let moves=[];if(d.fromhand){moves=generateDrops(turn,d.fromhand);}else{moves=generateMovesFrom(d.from.row,d.from.col);}moves.forEach(m=>{const sq=document.querySelector(`.square[data-row='${m.to.row}'][data-col='${m.to.col}']`);if(sq)sq.classList.add('highlight');});}
function clearHighlight(){document.querySelectorAll('.square.highlight').forEach(s=>s.classList.remove('highlight'));}
function onDrop(e){e.preventDefault();clearHighlight();const data=e.dataTransfer.getData('text');if(!data)return;const d=JSON.parse(data);const to={row:+e.currentTarget.dataset.row,col:+e.currentTarget.dataset.col};if(d.fromhand){if(applyMove({from:null,to,drop:d.fromhand,owner:turn}))afterMove();}else{const from={row:+d.from.row,col:+d.from.col};if(applyMove({from,to,owner:turn}))afterMove();}}
function afterMove(){history.push(cloneState());render();if(checkGameEnd()){return;}turn=1-turn;updateTurn();if(turn===1)makeAIMove();}
function updateTurn(){document.getElementById('turnLabel').textContent=turn===0?'あなたの手番':'AIの手番';}
function applyMove(m){let piece;if(m.drop){if(!(hands[m.owner][m.drop]>0))return false;piece={type:m.drop,owner:m.owner};board[m.to.row][m.to.col]=piece;hands[m.owner][m.drop]--;if(needsPromote(piece,m.to.row,m.owner)&&confirm('成りますか？'))piece.type=promote(piece.type);}else{piece=board[m.from.row][m.from.col];if(!piece||piece.owner!==m.owner)return false;const dest=board[m.to.row][m.to.col];if(dest){capturePiece(m.owner,dest);}board[m.from.row][m.from.col]=null;piece.type=maybePromote(piece,m,m.owner);board[m.to.row][m.to.col]=piece;}return true;}
function capturePiece(o,p){const base=unpromote(p.type);hands[o][base]=(hands[o][base]||0)+1;}
function maybePromote(piece,m,owner){if(canPromote(piece.type)&& (needsPromote(piece,m.to.row,owner)||needsPromote(piece,m.from.row,owner))){if(owner===0){if(confirm('成りますか？'))return promote(piece.type);}else{return promote(piece.type);} }return piece.type;}
function needsPromote(piece,row,owner){if(owner===0)return row<3;else return row>5;}
function canPromote(t){return ['P','L','N','S','B','R'].includes(unpromote(t));}
function promote(t){return {'P':'+P','L':'+L','N':'+N','S':'+S','B':'+B','R':'+R'}[t]||t;}
function unpromote(t){return { '+P':'P','+L':'L','+N':'N','+S':'S','+B':'B','+R':'R'}[t]||t;}
function generateMovesFrom(r,c){const p=board[r][c];if(!p||p.owner!==turn)return[];return generatePieceMoves(p,r,c);}
function generatePieceMoves(p,r,c){let moves=[];const dirs=getDirections(p.type,p.owner);for(let d of dirs){let nr=r+d.dr,nc=c+d.dc;if(d.jump){if(isInside(nr,nc)){if(!board[nr][nc]||board[nr][nc].owner!==p.owner)moves.push({from:{row:r,col:c},to:{row:nr,col:nc}});}continue;}while(isInside(nr,nc)){if(!board[nr][nc]){moves.push({from:{row:r,col:c},to:{row:nr,col:nc}});}else{if(board[nr][nc].owner!==p.owner)moves.push({from:{row:r,col:c},to:{row:nr,col:nc}});break;}nr+=d.dr;nc+=d.dc;}}return moves;}
function isInside(r,c){return r>=0&&r<9&&c>=0&&c<9;}
function getDirections(t,o){const f=o===0?-1:1;const dirs={
 'P':[{dr:f,dc:0,jump:true}],
 'L':[{dr:f,dc:0}],
 'N':[{dr:2*f,dc:-1,jump:true},{dr:2*f,dc:1,jump:true}],
 'S':[{dr:f,dc:-1,jump:true},{dr:f,dc:0,jump:true},{dr:f,dc:1,jump:true},{dr:-f,dc:-1,jump:true},{dr:-f,dc:1,jump:true}],
 'G':[{dr:f,dc:-1,jump:true},{dr:f,dc:0,jump:true},{dr:f,dc:1,jump:true},{dr:0,dc:-1,jump:true},{dr:0,dc:1,jump:true},{dr:-f,dc:0,jump:true}],
 'K':[{dr:1,dc:0,jump:true},{dr:-1,dc:0,jump:true},{dr:0,dc:1,jump:true},{dr:0,dc:-1,jump:true},{dr:1,dc:1,jump:true},{dr:1,dc:-1,jump:true},{dr:-1,dc:1,jump:true},{dr:-1,dc:-1,jump:true}],
 'B':[{dr:1,dc:1},{dr:1,dc:-1},{dr:-1,dc:1},{dr:-1,dc:-1}],
 'R':[{dr:1,dc:0},{dr:-1,dc:0},{dr:0,dc:1},{dr:0,dc:-1}],
 '+P':[],'+L':[],'+N':[],'+S':[]
};dirs['+P']=dirs['+L']=dirs['+N']=dirs['+S']=dirs['G'];
 dirs['+B']=dirs['B'].concat([{dr:1,dc:0,jump:true},{dr:-1,dc:0,jump:true},{dr:0,dc:1,jump:true},{dr:0,dc:-1,jump:true}]);
 dirs['+R']=dirs['R'].concat([{dr:1,dc:1,jump:true},{dr:1,dc:-1,jump:true},{dr:-1,dc:1,jump:true},{dr:-1,dc:-1,jump:true}]);
 return dirs[t]||[];}
function generateDrops(o,t){let moves=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(!board[r][c]){if(t==='P'&&nifu(o,c))continue;if(!dropValid(t,o,r))continue;moves.push({from:null,to:{row:r,col:c},drop:t});}return moves;}
function nifu(o,c){for(let r=0;r<9;r++){const p=board[r][c];if(p&&p.owner===o&&p.type==='P')return true;}return false;}
function dropValid(t,o,r){if(t==='P'||t==='L')return o===0?r>0:r<8; if(t==='N')return o===0?r>1:r<7; return true;}
function generateAllMoves(o){let all=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=board[r][c];if(p&&p.owner===o)all=all.concat(generatePieceMoves(p,r,c));}
 for(let t of Object.keys(hands[o]))if(hands[o][t]>0)all=all.concat(generateDrops(o,t));return all;}
function evaluateBoard(){let score=0;for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=board[r][c];if(p){let v=pieceValue[pieceMap[p.type]]||0;if(p.owner===1)score+=v;else score-=v;if(isEnemyCamp(r,1))score+=p.owner===1?20:-20;} }for(let o=0;o<2;o++)for(let t in hands[o]){const v=pieceValue[pieceMap[t]]||0;if(o===1)score+=v*hands[o][t];else score-=v*hands[o][t];}return score;}
function isEnemyCamp(r,o){return o===0?r<3:r>5;}
function minimax(d,a,b,max){if(d===0)return evaluateBoard();const moves=generateAllMoves(max?1:0);if(max){let best=-Infinity;for(let m of moves){const st=cloneState();if(applyMove({...m,owner:1})){turn=0;const val=minimax(d-1,a,b,false);restoreState(st);if(val>best)best=val;if(best>a)a=best;if(a>=b)break;}}return best;}else{let best=Infinity;for(let m of moves){const st=cloneState();if(applyMove({...m,owner:0})){turn=1;const val=minimax(d-1,a,b,true);restoreState(st);if(val<best)best=val;if(best<b)b=best;if(a>=b)break;}}return best;}}
function makeAIMove(){searchDepth=parseInt(document.getElementById('depthSelect').value,10);const moves=generateAllMoves(1);let best=-Infinity,bests=[];for(let m of moves){const st=cloneState();if(applyMove({...m,owner:1})){turn=0;const val=minimax(searchDepth-1,-Infinity,Infinity,false);restoreState(st);if(val>best){best=val;bests=[m];}else if(val===best){bests.push(m);} }}const m=bests[Math.floor(Math.random()*bests.length)];applyMove({...m,owner:1});history.push(cloneState());render();if(checkGameEnd())return;turn=0;updateTurn();}
function checkGameEnd(){if(isKingCaptured(0)){alert('あなたの負け');initBoard();return true;}if(isKingCaptured(1)){alert('あなたの勝ち');initBoard();return true;}return false;}
function isKingCaptured(o){for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=board[r][c];if(p&&p.owner===o&&unpromote(p.type)==='K')return false;}return true;}
document.getElementById('undoBtn').addEventListener('click',()=>{if(history.length>1){history.pop();restoreState(history[history.length-1]);render();turn=1-turn;updateTurn();}});
window.addEventListener('load',()=>{initBoard();history=[cloneState()];});
