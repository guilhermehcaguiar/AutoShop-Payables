import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarBoletos, resumoPrazo, selecionaveis, somarDias, formatarData } from '../src/boletosView.js';
import { dadosBoleto } from '../src/dadosBoleto.js';
import { parseValorBR } from '../src/formatar.js';
const hoje = '2026-10-10';
const itens = [
  { id: 1, fornecedor: 'Peças Silva', descricao: 'Óleo motor', valor: 100, status: 'Pendente', vencimento: '2026-09-30', codigo_barras: '123' },
  { id: 2, fornecedor: 'Oficina', valor: 200, status: 'Pago', vencimento: '2026-10-10' },
  { id: 3, fornecedor: 'Peças Silva', valor: 300, status: 'Pendente', vencimento: hoje },
  { id: 4, fornecedor: 'Oficina', valor: '400.00', status: 'Pendente', vencimento: '2026-10-17' },
  { id: 5, fornecedor: 'Oficina', valor: 500, status: 'Pendente', vencimento: '2026-10-18' },
];
const filtros = { mes: '2026-10', status: 'todos' };
const ids = resultado => resultado.map(b => b.id);
test('prazos abrangem meses anteriores, excluem pagos e respeitam os sete dias', () => {
  assert.deepEqual(ids(filtrarBoletos(itens, { ...filtros, status: 'vencidos' }, hoje)), [1]);
  assert.deepEqual(ids(filtrarBoletos(itens, { ...filtros, status: 'vencendo' }, hoje)), [3]);
  assert.deepEqual(ids(filtrarBoletos(itens, { ...filtros, status: 'proximos' }, hoje)), [4]);
  assert.deepEqual(resumoPrazo(itens, hoje), { vencidos: { quantidade: 1, valor: 100 }, vencendo: { quantidade: 1, valor: 300 }, proximos: { quantidade: 1, valor: 400 } });
});
test('busca sem acentos, fornecedor e intervalo com apenas um limite', () => {
  assert.deepEqual(ids(filtrarBoletos(itens, { ...filtros, inicio: '2026-09-01', fim: '2026-10-17', busca: 'oleo' }, hoje)), [1]);
  assert.deepEqual(ids(filtrarBoletos(itens, { ...filtros, inicio: '2026-10-17', fornecedor: 'Oficina' }, hoje)), [4, 5]);
  assert.deepEqual(ids(filtrarBoletos(itens, { ...filtros, dia: '10', status: 'pagos' }, hoje)), [2]);
  assert.deepEqual(ids(selecionaveis(filtrarBoletos(itens, filtros, hoje))), [3, 4, 5]);
  assert.equal(itens[0].id, 1);
});
test('datas locais atravessam meses sem deslocar o dia', () => {
  assert.equal(somarDias('2026-10-30', 7), '2026-11-06');
  assert.equal(formatarData('2026-10-10'), '10/10/2026');
});
test('calendário filtra a data exata em outro mês, sem incluir o mesmo dia de outros meses', () => {
  const contas = [...itens, { id: 6, fornecedor: 'Oficina', valor: 600, status: 'Pendente', vencimento: '2026-11-10' }];
  assert.deepEqual(ids(filtrarBoletos(contas, { ...filtros, inicio: '2026-11-10', fim: '2026-11-10' }, hoje)), [6]);
  assert.deepEqual(ids(filtrarBoletos(contas, { ...filtros, inicio: hoje, fim: hoje, status: 'pendentes' }, hoje)), [3]);
});
test('leitura retorna valor e datas das duas épocas para revisão explícita', () => {
  const dados = dadosBoleto('00193373700000001000500940144816060680935031');
  assert.equal(dados.valor, 1);
  assert.deepEqual(dados.vencimentos, ['2007-12-31', '2032-08-21']);
  assert.equal(dadosBoleto('83710000000123412342026100901234567890123456').valor, null);
  assert.equal(dadosBoleto('83630000000123412342026100901234567890123456').valor, 12.34);
  assert.throws(() => dadosBoleto('00193373700000001000500940144816060680935032'));
});
test('valor não aceita texto residual, múltiplos separadores ou precisão inválida', () => {
  for (const v of ['100abc', '1,2,3', '1.2.3', '-10', 'Infinity', '1,234', '']) assert.equal(parseValorBR(v), null, v);
  for (const [v, esperado] of [['1.500,00', 1500], ['1500.50', 1500.5], ['1.500', 1500], ['R$ 35,20', 35.2]]) assert.equal(parseValorBR(v), esperado);
});
