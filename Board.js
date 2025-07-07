const LETTERS = 'abcdefghi';

function pieceChar(piece) {
  const map = {
    P: '歩', L: '香', N: '桂', S: '銀', G: '金',
    B: '角', R: '飛', K: '玉',
    '+P': 'と', '+L': '杏', '+N': '圭', '+S': '全',
    '+B': '馬', '+R': '龍'
  };
  const key = piece.promoted ? '+' + piece.type : piece.type;
  return map[key] || '';
}

export default class Board {
  constructor(elem) {
    this.elem = elem;
    this.reset();
  }

  reset() {
    this.side = 'b';
    this.hands = { b: {}, w: {} };
    this.history = [];
    this.board = this.parseSFEN(
      'lnsgkgsnl/1r5b1/p1ppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL'
    );
    this.render();
  }

  parseSFEN(str) {
    const rows = str.split('/');
    const board = [];
    for (let y = 0; y < 9; y++) {
      const row = [];
      let idx = 0;
      for (const ch of rows[y]) {
        if (/[1-9]/.test(ch)) {
          const cnt = parseInt(ch, 10);
          for (let i = 0; i < cnt; i++) row.push(null);
        } else {
          const owner = ch === ch.toUpperCase() ? 'b' : 'w';
          row.push({ type: ch.toUpperCase(), owner, promoted: false });
        }
        idx++;
      }
      board.push(row);
    }
    return board;
  }

  render() {
    this.elem.innerHTML = '';
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.addEventListener('dragover', e => e.preventDefault());
        cell.addEventListener('drop', e => this.onDrop(e));
        const p = this.board[y][x];
        if (p) {
          const div = document.createElement('div');
          div.className = 'piece ' + p.owner;
          div.draggable = true;
          div.dataset.x = x;
          div.dataset.y = y;
          div.addEventListener('dragstart', e => this.onDragStart(e));
          div.textContent = pieceChar(p);
          cell.appendChild(div);
        }
        this.elem.appendChild(cell);
      }
    }
  }

  onDragStart(e) {
    const x = e.target.dataset.x;
    const y = e.target.dataset.y;
    e.dataTransfer.setData('text/plain', JSON.stringify({ x, y }));
    const moves = this.legalMoves(parseInt(x), parseInt(y));
    this.highlight(moves);
  }

  onDrop(e) {
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const toX = parseInt(e.currentTarget.dataset.x);
    const toY = parseInt(e.currentTarget.dataset.y);
    const fromX = parseInt(data.x);
    const fromY = parseInt(data.y);
    const moves = this.legalMoves(fromX, fromY);
    if (moves.some(m => m.x === toX && m.y === toY)) {
      this.move(fromX, fromY, toX, toY);
    }
    this.clearHighlight();
  }

  move(fx, fy, tx, ty) {
    const piece = this.board[fy][fx];
    this.board[fy][fx] = null;
    const captured = this.board[ty][tx];
    if (captured) {
      captured.owner = piece.owner;
      captured.promoted = false;
      this.addHand(piece.owner, captured.type);
    }
    this.board[ty][tx] = piece;
    this.history.push({ fx, fy, tx, ty, captured });
    this.side = this.side === 'b' ? 'w' : 'b';
    this.render();
  }

  undo() {
    const last = this.history.pop();
    if (!last) return;
    const { fx, fy, tx, ty, captured } = last;
    const piece = this.board[ty][tx];
    this.board[fy][fx] = piece;
    this.board[ty][tx] = captured || null;
    if (captured) {
      this.hands[piece.owner][captured.type]--;
    }
    this.side = this.side === 'b' ? 'w' : 'b';
    this.render();
    this.updateHands();
  }

  addHand(owner, type) {
    this.hands[owner][type] = (this.hands[owner][type] || 0) + 1;
    this.updateHands();
  }

  updateHands() {
    const bdiv = document.getElementById('hand-b');
    const wdiv = document.getElementById('hand-w');
    bdiv.textContent = '先手持ち駒: ' + this.formatHand(this.hands.b);
    wdiv.textContent = '後手持ち駒: ' + this.formatHand(this.hands.w);
  }

  getSFEN() {
    let rows = [];
    for (let y = 0; y < 9; y++) {
      let empty = 0;
      let row = '';
      for (let x = 0; x < 9; x++) {
        const p = this.board[y][x];
        if (!p) {
          empty++;
        } else {
          if (empty) { row += empty; empty = 0; }
          const ch = p.type;
          row += p.owner === 'b' ? ch : ch.toLowerCase();
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    const hand = this.formatSFENHand();
    return `${rows.join('/')}` + ` ${this.side === 'b' ? 'b' : 'w'} ${hand || '-'}`;
  }

  formatSFENHand() {
    const order = ['R','B','G','S','N','L','P'];
    let str = '';
    for (const owner of ['b','w']) {
      for (const p of order) {
        const c = this.hands[owner][p] || 0;
        if (c) str += (c > 1 ? c : '') + (owner === 'b' ? p : p.toLowerCase());
      }
    }
    return str;
  }

  formatHand(hand) {
    return Object.entries(hand)
      .map(([k, v]) => pieceChar({ type: k, owner: 'b' }) + (v > 1 ? v : ''))
      .join(' ');
  }

  highlight(moves) {
    for (const m of moves) {
      const selector = `.cell[data-x="${m.x}"][data-y="${m.y}"]`;
      const cell = this.elem.querySelector(selector);
      if (cell) cell.classList.add('highlight');
    }
  }

  clearHighlight() {
    this.elem.querySelectorAll('.highlight').forEach(c => c.classList.remove('highlight'));
  }

  legalMoves(x, y) {
    const p = this.board[y][x];
    if (!p || p.owner !== this.side) return [];
    const dirs = this.getPieceMoves(p);
    const moves = [];
    for (const d of dirs.steps || []) {
      const dx = d[0];
      const dy = p.owner === 'b' ? d[1] : -d[1];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= 9 || ny < 0 || ny >= 9) continue;
      const target = this.board[ny][nx];
      if (!target || target.owner !== p.owner) moves.push({ x: nx, y: ny });
    }
    for (const d of dirs.slides || []) {
      const dx = d[0];
      const dy = p.owner === 'b' ? d[1] : -d[1];
      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
        const target = this.board[ny][nx];
        if (!target) {
          moves.push({ x: nx, y: ny });
        } else {
          if (target.owner !== p.owner) moves.push({ x: nx, y: ny });
          break;
        }
        nx += dx;
        ny += dy;
      }
    }
    for (const d of dirs.jumps || []) {
      const dx = d[0];
      const dy = p.owner === 'b' ? d[1] : -d[1];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= 9 || ny < 0 || ny >= 9) continue;
      const target = this.board[ny][nx];
      if (!target || target.owner !== p.owner) moves.push({ x: nx, y: ny });
    }
    return moves;
  }

  getPieceMoves(piece) {
    const G = { steps: [[0,-1],[-1,-1],[1,-1],[-1,0],[1,0],[0,1]] };
    const data = {
      P: { steps: [[0,-1]] },
      L: { slides: [[0,-1]] },
      N: { jumps: [[-1,-2],[1,-2]] },
      S: { steps: [[0,-1],[-1,-1],[1,-1],[-1,1],[1,1]] },
      G,
      B: { slides: [[-1,-1],[1,-1],[-1,1],[1,1]] },
      R: { slides: [[0,-1],[0,1],[-1,0],[1,0]] },
      K: { steps: [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]] },
      '+P': G,
      '+L': G,
      '+N': G,
      '+S': G,
      '+B': { slides: [[-1,-1],[1,-1],[-1,1],[1,1]], steps: [[0,-1],[0,1],[-1,0],[1,0]] },
      '+R': { slides: [[0,-1],[0,1],[-1,0],[1,0]], steps: [[-1,-1],[1,-1],[-1,1],[1,1]] }
    };
    return data[piece.promoted ? '+' + piece.type : piece.type] || { steps: [] };
  }
}
