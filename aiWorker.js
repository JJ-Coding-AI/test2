let stop=false,bestMove=null,tt=new Map(),used=0;
const PIECE_VALUES={P:100,L:300,N:300,S:400,G:500,B:800,R:1000,K:10000,'+P':200,'+L':500,'+N':500,'+S':500,'+B':900,'+R':1100};
const RAND=[];for(let i=0;i<14*81*2;i++){RAND.push(BigInt.asUintN(64,BigInt(Math.floor(Math.random()*2**32))<<32n|BigInt(Math.floor(Math.random()*2**32))));}
self.onmessage=e=>{const d=e.data;if(d.type==='go'){stop=false;bestMove=null;searchRoot(d.pos,d.level+2);postMessage(bestMove);}else if(d.type==='stop'){stop=true;postMessage(bestMove);}};
function searchRoot(pos,depth){for(let d=1;d<=depth;d++){alphabeta(pos,d,-1e9,1e9,true);if(stop)break;}}
function alphabeta(pos,depth,alpha,beta,root){if(depth===0)return evaluate(pos);
 let key=hash(pos);let entry=tt.get(key);if(entry&&entry.d>=depth)return entry.s; let moves=generateMoves(pos);if(moves.length===0)return inCheck(pos,pos.turn)?-999999+depth:0;order(moves);
 let best=null;for(let m of moves){let n=makeMove(pos,m);let score=-alphabeta(n,depth-1,-beta,-alpha,false);if(stop)return alpha;if(score>alpha){alpha=score;best=m;if(root)bestMove=m;if(alpha>=beta)break;}}
 tt.set(key,{d:depth,s:alpha});if(tt.size>10000){for(let [k,v] of tt){if(used++%2)tt.delete(k);if(tt.size<=10000)break;}}return alpha;}
function evaluate(pos){let s=0;for(let y=0;y<9;y++)for(let x=0;x<9;x++){let p=pos.board[y][x];if(p){let v=PIECE_VALUES[p.replace(/[a-z]/,c=>c.toUpperCase())];s+=p===p.toUpperCase()?v:-v;}}
 for(let c of ['black','white'])for(let k in pos.hands[c]){s+=(c==='black'?1:-1)*PIECE_VALUES[k]*pos.hands[c][k];}
 if(inCheck(pos,'white'))s+=500;if(inCheck(pos,'black'))s-=500;return s;}
function generateMoves(pos){let moves=[];const c=pos.turn;for(let y=0;y<9;y++)for(let x=0;x<9;x++){let p=pos.board[y][x];if(p&&((c==='black')===(p===p.toUpperCase()))){moves.push(...pieceMoves(pos,x,y));}}
 for(let k in pos.hands[c])if(pos.hands[c][k]>0)moves.push(...dropMoves(pos,c,k));return moves;}
function pieceMoves(pos,x,y){let p=pos.board[y][x],c=pos.turn,s=c==='black'?-1:1,t=p.replace('+','').toUpperCase();let dirs={K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],G:[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,-1]],S:[[1,1],[-1,1],[1,-1],[-1,-1],[0,1]],P:[[0,1]],L:[[0,1]],N:[[1,2],[-1,2]],B:[[1,1],[1,-1],[-1,1],[-1,-1]],R:[[1,0],[-1,0],[0,1],[0,-1]]};
 let arr=[];if(t==='+B')arr=dirs.B.concat(dirs.K);else if(t==='+R')arr=dirs.R.concat(dirs.K);else if(['+P','+L','+N','+S'].includes(p))arr=dirs.G;else arr=dirs[t]||[];
 let res=[];for(let d of arr){let nx=x+d[0],ny=y+d[1]*s;if(t==='L'){while(inBounds(nx,ny)){let dst=pos.board[ny][nx];if(!dst)res.push(mv(x,y,nx,ny,null,true));else{if((dst===dst.toUpperCase())!== (c==='black'))res.push(mv(x,y,nx,ny,dst,true));break;}ny+=d[1]*s;}}
 else if(t==='B'||t==='R'){let dx=d[0],dy=d[1];let nx=x+dx,ny=y+dy;while(inBounds(nx,ny)){let dst=pos.board[ny][nx];if(!dst)res.push(mv(x,y,nx,ny,null,true));else{if((dst===dst.toUpperCase())!== (c==='black'))res.push(mv(x,y,nx,ny,dst,true));break;}nx+=dx;ny+=dy;}}
 else if(t==='N'){let nx=x+d[0],ny=y+d[1]*s;if(inBounds(nx,ny)){let dst=pos.board[ny][nx];if(!dst||((dst===dst.toUpperCase())!== (c==='black')))res.push(mv(x,y,nx,ny,dst,true));}}
 else{let nx=x+d[0],ny=y+d[1]*s;if(inBounds(nx,ny)){let dst=pos.board[ny][nx];if(!dst||((dst===dst.toUpperCase())!== (c==='black')))res.push(mv(x,y,nx,ny,dst,true));}}
 }
 return res.filter(m=>legal(pos,m));}
function mv(fx,fy,tx,ty,capture,prom){let m={from:{x:fx,y:fy},to:{x:tx,y:ty},capture};if(prom)m.prom=true;return m;}
function dropMoves(pos,c,p){let res=[];for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(!pos.board[y][x]){if(p==='P'){let ok=true;for(let yy=0;yy<9;yy++)if(pos.board[yy][x]===(c==='black'?'P':'p'))ok=false;if((c==='black'&&y===0)||(c==='white'&&y===8))ok=false;if(ok)res.push({drop:true,piece:p,to:{x,y}});}else{if(p==='N'&&(c==='black'?y<=1:y>=7))continue;if(p==='L'&&(c==='black'?y===0:y===8))continue;res.push({drop:true,piece:p,to:{x,y}});}}
 return res.filter(m=>legal(pos,m));}
function legal(pos,m){let n=apply(pos,m);return !inCheck(n,pos.turn);} 
function apply(pos,m){let b=pos.board.map(r=>r.slice()),h=JSON.parse(JSON.stringify(pos.hands)),c=pos.turn;let next={board:b,hands:h,turn:c==='black'?'white':'black'};if(m.drop){h[c][m.piece]--;b[m.to.y][m.to.x]=c==='black'?m.piece:m.piece.toLowerCase();}else{let p=b[m.from.y][m.from.x];b[m.from.y][m.from.x]=null;let piece=m.prom?('+'+p.replace('+','')):p;b[m.to.y][m.to.x]=piece;if(m.capture)h[c][m.capture.replace('+','').toUpperCase()]++;}
 return next;}
function inCheck(pos,color){let k=findKing(pos,color);return attacked(pos,k.x,k.y,color==='black'?'white':'black');}
function findKing(pos,color){for(let y=0;y<9;y++)for(let x=0;x<9;x++){let p=pos.board[y][x];if(p&&p.replace('+','').toUpperCase()==='K'&&((p===p.toUpperCase())===(color==='black')))return{x,y};}}
function attacked(pos,x,y,enemy){let s=enemy==='black'?-1:1;let dirs={K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],G:[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,-1]],S:[[1,1],[-1,1],[1,-1],[-1,-1],[0,1]],P:[[0,1]],L:[[0,1]],N:[[1,2],[-1,2]],B:[[1,1],[1,-1],[-1,1],[-1,-1]],R:[[1,0],[-1,0],[0,1],[0,-1]]};
 for(let yy=0;yy<9;yy++)for(let xx=0;xx<9;xx++){let p=pos.board[yy][xx];if(!p||((p===p.toUpperCase())!==(enemy==='black')))continue;let t=p.replace('+','').toUpperCase();let arr=[];if(t==='+B')arr=dirs.B.concat(dirs.K);else if(t==='+R')arr=dirs.R.concat(dirs.K);else if(['+P','+L','+N','+S'].includes(p))arr=dirs.G;else arr=dirs[t]||[];for(let d of arr){let nx=xx+d[0],ny=yy+d[1]*(t==='L'?s:1);if(t==='L'||t==='B'||t==='R'){while(inBounds(nx,ny)){let dst=pos.board[ny][nx];if(nx===x&&ny===y)return true;if(dst)break;nx+=d[0];ny+=d[1]*(t==='L'?s:1);}}else{if(nx===x&&ny===y)return true;}}}
 return false;}
function order(arr){arr.sort((a,b)=> (b.capture?PIECE_VALUES[b.capture.replace(/[a-z]/,c=>c.toUpperCase())]:0)-(a.capture?PIECE_VALUES[a.capture.replace(/[a-z]/,c=>c.toUpperCase())]:0));}
function inBounds(x,y){return x>=0&&x<9&&y>=0&&y<9;}
function hash(pos){let h=0n;for(let y=0;y<9;y++)for(let x=0;x<9;x++){let p=pos.board[y][x];if(p){let idx=(index(p)*81+y*9+x)*2+(p===p.toUpperCase()?0:1);h^=RAND[idx];}}
 for(let c of ['black','white'])for(let k in pos.hands[c])for(let i=0;i<pos.hands[c][k];i++){let idx=(index(k)*81*2)+(c==='black'?0:1);h^=RAND[idx];}
 return h;}
function index(p){return{'P':0,'L':1,'N':2,'S':3,'G':4,'B':5,'R':6,'K':7,'+P':8,'+L':9,'+N':10,'+S':11,'+B':12,'+R':13}[p.replace(/[a-z]/,c=>c.toUpperCase())];}

