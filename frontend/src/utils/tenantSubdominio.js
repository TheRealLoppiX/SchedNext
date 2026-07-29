// Detecta se o app está sendo acessado por um subdomínio de tenant
// (ex: barbearia.schednext.com.br) em vez do domínio raiz ou de um
// caminho /:empresaSlug. Ver App.js para como isso é usado no roteamento.
const DOMINIO_RAIZ = 'schednext.com.br';
const SUBDOMINIOS_RESERVADOS = ['www', 'api'];

export function obterSlugSubdominio() {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;

  if (host.endsWith(`.${DOMINIO_RAIZ}`)) {
    const sub = host.slice(0, -(DOMINIO_RAIZ.length + 1));
    if (!sub || sub.includes('.') || SUBDOMINIOS_RESERVADOS.includes(sub)) return null;
    return sub;
  }

  if (host === DOMINIO_RAIZ || host === 'localhost' || host === '127.0.0.1') return null;

  // Domínio próprio de um tenant (plano Enterprise). A resolução é assíncrona (chama a API,
  // ver rota pública GET /dominio/resolver) e acontece antes do primeiro render em App.js, que
  // guarda o resultado aqui pra este helper continuar síncrono pros chamadores existentes.
  try {
    return sessionStorage.getItem('dominioCustomizadoSlug') || null;
  } catch (err) {
    return null;
  }
}

// Rotas que nunca são prefixadas por slug de tenant, mesmo em modo subdomínio.
export function rotaIndependeDeTenant(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/cadastrar'
    || pathname === '/admin-absoluto' || pathname.startsWith('/admin-absoluto/');
}
