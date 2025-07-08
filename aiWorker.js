let stop=false,best=null;
onmessage=e=>{
  if(e.data.type==='stop'){stop=true;postMessage(best);return;}
  if(e.data.type==='search'){stop=false;best=null;const {state,level}=e.data;const depth=level*2+1;best=iterative(state,depth);postMessage(best);}
};
function iterative(state,max){let bestMove=null;for(let d=1;d<=max&&!stop;d++){const [score,move]=search(state,d,-1e9,1e9,true);if(!stop)bestMove=move;}return bestMove;}
function search(state,depth,alpha,beta,root){if(depth===0||stop)return [evaluate(state),null];
  const moves=generate(state);if(!moves.length)return[state.turn==='b'? -999999:999999,null];
  let best=null;
  for(const m of moves){apply(state,m);const [score]=search(state,depth-1,-beta,-alpha,false);const val=-score;revert(state,m);
    if(val>alpha){alpha=val;best=m;if(alpha>=beta)break;}
  }
  return[alpha,best];
}
function generate(state){const game=new Game(state);return game.generateMoves(state.turn);}
function apply(state,m){const game=new Game(state);game.applyMove(m);} // apply to state
function revert(state,m){const game=new Game(state);game.revertMove(m);} // revert
class Game{constructor(s){this.board=JSON.parse(JSON.stringify(s.board));this.hands=JSON.parse(JSON.stringify(s.hands));this.turn=s.turn;}
  generateMoves(color){
    // simplified: reuse minimal from main; not including drop mate check for speed
    const moves=[];const dirs={P:[[0,-1]],L:[[0,-1,'slide']],N:[[-1,-2],[1,-2]],S:[[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]],G:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],K:[[ -1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],B:[[-1,-1,'slide'],[1,-1,'slide'],[-1,1,'slide'],[1,1,'slide']],R:[[-1,0,'slide'],[1,0,'slide'],[0,-1,'slide'],[0,1,'slide']],};const gold=dirs.G;
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=this.board[y][x];if(!p||p.color!==color)continue;const base=p.type.replace('+','');const d=(p.type.startsWith('+')?gold:dirs[base])||[];for(const mv of d){let [dx,dy,slide]=mv;let nx=x,ny=y;while(true){nx+=dx*(color==='b'?1:-1);ny+=dy*(color==='b'?1:-1);if(nx<0||nx>8||ny<0||ny>8)break;const t=this.board[ny][nx];if(t&&t.color===color)break;moves.push({from:[x,y],to:[nx,ny]});if(t)break;if(!slide)break;}}}
    for(const [pt,cnt] of Object.entries(this.hands[color])){if(cnt<=0)continue;for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(!this.board[y][x])moves.push({drop:pt,to:[x,y]});}
    return moves;
  }
  applyMove(m){if(m.drop){this.hands[this.turn][m.drop]--;this.board[m.to[1]][m.to[0]]={type:m.drop,color:this.turn};}else{const p=this.board[m.from[1]][m.from[0]];this.board[m.from[1]][m.from[0]]=null;if(this.board[m.to[1]][m.to[0]]){const cap=this.board[m.to[1]][m.to[0]];const base=cap.type.replace('+','');this.hands[this.turn][base]=(this.hands[this.turn][base]||0)+1;}this.board[m.to[1]][m.to[0]]=p;}this.turn=this.turn==='b'?'w':'b';}
  revertMove(m){this.turn=this.turn==='b'?'w':'b';if(m.drop){delete this.board[m.to[1]][m.to[0]];this.hands[this.turn][m.drop]=(this.hands[this.turn][m.drop]||0)+1;}else{const p=this.board[m.to[1]][m.to[0]];this.board[m.to[1]][m.to[0]]=null;this.board[m.from[1]][m.from[0]]=p;if(m.capture){this.hands[this.turn][m.capture]=(this.hands[this.turn][m.capture]||0)-1;this.board[m.to[1]][m.to[0]]={type:m.capture,color:this.turn==='b'?'w':'b'};}}
  }
}
function evaluate(s){const values={P:100,L:300,N:300,S:500,G:600,B:700,R:800,K:10000,'+P':600,'+L':600,'+N':600,'+S':600,'+B':900,'+R':1000};let sum=0;for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=s.board[y][x];if(p)sum+=(p.color==='b'?1:-1)*values[p.type];}for(const [pt,cnt] of Object.entries(s.hands.b))sum+=values[pt]*cnt;for(const [pt,cnt] of Object.entries(s.hands.w))sum-=values[pt]*cnt;return sum*(s.turn==='b'?1:-1);} 

