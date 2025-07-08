let stop=false;
let bestMove='';

onmessage=e=>{
  if(e.data.type==='go'){
    stop=false;
    const state=fromSFEN(e.data.fen);
    const end=Date.now()+e.data.ms;
    let depth=1;
    while(!stop && Date.now()<end){
      search(state,depth,-1e9,1e9,true);
      depth++;
    }
    postMessage({type:'bestmove',move:bestMove});
  }else if(e.data.type==='stop'){
    stop=true;
    postMessage({type:'bestmove',move:bestMove});
  }
};

function fromSFEN(fen){
  const [boardStr,turnStr,handStr]=fen.split(' ');
  const rows=boardStr.split('/');
  const board=[];
  for(let y=0;y<9;y++){
    board[y]=[];let x=0;
    for(let i=0;i<rows[y].length;i++){
      const ch=rows[y][i];
      if(!isNaN(ch)){for(let j=0;j<+ch;j++) board[y][x++]=null;continue;}
      const owner=ch>='a'?'ai':'player';
      const piece=letterToPiece(ch.toUpperCase());
      board[y][x++]={type:piece,owner};
    }
  }
  const hands={player:{},ai:{}};
  if(handStr && handStr!=='-'){
    for(let i=0;i<handStr.length;i++){
      const ch=handStr[i];
      const owner=ch>='a'?'ai':'player';
      const piece=letterToPiece(ch.toUpperCase());
      hands[owner][piece]=(hands[owner][piece]||0)+1;
    }
  }
  return {board,turn:turnStr==='b'?'player':'ai',hands};
}

function letterToPiece(ch){
  switch(ch){
    case 'P':return '歩';case 'L':return '香';case 'N':return '桂';case 'S':return '銀';
    case 'G':return '金';case 'B':return '角';case 'R':return '飛';case 'K':return '王';
    default:return '歩';
  }
}

function clone(state){
  return {board:state.board.map(r=>r.map(p=>p?{...p}:null)),turn:state.turn,hands:JSON.parse(JSON.stringify(state.hands))};
}

const values={歩:100,香:300,桂:300,銀:400,金:500,角:850,飛:900,王:10000,
 と:100,杏:300,圭:300,全:400,馬:850,竜:900};

function evaluate(state){
  let score=0;
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=state.board[y][x];
    if(p) score+=(p.owner==='player'?1:-1)*values[p.type];
  }
  for(const pl of ['player','ai']){
    for(const [t,c] of Object.entries(state.hands[pl]))
      score+=(pl==='player'?1:-1)*values[t]*c;
  }
  return score;
}

function generateMoves(state){
  const moves=[];
  for(let y=0;y<9;y++) for(let x=0;x<9;x++){
    const p=state.board[y][x];
    if(p && p.owner===state.turn){
      moves.push(...generatePieceMoves(state,p,x,y));
    }
  }
  for(const [t,c] of Object.entries(state.hands[state.turn])){
    for(let y=0;y<9;y++) for(let x=0;x<9;x++){
      if(isLegalDrop(state,t,x,y)) moves.push({drop:t,x,y});
    }
  }
  return moves;
}

function search(state,depth,alpha,beta,root){
  if(stop) return 0;
  if(depth===0) return quiesce(state,alpha,beta);
  const moves=generateMoves(state);
  if(moves.length===0) return state.turn==='player'? -1e8:1e8;
  let best=-1e9;
  for(const m of moves){
    const s=applyMove(state,m);
    const score=-search(s,depth-1,-beta,-alpha,false);
    if(score>best){best=score;if(root) bestMove=formatMove(m);}
    alpha=Math.max(alpha,score);
    if(alpha>=beta) break;
  }
  return best;
}

function quiesce(state,alpha,beta){
  let stand=evaluate(state);
  if(stand>=beta) return beta;
  if(alpha<stand) alpha=stand;
  const moves=generateMoves(state).filter(m=>m.capture);
  for(const m of moves){
    const s=applyMove(state,m);
    const score=-quiesce(s,-beta,-alpha);
    if(score>alpha){alpha=score;if(alpha>=beta) break;}
  }
  return alpha;
}

function applyMove(state,m){
  const s=clone(state);
  if(m.drop){
    s.board[m.y][m.x]={type:m.drop,owner:state.turn};
    s.hands[state.turn][m.drop]--; if(!s.hands[state.turn][m.drop]) delete s.hands[state.turn][m.drop];
  }else{
    const piece=s.board[m.fromY][m.fromX];
    s.board[m.fromY][m.fromX]=null;
    const tgt=s.board[m.toY][m.toX];
    if(tgt){const base=unpromote(tgt.type);s.hands[state.turn][base]=(s.hands[state.turn][base]||0)+1;}
    s.board[m.toY][m.toX]={type:m.promote?promote(piece.type):piece.type,owner:state.turn};
  }
  s.turn=state.turn==='player'?'ai':'player';
  return s;
}

function generatePieceMoves(state,piece,x,y){
  const dir=piece.owner==='player'?-1:1;
  const res=[];
  const add=(nx,ny)=>{if(nx<0||nx>8||ny<0||ny>8) return;const t=state.board[ny][nx];if(t&&t.owner===piece.owner) return;res.push({fromX:x,fromY:y,toX:nx,toY:ny,capture:!!t});};
  switch(piece.type){
    case '歩':add(x,y+dir);break;
    case '香':for(let ny=y+dir;ny>=0&&ny<9;ny+=dir){let t=state.board[ny][x];add(x,ny);if(t) break;}break;
    case '桂':add(x-1,y+2*dir);add(x+1,y+2*dir);break;
    case '銀':add(x-1,y+dir);add(x,y+dir);add(x+1,y+dir);add(x-1,y-dir);add(x+1,y-dir);break;
    case '金':case 'と':case '杏':case '圭':case '全':
      add(x-1,y);add(x+1,y);add(x,y+dir);add(x,y-dir);add(x-1,y+dir);add(x+1,y+dir);break;
    case '角':for(let dx of [-1,1]) for(let dy of [-1,1]){let nx=x+dx,ny=y+dy;while(nx>=0&&nx<9&&ny>=0&&ny<9){let t=state.board[ny][nx];add(nx,ny);if(t) break;nx+=dx;ny+=dy;}}break;
    case '飛':for(let d of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+d[0],ny=y+d[1];while(nx>=0&&nx<9&&ny>=0&&ny<9){let t=state.board[ny][nx];add(nx,ny);if(t) break;nx+=d[0];ny+=d[1];}}break;
    case '王':add(x-1,y);add(x+1,y);add(x,y+1);add(x,y-1);add(x-1,y+1);add(x+1,y+1);add(x-1,y-1);add(x+1,y-1);break;
    case '馬':for(let dx of [-1,1]) for(let dy of [-1,1]){let nx=x+dx,ny=y+dy;while(nx>=0&&nx<9&&ny>=0&&ny<9){let t=state.board[ny][nx];add(nx,ny);if(t) break;nx+=dx;ny+=dy;}}add(x+1,y);add(x-1,y);add(x,y+1);add(x,y-1);break;
    case '竜':for(let d of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+d[0],ny=y+d[1];while(nx>=0&&nx<9&&ny>=0&&ny<9){let t=state.board[ny][nx];add(nx,ny);if(t) break;nx+=d[0];ny+=d[1];}}add(x-1,y-1);add(x+1,y-1);add(x-1,y+1);add(x+1,y+1);break;
  }
  return res;
}

function isLegalDrop(state,type,x,y){
  if(state.board[y][x]) return false;
  return true;
}

function promote(t){return {歩:'と',香:'杏',桂:'圭',銀:'全',角:'馬',飛:'竜'}[t]||t;}
function unpromote(t){return {と:'歩',杏:'香',圭:'桂',全:'銀',馬:'角',竜:'飛'}[t]||t;}

function formatMove(m){
  if(m.drop){
    return pieceToLetter(m.drop)+'*'+(9-m.x)+(String.fromCharCode(97+m.y));
  }
  const from=(9-m.fromX)+String.fromCharCode(97+m.fromY);
  const to=(9-m.toX)+String.fromCharCode(97+m.toY);
  return from+to;
}

function pieceToLetter(t){return {歩:'P',香:'L',桂:'N',銀:'S',金:'G',角:'B',飛:'R',王:'K'}[t];}



