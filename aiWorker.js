let stopFlag=false;
self.onmessage=e=>{
  if(e.data.type==='go'){
    stopFlag=false;
    const state=fromSFEN(e.data.fen);
    iterativeDeepening(state,e.data.ms||10000);
  }else if(e.data.type==='stop'){
    stopFlag=true;
  }
};
const TT=new Map();
const pieceValues={歩:100,香:300,桂:300,銀:400,金:500,角:850,飛:900,王:10000,と:500,杏:500,圭:500,全:500,馬:950,竜:1000};
function iterativeDeepening(state,limitMs=10000){
  const start=Date.now();
  let best;
  for(let depth=1; ;depth+=2){
    const {move}=search(state,depth,-Infinity,Infinity);
    if(move) best=move;
    if(Date.now()-start>limitMs||stopFlag) break;
  }
  postMessage({type:'bestmove',move:best});
}
function search(st,depth,alpha,beta){
  if(stopFlag) return {score:0};
  const hash=toSFEN(st);
  if(TT.has(hash)&&TT.get(hash).depth>=depth) return TT.get(hash);
  if(depth<=0) return {score:evaluate(st)};
  const moves=generateAllMoves(st);
  if(moves.length===0) return {score:isCheck(st,st.turn)?-99999:0};
  let bestMove=null;
  for(const m of moves){
    const child=clone(st);
    applyMove(child,m);
    const s=-search(child,depth-1,-beta,-alpha).score;
    if(s>alpha){
      alpha=s;bestMove=m;
      if(alpha>=beta) break;
    }
  }
  const entry={score:alpha,move:bestMove,depth};
  if(TT.size>10000){const k=TT.keys().next().value;TT.delete(k);} 
  TT.set(hash,entry);
  return entry;
}
function generateAllMoves(st){
  const res=[];
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=st.board[r][c];if(p&&p.owner===st.turn)res.push(...generateMoves(st,r,c));}
  for(const k in st.hands[st.turn]){
    for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(isLegalDrop(st,{drop:true,type:k,to:[r,c]}))res.push({drop:true,type:k,to:[r,c]});
  }
  return res;
}
function evaluate(st){
  let score=0;
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=st.board[r][c];if(p){const val=pieceValues[p.promoted?promoteName(p.type):p.type];score+=(p.owner==='player'?val:-val);}}
  for(const side of ['player','ai']){for(const k in st.hands[side]){const v=pieceValues[k]*(st.hands[side][k]);score+=side==='player'?v:-v;}}
  return score;
}
function applyMove(st,m){
  if(m.drop){st.board[m.to[0]][m.to[1]]={type:m.type,owner:st.turn,promoted:false};st.hands[st.turn][m.type]--;if(st.hands[st.turn][m.type]==0)delete st.hands[st.turn][m.type];}
  else{const p=st.board[m.from[0]][m.from[1]];st.board[m.from[0]][m.from[1]]=null;if(st.board[m.to[0]][m.to[1]]){const cap=st.board[m.to[0]][m.to[1]];const t=cap.promoted?demote(cap.type):cap.type;st.hands[st.turn][t]=(st.hands[st.turn][t]||0)+1;}if(m.promote)p.promoted=true;st.board[m.to[0]][m.to[1]]=p;}
  st.turn=st.turn==='player'?'ai':'player';
}
function clone(o){return JSON.parse(JSON.stringify(o));}

// the following parse/generate functions mirror those in main script
function toSFEN(st){
  let boardStr='';
  for(let r=0;r<9;r++){
    let empty=0;
    for(let c=0;c<9;c++){const p=st.board[r][c];if(p){if(empty){boardStr+=empty;empty=0;}boardStr+=toSFENChar(p);}else empty++;}
    if(empty)boardStr+=empty;if(r<8)boardStr+='/';
  }
  const turn=st.turn==='player'?'b':'w';
  const hand=handsToSFEN(st.hands);
  return boardStr+' '+turn+' '+(hand||'-');
}
function toSFENChar(p){const map={歩:'P',香:'L',桂:'N',銀:'S',金:'G',角:'B',飛:'R',王:'K',と:'+P',杏:'+L',圭:'+N',全:'+S',馬:'+B',竜:'+R'};return p.owner==='player'?map[p.promoted?promoteName(p.type):p.type]:map[p.promoted?promoteName(p.type):p.type].toLowerCase();}
function handsToSFEN(h){let s='';['ai','player'].forEach(side=>{for(const k in h[side]){const code=toSFENChar({type:k,owner:side,promoted:false}).replace('+','');s+=code+(h[side][k]>1?h[side][k]:'');}});return s;}
function fromSFEN(fen){const [b,t,h]=fen.split(' ');const rows=b.split('/');const board=Array.from({length:9},()=>Array(9).fill(null));for(let r=0;r<9;r++){let c=0,row=rows[r];for(let i=0;i<row.length;i++){let ch=row[i];if(!isNaN(ch)){c+=+ch;continue;}let promo=false,sym=ch;if(ch==='+'){promo=true;sym=row[++i];}const owner=ch===ch.toUpperCase()?'player':'ai';board[r][c++]={type:fromSFENChar(sym.toUpperCase()),owner,promoted:promo};}}const hands={player:{},ai:{}};if(h&&h!=='-'){let i=0;while(i<h.length){let ch=h[i++],num='';while(i<h.length&&!isNaN(h[i]))num+=h[i++];const owner=ch===ch.toUpperCase()?'player':'ai';const type=fromSFENChar(ch.toUpperCase());hands[owner][type]=num?parseInt(num):1;}}return{board,hands,turn:t==='b'?'player':'ai'};}
function fromSFENChar(ch){return {P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛',K:'王'}[ch];}
function generateMoves(st,r,c){const p=st.board[r][c];if(!p)return[];const dir=p.owner==='player'?-1:1;const res=[];const add=(dr,dc,rg)=>{for(let i=1;i<=rg;i++){const nr=r+dr*i,nc=c+dc*i;if(nr<0||nr>=9||nc<0||nc>=9)break;const t=st.board[nr][nc];if(t&&t.owner===p.owner)break;const promo=shouldPromote(p,r,nr);if(canPromotePiece(p.type)&&promo){res.push({from:[r,c],to:[nr,nc],promote:false});res.push({from:[r,c],to:[nr,nc],promote:true});}else res.push({from:[r,c],to:[nr,nc],promote:false});if(t)break;}};const step=(dr,dc)=>add(dr,dc,1);const leaps={'歩':()=>step(dir,0),'香':()=>add(dir,0,8),'桂':()=>{const nr=r+dir*2;[-1,1].forEach(dc=>{const promo=shouldPromote(p,r,nr);if(canPromotePiece(p.type)&&promo){res.push({from:[r,c],to:[nr,c+dc],promote:false});res.push({from:[r,c],to:[nr,c+dc],promote:true});}else res.push({from:[r,c],to:[nr,c+dc],promote:false});});},'銀':()=>{step(dir,-1);step(dir,0);step(dir,1);step(-dir,-1);step(-dir,1);},'金':()=>{step(dir,-1);step(dir,0);step(dir,1);step(0,-1);step(0,1);step(-dir,0);},'王':()=>{[-1,0,1].forEach(dr=>[-1,0,1].forEach(dc=>{if(dr||dc)step(dr,dc);}));},'角':()=>{add(1,1,8);add(1,-1,8);add(-1,1,8);add(-1,-1,8);},'飛':()=>{add(1,0,8);add(-1,0,8);add(0,1,8);add(0,-1,8);},'馬':()=>{leaps['角']();step(1,0);step(-1,0);step(0,1);step(0,-1);},'竜':()=>{leaps['飛']();step(1,1);step(1,-1);step(-1,1);step(-1,-1);},'と':()=>leaps['金'](),'杏':()=>leaps['金'](),'圭':()=>leaps['金'](),'全':()=>leaps['金']()};if(leaps[p.promoted?promoteName(p.type):p.type])leaps[p.promoted?promoteName(p.type):p.type]();return res;}
function isLegalDrop(st,m){const {type,to}=m,[r,c]=to;if(st.board[r][c])return false;if(type==='歩'){for(let i=0;i<9;i++){const p=st.board[i][c];if(p&&p.owner===st.turn&&p.type==='歩'&&!p.promoted)return false;}if((st.turn==='player'&&r===0)||(st.turn==='ai'&&r===8))return false;}if(type==='香'&&((st.turn==='player'&&r===0)||(st.turn==='ai'&&r===8)))return false;if(type==='桂'&&((st.turn==='player'&&r<=1)||(st.turn==='ai'&&r>=7)))return false;const copy=clone(st);applyMove(copy,m);const enemy=copy.turn;if(type==='歩'&&isCheck(copy,enemy)&&generateMovesForSide(copy,enemy).length===0)return false;return !isCheck(copy,st.turn);}
function isCheck(st,side){const enemy=side==='player'?'ai':'player';let kr,kc;for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=st.board[r][c];if(p&&p.owner===side&&p.type==='王'){kr=r;kc=c;}}return generateMovesForSide(st,enemy).some(m=>m.to[0]===kr&&m.to[1]===kc);}
function generateMovesForSide(st,side){const res=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++){const p=st.board[r][c];if(p&&p.owner===side)res.push(...generateMoves(st,r,c));}for(const t in st.hands[side]){for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(isLegalDrop(st,{drop:true,type:t,to:[r,c]}))res.push({drop:true,type:t,to:[r,c]});}return res;}
function canPromotePiece(type){return ['歩','香','桂','銀','角','飛'].includes(type);}function promoteName(t){return{歩:'と',香:'杏',桂:'圭',銀:'全',角:'馬',飛:'竜'}[t]||t;}function demote(t){return{と:'歩',杏:'香',圭:'桂',全:'銀',馬:'角',竜:'飛'}[t]||t;}function shouldPromote(p,fr,tr){return fr<=2||tr<=2||fr>=6||tr>=6;}
