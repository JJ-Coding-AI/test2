let engine;

async function initEngine() {
  const response = await fetch('engine/yaneuraou.wasm');
  const wasm = await WebAssembly.instantiateStreaming(response, {});
  engine = wasm.instance.exports;
  postMessage({ type: 'ready' });
}

onmessage = async e => {
  const msg = e.data;
  if (msg.type === 'init') {
    initEngine();
  } else if (msg.type === 'go') {
    // Placeholder: actual USI not implemented
    // return random move
    postMessage({ type: 'bestmove', move: '' });
  }
};
