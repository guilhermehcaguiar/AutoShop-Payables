import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { imagemITF } from './fixtures/itf.mjs';

// Executar após npm run build. APP_DIST permite testar um build isolado do lockfile.
const workspace = path.resolve('.local/login-browser');
const dist = path.resolve(process.argv[2] || process.env.APP_DIST || 'dist');
await fs.mkdir(workspace, { recursive: true });
const httpServer = createServer(async (req, res) => {
  const relative = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(dist, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const content = await fs.readFile(file);
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.otf':'font/otf'})[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
const server = { httpServer };
console.log('Servidor iniciado em', server.httpServer.address().port);
const browser = spawn(process.env.SCANNER_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  '--user-data-dir=' + path.join(workspace, 'profile-' + Date.now()), 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Browser timeout')), 30000);
    browser.on('error', reject);
    browser.stderr.on('data', data => {
      buffer += data;
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const target = await fetch(new URL('/json/new?about:blank', endpoint.replace('ws:', 'http:')), { method: 'PUT' }).then(r => r.json());
  console.log('Navegador iniciado');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 15000);
    socket.onopen = () => { clearTimeout(timeout); resolve(); }; socket.onerror = reject;
  });
  console.log('WebSocket conectado');
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    const operation = pending.get(message.id);
    if (operation) {
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(message.error.message));
      else operation.resolve(message.result);
    }
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 20000);
    pending.set(++id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const esperar = async expression => {
    for (let i = 0; i < 100; i++) {
      if (errors.length) throw new Error(JSON.stringify(errors));
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText'));
  };
  const viewport = (width, height, mobile = false) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  const screenshot = async name => {
    const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await fs.writeFile(path.join(workspace, name + '.png'), Buffer.from(result.data, 'base64'));
  };
  await cdp('Runtime.enable');
  await viewport(1440, 900);
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + server.httpServer.address().port });
  await esperar('!!document.querySelector("#login-password")');
  console.log('Login carregado');
  await evaluate('document.fonts.ready');
  await screenshot('desktop');
  await viewport(360, 800, true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await screenshot('mobile');
  await evaluate('document.querySelector(".login-show-password").click()');
  assert.equal(await evaluate('document.querySelector("#login-password").type'), 'text');
  await evaluate('document.querySelector(".login-show-password").click()');
  assert.equal(await evaluate('document.querySelector("#login-password").type'), 'password');
  await evaluate(`document.querySelector('#login-password').dispatchEvent(new KeyboardEvent('keydown', {key:'A', modifierCapsLock:true, bubbles:true}));`);
  await esperar('!!document.querySelector("#login-caps-lock")');
  await evaluate(`window.loginRequests = 0; window.fetch = async (url) => {
    if (String(url).endsWith('/login')) { window.loginRequests++; await new Promise(r => setTimeout(r, 800)); return new Response(JSON.stringify({detail:'Usuário ou senha incorretos.'}), {status:401}); }
    return new Response('[]');
  };
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  for (const [id,value] of [['login-username','teste'],['login-password','senha']]) {
    const input = document.getElementById(id); setter.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true}));
  }`);
  await evaluate('document.querySelector("form").requestSubmit()');
  await esperar('document.querySelector(".login-submit").disabled');
  await evaluate('document.querySelector("form").requestSubmit()');
  await esperar('!!document.querySelector(".login-error")');
  assert.equal(await evaluate('window.loginRequests'), 1);
  assert.equal(await evaluate('document.querySelector(".login-submit").disabled'), false);
  await screenshot('mobile-error');
  await evaluate(`window.fetch = async (url) => new Response(JSON.stringify(String(url).endsWith('/login') ? {access_token:'teste-local',usuario:{nome:'Teste',sexo:'',admin:false}} : String(url).includes('notificacoes') ? {} : [])); document.querySelector('form').requestSubmit();`);
  await esperar('!document.querySelector(".login-page")');
  assert.equal(await evaluate('localStorage.getItem("token")'), 'teste-local');
  // O scanner carrega somente ao abrir e precisa funcionar no bundle de produção.
  await evaluate(`navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('Novo Boleto')).click();`);
  await esperar(`!!document.querySelector('button[title="Escanear código de barras"]')`);
  await evaluate(`document.querySelector('button[title="Escanear código de barras"]').click()`);
  await esperar('document.body.innerText.includes("Acesso à câmera bloqueado")');
  const codigo = '00193373700000001000500940144816060680935031';
  const imagem = imagemITF(codigo, 3);
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = ${imagem.width}; canvas.height = ${imagem.height};
    const pixels = ${JSON.stringify(Array.from(imagem.pixels))};
    const rgba = new Uint8ClampedArray(pixels.length * 4);
    pixels.forEach((v,i) => { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=v; rgba[i*4+3]=255; });
    canvas.getContext('2d').putImageData(new ImageData(rgba,canvas.width,canvas.height),0,0);
    const blob = await new Promise(r => canvas.toBlob(r,'image/png'));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob],'boleto.png',{type:'image/png'}));
    const input = document.querySelector('input[type=file]'); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await esperar(`document.querySelector('input[inputmode="numeric"]').value === '${codigo}'`);
  await esperar(`!document.querySelector('[aria-label="Escanear boleto"]')`);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('OK: desktop, mobile sem overflow, mostrar senha, Caps Lock, carregamento, envio único, erro e login bem-sucedido com API simulada.');
  console.log('Capturas em ' + workspace);
  console.log('OK: scanner sob demanda e upload ITF preenche o código no cadastro em produção.');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  socket?.close(); browser.kill();
  server.httpServer.closeAllConnections();
  server.httpServer.closeIdleConnections();
  await new Promise(resolve => server.httpServer.close(resolve));
}
