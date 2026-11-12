const cp = require('child_process');
const path = require('path');

const exe = path.resolve(__dirname, '../apps/desktop/resources/worker/dropzone-worker.exe');
console.log('[VerifyWorker] Testing standalone worker binary:', exe);

const child = cp.spawn(exe, [], { shell: false });

let handshakeReceived = false;
let helloReceived = false;
let pongReceived = false;
let shutdownReceived = false;

child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(Boolean);
  for (const line of lines) {
    console.log('[Worker Output]', line);
    try {
      const msg = JSON.parse(line);
      if (msg.command === 'worker.ready') {
        handshakeReceived = true;
        console.log('[VerifyWorker] 1. Handshake received. Sending hello...');
        child.stdin.write(JSON.stringify({
          protocolVersion: '1.0',
          type: 'request',
          id: 'req_hello',
          command: 'hello',
          payload: { clientName: 'PackagedTest', clientVersion: '1.0.0' }
        }) + '\n');
      } else if (msg.id === 'req_hello') {
        helloReceived = true;
        console.log('[VerifyWorker] 2. Hello acknowledged. Sending ping...');
        child.stdin.write(JSON.stringify({
          protocolVersion: '1.0',
          type: 'request',
          id: 'req_ping',
          command: 'ping',
          payload: {}
        }) + '\n');
      } else if (msg.id === 'req_ping' && msg.payload?.pong) {
        pongReceived = true;
        console.log('[VerifyWorker] 3. Pong received. Sending shutdown...');
        child.stdin.write(JSON.stringify({
          protocolVersion: '1.0',
          type: 'request',
          id: 'req_shutdown',
          command: 'shutdown',
          payload: {}
        }) + '\n');
      } else if (msg.command === 'worker.shutdown') {
        shutdownReceived = true;
        console.log('[VerifyWorker] 4. Shutdown event acknowledged.');
      }
    } catch (err) {
      console.error('[VerifyWorker Parse Error]', err, line);
    }
  }
});

child.stderr.on('data', (d) => {
  console.log('[Worker Log]', d.toString().trim());
});

const timer = setTimeout(() => {
  console.error('[VerifyWorker TIMEOUT] Worker did not complete in 15 seconds.');
  child.kill();
  process.exit(1);
}, 15000);

child.on('close', (code) => {
  clearTimeout(timer);
  console.log('[VerifyWorker] Process exited with code:', code);
  if (handshakeReceived && helloReceived && pongReceived && code === 0) {
    console.log('[VerifyWorker SUCCESS] Standalone dropzone-worker.exe is verified and fully functional!');
    process.exit(0);
  } else {
    console.error('[VerifyWorker FAILED] Required handshake sequence incomplete.');
    process.exit(1);
  }
});

