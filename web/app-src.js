import { Chess } from 'chess.js';

const game = new Chess();
const $ = (id) => document.getElementById(id);
const PIECES = { w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'}, b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'} };
let orientation = 'w', selected = null, legalTargets = [], lastMove = null, hints = [];
let engineReady = false, currentDepth = 14, bestScore = 0, preferredHint = null;
const worker = new Worker('./vendor/stockfish-19-lite-single.js');
const arrowSvg = $('arrows');

function say(text, error=false) { $('message').textContent=text; $('message').style.color=error?'#f38ba8':'#f5c979'; }
function setStatus(text, state='') { const el=$('engineStatus'); el.textContent=text; el.className='status '+state; }
function engine(command) { worker.postMessage(command); }

function center(square) {
  const f='abcdefgh'.indexOf(square[0]), r=Number(square[1])-1;
  return {x:(orientation==='w'?f:7-f)*12.5+6.25,y:(orientation==='w'?7-r:r)*12.5+6.25};
}
function drawArrows() {
  arrowSvg.replaceChildren();
  const ns='http://www.w3.org/2000/svg', defs=document.createElementNS(ns,'defs');
  const colors=['#f5c979','#89b4fa','#cba6f7'];
  colors.forEach((color,i)=>{const marker=document.createElementNS(ns,'marker');marker.setAttribute('id','arrowhead-'+i);marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','5');marker.setAttribute('refX','4');marker.setAttribute('refY','2.5');marker.setAttribute('orient','auto');const p=document.createElementNS(ns,'path');p.setAttribute('d','M0,0 L5,2.5 L0,5 Z');p.setAttribute('fill',color);marker.appendChild(p);defs.appendChild(marker);});
  arrowSvg.appendChild(defs);
  const list=preferredHint?[preferredHint,...hints.filter(h=>h&&h!==preferredHint)]:hints;
  list.slice(0,3).forEach((h,i)=>{if(!h?.from||!h?.to)return;const a=center(h.from),b=center(h.to),line=document.createElementNS(ns,'line');line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);line.setAttribute('stroke',colors[i]);line.setAttribute('stroke-width',i===0?'1.7':'1.15');line.setAttribute('stroke-linecap','round');line.setAttribute('opacity',i===0?'.96':'.72');line.setAttribute('marker-end','url(#arrowhead-'+i+')');arrowSvg.appendChild(line);});
}
function renderBoard() {
  $('board').replaceChildren();
  const files=(orientation==='w'?'abcdefgh':'hgfedcba').split('');
  const ranks=orientation==='w'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  for(const rank of ranks) files.forEach((file,fi)=>{
    const sq=file+rank, fileIndex='abcdefgh'.indexOf(file), el=document.createElement('div');
    el.className='square '+((fileIndex+rank)%2===1?'light':'dark');
    if(sq===selected)el.classList.add('selected');
    if(lastMove?.from===sq||lastMove?.to===sq)el.classList.add(sq===lastMove.from?'last-from':'last-to');
    if(legalTargets.includes(sq))el.classList.add(game.get(sq)?'capture':'legal');
    const piece=game.get(sq);if(piece){const span=document.createElement('span');span.className='piece';span.textContent=PIECES[piece.color][piece.type];el.appendChild(span);}
    if(fi===0){const c=document.createElement('span');c.className='coord';c.textContent=rank;el.appendChild(c);}
    if(rank===(orientation==='w'?1:8)){const c=document.createElement('span');c.className='coord';c.style.left='auto';c.style.right='4px';c.textContent=file;el.appendChild(c);}
    el.addEventListener('click',()=>clickSquare(sq));$('board').appendChild(el);
  });
  drawArrows();
}
function clickSquare(sq) {
  const piece=game.get(sq);
  if(selected&&legalTargets.includes(sq)){
    try{const m=game.move({from:selected,to:sq,promotion:'q'});lastMove={from:m.from,to:m.to};selected=null;legalTargets=[];hints=[];preferredHint=null;renderBoard();syncFen();analyze();return;}catch(e){say(e.message,true);}
  }
  if(piece&&piece.color===game.turn()){selected=sq;legalTargets=game.moves({square:sq,verbose:true}).map(m=>m.to);}else{selected=null;legalTargets=[];}
  renderBoard();
}
function syncFen(){$('fenInput').value=game.fen();}
function analyze(){
  hints=[];preferredHint=null;renderMoves();
  if(!engineReady){setStatus('Loading Stockfish…');return;}
  if(game.isGameOver()){setStatus('Game over');updateEval(0,null);return;}
  setStatus('Analyzing…');engine('stop');engine('position fen '+game.fen());engine('go depth '+currentDepth);renderBoard();
}
function parseInfo(line){
  if(!line.startsWith('info ')||!line.includes(' pv '))return;
  const sm=line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);if(!sm)return;
  const mm=line.match(/\bmultipv\s+(\d+)/),dm=line.match(/\bdepth\s+(\d+)/);
  const uci=line.split(' pv ')[1].trim().split(/\s+/)[0];if(!uci||uci.length<4)return;
  const multi=mm?Number(mm[1]):1,turn=game.turn();let score=Number(sm[2]);if(sm[1]==='cp')score/=100;if(turn==='b')score=-score;
  const temp=new Chess(game.fen());let san=uci;
  try{san=temp.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})}).san;}catch{}
  hints[multi-1]={from:uci.slice(0,2),to:uci.slice(2,4),san,score,scoreType:sm[1],mate:sm[1]==='mate'?Number(sm[2])*(turn==='b'?-1:1):null,depth:dm?Number(dm[1]):0};
  if(multi===1){bestScore=score;updateEval(score,hints[0]);}
  renderMoves();drawArrows();
}
function updateEval(score,h){
  const pct=h?.scoreType==='mate'?(score>0?96:score<0?4:50):Math.max(3,Math.min(97,50+47*Math.tanh(score/3.5)));
  $('evalBar').style.width=pct+'%';
  const text=h?.scoreType==='mate'?'Mate '+(h.mate>0?'+':'')+h.mate:(score>0?'+':'')+score.toFixed(2);
  $('evalText').textContent=text;
}
function renderMoves(){
  const el=$('moves');el.replaceChildren();const list=hints.map((h,index)=>h?{...h,index}:null).filter(Boolean);
  if(!list.length){const p=document.createElement('p');p.className='muted';p.textContent='Waiting for engine analysis…';el.appendChild(p);return;}
  list.forEach((h,i)=>{const row=document.createElement('div');row.className='move-row'+(i===0?' best':'');
    const rank=document.createElement('span');rank.className='rank';rank.textContent=(i+1)+'.';
    const move=document.createElement('div'),san=document.createElement('div'),depth=document.createElement('span');
    san.className='move-san';san.textContent=h.san;depth.className='move-hint';depth.textContent='Depth '+h.depth;move.append(san,depth);
    const score=document.createElement('span');score.className='move-score';score.textContent=h.scoreType==='mate'?'M'+h.mate:(h.score>0?'+':'')+h.score.toFixed(2);
    row.append(rank,move,score);row.addEventListener('click',()=>{preferredHint=h;drawArrows();});el.appendChild(row);
  });
}
function reset(){game.reset();selected=null;legalTargets=[];lastMove=null;hints=[];syncFen();renderBoard();analyze();say('Starting position restored.');}
function undo(){const m=game.undo();if(!m){say('No move to undo.',true);return;}selected=null;legalTargets=[];hints=[];preferredHint=null;const hist=game.history({verbose:true});lastMove=hist.length?{from:hist.at(-1).from,to:hist.at(-1).to}:null;syncFen();renderBoard();analyze();say('Move undone.');}
function loadFen(){try{const next=new Chess($('fenInput').value.trim());game.load(next.fen());selected=null;legalTargets=[];lastMove=null;hints=[];preferredHint=null;syncFen();renderBoard();analyze();say('FEN loaded.');}catch(e){say('Invalid FEN: '+e.message,true);}}

worker.onmessage=(event)=>{
  const line=typeof event.data==='string'?event.data:String(event.data);
  if(line==='uciok'){engine('setoption name MultiPV value 3');engine('isready');}
  else if(line==='readyok'){engineReady=true;setStatus('Stockfish ready','ready');analyze();}
  else if(line.startsWith('info '))parseInfo(line);
  else if(line.startsWith('bestmove'))setStatus('Analysis complete','ready');
};
worker.onerror=(event)=>{setStatus('Engine failed to load','error');say('Stockfish could not load. Refresh the page and check that both engine JS and WASM files are deployed.',true);console.error('Stockfish worker error',event);};
$('whiteBtn').addEventListener('click',()=>{orientation='w';$('whiteBtn').classList.add('selected');$('blackBtn').classList.remove('selected');renderBoard();});
$('blackBtn').addEventListener('click',()=>{orientation='b';$('blackBtn').classList.add('selected');$('whiteBtn').classList.remove('selected');renderBoard();});
$('undoBtn').addEventListener('click',undo);$('resetBtn').addEventListener('click',reset);
$('depth').addEventListener('input',e=>{$('depthValue').textContent=e.target.value;currentDepth=Number(e.target.value);});
$('depth').addEventListener('change',analyze);$('loadFenBtn').addEventListener('click',loadFen);
$('copyFenBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(game.fen());say('Current FEN copied.');}catch{ $('fenInput').focus();$('fenInput').select();say('Clipboard access blocked; select and copy the FEN text.');}});
$('fenInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')loadFen();});
syncFen();renderBoard();engine('uci');
