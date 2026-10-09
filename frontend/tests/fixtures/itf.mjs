// Encoder ITF independente: pares intercalam barras e espaços, mais zona de silêncio.
export function imagemITF(codigo, escala = 2) {
  const padroes = ['11221', '21112', '12112', '22111', '11212', '21211', '12211', '11122', '21121', '12121'];
  const larguras = [1, 1, 1, 1];
  for (let i = 0; i < codigo.length; i += 2) {
    for (let j = 0; j < 5; j++) {
      larguras.push(Number(padroes[Number(codigo[i])][j]), Number(padroes[Number(codigo[i + 1])][j]));
    }
  }
  larguras.push(2, 1, 1);
  const margem = 20 * escala;
  const width = larguras.reduce((s, n) => s + n * escala, 0) + margem * 2;
  const height = 120;
  const pixels = new Uint8ClampedArray(width * height).fill(255);
  let x = margem;
  larguras.forEach((largura, i) => {
    if (i % 2 === 0) {
      for (let y = 15; y < height - 15; y++) pixels.fill(0, y * width + x, y * width + x + largura * escala);
    }
    x += largura * escala;
  });
  return { pixels, width, height };
}

