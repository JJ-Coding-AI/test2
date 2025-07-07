import Board from './Board.js';
import Engine from './Engine.js';

const boardElem = document.getElementById('board');
const board = new Board(boardElem);
const levelSelect = document.getElementById('level');
const turnSpan = document.getElementById('turn');
const messageDiv = document.getElementById('message');
const undoBtn = document.getElementById('undo');
const resetBtn = document.getElementById('reset');

let engine = new Engine(parseInt(levelSelect.value));
engine.init();
engine.onBestMove = move => {
  messageDiv.textContent = '';
  // TODO: apply best move
};

levelSelect.addEventListener('change', () => {
  engine = new Engine(parseInt(levelSelect.value));
  engine.init();
});

undoBtn.addEventListener('click', () => {
  board.undo();
});

resetBtn.addEventListener('click', () => {
  board.reset();
});

boardElem.addEventListener('drop', () => {
  turnSpan.textContent = board.side === 'b' ? '先手番' : '後手番';
  messageDiv.textContent = 'AI 思考中...';
  engine.go(board.getSFEN(), []);
});
