const { Chess } = require('chess.js');

const game = new Chess();
const boardEl = document.getElementById('board');
const PIECES = {
  w: { k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙' },
  b: { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' }
};
let orientation = 'w';
let selected = null;
let legalTargets = [];
let lastMove = null;
let hints = [];
let engineReady = false;
let currentDepth = 14;
let searchScore = 0;
let arrowLayer;

function message(text, error = false) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.style.color = error ? '#f38ba8' : '#f5c979';
}

function setupArrowLayer() {
  arrowLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowLayer.setAttribute('id', 'arrowLayer');
  arrowLayer.setAttribute('viewBox', '0 0 100 100');
  arrowLayer.setAttribute('preserveAspectRatio', 'none');
  document.querySelector('.board-wrap').appendChild(arrowLayer);
}
function squareCenter(square) {
  const file = 'abcdefgh'.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return {
    x: (orientation === 'w' ? file : 7 - file) * 12.5 + 6.25,
    y: (orientation === 'w' ? 7 - rank : rank) * 12.5 + 6.25
  };
}
function drawArrows() {
  arrowLayer.innerHTML = '';
  const ns = arrowLayer.namespaceURI;
  const defs = document.createElementNS(ns, 'defs');
  const colors = ['#f5c979', '#89b4fa', '#cba6f7'];
  colors.forEach((color, i) => {
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'arrowhead-' + i);
    marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5');
    marker.setAttribute('refX', '4'); marker.setAttribute('refY', '2.5');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M0,0 L5,2.5 L0,5 Z'); path.setAttribute('fill', color);
    marker.appendChild(path); defs.appendChild(marker);
  });
  arrowLayer.appendChild(defs);
  hints.slice(0, 3).forEach((hint, i) => {
    if (!hint?.from || !hint?.to) return;
    const a = squareCenter(hint.from), b = squareCenter(hint.to);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', colors[i]); line.setAttribute('stroke-width', i === 0 ? '1.7' : '1.2');
    line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', i === 0 ? '.95' : '.75');
    line.setAttribute('marker-end', 'url(#arrowhead-' + i + ')');
    arrowLayer.appendChild(line);
  });
}
function renderBoard() {
  boardEl.innerHTML = '';
  const files = orientation === 'w' ? 'abcdefgh'.split('') : 'hgfedcba'.split('');
  const ranks = orientation === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  for (const rank of ranks) {
    files.forEach((file, fi) => {
      const sq = file + rank;
      const fileIndex = 'abcdefgh'.indexOf(file);
      const el = document.createElement('div');
      el.className = 'square ' + ((fileIndex + rank) % 2 === 1 ? 'light' : 'dark');
      if (sq === selected) el.classList.add('selected');
      if (lastMove?.from === sq) el.classList.add('last-from');
      if (lastMove?.to === sq) el.classList.add('last-to');
      if (legalTargets.includes(sq)) el.classList.add(game.get(sq) ? 'capture' : 'legal');
      const piece = game.get(sq);
      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece'; span.textContent = PIECES[piece.color][piece.type];
        el.appendChild(span);
      }
      if (fi === 0) {
        const coord = document.createElement('span'); coord.className = 'coord';
        coord.textContent = rank; el.appendChild(coord);
      }
      if (rank === (orientation === 'w' ? 1 : 8)) {
        const coord = document.createElement('span'); coord.className = 'coord';
        coord.style.left = 'auto'; coord.style.right = '3px'; coord.textContent = file;
        el.appendChild(coord);
      }
      el.addEventListener('click', () => clickSquare(sq));
      boardEl.appendChild(el);
    });
  }
  drawArrows();
}
function clickSquare(sq) {
  const piece = game.get(sq);
  if (selected && legalTargets.includes(sq)) {
    try {
      const move = game.move({ from: selected, to: sq, promotion: 'q' });
      lastMove = { from: move.from, to: move.to };
      selected = null; legalTargets = []; hints = [];
      renderBoard(); updateFenInput(); analyze(); return;
    } catch (e) { message(e.message, true); }
  }
  if (piece && piece.color === game.turn()) {
    selected = sq;
    legalTargets = game.moves({ square: sq, verbose: true }).map(m => m.to);
  } else { selected = null; legalTargets = []; }
  renderBoard();
}
function send(command) { window.chessHelper.sendEngineCommand(command); }
function analyze() {
  hints = []; renderMoves();
  if (!engineReady) { document.getElementById('engineStatus').textContent = 'Starting engine…'; return; }
  document.getElementById('engineStatus').textContent = 'Analyzing…';
  send('stop'); send('position fen ' + game.fen()); send('go depth ' + currentDepth);
  renderBoard();
}
function parseInfo(line) {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return;
  const multiMatch = line.match(/\bmultipv\s+(\d+)/);
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (!scoreMatch) return;
  const uci = line.split(' pv ')[1].trim().split(/\s+/)[0];
  if (!uci || uci.length < 4) return;
  const multi = multiMatch ? Number(multiMatch[1]) : 1;
  const turn = game.turn();
  let score = Number(scoreMatch[2]);
  if (scoreMatch[1] === 'cp') score /= 100;
  if (turn === 'b') score = -score;
  const temp = new Chess(game.fen());
  let san = uci;
  try {
    san = temp.move({ from: uci.slice(0,2), to: uci.slice(2,4), ...(uci[4] ? { promotion: uci[4] } : {}) }).san;
  } catch {}
  hints[multi - 1] = {
    from: uci.slice(0,2), to: uci.slice(2,4), san, score,
    scoreType: scoreMatch[1],
    mate: scoreMatch[1] === 'mate' ? Number(scoreMatch[2]) * (turn === 'b' ? -1 : 1) : null,
    depth: depthMatch ? Number(depthMatch[1]) : 0
  };
  if (multi === 1) updateEval(score, hints[0]);
  renderMoves(); renderBoard();
}
function updateEval(score, hint) {
  const pct = hint?.scoreType === 'mate' ? (score > 0 ? 96 : score < 0 ? 4 : 50) :
    Math.max(3, Math.min(97, 50 + 47 * Math.tanh(score / 3.5)));
  document.getElementById('evalBar').style.width = pct + '%';
  const label = hint?.scoreType === 'mate' ? 'Mate ' + (hint.mate > 0 ? '+' : '') + hint.mate :
    (score > 0 ? '+' : '') + score.toFixed(2);
  document.getElementById('evalText').textContent = label + (game.turn() === 'w' ? ' · White to move' : ' · Black to move');
}
function renderMoves() {
  const el = document.getElementById('moves');
  const good = hints.map((h, index) => h ? { ...h, index } : null).filter(Boolean);
  if (!good.length) { el.innerHTML = '<div class="empty">Waiting for engine analysis…</div>'; return; }
  el.innerHTML = '';
  good.forEach((h, i) => {
    const row = document.createElement('div'); row.className = 'move-row' + (i === 0 ? ' best' : '');
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = (i + 1) + '.';
    const move = document.createElement('div');
    const san = document.createElement('div'); san.className = 'move-san'; san.textContent = h.san;
    const depth = document.createElement('span'); depth.className = 'move-hint'; depth.textContent = 'Depth ' + h.depth;
    move.append(san, depth);
    const score = document.createElement('span'); score.className = 'move-score';
    score.textContent = h.scoreType === 'mate' ? 'M' + h.mate : (h.score > 0 ? '+' : '') + h.score.toFixed(2);
    row.append(rank, move, score);
    row.addEventListener('click', () => { hints = [h, ...good.filter(other => other.index !== h.index)].slice(0,3); renderBoard(); });
    el.appendChild(row);
  });
}
function updateFenInput() { document.getElementById('fenInput').value = game.fen(); }
function resetGame() {
  game.reset(); selected = null; legalTargets = []; lastMove = null; hints = [];
  updateFenInput(); renderBoard(); analyze(); message('Starting position restored.');
}
function undoMove() {
  const move = game.undo();
  if (!move) { message('No move to undo.', true); return; }
  selected = null; legalTargets = []; hints = [];
  const history = game.history({ verbose: true });
  lastMove = history.length ? { from: history.at(-1).from, to: history.at(-1).to } : null;
  updateFenInput(); renderBoard(); analyze(); message('Move undone.');
}
function loadFen() {
  const fen = document.getElementById('fenInput').value.trim();
  try {
    const test = new Chess(fen);
    game.load(test.fen());
    selected = null; legalTargets = []; lastMove = null; hints = [];
    renderBoard(); updateFenInput(); analyze(); message('FEN loaded successfully.');
  } catch (e) { message('Invalid FEN: ' + e.message, true); }
}
window.chessHelper.onEngineLine((line) => {
  if (typeof line !== 'string') line = String(line);
  if (line === 'readyok') {
    engineReady = true;
    const status = document.getElementById('engineStatus');
    status.textContent = 'Stockfish ready'; status.classList.add('ready');
    analyze();
  }
  if (line.startsWith('info ')) parseInfo(line);
  if (line.startsWith('bestmove')) document.getElementById('engineStatus').textContent = 'Analysis complete';
});
document.getElementById('whiteBtn').addEventListener('click', () => {
  orientation = 'w'; document.getElementById('whiteBtn').classList.add('selected');
  document.getElementById('blackBtn').classList.remove('selected'); renderBoard();
});
document.getElementById('blackBtn').addEventListener('click', () => {
  orientation = 'b'; document.getElementById('blackBtn').classList.add('selected');
  document.getElementById('whiteBtn').classList.remove('selected'); renderBoard();
});
document.getElementById('undoBtn').addEventListener('click', undoMove);
document.getElementById('resetBtn').addEventListener('click', resetGame);
document.getElementById('closeBtn').addEventListener('click', () => window.chessHelper.hideWindow());
document.getElementById('minimizeBtn').addEventListener('click', () => window.chessHelper.hideWindow());
document.getElementById('depth').addEventListener('input', e => {
  currentDepth = Number(e.target.value); document.getElementById('depthValue').textContent = currentDepth;
});
document.getElementById('depth').addEventListener('change', analyze);
document.getElementById('loadFenBtn').addEventListener('click', loadFen);
document.getElementById('copyFenBtn').addEventListener('click', () => {
  window.chessHelper.copyText(game.fen()); message('Current FEN copied to clipboard.');
});
document.getElementById('fenInput').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') loadFen();
});
setupArrowLayer(); updateFenInput(); renderBoard();
