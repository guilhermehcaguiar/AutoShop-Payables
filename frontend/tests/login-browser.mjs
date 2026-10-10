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
  await cdp('Page.enable');
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
  await esperar('document.body.innerText.includes("Confira os dados lidos")');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Aplicar dados lidos").click()');
  await esperar('document.getElementById("boleto-valor").value === "1,00"');
  await evaluate('document.querySelector("dialog[open] .dialog-header button").click()');
  await esperar('document.body.innerText.includes("Descartar alterações?")');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Descartar").click()');
  await esperar('!document.querySelector("dialog[open]")');
  // API simulada durante a recarga: exercita sessão, seleção, pagamento e previsão.
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: '(' + (() => {
    const d = new Date();
    const iso = v => v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
    window.hoje = iso(d); d.setDate(0);
    window.contas = [
      { id: 1, fornecedor: 'Peças antigas', valor: 100, vencimento: iso(d), status: 'Pendente', categoria: 'Peças', codigo_barras: '' },
      { id: 2, fornecedor: 'Já pago', valor: 200, vencimento: window.hoje, status: 'Pago', categoria: 'Peças', codigo_barras: '' },
      { id: 3, fornecedor: 'Peças Silva', valor: 300, vencimento: window.hoje, status: 'Pendente', categoria: 'Peças', codigo_barras: '' },
      { id: 4, fornecedor: 'Oficina', valor: 400, vencimento: window.hoje, status: 'Pendente', categoria: 'Serviços', codigo_barras: '' },
    ];
    const today = new Date(window.hoje + 'T12:00:00');
    window.proximoMes = iso(new Date(today.getFullYear(), today.getMonth() + 1, 10));
    window.contas.push({ id: 5, fornecedor: 'Conta futura', valor: 600, vencimento: window.proximoMes, status: 'Pendente', categoria: 'Peças', codigo_barras: '' });
    window.lotes = []; window.cadastros = []; window.falharLote = true;
    window.fetch = async (url, options = {}) => {
      const caminho = new URL(url, location.href).pathname;
      if (window.forcar401) return new Response(JSON.stringify({ detail: 'Sessão expirada' }), { status: 401 });
      if (caminho === '/login') return new Response(JSON.stringify({ access_token: 'teste-local', usuario: { nome: 'Teste', admin: true } }));
      if (caminho === '/boletos/recorrentes' && options.method === 'POST') {
        window.modelos = (window.modelos || 0) + 1;
        if (window.falharModelo) return new Response(JSON.stringify({ detail: 'Modelo não salvo' }), { status: 503 });
        return new Response(JSON.stringify({ id: 1 }));
      }
      if (caminho === '/boletos/pagar-lote') {
        const dados = JSON.parse(options.body); window.lotes.push(dados);
        await new Promise(r => setTimeout(r, 500));
        if (window.falharLote) return new Response(JSON.stringify({ detail: 'Falha simulada no pagamento' }), { status: 503 });
        window.contas = window.contas.map(b => dados.ids.includes(b.id) ? { ...b, status: 'Pago' } : b);
        return new Response(JSON.stringify({ ids: dados.ids, quantidade: dados.ids.length }));
      }
      if (caminho === '/boletos/' && options.method === 'POST') {
        const dados = JSON.parse(options.body); window.cadastros.push(dados);
        window.contas.push({ ...dados, id: 10 + window.cadastros.length, status: 'Pendente' });
        return new Response(JSON.stringify({ id: 10 + window.cadastros.length }));
      }
      if (caminho === '/boletos/') return new Response(JSON.stringify(window.contas));
      if (caminho === '/boletos/categorias-utilizadas') return new Response(JSON.stringify([...new Set(window.contas.map(b => b.categoria))]));
      if (caminho === '/relatorio/mensal') return new Response(JSON.stringify({ total_pago: 200, total_pendente: 800, total_boletos: 4 }));
      if (caminho === '/metas/') return new Response(JSON.stringify([{ id: 1, categoria: 'Peças', limite_mensal: 5000 }]));
      if (caminho === '/fornecedores/') return new Response(JSON.stringify([{ id: 1, nome: 'Peças Silva' }]));
      return new Response('[]');
    };
  }).toString() + ')();' });
  await cdp('Page.reload');
  await esperar('document.body.innerText.includes("Peças Silva")');
  const clicarTexto = texto => evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ' + JSON.stringify(texto) + ').click()');
  const preencher = (id, valor) => evaluate('(() => { const e = document.getElementById(' + JSON.stringify(id) + '); const p = e.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + JSON.stringify(valor) + '); e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input",{bubbles:true})); })()');
  await viewport(1440, 900);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".app-shell")).backgroundColor'), 'rgb(15, 17, 23)');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".app-section")).backgroundColor'), 'rgb(26, 29, 39)');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".app-sidebar")).backgroundColor'), 'rgb(26, 29, 39)');
  await screenshot('dashboard-desktop');
  assert.equal(await evaluate('document.getElementById("filtro-dia").getBoundingClientRect().height > 0'), true);
  assert.equal(await evaluate('document.getElementById("pesquisa-boletos").hidden'), true);
  assert.equal(await evaluate('document.getElementById("filtro-dia").type'), 'date');
  await preencher('filtro-dia', await evaluate('window.proximoMes'));
  await esperar('document.querySelectorAll(".list-table tbody tr").length === 1 && document.querySelector(".list-table tbody").innerText.includes("Conta futura")');
  await preencher('filtro-dia', await evaluate('window.hoje.slice(0, 8) + (window.hoje.endsWith("01") ? "02" : "01")'));
  await esperar('document.querySelector(".empty-state h3")?.textContent === "Nenhum resultado para estes filtros"');
  await preencher('filtro-dia', await evaluate('window.hoje'));
  await esperar('document.querySelectorAll(".list-table tbody tr").length === 3');
  await clicarTexto('Limpar filtros');
  await evaluate('document.querySelector("button[aria-label=\\"Pesquisar boletos\\"]").click()');
  await esperar('document.activeElement.getAttribute("aria-label") === "Buscar contas por fornecedor, descrição ou código"');
  await evaluate('(() => { const e = document.activeElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "Silva"); e.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await esperar('document.querySelectorAll(".list-table tbody tr").length === 1');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await esperar('document.getElementById("pesquisa-boletos").hidden');
  assert.equal(await evaluate('document.querySelectorAll(".list-table tbody tr").length'), 1);
  await clicarTexto('Limpar filtros');
  await evaluate('document.querySelector(".summary-card.danger").click()');
  await esperar('document.querySelector(".list-table tbody")?.innerText.includes("Peças antigas") && !document.querySelector(".list-table tbody")?.innerText.includes("Já pago")');
  assert.equal(await evaluate('!!document.querySelector(".dashboard-heading") && document.querySelectorAll(".summary-grid .summary-card").length === 3'), true);
  assert.equal(await evaluate('document.querySelector(".summary-card.danger").getAttribute("aria-pressed")'), 'true');
  assert.equal(await evaluate('document.querySelector("#app-sidebar button[aria-current=\\"page\\"]").textContent.trim()'), 'Resumo');
  await evaluate('document.querySelector(".summary-card.danger").click()');
  await esperar('document.querySelectorAll(".list-table tbody tr").length === 3');
  assert.equal(await evaluate('document.querySelector(".summary-card.danger").getAttribute("aria-pressed")'), 'false');
  await clicarTexto('Todos');
  await esperar('[...document.querySelectorAll("input")].some(e => e.getAttribute("aria-label") === "Selecionar pendentes desta página")');
  assert.equal(await evaluate('[...document.querySelectorAll("input")].filter(e => e.getAttribute("aria-label")?.startsWith("Selecionar Já pago")).every(e => e.disabled)'), true);
  await evaluate('[...document.querySelectorAll("input")].find(e => e.getAttribute("aria-label") === "Selecionar pendentes desta página").click()');
  await esperar('!!document.querySelector(".batch-bar")');
  assert.equal(await evaluate('document.querySelector(".batch-bar").innerText.includes("2 selecionadas")'), true);
  await preencher('filtro-fornecedor', 'Peças Silva');
  await esperar('!document.querySelector(".batch-bar")');
  await clicarTexto('Limpar filtros');
  await evaluate('[...document.querySelectorAll("input")].find(e => e.getAttribute("aria-label") === "Selecionar pendentes desta página").click()');
  await clicarTexto('Registrar pagamentos');
  await esperar('!!document.getElementById("pag-metodo")');
  await preencher('pag-metodo', 'Pix');
  await preencher('pag-banco', 'Itaú');
  await evaluate('document.querySelector("dialog[open] form").requestSubmit()');
  await esperar('document.querySelector("dialog[open] button[type=submit]").disabled');
  await evaluate('document.querySelector("dialog[open] form").requestSubmit()');
  await esperar('document.body.innerText.includes("Falha simulada no pagamento")');
  assert.equal(await evaluate('window.lotes.length'), 1);
  assert.deepEqual(await evaluate('window.lotes[0].ids'), [3, 4]);
  assert.equal(await evaluate('window.lotes[0].metodo_pagamento'), 'Pix');
  assert.equal(await evaluate('window.lotes[0].banco'), 'Itaú');
  await evaluate('window.falharLote = false; document.querySelector("dialog[open] form").requestSubmit()');
  await esperar('!document.querySelector("dialog[open]") && !document.querySelector(".batch-bar")');
  await clicarTexto('Novo Boleto');
  await esperar('!!document.getElementById("boleto-fornecedor")');
  await evaluate('[...document.querySelectorAll("dialog[open] label")].find(l => l.textContent.includes("Ainda não recebi")).querySelector("input").click()');
  await preencher('boleto-fornecedor', 'Previsão teste');
  await preencher('boleto-valor', '500,00');
  await preencher('boleto-vencimento', await evaluate('window.hoje'));
  await clicarTexto('Nova categoria');
  assert.equal(await evaluate('document.activeElement.id'), 'boleto-categoria');
  await preencher('boleto-categoria', 'Equipamentos');
  await evaluate('document.querySelector("dialog[open] form").requestSubmit()');
  await esperar('!document.querySelector("dialog[open]")');
  assert.equal(await evaluate('window.cadastros.length'), 1);
  assert.equal(await evaluate('window.cadastros[0].codigo_barras'), '');
  assert.equal(await evaluate('window.cadastros[0].categoria'), 'Equipamentos');
  await viewport(360, 800, true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  assert.equal(await evaluate('document.querySelector("#app-sidebar").inert'), true);
  await screenshot('boletos-mobile');
  assert.equal(await evaluate('document.getElementById("filtro-dia").getBoundingClientRect().height > 0'), true);
  await evaluate('document.querySelector("button[aria-label=\\"Pesquisar boletos\\"]").click()');
  await esperar('!document.getElementById("pesquisa-boletos").hidden');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await screenshot('pesquisa-boletos-mobile');
  await evaluate('document.querySelector("button[aria-label=\\"Fechar pesquisa de boletos\\"]").click()');
  await clicarTexto('Mais');
  await esperar('document.querySelector("#app-sidebar").inert === false');
  await screenshot('menu-mobile');
  // O botão da sidebar é o primeiro com este texto.
  await clicarTexto('Fornecedores');
  await esperar('document.body.innerText.includes("Novo fornecedor")');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await screenshot('fornecedores-mobile');
  await clicarTexto('Mais');
  await clicarTexto('Boletos');
  await clicarTexto('Novo Boleto');
  await esperar('!!document.getElementById("boleto-fornecedor")');
  await esperar('[...document.querySelectorAll("#boleto-categorias option")].some(o => o.value === "Equipamentos")');
  await preencher('boleto-fornecedor', 'Rascunho preservado');
  await preencher('boleto-valor', '100,00');
  await preencher('boleto-vencimento', await evaluate('window.hoje'));
  await preencher('boleto-categoria', 'Peças');
  await evaluate('[...document.querySelectorAll("dialog[open] label")].find(l => l.textContent.includes("Ainda não recebi")).querySelector("input").click()');
  await evaluate('window.forcar401 = true; document.querySelector("dialog[open] form").requestSubmit()');
  await esperar('!!document.querySelector(".login-error") && document.body.innerText.includes("Sua sessão expirou")');
  assert.equal(await evaluate('localStorage.getItem("token")'), null);
  assert.equal(await evaluate('JSON.parse(sessionStorage.getItem("atend-rascunho-teste")).fornecedor'), 'Rascunho preservado');
  await evaluate('window.forcar401 = false');
  await preencher('login-username', 'teste');
  await preencher('login-password', 'senha');
  await evaluate('document.querySelector("form").requestSubmit()');
  await esperar('!document.querySelector(".login-page")');
  await clicarTexto('Novo Boleto');
  await esperar('document.getElementById("boleto-fornecedor")?.value === "Rascunho preservado"');
  // Falha parcial: a conta é criada uma vez e só o modelo é reenviado.
  await evaluate('[...document.querySelectorAll("dialog[open] label")].find(l => l.textContent.includes("Salvar também")).querySelector("input").click()');
  await evaluate('window.falharModelo = true; document.querySelector("dialog[open] form").requestSubmit()');
  await esperar('document.body.innerText.includes("A conta foi salva") && document.body.innerText.includes("Modelo não salvo")');
  const cadastrosAntesRetry = await evaluate('window.cadastros.length');
  await evaluate('window.falharModelo = false');
  await clicarTexto('Tentar salvar modelo');
  await esperar('!document.querySelector("dialog[open]")');
  assert.equal(await evaluate('window.cadastros.length'), cadastrosAntesRetry);
  assert.equal(await evaluate('window.modelos'), 2);
  await evaluate('document.querySelector(".app-toast button")?.click()');
  // As páginas compartilham ícones SVG e seções acessíveis, sem mudar a paleta.
  for (const [nome, titulo, captura] of [
    ['Relatórios', 'Relatórios', 'relatorios'],
    ['Administração', 'Administração', 'admin'],
    ['Metas', 'Metas por Categoria', 'metas'],
    ['Meu perfil', 'Meu Perfil', 'perfil'],
    ['Histórico', 'Histórico de ações', 'historico'],
  ]) {
    await viewport(360, 800, true);
    await clicarTexto('Mais');
    await clicarTexto(nome);
    await esperar(`document.querySelector('.app-main h2')?.textContent === ${JSON.stringify(titulo)}`);
    await esperar('!document.querySelector(".app-main .animate-pulse")');
    assert.equal(await evaluate('/[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF]/u.test(document.querySelector(".app-main").innerText)'), false);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    if (nome === 'Relatórios' || nome === 'Administração') {
      if (nome === 'Relatórios') {
        await preencher('relatorio-inicio', '2027-01-15');
        await esperar('document.querySelector("select[aria-label=\\"Ano do relatório\\"]").value === "2027"');
        assert.equal(await evaluate('document.querySelector("select[aria-label=\\"Mês do relatório\\"]").value'), '1');
        assert.equal(await evaluate('document.getElementById("relatorio-inicio").value'), '2027-01-15');
        await preencher('relatorio-fim', '2027-01-20');
      }
      await evaluate('document.querySelector(".page-accordion-toggle").click()');
      await esperar('document.querySelector(".page-accordion-toggle").getAttribute("aria-expanded") === "true"');
      assert.equal(await evaluate('document.querySelector(".page-accordion-region").inert'), false);
      assert.equal(await evaluate('!!document.querySelector(".page-accordion-icon svg")'), true);
    }
    if (nome === 'Metas') {
      await clicarTexto('Peças');
      await esperar('!!document.querySelector("dialog[open]")');
      assert.equal(await evaluate('document.querySelector("dialog[open]").innerText.includes("Editar Meta")'), true);
      await screenshot('meta-acoes-mobile');
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await esperar('!document.querySelector("dialog[open]")');
    }
    await screenshot(`${captura}-mobile`);
    await viewport(1440, 900);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    await screenshot(`${captura}-desktop`);
  }
  console.log('OK: Relatórios, Administração, Metas, Perfil e Histórico com SVGs, seções acessíveis e sem overflow em desktop/mobile.');
  console.log('OK: sessão expirada preserva rascunho; modelo recorrente com falha parcial permite retry sem duplicar a conta.');
  console.log('OK: filtros, seleção apenas de pendentes, confirmação e retry de lote sem envio duplicado, previsão e navegação mobile.');
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
