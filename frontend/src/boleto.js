// Padrões: BB Doc5175Bloqueto, seção 2.3; FEBRABAN Arrecadação v8.
export function modulo10(digits) {
  let soma = 0;
  let peso = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    const produto = Number(digits[i]) * peso;
    soma += Math.floor(produto / 10) + produto % 10;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - soma % 10) % 10;
}

export function modulo11(digits, arrecadacao = false) {
  let soma = 0;
  let peso = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    soma += Number(digits[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  if (arrecadacao) return resto < 2 ? 0 : 11 - resto;
  const dv = 11 - resto;
  return dv > 9 || dv === 0 ? 1 : dv;
}

function conferir(dados, dv, calcular) {
  if (calcular(dados) !== Number(dv)) {
    throw new Error('Dígito verificador inválido. Confira o código ou tente outra leitura.');
  }
}

export function normalizarBoleto(texto) {
  if (typeof texto !== 'string' || !/^[\d\s.-]+$/.test(texto)) {
    throw new Error('Informe apenas números, espaços, pontos ou traços do boleto.');
  }
  let codigo = texto.replace(/[\s.-]/g, '');
  const tamanhoOriginal = codigo.length;
  if (![44, 47, 48].includes(codigo.length)) {
    throw new Error('Use um código de barras de 44 dígitos ou linha digitável de 47 ou 48 dígitos.');
  }

  if (codigo.length === 47) {
    conferir(codigo.slice(0, 9), codigo[9], modulo10);
    conferir(codigo.slice(10, 20), codigo[20], modulo10);
    conferir(codigo.slice(21, 31), codigo[31], modulo10);
    codigo = codigo.slice(0, 4) + codigo[32] + codigo.slice(33)
      + codigo.slice(4, 9) + codigo.slice(10, 20) + codigo.slice(21, 31);
  } else if (codigo.length === 48) {
    if (codigo[0] !== '8' || !'6789'.includes(codigo[2])) {
      throw new Error('Linha digitável de arrecadação inválida.');
    }
    const calcular = '67'.includes(codigo[2]) ? modulo10 : (d) => modulo11(d, true);
    let barras = '';
    for (let i = 0; i < 48; i += 12) {
      const bloco = codigo.slice(i, i + 11);
      conferir(bloco, codigo[i + 11], calcular);
      barras += bloco;
    }
    codigo = barras;
  }

  // A linha de 47 posições é bancária, mesmo para bancos com código 8xx.
  const bancoValido = codigo.slice(0, 3) !== '000' && codigo[3] === '9'
    && modulo11(codigo.slice(0, 4) + codigo.slice(5)) === Number(codigo[4]);
  if (tamanhoOriginal !== 47 && codigo[0] === '8' && (tamanhoOriginal === 48 || !bancoValido)) {
    if (!'12345679'.includes(codigo[1]) || !'6789'.includes(codigo[2])) {
      throw new Error('Código de arrecadação inválido.');
    }
    const calcular = '67'.includes(codigo[2]) ? modulo10 : (d) => modulo11(d, true);
    conferir(codigo.slice(0, 3) + codigo.slice(4), codigo[3], calcular);
  } else {
    if (codigo.slice(0, 3) === '000' || codigo[3] !== '9') {
      throw new Error('Código de boleto bancário em reais inválido.');
    }
    conferir(codigo.slice(0, 4) + codigo.slice(5), codigo[4], modulo11);
  }
  return codigo;
}
