(() => {
  if (window.__chessHelperInstalled) return;
  window.__chessHelperInstalled = true;
  let overlay = null;
  function boardElement() {
    return document.querySelector('.board') || document.querySelector('[data-board]');
  }
  function readPosition() {
    const board = boardElement();
    if (!board) return {ok:false,error:'Could not find a Chess.com board. Open a game or puzzle first.'};
    const squares = Array.from(board.querySelectorAll('.piece'));
    const placement = Array.from({length:8},()=>Array(8).fill(''));
    const map = {wk:'K',wq:'Q',wr:'R',wb:'B',wn:'N',wp:'P',bk:'k',bq:'q',br:'r',bb:'b',bn:'n',bp:'p'};
    let found = 0;
    for (const node of squares) {
      const cls = [...node.classList];
      const pc = cls.find(c=>Object.prototype.hasOwnProperty.call(map,c));
      const sq = cls.map(c=>c.match(/^square-(\d)(\d)$/)).find(Boolean);
      if (!pc || !sq) continue;
      const file = Number(sq[1])-1, rank = Number(sq[2])-1;
      if(file<0||file>7||rank<0||rank>7) continue;
      placement[7-rank][file] = map[pc]; found++;
    }
    if (!found) return {ok:false,error:'Could not read pieces from the board. Paste the position FEN below.'};
    const rows = placement.map(row=>{
      let out='',empty=0;
      for(const cell of row){if(!cell)empty++;else{if(empty)out+=empty;empty=0;out+=cell;}}
      if(empty)out+=empty;
      return out;
    }).join('/');
    const whiteTurn = document.querySelector('.clock-bottom.clock-player-turn, .clock-bottom .clock-player-turn');
    const blackTurn = document.querySelector('.clock-top.clock-player-turn, .clock-top .clock-player-turn');
    const turn = whiteTurn ? 'w' : blackTurn ? 'b' : 'w';
    return {ok:true,fen:rows+' '+turn+' KQkq - 0 1',pieces:found};
  }
  function clearArrow(){if(overlay){overlay.remove();overlay=null;}}
  function showArrow(move){
    clearArrow();
    const board=boardElement();if(!board)return;
    const boardRect=board.getBoundingClientRect();
    if(!boardRect.width||!boardRect.height)return;
    overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
    overlay.setAttribute('viewBox','0 0 100 100');
    Object.assign(overlay.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'9999',overflow:'visible'});
    const style=getComputedStyle(board);if(style.position==='static')board.style.position='relative';
    const coord=sq=>{const f=sq.charCodeAt(0)-97,r=Number(sq[1])-1;return{x:(f+.5)*12.5,y:(7-r+.5)*12.5};};
    const a=coord(move.from),b=coord(move.to),ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');
    marker.setAttribute('id','chess-helper-head');marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','5');marker.setAttribute('refX','4');marker.setAttribute('refY','2.5');marker.setAttribute('orient','auto');
    const tip=document.createElementNS(ns,'path');tip.setAttribute('d','M0,0 L5,2.5 L0,5 Z');tip.setAttribute('fill','#f5c979');marker.appendChild(tip);defs.appendChild(marker);overlay.appendChild(defs);
    const line=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#f5c979','stroke-width':'2.1','stroke-linecap':'round','marker-end':'url(#chess-helper-head)'}))line.setAttribute(k,v);
    overlay.appendChild(line);board.appendChild(overlay);
  }
  chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
    if(msg.type==='CHESS_HELPER_GET_FEN') sendResponse(readPosition());
    else if(msg.type==='CHESS_HELPER_ARROW'){showArrow(msg.move);sendResponse({ok:true});}
    else if(msg.type==='CHESS_HELPER_CLEAR'){clearArrow();sendResponse({ok:true});}
    else if(msg.type==='CHESS_HELPER_PLAY'){
      const board=boardElement();
      const allowed=/\/play\/computer|\/puzzles?\b/i.test(location.pathname);
      if(!allowed){sendResponse({ok:false,error:'Auto-move is only available on recognized bot-game or puzzle pages.'});return;}
      const from=board?.querySelector('.piece.'+msg.move.from),to=board?.querySelector('.square-'+msg.move.to[0]+' .piece');
      if(from){from.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));from.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}
      const target=board?.querySelector('.square-'+msg.move.to);
      if(target){target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));sendResponse({ok:true});}
      else sendResponse({ok:false,error:'Could not select the move on this board.'});
    }
    return true;
  });
})();