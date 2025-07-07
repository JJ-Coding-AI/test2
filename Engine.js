export default class Engine {
  constructor(depth = 4) {
    this.depth = depth;
    this.worker = new Worker('engineWorker.js', { type: 'module' });
  }

  async init() {
    return new Promise(resolve => {
      this.worker.onmessage = e => {
        if (e.data.type === 'ready') resolve();
        if (e.data.type === 'bestmove' && this.onBestMove) this.onBestMove(e.data.move);
      };
      this.worker.postMessage({ type: 'init' });
    });
  }

  go(sfen, moves) {
    this.worker.postMessage({ type: 'go', sfen, moves, depth: this.depth });
  }
}
