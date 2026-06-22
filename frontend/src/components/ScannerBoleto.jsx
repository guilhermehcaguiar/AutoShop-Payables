import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const READER_ID = 'boleto-scanner-reader';

function ScannerBoleto({ aberto, onScan, onFechar }) {
  const [status, setStatus] = useState('iniciando');
  const [erro, setErro] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [flashDisponivel, setFlashDisponivel] = useState(false);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const flashStateRef = useRef(false);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!aberto) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined);
        scannerRef.current = null;
      }
      return;
    }

    let mounted = true;

    const iniciar = async () => {
      setStatus('iniciando');
      setErro('');

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!cameras || cameras.length === 0) {
          setStatus('erro');
          setErro('Nenhuma câmera encontrada no dispositivo.');
          return;
        }

        const scanner = new Html5Qrcode(READER_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 100 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ],
          },
          (decodedText) => {
            const digits = decodedText.replace(/\D/g, '');
            if (digits.length >= 44) {
              scanner.stop().catch(() => undefined);
              if (mounted) {
                try { navigator.vibrate?.(200); } catch { /* noop */ }
                onScanRef.current(digits);
              }
            }
          },
          () => undefined
        );

        if (!mounted) return;
        setStatus('escaneando');

        try {
          const caps = scanner.getRunningTrackCapabilities();
          if (caps && 'torch' in caps) {
            setFlashDisponivel(true);
          }
        } catch { /* noop */ }
      } catch (err) {
        if (!mounted) return;
        setStatus('erro');
        const name = err?.name;
        const msg = err?.message || '';
        if (name === 'NotAllowedError' || msg.includes('Permission')) {
          setErro('Acesso à câmera bloqueado. Permita o acesso nas configurações do navegador e tente novamente.');
        } else if (name === 'NotFoundError' || msg.includes('NotFound')) {
          setErro('Nenhuma câmera encontrada no dispositivo.');
        } else if (name === 'NotReadableError' || msg.includes('NotReadable') || msg.includes('in use')) {
          setErro('A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.');
        } else if (name === 'OverconstrainedError') {
          setErro('Câmera não suporta a resolução necessária.');
        } else {
          setErro(msg || 'Erro ao iniciar câmera.');
        }
      }
    };

    const timer = setTimeout(iniciar, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
      setFlashOn(false);
      setFlashDisponivel(false);
      flashStateRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined);
        scannerRef.current = null;
      }
    };
  }, [aberto]);

  const toggleFlash = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const novoEstado = !flashStateRef.current;
    flashStateRef.current = novoEstado;
    setFlashOn(novoEstado);
    try {
      await scanner.applyVideoConstraints({ torch: novoEstado });
    } catch {
      flashStateRef.current = !novoEstado;
      setFlashOn(!novoEstado);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('iniciando');
    setErro('');

    const uid = `tmp-scan-${Date.now()}`;
    const el = document.createElement('div');
    el.id = uid;
    el.style.display = 'none';
    document.body.appendChild(el);

    try {
      const scanner = new Html5Qrcode(uid);
      const result = await scanner.scanFile(file, false);
      scanner.clear();
      const digits = result.replace(/\D/g, '');
      if (digits.length >= 44) {
        try { navigator.vibrate?.(200); } catch { /* noop */ }
        onScanRef.current(digits);
      } else {
        setStatus('erro');
        setErro('Código de barras não reconhecido. Tente outra imagem.');
      }
    } catch {
      setStatus('erro');
      setErro('Não foi possível ler o código desta imagem.');
    } finally {
      document.body.removeChild(el);
    }
    e.target.value = '';
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/80" onClick={onFechar} />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Escanear Código de Barras</h3>
          <button onClick={onFechar}
            className="text-slate-500 hover:text-white text-xl leading-none active:scale-[0.98] transition-all duration-200">
            &times;
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black border border-atend-border">
          <div id={READER_ID} className="w-full aspect-[4/3]" />

          {status === 'escaneando' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[100px]">
                <div className="absolute inset-0 border-2 border-atend-verde/70 rounded-lg shadow-[0_0_15px_rgba(46,204,113,0.25)]" />
                <div className="absolute -top-[2px] -left-[2px] w-5 h-5 border-t-2 border-l-2 border-atend-verde rounded-tl" />
                <div className="absolute -top-[2px] -right-[2px] w-5 h-5 border-t-2 border-r-2 border-atend-verde rounded-tr" />
                <div className="absolute -bottom-[2px] -left-[2px] w-5 h-5 border-b-2 border-l-2 border-atend-verde rounded-bl" />
                <div className="absolute -bottom-[2px] -right-[2px] w-5 h-5 border-b-2 border-r-2 border-atend-verde rounded-br" />
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[95%] h-0.5 bg-gradient-to-r from-transparent via-atend-verde/90 to-transparent animate-scanner-line" />
              </div>

              {flashDisponivel && (
                <button type="button" onClick={toggleFlash}
                  className="absolute top-3 right-3 pointer-events-auto z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-all active:scale-90 border border-white/10">
                  {flashOn ? (
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}

          {status === 'iniciando' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-atend-verde border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-300">Iniciando câmera...</p>
              </div>
            </div>
          )}

          {status === 'erro' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center px-6 py-8">
                <svg className="w-10 h-10 text-rose-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-rose-400 text-sm mb-2">{erro}</p>
                <p className="text-slate-500 text-xs mb-4">Tente usar uma foto do código de barras.</p>
                <label className="inline-flex items-center gap-2 bg-atend-verde/20 hover:bg-atend-verde/30 text-atend-verde text-sm font-medium px-5 py-2.5 rounded-lg cursor-pointer transition-all active:scale-95 border border-atend-verde/30">
                  Escolher imagem
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          {status !== 'erro' && (
            <label className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] cursor-pointer text-slate-300 text-sm font-medium py-2.5 rounded-lg transition-all border border-slate-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Escolher imagem
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          )}
          <button onClick={onFechar}
            className={`${status === 'erro' ? 'flex-1' : 'flex-[0.5]'} bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 text-sm font-medium py-2.5 rounded-lg transition-all border border-slate-700`}>
            {status === 'erro' ? 'Fechar' : 'Cancelar'}
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-3">
          Posicione o código de barras horizontalmente dentro da área verde
        </p>
      </div>

      <style>{`
        @keyframes scanner-line-move {
          0%, 100% { top: 0; opacity: 0.3; }
          50% { top: calc(100% - 2px); opacity: 1; }
        }
        .animate-scanner-line {
          animation: scanner-line-move 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default ScannerBoleto;
