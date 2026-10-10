import { normalizarBoleto, modulo11 } from './boleto.js';
import { somarDias } from './boletosView.js';

export function dadosBoleto(texto) {
  const codigo = normalizarBoleto(texto);
  const bancario = codigo[3] === '9' && codigo.slice(0, 3) !== '000' && modulo11(codigo.slice(0, 4) + codigo.slice(5)) === Number(codigo[4]);
  const valor = bancario ? Number(codigo.slice(9, 19)) / 100 : '68'.includes(codigo[2]) ? Number(codigo.slice(4, 15)) / 100 : null;
  const fator = bancario ? Number(codigo.slice(5, 9)) : 0;
  // O fator é reutilizado desde 22/02/2025. A revisão evita escolher a época silenciosamente.
  const vencimentos = fator ? [somarDias('1997-10-07', fator), ...(fator >= 1000 ? [somarDias('2025-02-22', fator - 1000)] : [])] : [];
  return { codigo, valor: valor || null, vencimentos };
}
