let stopFlag=false;let bestMove=null;

const values={p:100,l:300,n:300,s:400,g:500,b:850,r:900,k:10000};

onmessage=e=>{
 if(e.data.type==='go'){
  stopFlag=false;
  const state=parseSFEN(e.data.fen);
  iterativeDeepening(state,e.data.ms||10000);
 }else if(e.data.type==='stop'){stopFlag=true;}
};

function iterativeDeepening(state,limitMs){
 const start=Date.now();
 for(let depth=1;;depth++){
  bestMove=searchRoot(state,depth,-1e9,1e9);
  if(Date.now()-start>limitMs||stopFlag)break;
 }
 postMessage({type:'bestmove',move:bestMove});
}

function searchRoot(state,depth,alpha,beta){
 let moves=genAll(state);
 let best=null;let bestScore=-1e9;
 for(const m of moves){
  const undo=apply(state,m);
  const score=-search(state,depth-1,-beta,-alpha);
  undoMove(state,undo);
  if(score>bestScore){bestScore=score;best=m;alpha=Math.max(alpha,score);} 
  if(alpha>=beta||stopFlag)break;
 }
 return best;
}

function search(state,depth,alpha,beta){
 if(stopFlag)return 0;
 if(depth===0)return evaluate(state);
 let moves=genAll(state);
 if(moves.length===0)return -10000-depth;
 for(const m of moves){
  const undo=apply(state,m);
  const score=-search(state,depth-1,-beta,-alpha);
  undoMove(state,undo);
  if(score>alpha){alpha=score;} 
  if(alpha>=beta)break;
 }
 return alpha;
}

function evaluate(state){
 let score=0;
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){
  const p=state.board[y][x];
  if(p){const v=values[p.type.toLowerCase()];score+=(p.owner==='ai'?-v:v);}
 }
 Object.entries(state.hands.player).forEach(([t,c])=>{score+=values[t.toLowerCase()]*c;});
 Object.entries(state.hands.ai).forEach(([t,c])=>{score-=values[t.toLowerCase()]*c;});
 return score;
}

function genAll(state){
 const moves=[];const own=state.turn;
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){
  const p=state.board[y][x];
  if(p&&p.owner===own)moves.push(...generateMoves(state,x,y,p));
 }
 Object.keys(state.hands[own]).forEach(t=>{moves.push(...generateDrops(state,t));});
 return moves;
}

function generateMoves(state,x,y,p){
 const dir=p.owner==='player'?-1:1;
 const result=[];const t=p.type;
 const patterns={
  '歩':[[0,dir]],'香':Array.from({length:8},(_,i)=>[0,dir*(i+1)]),
  '桂':[[1,2*dir],[-1,2*dir]],
  '銀':[[0,dir],[1,dir],[-1,dir],[1,-dir],[-1,-dir]],
  '金':[[0,dir],[1,dir],[-1,dir],[0,-dir],[1,0],[-1,0]],
  '王':[[0,1],[1,1],[-1,1],[0,-1],[1,0],[-1,0],[1,-1],[-1,-1]],
  '角':[[1,1],[-1,1],[1,-1],[-1,-1]],
  '飛':[[0,1],[1,0],[-1,0],[0,-1]],
  '馬':[[1,1],[-1,1],[1,-1],[-1,-1],[0,1],[1,0],[-1,0],[0,-1]],
  '竜':[[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]],
  'と':[[0,dir],[1,0],[-1,0],[0,-dir],[1,dir],[-1,dir]],
  '杏':[[0,dir],[0,-dir],[1,0],[-1,0],[1,dir],[-1,dir]],
  '圭':[[0,dir],[0,-dir],[1,0],[-1,0],[1,dir],[-1,dir]],
  '全':[[0,dir],[0,-dir],[1,0],[-1,0],[1,dir],[-1,dir]]
 };
 const longRange=['香','角','飛','馬','竜'];
 for(const d of patterns[t]){
  let nx=x+d[0],ny=y+d[1];
  while(nx>=0&&nx<9&&ny>=0&&ny<9){
   const target=state.board[ny][nx];
   if(target&&target.owner===p.owner)break;
   result.push({sx:x,sy:y,x:nx,y:ny,promote:shouldPromote(p,ny)});
   if(target)break;
   if(!longRange.includes(t))break;
   nx+=d[0];ny+=d[1];
  }
 }
 return result;
}

function generateDrops(state,type){
 const res=[];
 for(let y=0;y<9;y++)for(let x=0;x<9;x++){
  if(!state.board[y][x])res.push({drop:type,x,y});
 }
 return res;
}

function shouldPromote(p,ny){
 const zone=p.owner==='player'?ny<=2:ny>=6;
 return zone&&['歩','香','桂','銀','角','飛'].includes(p.type);
}

function apply(state,m){
 const undo={};
 if(m.drop){undo.drop=true;state.hands[state.turn][m.drop]--;state.board[m.y][m.x]={type:m.drop,owner:state.turn};}
 else {
  undo.src={x:m.sx,y:m.sy,p:state.board[m.sy][m.sx]};
  undo.dst={x:m.x,y:m.y,p:state.board[m.y][m.x]};
  state.board[m.sy][m.sx]=null;
  state.board[m.y][m.x]=undo.src.p;
  if(m.promote)undo.src.p.type=promotePiece(undo.src.p.type);
  if(undo.dst.p){state.hands[state.turn][demote(undo.dst.p.type)]=(state.hands[state.turn][demote(undo.dst.p.type)]||0)+1;}
 }
 state.turn=state.turn==='player'?'ai':'player';
 return undo;
}

function undoMove(state,u){
 state.turn=state.turn==='player'?'ai':'player';
 if(u.drop){state.hands[state.turn][u.drop]=(state.hands[state.turn][u.drop]||0)+1;state.board[u.y][u.x]=null;}
 else {
  state.board[u.src.y][u.src.x]=u.src.p;
  state.board[u.dst.y][u.dst.x]=u.dst.p;
  if(u.dst.p){state.hands[state.turn][demote(u.dst.p.type)]--;}
 }
}

function parseSFEN(fen){
 const [boardPart,turnPart,handPart]=fen.split(' ');
 const board=Array.from({length:9},()=>Array(9).fill(null));
 const rows=boardPart.split('/');
 rows.forEach((row,y)=>{
  let x=0;
  for(let i=0;i<row.length;i++){
   const ch=row[i];
   if(/\d/.test(ch)){x+=parseInt(ch,10);}else{
    let promote=false;let piece=ch;
    if(ch==='+'&&(i+1<row.length)){promote=true;piece=row[++i];}
    const owner=piece===piece.toUpperCase()?'player':'ai';
    const type=revPieceCode((promote?'+':'')+piece.toLowerCase());
    board[y][x]={type,owner};x++;}
  }
 });
 const hands={player:{},ai:{}};
 if(handPart!=='-'){
  handPart.match(/\w\d+/g).forEach(s=>{const piece=s[0];const n=parseInt(s.slice(1));const owner=piece===piece.toUpperCase()?'player':'ai';const t=revPieceCode(piece.toLowerCase());hands[owner][t]=n;});
 }
 return {board,hands,turn:turnPart==='b'?'player':'ai'};
}

function revPieceCode(c){return {p:'歩',l:'香',n:'桂',s:'銀',g:'金',b:'角',r:'飛',k:'王','+p':'と','+l':'杏','+n':'圭','+s':'全','+b':'馬','+r':'竜'}[c];}

function promotePiece(t){return {'歩':'と','香':'杏','桂':'圭','銀':'全','角':'馬','飛':'竜'}[t]||t;}
function demote(t){return {'と':'歩','杏':'香','圭':'桂','全':'銀','馬':'角','竜':'飛'}[t]||t;}
