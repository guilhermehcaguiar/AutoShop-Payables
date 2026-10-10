import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import { normalizarBoleto } from '../boleto.js';
import { lerImagemBoleto, observarVideoBoleto } from '../leitorBoleto.js';
import Dialog from './Dialog.jsx';

const READER_ID = 'boleto-scanner-reader';
let proximaSessao = 0;
const CONFIG = { formatsToSupport: [Html5QrcodeSupportedFormats.ITF], useBarCodeDetectorIfSupported: false, verbose: false };

async function aguardarVideo(scanner) {
  // start() resolve antes de play() e da criação do canvas em html5-qrcode 2.3.8.
  // A fila só pode liberar a câmera depois de o evento playing inicializar o leitor.
  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (scanner.isScanning) return;
  }
  throw new Error('A câmera abriu, mas o vídeo não iniciou. Tente novamente ou use uma imagem.');
}

async function liberar(session) {
  session.pararLeitura?.();
  session.pararLeitura = null;
  if (!session.scanner) return;
  const video = session.reader.querySelector('video');
  const tracks = video?.srcObject?.getTracks() || [];
  const state = session.scanner.getState();
  try {
    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
      await session.scanner.stop();
    }
  } catch { /* start incompleto pode ainda não ter criado o canvas. */ }
  finally { tracks.forEach((track) => track.stop()); }
  try { session.scanner.clear(); }
  catch { session.reader.replaceChildren(); }
  session.scanner = null;
}

function mensagemCamera(err) {
  const texto = String(err?.message || err || 'Erro ao iniciar câmera.');
  const causa = String(err?.name) + ' ' + texto;
  if (/NotAllowed|Permission|denied/i.test(causa)) return 'Acesso à câmera bloqueado. Permita a câmera nas configurações do navegador.';
  if (/NotFound/i.test(causa)) return 'Nenhuma câmera encontrada. Use uma imagem ou cole a linha digitável no cadastro.';
  if (/NotReadable|in use/i.test(causa)) return 'Câmera ocupada. Feche outros aplicativos e tente novamente.';
  return texto;
}

function ScannerBoleto({ aberto, onScan, onFechar }) {
  const [status, setStatus] = useState('iniciando');
  const [erro, setErro] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [flashDisponivel, setFlashDisponivel] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const sessionRef = useRef(null);
  const filaRef = useRef(Promise.resolve());
  const containerRef = useRef(null);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  function enfileirar(tarefa) {
    const operacao = filaRef.current.then(tarefa);
    filaRef.current = operacao.catch(() => undefined);
    return operacao;
  }

  useLayoutEffect(() => {
    if (!aberto) return;
    const container = containerRef.current;
    const reader = document.createElement('div');
    reader.id = READER_ID + '-' + ++proximaSessao;
    reader.style.width = '1280px';
    reader.style.transformOrigin = 'top left';
    container.prepend(reader);
    const session = { cancelada: false, modo: 'camera', scanner: null, entregue: false, reader };
    sessionRef.current = session;
    const ajustar = () => {
      reader.style.transform = 'scale(' + container.clientWidth / 1280 + ')';
    };
    ajustar();
    const observer = new ResizeObserver(ajustar);
    observer.observe(container);

    const aceitar = (texto) => {
      if (session.cancelada || session.entregue || session.modo !== 'camera') return;
      let codigo;
      try { codigo = normalizarBoleto(texto); }
      catch (err) { setErro(err.message); return; }
      session.entregue = true;
      setStatus('processando');
      enfileirar(async () => {
        await liberar(session);
        if (!session.cancelada) onScanRef.current(codigo);
      }).catch((err) => {
        if (!session.cancelada) { setStatus('erro'); setErro(mensagemCamera(err)); }
      });
    };

    // Todas as operações aguardam a sessão anterior, inclusive no StrictMode.
    enfileirar(async () => {
      if (session.cancelada || session.modo !== 'camera') return;
      setStatus('iniciando'); setErro(''); setFlashOn(false); setFlashDisponivel(false);
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('A câmera exige HTTPS ou localhost. Use uma imagem ou cole a linha digitável no cadastro.');
        }
        const alvos = [{ facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }];
        let ultimoErro;
        for (let i = 0; i < alvos.length; i++) {
          if (session.cancelada || session.modo !== 'camera') return;
          session.scanner = new Html5Qrcode(reader.id, CONFIG);
          try {
            await session.scanner.start({ facingMode: 'environment' }, {
              fps: 5,
              aspectRatio: 4 / 3,
              videoConstraints: { ...alvos[i], aspectRatio: { ideal: 4 / 3 } },
              // Manter resolução suficiente para as barras estreitas do ITF de 44 dígitos.
              qrbox: (width, height) => ({ width: Math.floor(width * 0.94), height: Math.floor(height * 0.3) }),
            }, aceitar, () => undefined);
            await aguardarVideo(session.scanner);
            if (session.cancelada || session.modo !== 'camera') { await liberar(session); return; }
            session.pararLeitura = observarVideoBoleto(reader.querySelector('video'), aceitar);
            try {
              const caps = session.scanner.getRunningTrackCapabilities();
              setFlashDisponivel(caps.torch === true);
            } catch { /* Câmera sem consulta de capacidades. */ }
            if (!session.entregue) setStatus('escaneando');
            return;
          } catch (err) {
            ultimoErro = err;
            await liberar(session);
            if (/NotAllowed|Permission|denied/i.test(String(err?.name) + ' ' + err)) throw err;
            if (i === 0 && !session.cancelada && session.modo === 'camera') {
              const cameras = await Html5Qrcode.getCameras();
              cameras.sort((a, b) => Number(/back|rear|traseir/i.test(b.label)) - Number(/back|rear|traseir/i.test(a.label)));
              alvos.push(...cameras.map((c) => ({ deviceId: { exact: c.id }, width: { ideal: 1920 } })));
            }
          }
        }
        throw ultimoErro || new Error('Nenhuma câmera encontrada.');
      } catch (err) {
        if (!session.cancelada && session.modo === 'camera') { setStatus('erro'); setErro(mensagemCamera(err)); }
      }
    });
    return () => {
      session.cancelada = true;
      session.pararLeitura?.();
      observer.disconnect();
      // A biblioteca precisa de um elemento com dimensões até start() concluir.
      // Preservá-lo fora da tela evita vazamento ao fechar durante a permissão.
      Object.assign(reader.style, { position: 'fixed', left: '-10000px', top: '0', transform: 'none' });
      reader.setAttribute('aria-hidden', 'true');
      document.body.appendChild(reader);
      enfileirar(async () => {
        try { await liberar(session); } finally { reader.remove(); }
      });
    };
  }, [aberto, tentativa]);

  const toggleFlash = async () => {
    const session = sessionRef.current;
    if (!session?.scanner || session.cancelada || session.modo !== 'camera') return;
    try {
      await enfileirar(async () => {
        if (!session.scanner?.isScanning || session.cancelada) return;
        await session.scanner.applyVideoConstraints({ advanced: [{ torch: !flashOn }] });
        if (!session.cancelada) setFlashOn(!flashOn);
      });
    } catch { setErro('Não foi possível alterar a lanterna nesta câmera.'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const session = sessionRef.current;
    if (!file || !session || session.cancelada || session.entregue || session.modo === 'arquivo') return;
    session.modo = 'arquivo';
    setStatus('processando'); setErro(''); setFlashOn(false); setFlashDisponivel(false);
    await enfileirar(async () => {
      let leuCodigo = false;
      try {
        await liberar(session);
        if (session.cancelada) return;
        session.scanner = new Html5Qrcode(session.reader.id, CONFIG);
        const resultado = await lerImagemBoleto(file) || await session.scanner.scanFile(file, false);
        leuCodigo = true;
        const codigo = normalizarBoleto(resultado);
        await liberar(session);
        if (!session.cancelada) {
          session.entregue = true;
          onScanRef.current(codigo);
        }
      } catch (err) {
        if (!session.cancelada) {
          setStatus('erro');
          setErro(leuCodigo && err instanceof Error ? err.message : 'Não foi possível ler a imagem. Escolha uma foto nítida com todas as barras e margens brancas, na horizontal.');
        }
      } finally {
        await liberar(session);
        session.modo = 'parada';
      }
    });
  };

  if (!aberto) return null;
  return (
    <Dialog aberto={aberto} titulo="Escanear código de barras do boleto" label="Escanear boleto" onFechar={onFechar} largo>
      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Escanear código de barras do boleto</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar scanner" className="text-white text-xl">&times;</button>
        </div>
        <div ref={containerRef} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-atend-border">
          {status === 'escaneando' && flashDisponivel && (
            <button type="button" onClick={toggleFlash} className="absolute top-3 right-3 bg-black/70 text-white rounded-lg px-3 py-2">
              {flashOn ? 'Desligar lanterna' : 'Ligar lanterna'}
            </button>
          )}
          {(status === 'iniciando' || status === 'processando') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white" role="status">
              {status === 'iniciando' ? 'Iniciando câmera...' : 'Processando leitura...'}
            </div>
          )}
          {status === 'erro' && <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-rose-400" role="alert">{erro}</div>}
        </div>
        {erro && status !== 'erro' && <p className="text-amber-300 text-sm mt-2" role="status">{erro}</p>}
        <div className="flex flex-wrap gap-3 mt-4">
          <label className={'flex-1 text-center bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg ' + (status === 'processando' ? 'opacity-50' : 'cursor-pointer')}>
            Escolher imagem
            <input type="file" accept="image/*" disabled={status === 'processando'} onChange={handleFileUpload} className="hidden" />
          </label>
          {status === 'erro' && <button type="button" onClick={() => setTentativa((v) => v + 1)} className="bg-slate-800 text-slate-300 text-sm px-3 rounded-lg">Tentar câmera</button>}
          <button type="button" onClick={onFechar} className="bg-slate-800 text-slate-300 text-sm px-4 py-2.5 rounded-lg">Fechar</button>
        </div>
        <p className="text-center text-xs text-slate-300 mt-3">Enquadre o código inteiro e as margens brancas. A leitura também busca fora da faixa central. Mantenha a câmera firme e afaste um pouco se as barras estiverem desfocadas. Para colar a linha digitável, use o campo do cadastro.</p>
      </div>
    </Dialog>
  );
}

export default ScannerBoleto;
