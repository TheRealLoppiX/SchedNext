// Detecta se o app está sendo acessado por um subdomínio de tenant
// (ex: barbearia.schednext.com.br) em vez do domínio raiz ou de um
// caminho /:empresaSlug. Ver App.js para como isso é usado no roteamento.
const DOMINIO_RAIZ = 'schednext.com.br';
const SUBDOMINIOS_RESERVADOS = ['www', 'api'];

export function obterSlugSubdominio() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (!host.endsWith(`.${DOMINIO_RAIZ}`)) return null;
  const sub = host.slice(0, -(DOMINIO_RAIZ.length + 1));
  if (!sub || sub.includes('.') || SUBDOMINIOS_RESERVADOS.includes(sub)) return null;
  return sub;
}

// Rotas que nunca são prefixadas por slug de tenant, mesmo em modo subdomínio.
export function rotaIndependeDeTenant(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/cadastrar';
}
