export function parseValorBR(texto) {
  if (typeof texto !== 'string') return null;
  const limpo = texto.trim().replace(/[R$\s]/g, '');
  if (!limpo) return null;

  let numero;
  if (limpo.includes(',')) {
    numero = parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  } else {
    const partes = limpo.split('.');
    const ultimaParte = partes[partes.length - 1];
    if (partes.length > 1 && ultimaParte.length <= 2) {
      numero = parseFloat(limpo);
    } else {
      numero = parseFloat(limpo.replace(/\./g, ''));
    }
  }
  return Number.isFinite(numero) ? numero : null;
}

export function formatarValorBR(numero) {
  return Number(numero || 0).toFixed(2).replace('.', ',');
}