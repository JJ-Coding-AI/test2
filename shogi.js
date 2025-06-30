const boardElement = document.getElementById('board');
const blackHandElement = document.getElementById('black-hand');
const whiteHandElement = document.getElementById('white-hand');
const turnElement = document.getElementById('turn');
const undoButton = document.getElementById('undo');
let board = [];
let hands = { black: [], white: [] };
let turn = 'black';
let history = [];

const pieceNames = {
  OU: '王',
  HI: '飛',
  KA: '角',
  KI: '金',
  GI: '銀',
  KE: '桂',
  KY: '香',
  FU: '歩',
  TO: 'と',
  NY: '成香',
  NK: '成桂',
  NG: '成銀',
  UM: '馬',
  RY: '龍'
};

function initBoard() {
  board = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      row.push(null);
    }
    board.push(row);
  }
  // 初期配置
  board[0] = [
    {type:'KY',owner:'white'},{type:'KE',owner:'white'},{type:'GI',owner:'white'},{type:'KI',owner:'white'},{type:'OU',owner:'white'},{type:'KI',owner:'white'},{type:'GI',owner:'white'},{type:'KE',owner:'white'},{type:'KY',owner:'white'}
  ];
  board[1][1] = {type:'KA',owner:'white'};
  board[1][7] = {type:'HI',owner:'white'};
  for(let i=0;i<9;i++) board[2][i] = {type:'FU',owner:'white'};

  board[8] = [
    {type:'KY',owner:'black'},{type:'KE',owner:'black'},{type:'GI',owner:'black'},{type:'KI',owner:'black'},{type:'OU',owner:'black'},{type:'KI',owner:'black'},{type:'GI',owner:'black'},{type:'KE',owner:'black'},{type:'KY',owner:'black'}
  ];
  board[7][7] = {type:'KA',owner:'black'};
  board[7][1] = {type:'HI',owner:'black'};
  for(let i=0;i<9;i++) board[6][i] = {type:'FU',owner:'black'};

  hands = { black: [], white: [] };
  turn = 'black';
  history = [];
}

function render() {
  boardElement.innerHTML = '';
  for (let r=0;r<9;r++) {
    for (let c=0;c<9;c++) {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      cellDiv.dataset.row = r;
      cellDiv.dataset.col = c;
      const piece = board[r][c];
      if(piece){
        const pieceDiv = document.createElement('div');
        pieceDiv.className = 'piece ' + piece.owner;
        pieceDiv.draggable = true;
        pieceDiv.textContent = pieceNames[piece.type];
        pieceDiv.dataset.row = r;
        pieceDiv.dataset.col = c;
        pieceDiv.dataset.owner = piece.owner;
        pieceDiv.addEventListener('dragstart', onDragStart);
        cellDiv.appendChild(pieceDiv);
      }
      cellDiv.addEventListener('dragover', e=>e.preventDefault());
      cellDiv.addEventListener('drop', onDrop);
      boardElement.appendChild(cellDiv);
    }
  }
  renderHands();
  turnElement.textContent = turn==='black'? '先手の番':'後手の番';
}

function renderHands(){
  blackHandElement.innerHTML = '';
  hands.black.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='piece black';
    d.textContent=pieceNames[p.type];
    d.draggable=true;
    d.dataset.hand='black';
    d.dataset.index=i;
    d.addEventListener('dragstart', onDragStart);
    blackHandElement.appendChild(d);
  });
  whiteHandElement.innerHTML = '';
  hands.white.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='piece white';
    d.textContent=pieceNames[p.type];
    d.draggable=true;
    d.dataset.hand='white';
    d.dataset.index=i;
    d.addEventListener('dragstart', onDragStart);
    whiteHandElement.appendChild(d);
  });
}

function onDragStart(e){
  const row = e.target.dataset.row;
  const col = e.target.dataset.col;
  const hand = e.target.dataset.hand;
  const index = e.target.dataset.index;
  e.dataTransfer.setData('text/plain', JSON.stringify({row,col,hand,index}));
}

function onDrop(e){
  e.preventDefault();
  const targetRow = Number(e.currentTarget.dataset.row);
  const targetCol = Number(e.currentTarget.dataset.col);
  const data = JSON.parse(e.dataTransfer.getData('text/plain'));
  if(data.hand){
    // 手駒から打つ
    const piece = hands[data.hand][data.index];
    if(turn!==data.hand) return;
    if(board[targetRow][targetCol]) return;
    history.push(JSON.stringify({board:board,hands:hands,turn:turn}));
    board[targetRow][targetCol]= {type:piece.type, owner:turn};
    hands[data.hand].splice(data.index,1);
    turn = turn==='black'? 'white':'black';
    render();
    checkWin();
  } else {
    const fromRow = Number(data.row);
    const fromCol = Number(data.col);
    const piece = board[fromRow][fromCol];
    if(!piece || piece.owner!==turn) return;
    if(!isLegalMove(piece,fromRow,fromCol,targetRow,targetCol)) return;
    history.push(JSON.stringify({board:board,hands:hands,turn:turn}));
    const captured = board[targetRow][targetCol];
    board[targetRow][targetCol]=piece;
    board[fromRow][fromCol]=null;
    if(captured){
      captured.owner=turn;
      captured.type=demote(captured.type);
      hands[turn].push(captured);
    }
    if(shouldPromote(piece,fromRow,targetRow,turn)){
      if(confirm('成りますか？')) piece.type=promote(piece.type);
    }
    turn = turn==='black'? 'white':'black';
    render();
    checkWin();
  }
}

function demote(type){
  switch(type){
    case 'TO': return 'FU';
    case 'NY': return 'KY';
    case 'NK': return 'KE';
    case 'NG': return 'GI';
    case 'UM': return 'KA';
    case 'RY': return 'HI';
  }
  return type;
}

function promote(type){
  switch(type){
    case 'FU': return 'TO';
    case 'KY': return 'NY';
    case 'KE': return 'NK';
    case 'GI': return 'NG';
    case 'KA': return 'UM';
    case 'HI': return 'RY';
  }
  return type;
}

function shouldPromote(piece,fromRow,toRow,owner){
  const zone = owner==='black'? [0,1,2] : [6,7,8];
  return (zone.includes(fromRow) || zone.includes(toRow)) && canPromote(piece.type);
}

function canPromote(type){
  return ['FU','KY','KE','GI','KA','HI'].includes(type);
}

function isLegalMove(piece,fr,fc,tr,tc){
  if(tr<0||tr>8||tc<0||tc>8) return false;
  if(fr===tr && fc===tc) return false;
  const target = board[tr][tc];
  if(target && target.owner===piece.owner) return false;
  let dr = piece.owner==='black'? tr-fr : fr-tr;
  let dc = piece.owner==='black'? tc-fc : fc-tc;
  switch(piece.type){
    case 'FU':
      return dr===-1&&dc===0;
    case 'TO':
    case 'KI':
    case 'NY':
    case 'NK':
    case 'NG':
      return (dr===-1&&dc===0)|| (dr===-1&&Math.abs(dc)===1)|| (dr===0&&Math.abs(dc)===1)|| (dr===1&&dc===0);
    case 'GI':
      return (dr===-1&&Math.abs(dc)<=1)|| (dr===1&&Math.abs(dc)===1);
    case 'KE':
      return dr===-2&&Math.abs(dc)===1;
    case 'KY':
      if(dc!==0 || dr>=0) return false;
      for(let r=fr-1;r>tr;r--) if(board[r][fc]) return false;
      return true;
    case 'HI':
    case 'RY':
      if(dr===0){
        const step = dc>0?1:-1;
        for(let c=fc+step; c!=tc; c+=step) if(board[fr][c]) return false;
      }else if(dc===0){
        const step = dr>0?1:-1;
        for(let r=fr+step; r!=tr; r+=step) if(board[r][fc]) return false;
      }else if(piece.type==='RY' && Math.abs(dr)===1 && Math.abs(dc)===1){
        return true;
      }else return false;
      return true;
    case 'KA':
    case 'UM':
      if(Math.abs(dr)!==Math.abs(dc)){
        if(piece.type==='UM' && ((Math.abs(dr)===1&&dc===0)||(Math.abs(dc)===1&&dr===0))) return true;
        return false;
      }
      const stepr = dr>0?1:-1;
      const stepc = dc>0?1:-1;
      let r=fr+stepr, c=fc+stepc;
      while(r!==tr){
        if(board[r][c]) return false;
        r+=stepr; c+=stepc;
      }
      return true;
    case 'OU':
      return Math.abs(dr)<=1 && Math.abs(dc)<=1;
  }
  return false;
}

function checkWin(){
  let hasBlackKing=false, hasWhiteKing=false;
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const p=board[r][c];
      if(p&&p.type==='OU'){
        if(p.owner==='black') hasBlackKing=true; else hasWhiteKing=true;
      }
    }
  }
  if(!hasWhiteKing){
    alert('先手の勝ち');
    initBoard();
    render();
  }else if(!hasBlackKing){
    alert('後手の勝ち');
    initBoard();
    render();
  }
}

undoButton.addEventListener('click',()=>{
  if(history.length===0) return;
  const last = JSON.parse(history.pop());
  board=JSON.parse(JSON.stringify(last.board));
  hands=JSON.parse(JSON.stringify(last.hands));
  turn=last.turn;
  render();
});

initBoard();
render();
