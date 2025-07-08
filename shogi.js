const PIECE_NAMES={P:'\u6b69',L:'\u9999',N:'\u6842',S:'\u9280',G:'\u91d1',B:'\u89d2',R:'\u98db',K:'\u7389','+P':'\u3068','+L':'\u6210\u9999','+N':'\u6210\u6842','+S':'\u6210\u9280','+B':'\u99ac','+R':'\u7adc'};
const START_BOARD=[
 ['l','n','s','g','k','g','s','n','l'],
 [null,'r',null,null,null,null,null,'b',null],
 ['p','p','p','p','p','p','p','p','p'],
 [null,null,null,null,null,null,null,null,null],
 [null,null,null,null,null,null,null,null,null],
 [null,null,null,null,null,null,null,null,null],
 ['P','P','P','P','P','P','P','P','P'],
 [null,'B',null,null,null,null,null,'R',null],
 ['L','N','S','G','K','G','S','N','L']
];
let board, hands, turn, dragging=null, dragElem=null, fromHand=null, legalMoves=[], pendingPromote=null, history=[];
const worker=new Worker('aiWorker.js');
worker.onmessage=e=>{ if(e.data){ applyMove(e.data); update(); }};
function init(){
 board=JSON.parse(JSON.stringify(START_BOARD));
 hands={black:{},white:{}}; for(let p of ['P','L','N','S','G','B','R']){hands.black[p]=0;hands.white[p]=0;}
 turn='black';
 drawBoard(); update();
}
function drawBoard(){
 const b=document.getElementById('board'); b.innerHTML='';
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){const c=document.createElement('div');c.className='cell';c.dataset.x=x;c.dataset.y=y;b.appendChild(c);}
 b.addEventListener('pointerdown',startDrag);
 document.addEventListener('pointermove',moveDrag);
 document.addEventListener('pointerup',endDrag);
 document.getElementById('undo').onclick=undo;
 document.getElementById('promYes').onclick=()=>finishMove(true);
 document.getElementById('promNo').onclick=()=>finishMove(false);
}
function pieceColor(p){return p&&p===p.toUpperCase()?'black':'white';}
function pieceType(p){return p&&p.replace('+','').toUpperCase();}
function isPromoted(p){return p&&p.startsWith('+');}
function inZone(y,color){return color==='black'?y<=2:y>=6;}
function update(){
 const cells=document.querySelectorAll('.cell');
 cells.forEach(c=>{c.innerHTML=''; c.classList.remove('highlight');});
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=board[y][x]; if(p){const d=document.createElement('div');d.className='piece';if(pieceColor(p)==='white')d.classList.add('white');d.textContent=PIECE_NAMES[p];cells[y*9+x].appendChild(d);} }
 const bh=document.getElementById('blackHand');const wh=document.getElementById('whiteHand');bh.innerHTML='';wh.innerHTML='';
 for(let p of ['P','L','N','S','G','B','R']){if(hands.black[p]){const d=document.createElement('div');d.className='handPiece';d.dataset.p=p;d.dataset.c='black';d.textContent=PIECE_NAMES[p]+hands.black[p];bh.appendChild(d);} if(hands.white[p]){const d=document.createElement('div');d.className='handPiece';d.dataset.p=p;d.dataset.c='white';d.textContent=PIECE_NAMES[p]+hands.white[p];wh.appendChild(d);} }
 document.getElementById('turn').textContent=turn==='black'?'先手':'後手';
 document.querySelectorAll('.handPiece').forEach(h=>h.onclick=startHandDrag);
}
function startHandDrag(e){fromHand={color:e.target.dataset.c,piece:e.target.dataset.p};dragging={piece:(fromHand.color==='black'?fromHand.piece:fromHand.piece.toLowerCase()),from:null,to:null}; createDragElem(e.target.textContent); legalMoves=generateLegalDrops(fromHand.color,fromHand.piece); highlight();}
function startDrag(e){const cell=e.target.closest('.cell');if(!cell)return;const x=+cell.dataset.x,y=+cell.dataset.y;const p=board[y][x];if(!p||pieceColor(p)!==turn)return;dragging={piece:p,from:{x,y},to:null}; legalMoves=generateMovesForPiece(x,y); highlight(); createDragElem(PIECE_NAMES[p]);}
function createDragElem(txt){
  dragElem=document.createElement('div');
  dragElem.className='piece';
  dragElem.textContent=txt;
  document.body.appendChild(dragElem);
}

function highlight(){
  document.querySelectorAll('.cell').forEach(c=>c.classList.remove('highlight'));
  for(const m of legalMoves){
    const el=document.querySelector(`.cell[data-x='${m.to.x}'][data-y='${m.to.y}']`);
    if(el)el.classList.add('highlight');
  }
}
function moveDrag(e){if(dragging&&dragElem){dragElem.style.position='fixed';dragElem.style.left=e.pageX+'px';dragElem.style.top=e.pageY+'px';}}
function endDrag(e){if(!dragging)return;const cell=e.target.closest('.cell');if(cell){const x=+cell.dataset.x,y=+cell.dataset.y;for(let m of legalMoves){if(m.to.x===x&&m.to.y===y){pendingPromote=m;if(m.prom){showModal();}else{finishMove(false);}break;}}}
 cleanupDrag();}
function cleanupDrag(){if(dragElem){dragElem.remove();dragElem=null;}dragging=null;fromHand=null;legalMoves=[];update();}
function showModal(){document.getElementById('modal').classList.remove('hidden');}
function hideModal(){document.getElementById('modal').classList.add('hidden');}
function finishMove(prom){hideModal();let m=pendingPromote;if(prom)m.promote=true;applyMove(m);update();if(turn==='white'){setTimeout(aiGo,50);} pendingPromote=null;}
function aiGo(){worker.postMessage({type:'go',pos:{board,hands,turn},level:+document.getElementById('level').value});}
function applyMove(m){history.push(JSON.stringify({board,hands,turn}));if(m.drop){hands[turn][m.piece]--;board[m.to.y][m.to.x]=turn==='black'?m.piece:m.piece.toLowerCase();}
 else{const p=board[m.from.y][m.from.x];board[m.from.y][m.from.x]=null;let piece=m.promote?('+'+pieceType(p)):(p.startsWith('+')?p:p.replace('+',''));board[m.to.y][m.to.x]=piece; if(m.capture){hands[turn][pieceType(m.capture)]++;}}
 turn=turn==='black'?'white':'black';}
function undo(){worker.postMessage({type:'stop'});if(history.length<2)return;const state=JSON.parse(history.splice(-2,1)[0]);board=state.board;hands=state.hands;turn=state.turn;update();}
function generateMovesForPiece(x,y){const p=board[y][x];if(!p)return[];const color=pieceColor(p);let moves=[];const dirs={K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],G:[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,-1]],S:[[1,1],[-1,1],[1,-1],[-1,-1],[0,1]],P:[[0,1]],L:[[0,1]],N:[[1,2],[-1,2]],B:[[1,1],[1,-1],[-1,1],[-1,-1]],R:[[1,0],[-1,0],[0,1],[0,-1]]};
 const sign=color==='black'?-1:1;
 const t=pieceType(p);
 const promotable=['P','L','N','S','B','R'].includes(t);
 let arr=[]; if(t in dirs)arr=dirs[t]; else if(t==='+B')arr=dirs.B.concat(dirs.K); else if(t==='+R')arr=dirs.R.concat(dirs.K); else if(['+P','+L','+N','+S'].includes(t))arr=dirs.G;
 for(let d of arr){let nx=x+d[0],ny=y+d[1]*sign; if(t==='L'){while(inBounds(nx,ny)){const dest=board[ny][nx];if(!dest||pieceColor(dest)!==color){moves.push({from:{x,y},to:{x:nx,y:ny},capture:dest,prom:promotable&&(inZone(y,color)||inZone(ny,color))}); if(dest)break;} else break;ny+=d[1]*sign;} }else if(t==='B'||t==='R'){let step=d;let dx=step[0],dy=step[1];let nx=x+dx,ny=y+dy;while(inBounds(nx,ny)){const dest=board[ny][nx];if(!dest||pieceColor(dest)!==color){moves.push({from:{x,y},to:{x:nx,y:ny},capture:dest,prom:promotable&&(inZone(y,color)||inZone(ny,color))}); if(dest)break;} else break;nx+=dx;ny+=dy;} }else if(t==='N'){let nx=x+d[0],ny=y+d[1]*sign;if(inBounds(nx,ny)){const dest=board[ny][nx];if(!dest||pieceColor(dest)!==color){moves.push({from:{x,y},to:{x:nx,y:ny},capture:dest,prom:promotable&&(inZone(y,color)||inZone(ny,color)||ny<0||ny>8)});} } }else{let nx=x+d[0],ny=y+d[1]*sign;if(inBounds(nx,ny)){const dest=board[ny][nx];if(!dest||pieceColor(dest)!==color){moves.push({from:{x,y},to:{x:nx,y:ny},capture:dest,prom:promotable&&(inZone(y,color)||inZone(ny,color))});} } }
 }
 return moves.filter(m=>isLegalMove(m,color));}
function generateLegalDrops(color,piece){let list=[];for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(!board[y][x]){if(piece==='P'){let ok=true;for(let yy=0;yy<9;yy++)if(board[yy][x]===(color==='black'?'P':'p'))ok=false;if((color==='black'&&y===0)||(color==='white'&&y===8))ok=false;if(ok){let m={drop:true,piece,from:null,to:{x,y},promote:false};if(isLegalMove(m,color))list.push(m);}}else{let lastRank=color==='black'?0:8;let ok=true;if(piece==='N'&&(color==='black'?y<=1:y>=7))ok=false;if(piece==='L'&&y===lastRank)ok=false;if(ok){let m={drop:true,piece,from:null,to:{x,y},promote:false};if(isLegalMove(m,color))list.push(m);}}}
 return list;}
function inBounds(x,y){return x>=0&&x<9&&y>=0&&y<9;}
function isLegalMove(m,color){let clone=JSON.parse(JSON.stringify({board,hands,turn}));let b=clone.board;let h=clone.hands; if(m.drop){b[m.to.y][m.to.x]=color==='black'?m.piece:m.piece.toLowerCase();h[color][m.piece]--;}else{let p=b[m.from.y][m.from.x];b[m.from.y][m.from.x]=null;let piece=m.promote?('+'+pieceType(p)):p;b[m.to.y][m.to.x]=piece; if(m.capture){h[color][pieceType(m.capture)]++;}}
 return !isCheck(b,color);}
function isCheck(b,color){let kx,ky;for(let y=0;y<9;y++)for(let x=0;x<9;x++){let p=b[y][x];if(p&&pieceType(p)==='K'&&pieceColor(p)===color){kx=x;ky=y;}}
 return attacks(b,kx,ky,color==='black'?'white':'black');}
function attacks(b,x,y,enemy){let dirs={K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],G:[[1,0],[-1,0],[0,1],[1,-1],[-1,-1],[0,-1]],S:[[1,1],[-1,1],[1,-1],[-1,-1],[0,1]],P:[[0,1]],L:[[0,1]],N:[[1,2],[-1,2]],B:[[1,1],[1,-1],[-1,1],[-1,-1]],R:[[1,0],[-1,0],[0,1],[0,-1]]};
 const sign=enemy==='black'?-1:1;for(let yy=0;yy<9;yy++)for(let xx=0;xx<9;xx++){let p=b[yy][xx];if(!p||pieceColor(p)!==enemy)continue;let t=pieceType(p);if(t==='+B')t='B';if(t==='+R')t='R';if(['+P','+L','+N','+S'].includes(t))t='G';if(t in {'L':1,'B':1,'R':1}){let arr=dirs[t];for(let d of arr){let nx=xx+d[0],ny=yy+d[1]* (t==='L'?sign:1);while(inBounds(nx,ny)){if(nx===x&&ny===y)return true;let dest=b[ny][nx];if(dest)break;nx+=d[0];ny+=d[1]*(t==='L'?sign:1);}} }else if(t==='N'){for(let d of dirs.N){let nx=xx+d[0],ny=yy+d[1]*sign;if(nx===x&&ny===y)return true;}}else{let arr=t==='K'?dirs.K:(t==='G'?dirs.G:(t==='S'?dirs.S:(t==='P'?dirs.P:[])));for(let d of arr){let nx=xx+d[0],ny=yy+d[1]*sign;if(nx===x&&ny===y)return true;}}}
 return false;}
init();
