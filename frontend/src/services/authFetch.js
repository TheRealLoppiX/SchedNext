// O backend agora exige um JWT (Authorization: Bearer <token>) em toda a área /admin/*,
// exceto /admin/login. Como o app inteiro chama `fetch(...)` diretamente, sem nenhuma camada
// de API centralizada, a forma mais segura de garantir que NENHUMA chamada admin fique sem o
// header (e quebre silenciosamente) é interceptar o fetch global uma única vez aqui.
// TODO (ver handoff.md, Fase 4): substituir isso por um services/api.js explícito, chamado
// por cada página, em vez de um patch no fetch global.
const ADMIN_LOGIN_URL_FRAGMENT = '/admin/login';

function getAdminToken() {
  const raw = localStorage.getItem('adminToken');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || null;
  } catch (e) {
    return null;
  }
}

const originalFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const isAdminRoute = url.includes('/admin/') && !url.includes(ADMIN_LOGIN_URL_FRAGMENT);

  if (isAdminRoute) {
    const token = getAdminToken();
    if (token) {
      init = {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`
        }
      };
    }
  }

  return originalFetch(input, init);
};
