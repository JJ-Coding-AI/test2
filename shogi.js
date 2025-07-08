class ShogiGame {
  constructor() {
    this.board = [];
    this.hands = {b:{}, w:{}};
    this.turn = 'b';
    this.history = [];
    this.initBoard();
    this.render();
    this.worker = new Worker('aiWorker.js');
    this.worker.onmessage = e => this.onAIMove(e.data);
    document.getElementById('undo').onclick=()=>this.undo();
    document.getElementById('level').onchange=e=>{this.level=+e.target.value;};
    this.level=2;
  }
  initBoard(){
    const empty=()=>Array(9).fill(null);
    for(let y=0;y<9;y++)this.board[y]=empty();
    const b='b',w='w';
    const set=(x,y,t,c)=>this.board[y][x]={type:t,color:c};
    // set up pieces
    const row=(y,c)=>{
      set(0,y,'L',c);set(1,y,'N',c);set(2,y,'S',c);set(3,y,'G',c);set(4,y,'K',c);set(5,y,'G',c);set(6,y,'S',c);set(7,y,'N',c);set(8,y,'L',c);
    };
    row(0,w);row(8,b);
    set(1,1,'B',w);set(7,7,'B',b);
    set(7,1,'R',w);set(1,7,'R',b);
    for(let x=0;x<9;x++){set(x,2,'P',w);set(x,6,'P',b);}
  }
  render(){
    const boardEl=document.getElementById('board');
    boardEl.innerHTML='';
    for(let y=0;y<9;y++){
      for(let x=0;x<9;x++){
        const sq=document.createElement('div');
        sq.className='square';
        sq.dataset.x=x;sq.dataset.y=y;
        boardEl.appendChild(sq);
        const p=this.board[y][x];
        if(p){
          const el=this.createPieceEl(p);
          sq.appendChild(el);
        }
      }
    }
    this.updateHands();
    this.updateTurn();
  }
  createPieceEl(p){
    const el=document.createElement('div');
    el.className='piece'+(p.color==='w'?' white':'');
    el.textContent=this.pieceChar(p.type);
    el.onmousedown=e=>this.startDragBoard(e,p);
    return el;
  }
  pieceChar(t){
    return{P:'歩',L:'香',N:'桂',S:'銀',G:'金',K:'王',B:'角',R:'飛','+P':'と','+L':'杏','+N':'圭','+S':'全','+B':'馬','+R':'龍'}[t]||t;
  }
  startDragBoard(e,p){
    if(p.color!==this.turn)return;
    const x=+e.target.parentNode.dataset.x;
    const y=+e.target.parentNode.dataset.y;
    this.dragging={from:[x,y],piece:p,source:'board'};
    this.showLegalMoves(x,y,p);
  }
  showLegalMoves(x,y,p){
    this.clearHighlights();
    const moves=this.generateMoves(this.turn);
    moves.filter(m=>m.from[0]===x&&m.from[1]===y).forEach(m=>{
      const sq=document.querySelector(`[data-x="${m.to[0]}"][data-y="${m.to[1]}"]`);
      if(sq){sq.classList.add('highlight');sq.onclick=()=>this.move(m);}
    });
  }
  clearHighlights(){
    document.querySelectorAll('.highlight').forEach(el=>{el.classList.remove('highlight');el.onclick=null;});
  }
  startDragHand(pieceType){
    if(!this.hands[this.turn][pieceType])return;
    this.dragging={from:null,piece:{type:pieceType,color:this.turn},source:'hand'};
    this.showLegalDrops(pieceType);
  }
  showLegalDrops(pt){
    this.clearHighlights();
    const moves=this.generateMoves(this.turn);
    moves.filter(m=>m.drop===pt).forEach(m=>{
      const sq=document.querySelector(`[data-x="${m.to[0]}"][data-y="${m.to[1]}"]`);
      if(sq){sq.classList.add('highlight');sq.onclick=()=>this.move(m);}
    });
  }
  move(m){
    this.clearHighlights();
    if(m.drop){
      this.hands[this.turn][m.drop]--; if(this.hands[this.turn][m.drop]===0)delete this.hands[this.turn][m.drop];
      this.board[m.to[1]][m.to[0]]={type:m.drop,color:this.turn};
      this.history.push({move:m,capture:null});
    }else{
      const p=this.board[m.from[1]][m.from[0]];this.board[m.from[1]][m.from[0]]=null;
      if(this.board[m.to[1]][m.to[0]]){
        const cap=this.board[m.to[1]][m.to[0]];const base=cap.type.replace('+','');
        this.hands[this.turn][base]=(this.hands[this.turn][base]||0)+1;
      }
      let piece=p;
      if(m.promote){piece={type:this.promote(p.type),color:p.color};}
      this.board[m.to[1]][m.to[0]]=piece;
      this.history.push({move:m});
    }
    this.turn=this.turn==='b'?'w':'b';
    this.render();
    this.postAI();
  }
  promote(t){
    return{P:'+P',L:'+L',N:'+N',S:'+S',B:'+B',R:'+R'}[t]||t;
  }
  postAI(){
    if(this.turn!=='w')return; // AI is white
    this.worker.postMessage({type:'search',state:this.serialize(),level:this.level});
  }
  onAIMove(m){
    if(!m)return;this.move(m);
  }
  serialize(){
    return {board:this.board,hands:this.hands,turn:this.turn};
  }
  undo(){
    const b=this.history.pop();const a=this.history.pop();
    if(!a||!b)return;
    this.loadHistory();
  }
  loadHistory(){
    this.board=[];this.hands={b:{},w:{}};this.turn='b';this.initBoard();
    const hist=[...this.history];this.history=[];
    hist.forEach(h=>this.move(h.move));
    this.turn=this.turn==='b'?'w':'b'; // revert extra switch
    this.render();
  }
  updateHands(){
    const black=document.getElementById('black-hand');
    const white=document.getElementById('white-hand');
    black.innerHTML='';white.innerHTML='';
    for(const [k,v] of Object.entries(this.hands.b)){
      const el=document.createElement('span');el.className='handPiece';el.textContent=this.pieceChar(k)+v;el.onclick=()=>this.startDragHand(k);black.appendChild(el);
    }
    for(const [k,v] of Object.entries(this.hands.w)){
      const el=document.createElement('span');el.className='handPiece white';el.textContent=this.pieceChar(k)+v;white.appendChild(el);
    }
  }
  updateTurn(){
    document.getElementById('turn').textContent=this.turn==='b'?'あなたの番':'AIの番';
  }
  generateMoves(color){
    const moves=[];
    const enemy=color==='b'?'w':'b';
    const dirs={
      P:[[0,-1]],L:[[0,-1,'slide']],N:[[-1,-2],[1,-2]],S:[[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]],
      G:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
      K:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
      B:[[-1,-1,'slide'],[1,-1,'slide'],[-1,1,'slide'],[1,1,'slide']],
      R:[[-1,0,'slide'],[1,0,'slide'],[0,-1,'slide'],[0,1,'slide']],
    };
    const prom={P:'+P',L:'+L',N:'+N',S:'+S',B:'+B',R:'+R'};
    const goldDirs=dirs.G;
    for(let y=0;y<9;y++){
      for(let x=0;x<9;x++){
        const p=this.board[y][x];if(!p||p.color!==color)continue;
        const type=p.type;
        const base=type.replace('+','');
        const d=(type.startsWith('+')?goldDirs:dirs[base])||[];
        for(const mv of d){
          const [dx,dy,slide]=mv;let nx=x,ny=y;
          while(true){
            nx+=dx*(color==='b'?1:-1);
            ny+=dy*(color==='b'?1:-1);
            if(nx<0||nx>8||ny<0||ny>8)break;
            const target=this.board[ny][nx];
            if(target&&target.color===color)break;
            const m={from:[x,y],to:[nx,ny]};
            if(!slide) { moves.push(this.addProm(m,p,y,ny,color)); }
            else { moves.push(this.addProm(m,p,y,ny,color)); if(target)break; }
            if(target)break;
            if(!slide)break;
          }
        }
      }
    }
    // drops
    for(const [pt,cnt] of Object.entries(this.hands[color])){
      if(cnt<=0)continue;
      for(let y=0;y<9;y++){
        for(let x=0;x<9;x++){
          if(this.board[y][x])continue;
          const m={drop:pt,to:[x,y]};
          if(pt==='P' && this.nifu(color,x))continue;
          if(pt==='P' && this.dropMate(color,x,y))continue;
          if(!this.selfCheckAfterMove(color,m)) moves.push(m);
        }
      }
    }
    // filter self-check moves
    return moves.filter(m=>!this.selfCheckAfterMove(color,m));
  }
  addProm(m,p,y,ny,color){
    const zone=color==='b'?[0,1,2]:[6,7,8];
    if(p.type.replace('+','') in {P:1,L:1,N:1,S:1,B:1,R:1} && (zone.includes(y)||zone.includes(ny))){
      const mp=Object.assign({},m,{promote:true});
      return mp;
    }
    return m;
  }
  nifu(color,x){
    for(let y=0;y<9;y++){
      const p=this.board[y][x];
      if(p&&p.color===color&&p.type==='P')return true;
    }
    return false;
  }
  dropMate(color,x,y){
    const tmp=this.board[y][x];
    this.board[y][x]={type:'P',color};
    const mate=this.isCheckmate(color==='b'?'w':'b');
    this.board[y][x]=tmp;
    return mate;
  }
  selfCheckAfterMove(color,m){
    const save=JSON.parse(JSON.stringify({board:this.board,hands:this.hands}));
    if(m.drop){
      this.hands[color][m.drop]--; if(this.hands[color][m.drop]===0)delete this.hands[color][m.drop];
      this.board[m.to[1]][m.to[0]]={type:m.drop,color};
    }else{
      const p=this.board[m.from[1]][m.from[0]];this.board[m.from[1]][m.from[0]]=null;let piece=p;if(m.promote)piece={type:this.promote(p.type),color:p.color};
      if(this.board[m.to[1]][m.to[0]]){const cap=this.board[m.to[1]][m.to[0]];const base=cap.type.replace('+','');this.hands[color][base]=(this.hands[color][base]||0)+1;}
      this.board[m.to[1]][m.to[0]]=piece;
    }
    const inCheck=this.isInCheck(color);
    this.board=save.board;this.hands=save.hands;
    return inCheck;
  }
  isInCheck(color){
    const enemy=color==='b'?'w':'b';
    const kingPos=this.findKing(color);
    const moves=this.generateMovesRaw(enemy);
    return moves.some(m=>m.to[0]===kingPos[0]&&m.to[1]===kingPos[1]);
  }
  findKing(color){
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){const p=this.board[y][x];if(p&&p.color===color&&p.type==='K')return[x,y];}
    return[-1,-1];
  }
  generateMovesRaw(color){
    const moves=[]; // like generateMoves but without self-check filter
    const dirs={
      P:[[0,-1]],L:[[0,-1,'slide']],N:[[-1,-2],[1,-2]],S:[[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]],
      G:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
      K:[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
      B:[[-1,-1,'slide'],[1,-1,'slide'],[-1,1,'slide'],[1,1,'slide']],
      R:[[-1,0,'slide'],[1,0,'slide'],[0,-1,'slide'],[0,1,'slide']],
    };
    const goldDirs=dirs.G;
    for(let y=0;y<9;y++){
      for(let x=0;x<9;x++){
        const p=this.board[y][x];if(!p||p.color!==color)continue;
        const type=p.type;
        const base=type.replace('+','');
        const d=(type.startsWith('+')?goldDirs:dirs[base])||[];
        for(const mv of d){
          const [dx,dy,slide]=mv;let nx=x,ny=y;
          while(true){
            nx+=dx*(color==='b'?1:-1);
            ny+=dy*(color==='b'?1:-1);
            if(nx<0||nx>8||ny<0||ny>8)break;
            const target=this.board[ny][nx];
            if(target&&target.color===color)break;
            moves.push({from:[x,y],to:[nx,ny]});
            if(target)break;
            if(!slide)break;else if(target)break;
          }
        }
      }
    }
    return moves;
  }
  isCheckmate(color){
    const moves=this.generateMoves(color);
    if(moves.length) return false;
    if(this.isInCheck(color))return true;
    return false;
  }
}

window.onload=()=>{
  const game=new ShogiGame();
};
