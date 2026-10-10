// Reutiliza o ZXing já distribuído com html5-qrcode, com busca ampliada de linhas.
import ZXing from 'html5-qrcode/third_party/zxing-js.umd.js';
import { normalizarBoleto } from './boleto.js';

const hints = new Map([
  [ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.ITF]],
  [ZXing.DecodeHintType.TRY_HARDER, true],
  [ZXing.DecodeHintType.ALLOWED_LENGTHS, [44]],
]);

function decodificar(canvas) {
  const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
  // Hybrid preserva contraste local; Global ajuda em barras pequenas na imagem.
  for (const Binarizer of [ZXing.HybridBinarizer, ZXing.GlobalHistogramBinarizer]) {
    try {
      const bitmap = new ZXing.BinaryBitmap(new Binarizer(source));
      return normalizarBoleto(new ZXing.MultiFormatReader().decode(bitmap, hints).getText());
    } catch { /* Quadro sem boleto válido: continuar buscando. */ }
  }
  return null;
}

export function lerCanvasBoleto(canvas) {
  const codigo = decodificar(canvas);
  if (codigo) return codigo;
  // O luminance source de canvas desta versão não garante rotação automática.
  const rotated = document.createElement('canvas');
  rotated.width = canvas.height;
  rotated.height = canvas.width;
  const context = rotated.getContext('2d');
  context.translate(rotated.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(canvas, 0, 0);
  return decodificar(rotated);
}

export async function lerImagemBoleto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return lerCanvasBoleto(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function observarVideoBoleto(video, aceitar) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let encerrado = false;
  let timer;
  const ler = () => {
    if (encerrado) return;
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      // Usa os pixels da câmera, sem reduzir a imagem à largura da interface.
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const codigo = lerCanvasBoleto(canvas);
      if (codigo) aceitar(codigo);
    }
    if (!encerrado) timer = setTimeout(ler, 400);
  };
  timer = setTimeout(ler, 0);
  return () => { encerrado = true; clearTimeout(timer); };
}
