# Scanner de boletos

O scanner usa ITF (2 de 5 intercalado). A câmera e o upload de imagem só entregam
códigos que passam pela validação do boleto. O cadastro aceita código de barras
de 44 posições, linha digitável bancária de 47 ou de arrecadação de 48. Linhas
digitáveis são convertidas para 44 posições antes do envio à API.

A validação confere os três blocos módulo 10 da linha bancária, os quatro blocos
de arrecadação e o dígito geral. Arrecadação usa módulo 10 para referências 6/7
e módulo 11 para 8/9, com regras distintas do módulo 11 bancário.
Ela verifica a integridade numérica; não consulta registro, beneficiário ou situação
de pagamento no banco.

Fontes:

- [Banco do Brasil: especificação do boleto, seção 2.3 e anexos V/VI](https://www.bb.com.br/docs/pub/emp/empl/dwn/Doc5175Bloqueto.pdf).
- [FEBRABAN: layouts de arrecadação](https://portal.febraban.org.br/pagina/3425/33/pt-br/layout-febraban), versão 8.

## Android e iOS

Use o site por HTTPS e permita a câmera. A exceção de localhost é local ao
aparelho: acessar o IP do computador por HTTP no celular não permite câmera.
No Android, testar no Chrome; no iPhone/iPad, no Safari. O leitor pede a câmera
traseira e a biblioteca configura vídeo inline, necessário no iOS.

O leitor central mantém largura de 1280 pixels e a interface escala para a tela.
Uma segunda leitura analisa o quadro inteiro na resolução da câmera, com busca
ampliada de linhas (TRY_HARDER) e dois métodos de contraste. Assim, as barras
podem ser reconhecidas fora da faixa central e na vertical. Imagens enviadas
também usam essa busca na resolução original. Ambas as leituras exigem código
válido e a segunda leitura é encerrada ao fechar ou trocar por arquivo.
A lanterna é opcional,
fica desligada inicialmente e só aparece quando a câmera informa suporte.
Se a câmera for negada ou indisponível, o upload e a entrada manual continuam disponíveis.
Uploads aceitam imagens compatíveis com o navegador, não PDFs. Para boletos em
PDF, use uma captura nítida do código de barras com margens brancas.

## Verificação

Na pasta frontend:

```sh
npm test
npm run build
npm run test:login:browser
npm run test:scanner:browser
```

O teste de navegador requer Microsoft Edge no Windows. Para outro Chromium,
defina SCANNER_BROWSER com o caminho do executável. Ele cria dados temporários
em frontend/.local e usa uma câmera sintética ITF. Verifica StrictMode, fechamento
durante inicialização, permissão negada, imagem inválida e nova leitura válida,
com telas de 390 e 360 pixels, barras fora da faixa central, foto de página inteira
com contraste reduzido e código na vertical. Emulação de tela no Chromium não equivale a Safari
ou a um aparelho físico.

O teste de login serve o build de produção de `frontend/dist`. Verifica que a
aplicação abre sem erro de JavaScript, testa o acesso com API simulada e abre o
scanner para ler uma imagem ITF e preencher o cadastro. Isso cobre a integração
da biblioteca no bundle final, além dos testes do scanner no servidor de desenvolvimento.
Para reproduzir o ambiente publicado, use as versões do lockfile (`npm ci`).

Antes de publicar, validar em Android e iPhone reais por HTTPS:

1. Ler um boleto bancário e uma conta de arrecadação impressos, com todas as
   barras e margens visíveis na horizontal; conferir o código preenchido.
2. Fechar durante abertura da câmera e reabrir; conferir que a câmera é liberada.
3. Negar a câmera e ler uma foto; repetir com imagem inválida e depois válida.
4. Colar linhas de 47/48 dígitos com pontuação; conferir que a API recebe 44.
