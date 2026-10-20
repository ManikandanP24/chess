(() => {
  let engine;
  const send = data => parent.postMessage({channel:'ch-helper-engine',...data}, '*');
  try {
    engine = new Worker(chrome.runtime.getURL('vendor/stockfish-19-lite-single.js'));
    engine.addEventListener('message', event => send({line:String(event.data || '')}));
    engine.addEventListener('error', event => send({error:event.message || 'Worker failed to load'}));
  } catch (error) {
    send({error:error.message || String(error)});
  }
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.channel !== 'ch-helper-command' || typeof event.data.command !== 'string') return;
    if (!engine) { send({error:'Stockfish worker is unavailable'}); return; }
    engine.postMessage(event.data.command);
  });
})();