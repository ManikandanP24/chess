(() => {
  if (window.__chessHelperInstalled) return;
  window.__chessHelperInstalled = true;

  const PIECES = {wk:'K',wq:'Q',wr:'R',wb:'B',wn:'N',wp:'P',bk:'k',bq:'q',br:'r',bb:'b',bn:'n',bp:'p'};
  let panel, worker, arrow, currentFen = '', lastMove = null, auto = true, depth = 12, busy = false, pending = null, ready = false, uciReady = false;
  const style = document.createElement('style');
  style.textContent = `
    #ch-helper-panel{position:fixed;right:16px;top:115px;width:250px;z-index:2147483647;background:#171923;color:#edf0f6;border:1px solid #42485b;border-radius:13px;box-shadow:0 10px 35px #0008;font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
    #ch-helper-panel *{box-sizing:border-box}#ch-helper-panel .ch-head{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid #34394a;cursor:move}
    #ch-helper-panel .ch-logo{font-size:24px;color:#f5c979}#ch-helper-panel .ch-title{font-weight:800;font-size:14px;flex:1}#ch-helper-panel .ch-sub{font-size:9px;letter-spacing:1px;color:#a4abc0}
    #ch-helper-panel button{border:0;border-radius:7px;padding:8px 10px;font-weight:700;cursor:pointer;background:#f5c979;color:#171923}
    #ch-helper-panel .ch-close{background:#2b3040;color:#dfe3ee;padding:4px 8px}
    #ch-helper-panel .ch-body{padding:12px}#ch-helper-panel .ch-primary{width:100%;font-size:13px}#ch-helper-panel .ch-status{margin:10px 0;color:#f5c979;min-height:18px;font-size:12px}
    #ch-helper-panel .ch-result{padding:10px;border-radius:8px;background:#252a3a;margin-bottom:10px}#ch-helper-panel .ch-move{font-size:21px;font-weight:800;color:#f5c979}#ch-helper-panel .ch-muted{color:#a4abc0;font-size:11px}
    #ch-helper-panel .ch-depth{display:flex;justify-content:space-between;align-items:center;margin:10px 0 5px}#ch-helper-panel input[type=range]{width:100%;accent-color:#f5c979}
    #ch-helper-panel .ch-toggle{display:flex;align-items:center;gap:7px;margin-top:11px;font-size:12px}#ch-helper-panel input[type=checkbox]{accent-color:#f5c979}
    #ch-helper-panel .ch-footer{font-size:10px;color:#9098ad;margin-top:9px}
    #ch-helper-panel.ch-min .ch-body{display:none}
  `;
  document.documentElement.appendChild(style);

  function findBoard(){return document.querySelector('.board')||document.querySelector('[data-board]');}
  function getPosition(){
    const board=findBoard(); if(!board)return null;
    const cells=Array.from({length:8},()=>Array(8).fill(''));let count=0;
    for(const p of board.querySelectorAll('.piece')){
      const cls=[...p.classList], piece=cls.find(c=>PIECES[c]);
      const sm=cls.map(c=>c.match(/^square-(\d)(\d)$/)).find(Boolean);
      if(!piece||!sm)continue;
      const file=+sm[1]-1,rank=+sm[2]-1;if(file<0||file>7||rank<0||rank>7)continue;
      cells[7-rank][file]=PIECES[piece];count++;
    }
    if(count<2)return null;
    const placement=cells.map(row=>{let s='',n=0;for(const c of row){if(!c)n++;else{if(n)s+=n;s+=c;n=0;}}if(n)s+=n;return s;}).join('/');
    const white=document.querySelector('.clock-bottom.clock-player-turn, .clock-bottom .clock-player-turn');
    const black=document.querySelector('.clock-top.clock-player-turn, .clock-top .clock-player-turn');
    const turn=white?'w':black?'b':'w';
    return {fen:placement+' '+turn+' - - 0 1',count};
  }
  function makePanel(){
    panel=document.createElement('section');panel.id='ch-helper-panel';
    panel.innerHTML='<header class="ch-head"><span class="ch-logo">♞</span><div style="flex:1"><div class="ch-title">Chess Helper</div><div class="ch-sub">BEST MOVE ASSISTANT</div></div><button class="ch-close" id="ch-min">−</button></header><div class="ch-body"><button class="ch-primary" id="ch-analyze">↗ Find Best Move</button><div class="ch-status" id="ch-status">Reading chessboard…</div><div class="ch-result"><div class="ch-muted">Recommended move</div><div class="ch-move" id="ch-move">—</div><div class="ch-muted" id="ch-detail">Best move arrow appears on the board</div></div><div class="ch-depth"><label for="ch-depth">Analysis depth</label><b id="ch-depth-label">12</b></div><input id="ch-depth" type="range" min="8" max="18" value="12"><label class="ch-toggle"><input type="checkbox" id="ch-auto" checked> Automatically update as the position changes</label><div class="ch-footer">For study and practice. Avoid using move assistance in live games against people.</div></div>';
    document.body.appendChild(panel);
    panel.querySelector('#ch-analyze').addEventListener('click',()=>{const p=getPosition();if(p)analyze(p.fen,true);else status('Could not read board pieces. Refresh Chess.com and try again.',true);});
    panel.querySelector('#ch-min').addEventListener('click',()=>panel.classList.toggle('ch-min'));
    panel.querySelector('#ch-depth').addEventListener('input',e=>{depth=+e.target.value;panel.querySelector('#ch-depth-label').textContent=depth;});
    panel.querySelector('#ch-auto').addEventListener('change',e=>{auto=e.target.checked;if(auto){const p=getPosition();if(p)analyze(p.fen,false);}});
    // Drag the panel by its header.
    const head=panel.querySelector('.ch-head');let drag=null;
    head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=panel.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};head.setPointerCapture(e.pointerId);});
    head.addEventListener('pointermove',e=>{if(!drag)return;panel.style.left=Math.max(0,e.clientX-drag.x)+'px';panel.style.top=Math.max(0,e.clientY-drag.y)+'px';panel.style.right='auto';});
    head.addEventListener('pointerup',()=>{drag=null;});
  }
  function status(text,error=false){if(!panel)return;const el=panel.querySelector('#ch-status');el.textContent=text;el.style.color=error?'#f38ba8':'#f5c979';}
  function initEngine(){
    if(worker)return;
    try {
      // Content scripts cannot always launch a worker directly from chrome-extension://
      // because the page origin owns the Worker constructor. A blob bootstrap imports
      // the web-accessible engine from the extension origin.
      const engineUrl = chrome.runtime.getURL('vendor/stockfish-19-lite-single.js');
      const bootstrap = new Blob([`importScripts("${engineUrl}");`], { type: 'text/javascript' });
      worker = new Worker(URL.createObjectURL(bootstrap));
      worker.addEventListener('error', e => {
        status('Stockfish worker failed to load. Check extension/vendor files and reload the extension.', true);
        console.error('Chess Helper Stockfish worker error:', e.message, e.filename, e.lineno);
      });
    } catch(e) {
      status('Could not start Stockfish: ' + (e.message || 'worker blocked'), true);
      console.error('Chess Helper could not start Stockfish:', e);
      return;
    }
    worker.addEventListener('message',e=>{
      const line=String(e.data||'');
      if(line==='uciok'){uciReady=true;worker.postMessage('isready');}
      else if(line==='readyok'){ready=true;if(pending){const p=pending;pending=null;startSearch(p.fen,p.force);}}
      else if(line.startsWith('bestmove ')){
        busy=false;const uci=line.split(/\s+/)[1];
        if(!uci||uci==='(none)'){status('No legal move found.');return;}
        lastMove={from:uci.slice(0,2),to:uci.slice(2,4),uci};
        panel.querySelector('#ch-move').textContent=lastMove.from+' → '+lastMove.to;
        panel.querySelector('#ch-detail').textContent='Engine move · depth '+depth;
        drawArrow(lastMove);status('Best move ready');
      }
      else if(line.startsWith('info depth ')){
        const m=line.match(/\bdepth\s+(\d+)/);if(m)status('Analyzing… depth '+m[1]);
      }
    });
    worker.postMessage('uci');
  }
  function analyze(fen,force){
    if(!panel)return;
    currentFen=fen;
    if(!worker)initEngine();
    if(!worker)return;
    if(!ready){pending={fen,force};status('Starting Stockfish…');return;}
    startSearch(fen,force);
  }
  function startSearch(fen,force){
    if(!worker||!ready)return;
    if(busy)worker.postMessage('stop');
    busy=true;lastMove=null;clearArrow();
    panel.querySelector('#ch-move').textContent='…';
    panel.querySelector('#ch-detail').textContent='Stockfish is calculating';
    status('Analyzing position…');
    worker.postMessage('position fen '+fen);
    worker.postMessage('go depth '+depth);
  }
  function drawArrow(move){
    clearArrow();const board=findBoard();if(!board)return;
    if(getComputedStyle(board).position==='static')board.style.position='relative';
    arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 100 100');
    Object.assign(arrow.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'9999'});
    const point=s=>({x:((s.charCodeAt(0)-97)+.5)*12.5,y:(8-Number(s[1])+.5)*12.5});
    const a=point(move.from),b=point(move.to),ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs'),mark=document.createElementNS(ns,'marker');
    mark.setAttribute('id','ch-helper-arrowhead');mark.setAttribute('markerWidth','5');mark.setAttribute('markerHeight','5');mark.setAttribute('refX','4');mark.setAttribute('refY','2.5');mark.setAttribute('orient','auto');
    const tip=document.createElementNS(ns,'path');tip.setAttribute('d','M0,0 L5,2.5 L0,5 Z');tip.setAttribute('fill','#f5c979');mark.appendChild(tip);defs.appendChild(mark);arrow.appendChild(defs);
    const line=document.createElementNS(ns,'line');Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#f5c979','stroke-width':'2.2','stroke-linecap':'round','marker-end':'url(#ch-helper-arrowhead)'}).forEach(([k,v])=>line.setAttribute(k,v));arrow.appendChild(line);board.appendChild(arrow);
  }
  function clearArrow(){if(arrow){arrow.remove();arrow=null;}}
  function scan(){
    if(!panel||!document.body.contains(panel))return;
    const p=getPosition();if(!p){status('Open a game or puzzle to detect the board.');return;}
    if(p.fen!==currentFen&&auto){clearTimeout(scan.timer);scan.timer=setTimeout(()=>{const now=getPosition();if(now&&now.fen!==currentFen)analyze(now.fen,false);},350);}
    else if(!currentFen)status('Board detected. Starting analysis…');
  }
  makePanel();
  // Avoid observing the entire Chess.com DOM, which changes constantly during play.
  // Poll lightly and only start the engine after a position is found.
  let previousBoard = null;
  let scanBusy = false;
  const safeScan = () => {
    if (scanBusy) return;
    scanBusy = true;
    try {
      const board = findBoard();
      if (board !== previousBoard) {
        previousBoard = board;
        currentFen = '';
      }
      scan();
    } catch (err) {
      status('Board scan hiccup. Try Find Best Move.', true);
    } finally {
      scanBusy = false;
    }
  };
  setTimeout(safeScan, 1200);
  setTimeout(safeScan, 3000);
  setInterval(safeScan, 1800);
})();