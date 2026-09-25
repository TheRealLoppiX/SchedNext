// Tema claro/escuro da área do cliente e das telas de acesso. Fica salvo no aparelho
// (localStorage) e é aplicado em <html data-tema="..."> já na importação, antes do primeiro
// render, pra não piscar o tema errado.
const CHAVE = 'sn_tema';

export function temaAtual() {
  try { return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro'; } catch (_) { return 'escuro'; }
}

export function aplicarTema(tema, animar = false) {
  const raiz = document.documentElement;
  if (animar) {
    raiz.classList.add('oc-trocando-tema');
    setTimeout(() => raiz.classList.remove('oc-trocando-tema'), 400);
  }
  raiz.dataset.tema = tema;
  try { localStorage.setItem(CHAVE, tema); } catch (_) { /* modo privado: vale só nesta visita */ }
  window.dispatchEvent(new CustomEvent('sn-tema', { detail: tema }));
}

if (typeof document !== 'undefined') document.documentElement.dataset.tema = temaAtual();
