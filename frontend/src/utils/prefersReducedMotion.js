// Preferência "reduzir movimento" do sistema operacional, lida uma única vez no carregamento do
// módulo: a media query não muda no meio da sessão na prática (mesma premissa que a Landing.js já
// assumia antes de existir um lugar compartilhado pra isso), então uma constante única serve todo
// mundo sem recalcular por componente nem divergir entre montagens em momentos diferentes.
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default prefersReducedMotion;
