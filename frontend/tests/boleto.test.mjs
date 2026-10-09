import { imagemITF } from './fixtures/itf.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { modulo10, modulo11, normalizarBoleto } from '../src/boleto.js';

const require = createRequire(import.meta.url);
// Mesmo decodificador ZXing distribuído com html5-qrcode 2.3.8.
const zxing = require('html5-qrcode/third_party/zxing-js.umd.js');
// Exemplo do manual BB Doc5175Bloqueto, anexo V.
const bancario = '00193373700000001000500940144816060680935031';
const linhaBancaria = '00190500954014481606906809350314337370000000100';
const arrecadacoes = [
  ['83630000000123412342026100901234567890123456', '836300000004123412342024610090123452678901234560'],
  ['83710000000123412342026100901234567890123456', '837100000004123412342024610090123452678901234560'],
  ['83850000000123412342026100901234567890123456', '838500000008123412342028610090123455678901234561'],
  ['83930000000123412342026100901234567890123456', '839300000002123412342028610090123455678901234561'],
];

test('boleto do manual BB: barras, linha digitável e pontuação', () => {
  assert.equal(normalizarBoleto(bancario), bancario);
  assert.equal(normalizarBoleto(linhaBancaria), bancario);
  assert.equal(normalizarBoleto('00190.50095 40144.816069 06809.350314 3 37370000000100'), bancario);
});

test('módulos 10 e 11: exemplos FEBRABAN e exceções', () => {
  assert.equal(modulo10('01230067896'), 3);
  assert.equal(modulo11('01230067896', true), 0);
  for (const [texto, esperado] of [['0', 0], ['6', 0], ['5', 1], ['1', 9]]) {
    assert.equal(modulo11(texto, true), esperado);
  }
  for (const texto of ['0', '6', '5']) assert.equal(modulo11(texto), 1);
});

test('aceita boleto bancário com código do banco iniciado por 8', () => {
  const barras = '81298100000000001001234567890123456789012345';
  assert.equal(normalizarBoleto(barras), barras);
});

for (const [barras, linha] of arrecadacoes) {
  test('arrecadação: referência ' + barras[2] + ', 44 e 48 dígitos', () => {
    assert.equal(normalizarBoleto(barras), barras);
    assert.equal(normalizarBoleto(linha), barras);
  });
}

test('rejeita leituras truncadas, caracteres indevidos e formatos estranhos', () => {
  for (const codigo of ['', '0'.repeat(44), bancario.slice(1), bancario + '0', linhaBancaria + '0', 'abc' + bancario, 'https://' + bancario]) {
    assert.throws(() => normalizarBoleto(codigo));
  }
});

test('rejeita alteração em qualquer dígito de código de barras ou linha digitável', () => {
  for (const codigo of [bancario, linhaBancaria, ...arrecadacoes.flat()]) {
    for (let i = 0; i < codigo.length; i++) {
      const alterado = codigo.slice(0, i) + (Number(codigo[i]) + 1) % 10 + codigo.slice(i + 1);
      assert.throws(() => normalizarBoleto(alterado), 'alteração na posição ' + i + ' de ' + codigo);
    }
  }
});


for (const codigo of [bancario, ...arrecadacoes.map(([b]) => b)]) {
  test('decodifica imagem ITF de 44 dígitos: ' + codigo.slice(0, 4), () => {
    for (const escala of [2, 3]) {
      const { pixels, width, height } = imagemITF(codigo, escala);
      const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels, width, height)));
      const hints = new Map([[zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.ITF]]]);
      const resultado = new zxing.MultiFormatReader().decode(bitmap, hints);
      assert.equal(normalizarBoleto(resultado.getText()), codigo);
    }
  });
}
