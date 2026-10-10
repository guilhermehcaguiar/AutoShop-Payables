export function dataLocal(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

export function somarDias(data, dias) {
  const valor = new Date(data + 'T12:00:00');
  valor.setDate(valor.getDate() + dias);
  return dataLocal(valor);
}

export function formatarData(data) {
  if (!data) return '—';
  const valor = new Date(data.length === 10 ? data + 'T12:00:00' : data);
  return Number.isNaN(valor.getTime()) ? '—' : valor.toLocaleDateString('pt-BR');
}

export const moeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatarDataHora(data) {
  if (!data) return '—';
  const valor = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(data) ? data : data + 'Z');
  return Number.isNaN(valor.getTime()) ? '—' : valor.toLocaleString('pt-BR');
}
const buscar = texto => String(texto || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function filtrarBoletos(boletos, filtros, hoje = dataLocal()) {
  const { mes, inicio, fim, status, dia, fornecedor, busca } = filtros;
  const proximos = somarDias(hoje, 7);
  const termo = buscar(busca).trim();
  return boletos.filter(b => {
    const focoPrazo = ['vencidos', 'vencendo', 'proximos'].includes(status);
    if (!focoPrazo) {
      if (inicio || fim) {
        if (inicio && b.vencimento < inicio || fim && b.vencimento > fim) return false;
      } else if (mes && !b.vencimento.startsWith(mes)) return false;
    }
    if (status === 'pagos' && b.status !== 'Pago') return false;
    if (status === 'pendentes' && b.status === 'Pago') return false;
    if (status === 'vencidos' && (b.status === 'Pago' || b.vencimento >= hoje)) return false;
    if (status === 'vencendo' && (b.status === 'Pago' || b.vencimento !== hoje)) return false;
    if (status === 'proximos' && (b.status === 'Pago' || b.vencimento <= hoje || b.vencimento > proximos)) return false;
    if (dia && Number(b.vencimento.slice(8, 10)) !== Number(dia)) return false;
    if (fornecedor && b.fornecedor !== fornecedor) return false;
    return !termo || buscar([b.fornecedor, b.descricao, b.codigo_barras].join(' ')).includes(termo);
  }).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.id - b.id);
}

export function selecionaveis(boletos) { return boletos.filter(b => b.status !== 'Pago'); }
export function resumoPrazo(boletos, hoje = dataLocal()) {
  const fim = somarDias(hoje, 7);
  const grupos = { vencidos: [], vencendo: [], proximos: [] };
  for (const b of selecionaveis(boletos)) {
    if (b.vencimento < hoje) grupos.vencidos.push(b);
    else if (b.vencimento === hoje) grupos.vencendo.push(b);
    else if (b.vencimento <= fim) grupos.proximos.push(b);
  }
  return Object.fromEntries(Object.entries(grupos).map(([nome, itens]) => [nome, { quantidade: itens.length, valor: itens.reduce((s, b) => s + Number(b.valor), 0) }]));
}
