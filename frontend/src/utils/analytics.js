import { API_URL } from '../services/api';
import { obterSlugSubdominio } from './tenantSubdominio';

// Analytics próprio do site institucional da SchedNext (landing, docs, cadastro de empresa e
// login do admin), sem Google Analytics nem cookie de terceiro. Alimenta o "Funil de
// conversão" do admin absoluto (ver backend routes/analytics.js e sql/2026_analytics_funil.sql).
//
// - Visitante: id aleatório guardado no localStorage (conta pessoas que voltam).
// - Sessão: id aleatório que expira após 30 min sem atividade, ou quando a pessoa chega por um
//   link de campanha novo (utm/gclid/fbclid). A atribuição (de onde veio) é da entrada.
// - Eventos vão numa fila e são mandados em lote via sendBeacon (sobrevive a fechar a aba).
//
// Nunca manda o que a pessoa digitou: nos campos do cadastro só registra QUAL campo foi tocado.
// Não roda em subdomínio/domínio de empresa (lá é o site do cliente, não o da SchedNext), em
// localhost (a não ser com REACT_APP_ANALYTICS_DEV=1) nem no navegador de quem está logado no
// admin absoluto, pra não misturar teste/acesso interno com dado real.

const CHAVE_VISITANTE = 'sn_analytics_visitante';
const CHAVE_SESSAO = 'sn_analytics_sessao';
const INATIVIDADE_MS = 30 * 60 * 1000;
const INTERVALO_ENVIO_MS = 4000;

// Páginas rastreadas. Rotas do painel (admin, admin absoluto, cliente logado) ficam de fora.
export const ROTAS_RASTREADAS = ['/', '/docs', '/cadastrar', '/admin/login', '/admin/recuperar-senha'];

let fila = [];
let timerEnvio = null;
let ouvintesInstalados = false;
let primeiraPaginaDoCarregamento = true;

function gerarId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function ler(chave) {
  try { return localStorage.getItem(chave); } catch (_) { return null; }
}

function gravar(chave, valor) {
  try { localStorage.setItem(chave, valor); } catch (_) { /* modo privado: segue só em memória */ }
}

let sessaoEmMemoria = null;

function analyticsAtivo() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if ((host === 'localhost' || host === '127.0.0.1') && process.env.REACT_APP_ANALYTICS_DEV !== '1') return false;
  if (obterSlugSubdominio()) return false;
  // Navegador de alguém do time (logado no admin absoluto) não entra na conta.
  if (ler('superAdminToken')) return false;
  return true;
}

function rotaRastreada(caminho) {
  return ROTAS_RASTREADAS.includes(caminho);
}

function obterVisitante() {
  let id = ler(CHAVE_VISITANTE);
  if (!id) {
    id = gerarId();
    gravar(CHAVE_VISITANTE, id);
  }
  return id;
}

function paramsCampanha() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get('utm_source'),
    utm_medium: p.get('utm_medium'),
    utm_campaign: p.get('utm_campaign'),
    utm_term: p.get('utm_term'),
    utm_content: p.get('utm_content'),
    tem_clid: Boolean(p.get('gclid') || p.get('fbclid') || p.get('msclkid') || p.get('gbraid') || p.get('wbraid') || p.get('ttclid'))
  };
}

function novaSessao() {
  let fuso = null;
  try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { /* ignora */ }
  return {
    id: gerarId(),
    visitante_id: obterVisitante(),
    ultima: Date.now(),
    atributos: {
      referrer: document.referrer || null,
      pagina_entrada: window.location.pathname,
      ...paramsCampanha(),
      largura_tela: window.innerWidth,
      idioma: navigator.language || null,
      fuso
    }
  };
}

function obterSessao() {
  let sessao = sessaoEmMemoria;
  if (!sessao) {
    try { sessao = JSON.parse(ler(CHAVE_SESSAO) || 'null'); } catch (_) { sessao = null; }
  }
  const campanha = primeiraPaginaDoCarregamento ? paramsCampanha() : null;
  const chegouPorCampanhaNova = campanha && (campanha.utm_source || campanha.utm_campaign || campanha.tem_clid) &&
    (!sessao || sessao.atributos.utm_campaign !== campanha.utm_campaign || sessao.atributos.utm_source !== campanha.utm_source || (campanha.tem_clid && !sessao.atributos.tem_clid));
  if (!sessao || Date.now() - sessao.ultima > INATIVIDADE_MS || chegouPorCampanhaNova) {
    enviarFila(); // o que sobrou da sessão anterior vai com ela
    sessao = novaSessao();
  }
  sessao.ultima = Date.now();
  sessaoEmMemoria = sessao;
  gravar(CHAVE_SESSAO, JSON.stringify(sessao));
  return sessao;
}

function enviarFila() {
  if (!fila.length) return;
  const lote = fila;
  fila = [];
  clearTimeout(timerEnvio);
  timerEnvio = null;

  // Uma sessão por lote (a fila é esvaziada sempre que a sessão troca).
  const { sessao } = lote[0];
  const corpo = JSON.stringify({
    sessao: { id: sessao.id, visitante_id: sessao.visitante_id, ...sessao.atributos },
    eventos: lote.map(({ evento }) => evento)
  });
  const url = `${API_URL}/analytics/eventos`;
  // text/plain = requisição "simples" de CORS, sem preflight; é o que o sendBeacon aceita.
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([corpo], { type: 'text/plain' }))) return;
  } catch (_) { /* cai no fetch abaixo */ }
  fetch(url, { method: 'POST', body: corpo, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
}

function enfileirar(tipo, nome, dados) {
  if (!analyticsAtivo()) return;
  const caminho = window.location.pathname;
  if (!rotaRastreada(caminho)) return;
  const sessao = obterSessao();
  fila.push({ sessao, evento: { tipo, nome, caminho, dados: dados || null, em: new Date().toISOString() } });
  if (fila.length >= 20) enviarFila();
  else if (!timerEnvio) timerEnvio = setTimeout(enviarFila, INTERVALO_ENVIO_MS);
}

// Nome legível pra um clique sem data-track: texto do botão/link (sem nada digitado).
function nomeDoElemento(el) {
  if (el.dataset.track) return el.dataset.track;
  const texto = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const tipo = el.tagName === 'A' ? 'link' : 'botão';
  return texto ? `${tipo}: ${texto.slice(0, 60)}` : null;
}

function instalarOuvintes() {
  if (ouvintesInstalados) return;
  ouvintesInstalados = true;

  // Captura TODO clique em link/botão das páginas rastreadas. Os principais têm data-track com
  // um nome fixo (ex: "hero_criar_conta"); os demais entram pelo texto.
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-track], a, button');
    if (!el) return;
    const nome = nomeDoElemento(el);
    if (!nome) return;
    const dados = {};
    if (el.dataset.trackExtra) dados.extra = el.dataset.trackExtra;
    const destino = el.getAttribute('href');
    if (destino) dados.destino = destino.slice(0, 150);
    enfileirar('clique', nome, Object.keys(dados).length ? dados : null);
  }, true);

  const aoSair = () => enviarFila();
  window.addEventListener('pagehide', aoSair);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') aoSair();
  });
}

// Chamado a cada troca de rota (ver RastreadorAnalytics em App.js).
export function rastrearPagina(caminho) {
  if (!analyticsAtivo() || !rotaRastreada(caminho)) return;
  instalarOuvintes();
  enfileirar('pagina', caminho);
  primeiraPaginaDoCarregamento = false;
}

// Marco de negócio (etapas do cadastro, login...). `dados` nunca deve levar o que foi digitado.
export function rastrearEvento(nome, dados) {
  enfileirar('evento', nome, dados);
}

// Seções da landing que a pessoa chegou a ver (profundidade de rolagem). Marca cada elemento
// com data-track-secao="nome"; conta uma vez por carregamento da página.
export function observarSecoes(raiz = document) {
  if (!analyticsAtivo() || typeof IntersectionObserver === 'undefined') return () => {};
  const vistas = new Set();
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      const nome = entrada.target.dataset.trackSecao;
      if (entrada.isIntersecting && nome && !vistas.has(nome)) {
        vistas.add(nome);
        enfileirar('secao', nome);
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.35 });
  raiz.querySelectorAll('[data-track-secao]').forEach((el) => observador.observe(el));
  return () => observador.disconnect();
}
