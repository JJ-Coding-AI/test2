const boardEl = document.getElementById('board');
const blackHandEl = document.getElementById('black-hand');
const whiteHandEl = document.getElementById('white-hand');
const turnEl = document.getElementById('turn');
const levelEl = document.getElementById('level');
const undoBtn = document.getElementById('undo');

const worker = new Worker('aiWorker.js');

let history = [];

const initialSfen = 'lnsgkgsnl/1r5b1/p1ppppppp/9/9/9/P1PPPPPPP/1B5R1/LNSGKGSNL b - 1';
let position = parseSFEN(initialSfen);
render();
turnEl.textContent = position.turn === 'b' ? '先手番' : '後手番';

worker.onmessage = e => {
  if (e.data.type === 'bestmove') {
    applyMoveString(e.data.move);
  }
};

undoBtn.addEventListener('click', () => {
  if (history.length >= 2) {
    worker.postMessage({type:'stop'});
    position = history[history.length-2];
    history.splice(-2,2);
    render();
  }
});

function render() {
  boardEl.innerHTML = '';
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      const piece = position.board[y][x];
      if (piece) {
        cell.textContent = pieceToChar(piece);
        if (piece.color === position.turn) {
          cell.draggable = true;
          cell.addEventListener('dragstart', onDragStart);
        }
      }
      cell.addEventListener('dragover', onDragOver);
      cell.addEventListener('drop', onDrop);
      boardEl.appendChild(cell);
    }
  }
  renderHands();
  turnEl.textContent = position.turn === 'b' ? '先手番' : '後手番';
}

function renderHands() {
  blackHandEl.innerHTML = '先手持駒:' + handToString(position.hands.b);
  whiteHandEl.innerHTML = '後手持駒:' + handToString(position.hands.w);
}

function handToString(hand) {
  return Object.entries(hand).map(([k,v])=>v>0?k+v:'').join(' ');
}

let dragData = null;

function onDragStart(e) {
  const x = +this.dataset.x; const y = +this.dataset.y;
  const moves = generateMoves(position, x, y);
  highlight(moves.map(m=>({x:m.to.x,y:m.to.y})));
  dragData = {from:{x,y}, moves};
  e.dataTransfer.setData('text/plain','');
}

function onDragOver(e) {
  e.preventDefault();
}

function onDrop(e) {
  e.preventDefault();
  if (!dragData) return;
  const toX = +this.dataset.x; const toY = +this.dataset.y;
  const m = dragData.moves.find(m=>m.to.x===toX&&m.to.y===toY);
  clearHighlights();
  if (m) {
    history.push(clonePosition(position));
    applyMove(m);
    render();
    const fen = toSFEN(position);
    worker.postMessage({type:'go', fen, ms: +levelEl.value});
  }
  dragData = null;
}

function highlight(cells) {
  cells.forEach(c => {
    const el = [...boardEl.children].find(d=>+d.dataset.x===c.x&&+d.dataset.y===c.y);
    if (el) el.classList.add('highlight');
  });
}

function clearHighlights() {
  [...boardEl.children].forEach(c=>c.classList.remove('highlight'));
}

function applyMove(move) {
  const piece = position.board[move.from.y][move.from.x];
  if (move.capture) {
    const cap = position.board[move.to.y][move.to.x];
    position.hands[piece.color].push(cap.type);
  }
  position.board[move.to.y][move.to.x] = piece;
  position.board[move.from.y][move.from.x] = null;
  if (move.promote) piece.promoted = true;
  position.turn = position.turn === 'b' ? 'w':'b';
}

function applyMoveString(str) {
  // simple: xfyfxtyt promotion flag e.g., 7776
  const fromX = 8-(str.charCodeAt(0)-'1'.charCodeAt(0));
  const fromY = str.charCodeAt(1)-'1'.charCodeAt(0);
  const toX = 8-(str.charCodeAt(2)-'1'.charCodeAt(0));
  const toY = str.charCodeAt(3)-'1'.charCodeAt(0);
  const move = {from:{x:fromX,y:fromY}, to:{x:toX,y:toY}, capture:position.board[toY][toX]};
  history.push(clonePosition(position));
  applyMove(move);
  render();
}

function clonePosition(pos) {
  return {board:pos.board.map(r=>r.map(p=>p?{...p}:null)), turn:pos.turn, hands:{b:{...pos.hands.b}, w:{...pos.hands.w}}};
}

function pieceToChar(p) {
  const map = {K:'玉',R:'飛',B:'角',G:'金',S:'銀',N:'桂',L:'香',P:'歩'};
  let ch = map[p.type] || '';
  if (p.promoted) ch = '+'+ch;
  return p.color==='b'?ch:ch;
}

function parseSFEN(sfen) {
  const [boardStr, turn, handStr] = sfen.split(' ');
  const rows = boardStr.split('/');
  const board = [];
  for (let y=0;y<9;y++) {
    const row = [];
    let x=0;
    for (let i=0;i<rows[y].length;i++) {
      const ch = rows[y][i];
      if (ch>='1' && ch<='9') {
        for (let k=0;k<+ch;k++) row.push(null);
        x += +ch;
      } else if (ch === '+') {
        const next = rows[y][++i];
        row.push({type:next.toUpperCase(), color: next === next.toUpperCase()? 'b':'w', promoted:true});
        x++;
      } else {
        row.push({type:ch.toUpperCase(), color: ch === ch.toUpperCase()? 'b':'w', promoted:false});
        x++;
      }
    }
    board.push(row);
  }
  const hands = {b:{}, w:{}};
  if (handStr !== '-') {
    const regex = /(\d+)?([PRBNGLSK])/gi;
    let m;
    while ((m = regex.exec(handStr))) {
      const num = parseInt(m[1]||'1',10);
      const piece = m[2];
      const color = piece === piece.toUpperCase() ? 'b':'w';
      hands[color][piece.toUpperCase()] = num;
    }
  }
  return {board, turn, hands:{b:hands.b||{}, w:hands.w||{}}};
}

function toSFEN(pos) {
  let boardStr = '';
  for (let y=0;y<9;y++) {
    let empty=0;
    for (let x=0;x<9;x++) {
      const p = pos.board[y][x];
      if (p) {
        if (empty) {boardStr += empty; empty=0;}
        boardStr += (p.promoted?'+':'') + (p.color==='b'?p.type:p.type.toLowerCase());
      } else empty++;
    }
    if (empty) boardStr += empty;
    if (y!==8) boardStr += '/';
  }
  // hands omitted for brevity
  return boardStr+' '+pos.turn+' -';
}

function generateMoves(pos, x, y) {
  const p = pos.board[y][x];
  if (!p) return [];
  const moves = [];
  const dir = p.color==='b'?-1:1;
  const add = (dx,dy,slide=false) => {
    let nx=x+dx, ny=y+dy;
    while(nx>=0&&nx<9&&ny>=0&&ny<9) {
      const target = pos.board[ny][nx];
      if(!target) {
        moves.push({from:{x,y},to:{x:nx,y:ny}});
      } else {
        if(target.color!==p.color) moves.push({from:{x,y},to:{x:nx,y:ny},capture:true});
        break;
      }
      if(!slide) break;
      nx+=dx; ny+=dy;
    }
  };
  switch(p.type+(p.promoted?'+':'')) {
    case 'P':
      add(0,dir);break;
    case 'P+':
    case 'L+':
    case 'N+':
    case 'S+':
      [[0,dir],[1,0],[-1,0],[0,-dir],[1,dir],[-1,dir]].forEach(d=>add(d[0],d[1]));
      break;
    case 'L': add(0,dir,true);break;
    case 'N': add(-1,2*dir);add(1,2*dir);break;
    case 'S': [[0,dir],[1,dir],[-1,dir],[1,-dir],[-1,-dir]].forEach(d=>add(d[0],d[1]));break;
    case 'G': [[0,dir],[1,0],[-1,0],[0,-dir],[1,dir],[-1,dir]].forEach(d=>add(d[0],d[1]));break;
    case 'B': add(1,1,true);add(1,-1,true);add(-1,1,true);add(-1,-1,true);break;
    case 'B+': add(1,1,true);add(1,-1,true);add(-1,1,true);add(-1,-1,true);[[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>add(d[0],d[1]));break;
    case 'R': add(1,0,true);add(-1,0,true);add(0,1,true);add(0,-1,true);break;
    case 'R+': add(1,0,true);add(-1,0,true);add(0,1,true);add(0,-1,true);[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(d=>add(d[0],d[1]));break;
    case 'K': [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(d=>add(d[0],d[1]));break;
  }
  return moves;
}
