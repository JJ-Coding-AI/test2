const boardElement = document.getElementById('board');
const playerHandElement = document.getElementById('player-hand');
const cpuHandElement = document.getElementById('cpu-hand');
const resetButton = document.getElementById('reset');

const PIECES = {
    K: '玉',
    R: '飛',
    B: '角',
    G: '金',
    S: '銀',
    N: '桂',
    L: '香',
    P: '歩'
};

let board, playerHand, cpuHand, selected, gameOver;

function initGame() {
    board = [
        [ {type:'L', owner:'G'}, {type:'N', owner:'G'}, {type:'S', owner:'G'}, {type:'G', owner:'G'}, {type:'K', owner:'G'}, {type:'G', owner:'G'}, {type:'S', owner:'G'}, {type:'N', owner:'G'}, {type:'L', owner:'G'} ],
        [ null, {type:'R', owner:'G'}, null, null, null, null, null, {type:'B', owner:'G'}, null ],
        [ {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'}, {type:'P', owner:'G'} ],
        [ null, null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null, null ],
        [ null, null, null, null, null, null, null, null, null ],
        [ {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'}, {type:'P', owner:'S'} ],
        [ null, {type:'B', owner:'S'}, null, null, null, null, null, {type:'R', owner:'S'}, null ],
        [ {type:'L', owner:'S'}, {type:'N', owner:'S'}, {type:'S', owner:'S'}, {type:'G', owner:'S'}, {type:'K', owner:'S'}, {type:'G', owner:'S'}, {type:'S', owner:'S'}, {type:'N', owner:'S'}, {type:'L', owner:'S'} ]
    ];
    playerHand = [];
    cpuHand = [];
    selected = null;
    gameOver = false;
    render();
}

function render() {
    boardElement.innerHTML = '';
    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            const piece = board[y][x];
            if (piece) {
                cell.textContent = PIECES[piece.type];
                if (piece.owner === 'G') {
                    cell.classList.add('gote');
                }
            }
            if (selected && selected.x === x && selected.y === y) {
                cell.classList.add('selected');
            }
            cell.addEventListener('click', () => handleCellClick(x, y));
            boardElement.appendChild(cell);
        }
    }
    playerHandElement.textContent = '持ち駒: ' + playerHand.map(p => PIECES[p]).join(' ');
    cpuHandElement.textContent = '相手の持ち駒: ' + cpuHand.map(p => PIECES[p]).join(' ');
}

function handleCellClick(x, y) {
    if (gameOver) return;
    const piece = board[y][x];
    if (selected) {
        if (movePiece(selected.x, selected.y, x, y)) {
            selected = null;
            render();
            setTimeout(cpuTurn, 500);
        } else {
            selected = null;
            render();
        }
    } else if (piece && piece.owner === 'S') {
        selected = {x, y};
        render();
    }
}

function movePiece(sx, sy, dx, dy) {
    const piece = board[sy][sx];
    if (!piece || piece.owner !== 'S') return false;
    const moves = getLegalMoves(sx, sy, piece);
    if (!moves.some(m => m.x === dx && m.y === dy)) return false;
    const target = board[dy][dx];
    if (target) {
        cpuHand.push(target.type);
    }
    board[dy][dx] = piece;
    board[sy][sx] = null;
    if (target && target.type === 'K') {
        alert('あなたの勝ち！');
        gameOver = true;
    }
    return true;
}

function cpuTurn() {
    if (gameOver) return;
    const moves = [];
    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (piece && piece.owner === 'G') {
                const legal = getLegalMoves(x, y, piece);
                legal.forEach(m => moves.push({sx:x, sy:y, dx:m.x, dy:m.y}));
            }
        }
    }
    if (moves.length === 0) {
        alert('あなたの勝ち！');
        gameOver = true;
        return;
    }
    const move = moves[Math.floor(Math.random() * moves.length)];
    const target = board[move.dy][move.dx];
    if (target) {
        playerHand.push(target.type);
    }
    board[move.dy][move.dx] = board[move.sy][move.sx];
    board[move.sy][move.sx] = null;
    if (target && target.type === 'K') {
        alert('あなたの負け...');
        gameOver = true;
    }
    render();
}

function getLegalMoves(x, y, piece) {
    const dirs = {
        K: [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]],
        R: [[1,0],[-1,0],[0,1],[0,-1]],
        B: [[1,1],[1,-1],[-1,1],[-1,-1]],
        G: [[1,0],[0,1],[-1,0],[1,-1],[0,-1],[-1,-1]],
        S: [[1,1],[0,1],[-1,1],[1,-1],[-1,-1]],
        N: [[1,2],[-1,2]],
        L: [[0,1]],
        P: [[0,1]]
    };
    const result = [];
    const forward = piece.owner === 'S' ? -1 : 1;
    const vectors = dirs[piece.type];
    vectors.forEach(v => {
        let nx = x + v[0];
        let ny = y + v[1] * (piece.type === 'N' || piece.type === 'L' || piece.type === 'P' ? forward : 1);
        if (piece.type !== 'N' && piece.type !== 'L' && piece.type !== 'P') {
            for (let step = 1; ; step++) {
                nx = x + v[0]*step;
                ny = y + v[1]*step*(piece.type === 'B' || piece.type === 'R' || piece.type === 'L' ? 1 : forward);
                if (piece.owner === 'S') ny = y + v[1]*step*forward;
                if (nx < 0 || nx >= 9 || ny < 0 || ny >= 9) break;
                const target = board[ny][nx];
                if (target && target.owner === piece.owner) break;
                result.push({x:nx, y:ny});
                if (target) break;
                if (piece.type !== 'B' && piece.type !== 'R' && piece.type !== 'L') break;
            }
        } else {
            if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
                const target = board[ny][nx];
                if (!target || target.owner !== piece.owner) {
                    result.push({x:nx, y:ny});
                }
            }
        }
    });
    return result;
}

resetButton.addEventListener('click', initGame);
initGame();
