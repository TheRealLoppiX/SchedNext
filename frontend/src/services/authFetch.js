// O backend agora exige um JWT (Authorization: Bearer <token>) em toda a área /admin/*,
// exceto /admin/login, e também nas rotas de perfil do cliente (routes/perfil.js). Antes
// essas rotas de cliente não exigiam nenhum token. Como o app inteiro chama `fetch(...)`
// diretamente, sem nenhuma camada de API centralizada, a forma mais segura de garantir que
// NENHUMA chamada fique sem o header certo (e quebre silenciosamente) é interceptar o fetch
// global uma única vez aqui.
// TODO (ver handoff.md, Fase 4): substituir isso por um services/api.js explícito, chamado
// por cada página, em vez de um patch no fetch global.
const ADMIN_LOGIN_URL_FRAGMENT = '/admin/login';

// Fragmentos de rota protegidos por routes/perfil.js (token de cliente comum, chave
// localStorage 'token'). Mantido como lista explícita em vez de "tudo que não é /admin/"
// porque várias rotas públicas (login, cadastro, empresasPublico, disponibilidade, agendar)
// também não passam por '/admin/' e não devem levar esse header.
const CLIENTE_ROUTE_FRAGMENTS = [
  '/notificacoes/',
  '/meus-agendamentos/',
  '/usuarios/',
  '/atualizar-perfil/',
  '/cancelar-agendamento/',
  '/avaliar',
  '/fidelidade/',
  '/usuario/',
  '/agendar'
];

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

function getClienteToken() {
  return localStorage.getItem('token') || null;
}

const originalFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const isAdminRoute = url.includes('/admin/') && !url.includes(ADMIN_LOGIN_URL_FRAGMENT);
  const isClienteRoute = !isAdminRoute && CLIENTE_ROUTE_FRAGMENTS.some((frag) => url.includes(frag));

  const token = isAdminRoute ? getAdminToken() : isClienteRoute ? getClienteToken() : null;

  if (token) {
    init = {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`
      }
    };
  }

  return originalFetch(input, init).then((res) => {
    // Sessão expirada/token inválido: antes disso o app só mostrava um toast genérico de
    // "não foi possível conectar" e ficava preso na tela, sem nunca deslogar de verdade.
    if (res.status === 401) {
      if (isAdminRoute) {
        localStorage.removeItem('adminToken');
        if (!window.location.pathname.startsWith('/admin/login')) {
          window.location.href = '/admin/login';
        }
      } else if (isClienteRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario_id');
        const slugMatch = window.location.pathname.match(/^\/([^/]+)/);
        const slug = slugMatch ? slugMatch[1] : '';
        const loginPath = slug ? `/${slug}/login` : '/';
        if (!window.location.pathname.endsWith('/login')) {
          window.location.href = loginPath;
        }
      }
    }
    return res;
  });
};
