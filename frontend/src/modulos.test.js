// Carrega todos os módulos de páginas e componentes, inclusive os que o App só importa sob demanda
// (lazy, ex: painel do admin). Pega erro de compilação ou de execução no carregamento de qualquer
// tela sem precisar abrir uma por uma no navegador — criado na migração do CRA pro Vite (28/10),
// em que o JSX dos .js passou a ser compilado por um plugin próprio (ver vite.config.js).
const modulos = import.meta.glob(['./**/*.js', '!./**/*.test.js', '!./setupTests.js', '!./index.js']);

test.each(Object.keys(modulos))('carrega %s', async (caminho) => {
  const modulo = await modulos[caminho]();
  expect(modulo).toBeTruthy();
});
