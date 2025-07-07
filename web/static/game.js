let state = null;
let dragFrom = null;

async function fetchState() {
  const res = await fetch('/state');
  state = await res.json();
  render();
}

function cellId(x,y){return `c${x}_${y}`;}

function render(){
  const b=document.getElementById('board');
  b.innerHTML='';
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const d=document.createElement('div');
      d.className='cell';
      d.id=cellId(x,y);
      d.dataset.x=x;d.dataset.y=y;
      const p=state.board[y][x];
      if(p){
        const span=document.createElement('span');
        span.textContent=p.k;
        if(p.o===1) span.classList.add('p1');
        span.draggable=true;
        span.addEventListener('dragstart',e=>dragStart(e,x,y));
        d.appendChild(span);
      }
      d.addEventListener('dragover',dragOver);
      d.addEventListener('drop',e=>drop(e,x,y));
      b.appendChild(d);
    }
  }
  document.getElementById('hand0').textContent=state.hands[0].map(p=>p.k).join(' ');
  document.getElementById('hand1').textContent=state.hands[1].map(p=>p.k).join(' ');
}

function clearHighlight(){
  document.querySelectorAll('.cell.highlight').forEach(c=>c.classList.remove('highlight'));
}

async function dragStart(e,x,y){
  dragFrom=[x,y];
  const res=await fetch(`/moves?x=${x}&y=${y}`);
  const moves=await res.json();
  clearHighlight();
  moves.forEach(m=>{
    const c=document.getElementById(cellId(m[0],m[1]));
    if(c) c.classList.add('highlight');
  });
}

function dragOver(e){e.preventDefault();}

async function drop(e,x,y){
  e.preventDefault();
  if(!dragFrom){return;}
  clearHighlight();
  const res=await fetch('/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:dragFrom,to:[x,y]})});
  state=await res.json();
  dragFrom=null;
  render();
}

document.getElementById('undo').addEventListener('click',async()=>{
  const res=await fetch('/undo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  state=await res.json();
  render();
});

fetchState();
