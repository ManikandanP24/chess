import { Chess } from 'chess.js';

const $ = id => document.getElementById(id);
let worker = null;
let latestMove = null;
let tabId = null;
let practicePage = false;
const setStatus = (text, error=false) => { $('status').textContent=text; $('status').style.color=error?'#f38ba8':'#f5c979'; };
const sendTab = message => new Promise(resolve => {
  if(tabId==null){resolve({ok:false,error:'No active tab.'});return;}
  chrome.tabs.sendMessage(tabId,message,response=>resolve(chrome.runtime.lastError?{ok:false,error:chrome.runtime.lastError.message}:response||{ok:false,error:'No response from Chess.com.'}));
});
function ensureWorker(){
  if(worker)return;
  worker=new Worker(chrome.runtime.getURL('vendor/stockfish-19-lite-single.js'));
}
function analyze(fen,depth){
  return new Promise((resolve,reject)=>{
    ensureWorker();
    const game=new Chess(fen);
    let best=null;
    const timeout=setTimeout(()=>{worker.postMessage('stop');reject(new Error('Analysis timed out. Try a lower depth.'));},45000);
    const handler=event=>{
      const line=String(event.data||'');
      if(line==='uciok')worker.postMessage('isready');
      if(line==='readyok'){worker.postMessage('ucinewgame');worker.postMessage('position fen '+fen);worker.postMessage('go depth '+depth);}
      if(line.startsWith('bestmove ')){
        clearTimeout(timeout);worker.removeEventListener('message',handler);
        const uci=line.split(/\s+/)[1];
        if(!uci||uci==='(none)'){reject(new Error('No legal move is available in this position.'));return;}
        try{const move=game.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})});best={from:move.from,to:move.to,san:move.san,uci};resolve(best);}
        catch(e){reject(new Error('Engine returned an invalid move for this position.'));}
      }
    };
    worker.addEventListener('message',handler);
    worker.postMessage('uci');
  });
}
async function init(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab?.id??null;
  practicePage=/\/play\/computer|\/puzzles?\b/i.test(tab?.url||'');
  $('autoMove').disabled=!practicePage;
  $('autoMove').title=practicePage?'Available on recognized practice pages':'Auto-move is disabled outside bot games and puzzles';
  const response=await sendTab({type:'CHESS_HELPER_GET_FEN'});
  if(response?.ok){$('fen').value=response.fen;setStatus('Board detected');}
  else setStatus('Paste FEN',true);
}
$('depth').addEventListener('input',()=>{$('depthLabel').textContent=$('depth').value;});
$('bestMove').addEventListener('click',async()=>{
  const fen=$('fen').value.trim();if(!fen){setStatus('Position required',true);return;}
  try{new Chess(fen);}catch{setStatus('Invalid FEN',true);return;}
  $('bestMove').disabled=true;$('result').innerHTML='<div class="muted">Stockfish is analyzing…</div>';setStatus('Analyzing…');
  try{
    const move=await analyze(fen,Number($('depth').value));latestMove=move;
    $('result').innerHTML='<div class="best">'+move.san+' · '+move.from+' → '+move.to+'</div><div class="detail">Best move at depth '+$('depth').value+'</div>';
    const arrow=await sendTab({type:'CHESS_HELPER_ARROW',move});
    if(!arrow?.ok)setStatus('Move found · arrow unavailable');
    else setStatus('Best move found');
    if($('autoMove').checked&&practicePage){
      const played=await sendTab({type:'CHESS_HELPER_PLAY',move});
      if(!played?.ok)setStatus(played?.error||'Auto-move failed',true);
      else setStatus('Move played in practice');
    }
  }catch(e){$('result').innerHTML='<div class="muted">'+e.message+'</div>';setStatus('Analysis failed',true);}
  finally{$('bestMove').disabled=false;}
});
$('clearArrow').addEventListener('click',async()=>{await sendTab({type:'CHESS_HELPER_CLEAR'});setStatus('Arrow cleared');});
$('copyFen').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('fen').value);setStatus('FEN copied');}catch{setStatus('Copy failed',true);}});
init();
