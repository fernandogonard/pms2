const WebSocket = require('ws');
const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async function() {
  const envToken = process.env.TEST_JWT;
  const token = envToken || (await ask('Pega aquí tu JWT para test WS: '));
  if (!token) {
    console.error('No se proporcionó token. Abortando.');
    process.exit(1);
  }

  const url = `ws://localhost:5000/ws?token=${token}`;
  console.log('Conectando a', url);
  const ws = new WebSocket(url);

  ws.on('open', () => {
    console.log('WS abierto. Enviando ping de aplicación...');
    ws.send(JSON.stringify({ type: 'ping' }));
  });

  ws.on('message', (m) => {
    try { console.log('Mensaje recibido:', m.toString()); }
    catch(e) { console.log('Mensaje (non-string)'); }
  });

  ws.on('close', (code, reason) => {
    console.log('WS cerrado', code, reason && reason.toString ? reason.toString() : reason);
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('Error WS:', err.message || err);
    process.exit(1);
  });
})();
