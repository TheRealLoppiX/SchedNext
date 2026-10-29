import { defineConfig, loadEnv, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

// Migrado do Create React App (react-scripts, descontinuado e com dezenas de vulnerabilidades
// conhecidas na cadeia de build) em 28/10. Mantém o que o CRA fazia e o deploy espera:
//   - saída em build/ (pasta publicada pelo Static Site do Render);
//   - variáveis REACT_APP_* do ambiente expostas como process.env.REACT_APP_* (o Render injeta
//     REACT_APP_API_URL no build, ver src/services/api.js), sem precisar mexer no código;
//   - JSX dentro de arquivos .js (o projeto inteiro usa .js, não .jsx);
//   - dev server na porta 3000 (FRONTEND_URL do backend em dev aponta pra ela).

// O Vite 8 só aceita JSX em .jsx/.tsx (o transformador nativo do Rolldown decide a linguagem pela
// extensão e não dá pra mudar por configuração). Em vez de renomear dezenas de arquivos, este
// plugin roda antes e compila o JSX dos .js de src/ com o mesmo compilador do Vite (Oxc).
function jsxEmArquivosJs(mode) {
  return {
    name: 'schednext:jsx-em-arquivos-js',
    enforce: 'pre',
    async transform(codigo, id) {
      const arquivo = id.split('?')[0].replace(/\\/g, '/');
      if (!/\/src\/.*\.js$/.test(arquivo) || arquivo.includes('/node_modules/') || !/<[A-Za-z>]/.test(codigo)) return null;
      const resultado = await transformWithOxc(codigo, arquivo, {
        lang: 'jsx',
        jsx: { runtime: 'automatic', development: mode !== 'production' },
        sourcemap: true
      });
      return { code: resultado.code, map: resultado.map };
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  const processEnv = Object.fromEntries(
    Object.entries(env).map(([chave, valor]) => [`process.env.${chave}`, JSON.stringify(valor)])
  );

  return {
    plugins: [jsxEmArquivosJs(mode), react()],
    build: { outDir: 'build', sourcemap: false },
    // A varredura de dependências do dev server lê os arquivos crus (antes dos plugins): sem isso
    // ela falha no JSX dos .js e pula o pré-empacotamento, que é o que converte pacotes CommonJS
    // (ex: react) pra rodar no navegador.
    optimizeDeps: { rolldownOptions: { moduleTypes: { '.js': 'jsx' } } },
    define: {
      ...processEnv,
      // Qualquer outra process.env.REACT_APP_* não definida vira undefined em vez de quebrar.
      'process.env': '{}'
    },
    server: { port: 3000 },
    preview: { port: 3000 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js'
    }
  };
});
