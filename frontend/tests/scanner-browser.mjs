// Teste de integração no Chromium: câmera simulada, uploads e ciclo de vida React.
// Executar: npm run test:scanner:browser (requer Edge ou SCANNER_BROWSER).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';
import { imagemITF } from './fixtures/itf.mjs';

const codigo = '00193373700000001000500940144816060680935031';
const workspace = path.resolve('.local/scanner-browser');
await fs.mkdir(workspace, { recursive: true });
const frameWidth = 1280;
const frameHeight = 960;
const imagem = imagemITF(codigo, 3);
const y = Buffer.alloc(frameWidth * frameHeight, 235);
for (let row = 0; row < imagem.height; row++) {
  for (let col = 0; col < imagem.width; col++) {
    y[(row + 130) * frameWidth + col + Math.floor((frameWidth - imagem.width) / 2)] = imagem.pixels[row * imagem.width + col] ? 235 : 16;
  }
}
const capture = path.join(workspace, 'boleto.y4m');
await fs.writeFile(capture, Buffer.concat([
  Buffer.from('YUV4MPEG2 W1280 H960 F5:1 Ip A1:1 C420\nFRAME\n'),
  y, Buffer.alloc(frameWidth * frameHeight / 2, 128),
]));

const paginaTeste = async (server, _req, res) => {
  const html = `<!doctype html><html><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import Scanner from '/src/components/ScannerBoleto.jsx';
    import '/src/index.css';
    const root = ReactDOM.createRoot(document.getElementById('root'));
    window.resultados = [];
    window.abrir = (aberto) => root.render(React.createElement(React.StrictMode, null, React.createElement(Scanner, {
      aberto, onScan: c => { window.resultados.push(c); window.abrir(false); }, onFechar: () => window.abrir(false)
    })));
    window.abrir(true);
  </script></body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.end(await server.transformIndexHtml('/scanner-test', html));
};
const server = await createServer({
  optimizeDeps: { include: ['react', 'react-dom/client', 'html5-qrcode', 'html5-qrcode/third_party/zxing-js.umd.js'] },
  server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.local/**'] } },
  plugins: [{ name: 'scanner-test-page', configureServer(server) {
    server.middlewares.use('/scanner-test', (req, res) => paginaTeste(server, req, res));
  } }],
});
await server.listen();
const port = server.httpServer.address().port;
const executable = process.env.SCANNER_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = spawn(executable, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + path.join(workspace, 'profile-' + Date.now()),
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--use-file-for-fake-video-capture=' + capture, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Navegador não iniciou em 30 segundos')), 30000);
    browser.on('error', reject);
    browser.stderr.on('data', (data) => {
      buffer += data;
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const target = await fetch(new URL('/json/new?about:blank', endpoint.replace('ws:', 'http:')), { method: 'PUT' }).then(r => r.json());
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ' ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
    const operation = pending.get(message.id);
    if (operation) {
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(message.error.message));
      else operation.resolve(message.result);
    }
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const esperar = async (expression) => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      if (errors.length) throw new Error(errors.join('\n'));
      await delay(200);
    }
    throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText'));
  };
  await cdp('Runtime.enable');
  await cdp('Log.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + port + '/scanner-test' });
  await esperar('window.resultados?.length === 1');
  assert.equal(await evaluate('window.resultados[0]'), codigo);
  console.log('OK: câmera ITF fora da faixa central em tela de 390px, StrictMode e encerramento após leitura');

  // Impedir a leitura automática para exercitar troca por arquivo e fechamento durante start.
  await evaluate(`window.trackStops = 0; window.videoStreams = []; const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      await new Promise(r => setTimeout(r, 300));
      const stream = await original(...args); window.videoStreams.push(stream);
      stream.getVideoTracks().forEach(t => { const stop = t.stop.bind(t); t.stop = () => { window.trackStops++; stop(); }; });
      return stream;
    };`);
  await evaluate('window.abrir(true); setTimeout(() => window.abrir(false), 100)');
  await delay(1500);
  assert.equal(await evaluate('window.videoStreams.length > 0 && window.trackStops > 0'), true);
  assert.equal(await evaluate('window.videoStreams.every(s => s.getTracks().every(t => t.readyState === "ended"))'), true);
  console.log('OK: fechamento durante inicialização libera todas as trilhas de vídeo');

  // Camera bloqueada: upload ainda deve funcionar, inclusive em telas Android estreitas.
  await evaluate('navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Permission denied", "NotAllowedError"); }; window.abrir(true)');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: true });
  await esperar('document.body.innerText.includes("Acesso à câmera bloqueado")');
  const upload = async (pixels, width, height) => evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
    const ctx = canvas.getContext('2d'); const pixels = ${JSON.stringify(Array.from(pixels))};
    const rgba = new Uint8ClampedArray(pixels.length * 4);
    pixels.forEach((v,i) => { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=v; rgba[i*4+3]=255; });
    ctx.putImageData(new ImageData(rgba, canvas.width, canvas.height),0,0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'boleto.png', {type:'image/png'}));
    const input = document.querySelector('input[type=file]'); input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await upload(new Uint8ClampedArray(10000).fill(255), 100, 100);
  await esperar('document.body.innerText.includes("Não foi possível ler")');
  assert.equal(await evaluate('window.resultados.length'), 1);
  await upload(imagem.pixels, imagem.width, imagem.height);
  await esperar('window.resultados.length === 2');
  assert.equal(await evaluate('window.resultados[1]'), codigo);
  // Foto de uma página inteira: código pequeno, fora do centro e com contraste menor.
  const pageWidth = 1800;
  const pageHeight = 2400;
  const page = new Uint8ClampedArray(pageWidth * pageHeight).fill(220);
  for (let row = 0; row < imagem.height; row++) {
    for (let col = 0; col < imagem.width; col++) {
      page[(row + 2050) * pageWidth + col + 200] = imagem.pixels[row * imagem.width + col] ? 220 : 75;
    }
  }
  await evaluate('window.abrir(true)');
  await esperar('document.body.innerText.includes("Acesso à câmera bloqueado")');
  await upload(page, pageWidth, pageHeight);
  await esperar('window.resultados.length === 3');
  assert.equal(await evaluate('window.resultados[2]'), codigo);

  // Código na vertical: TRY_HARDER deve tentar também a imagem rotacionada.
  const rotated = new Uint8ClampedArray(imagem.pixels.length);
  for (let row = 0; row < imagem.height; row++) {
    for (let col = 0; col < imagem.width; col++) {
      rotated[col * imagem.height + imagem.height - row - 1] = imagem.pixels[row * imagem.width + col];
    }
  }
  await evaluate('window.abrir(true)');
  await esperar('document.body.innerText.includes("Acesso à câmera bloqueado")');
  await upload(rotated, imagem.height, imagem.width);
  await esperar('window.resultados.length === 4');
  assert.equal(await evaluate('window.resultados[3]'), codigo);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('OK: câmera bloqueada, imagem inválida, nova tentativa e imagem ITF válida em tela Android (360px)');
  console.log('OK: página inteira com barras fora do centro, contraste reduzido e código na vertical');
} finally {
  socket?.close();
  browser.kill();
  await server.close();
}
