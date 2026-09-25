import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { obterSlugSubdominio, rotaIndependeDeTenant } from './utils/tenantSubdominio';
import { API_URL } from './services/api';
import { rastrearPagina } from './utils/analytics';
import Login from './pages/Login';
import EntrarMagico from './pages/EntrarMagico';
import Barbeiros from './pages/Barbeiros';
import Agenda from './pages/Agenda';
import Assinatura from './pages/Assinatura';
import Cadastro from './pages/Cadastro';
import RecuperarSenha from './pages/RecuperarSenha';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import LoginAdmin from './pages/admin/LoginAdmin';
import RecuperarSenhaAdmin from './pages/admin/RecuperarSenhaAdmin';
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin';
import RecuperarSenhaSuperAdmin from './pages/superadmin/RecuperarSenhaSuperAdmin';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import HelpButton from './components/HelpButton';
import BotaoTema from './components/BotaoTema';

// Depois de um deploy novo, uma aba aberta antes dele pede pacotes que não existem mais no
// servidor (os nomes mudam a cada build). Nesse caso recarrega a página uma vez só, pra pegar a
// versão nova, em vez de quebrar a tela; se já recarregou há pouco e ainda falha, deixa o erro seguir.
function lazy(carregar) {
  return React.lazy(() => carregar().catch((erro) => {
    const chave = 'sn_recarregou_pacote';
    let ultima = 0;
    try { ultima = Number(sessionStorage.getItem(chave)) || 0; } catch (_) { /* sem storage */ }
    if (Date.now() - ultima > 30000) {
      try { sessionStorage.setItem(chave, String(Date.now())); } catch (_) { /* sem storage */ }
      window.location.reload();
      return new Promise(() => {}); // segura o Suspense até a página recarregar
    }
    throw erro;
  }));
}

// Divisão do código por área (React.lazy): o pacote principal leva só a área do cliente final e
// os logins. Site institucional, painel da empresa e admin absoluto viram pacotes separados,
// baixados só por quem entra neles (e pré-carregados em segundo plano, ver AppRoutes). As páginas
// com o mesmo webpackChunkName saem num arquivo só, pra navegar dentro do painel sem nova espera.
const Landing = lazy(() => import(/* webpackChunkName: "site" */ './pages/Landing'));
const Docs = lazy(() => import(/* webpackChunkName: "site" */ './pages/Docs'));
const CadastroEmpresa = lazy(() => import(/* webpackChunkName: "site" */ './pages/CadastroEmpresa'));

const AdminConta = lazy(() => import(/* webpackChunkName: "painel-admin" */ './AdminConta'));
const AdminDashboard = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminDashboard'));
const AdminBarbeiros = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminBarbeiros'));
const GestaoServicos = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/GestaoServicos'));
const AdminAgendamentos = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminAgendamentos'));
const AdminEstoque = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminEstoque'));
const AdminAcoes = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminAcoes'));
const AdminAssinaturas = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminAssinaturas'));
const AdminClientes = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminClientes'));
const AdminUnidades = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminUnidades'));
const AdminUnidadeDashboard = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminUnidadeDashboard'));
const AdminApiKeys = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminApiKeys'));
const AdminRelatorios = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminRelatorios'));
const AdminDominio = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminDominio'));
const AdminWhatsapp = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminWhatsapp'));
const AdminMercadoPago = lazy(() => import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminMercadoPago'));

// Admin absoluto (dono da plataforma) — fora da árvore de tenant, ver
// src/utils/tenantSubdominio.js (rotaIndependeDeTenant).
const SuperAdminDashboard = lazy(() => import(/* webpackChunkName: "admin-absoluto" */ './pages/superadmin/SuperAdminDashboard'));


// Faz o roteamento por slug (/:empresaSlug/...) funcionar também quando o
// tenant é acessado por subdomínio (ex: barbearia.schednext.com.br). Nenhuma
// página de tenant precisa saber disso: aqui a gente injeta o slug detectado
// no pathname "virtual" só pra fins de match de rota, e limpa da barra de
// endereço real qualquer navegação interna que ainda tenha montado o slug
// (as páginas de tenant continuam navegando com navigate(`/${empresaSlug}/...`)
// normalmente, sem precisar saber que estão num subdomínio).
function AppRoutes({ empresaId, setEmpresaId, deslogarAdmin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const slugSubdominio = obterSlugSubdominio();

  useEffect(() => {
    if (!slugSubdominio || rotaIndependeDeTenant(location.pathname)) return;
    const prefixo = `/${slugSubdominio}`;
    if (location.pathname === prefixo || location.pathname.startsWith(`${prefixo}/`)) {
      const semPrefixo = location.pathname.slice(prefixo.length) || '/';
      navigate(`${semPrefixo}${location.search}`, { replace: true });
    }
  }, [location, slugSubdominio, navigate]);

  // Funil de conversão do site institucional (ver utils/analytics.js): só registra as rotas
  // públicas da SchedNext, nunca as de tenant nem as do painel.
  useEffect(() => {
    rastrearPagina(location.pathname);
  }, [location.pathname]);

  // Pré-carrega em segundo plano o pacote da área em que a pessoa está (ex.: na tela de login do
  // painel já baixa o painel), pra depois de entrar a página abrir sem a tela de carregamento.
  const areaAtual = location.pathname.startsWith('/admin-absoluto') ? 'absoluto' : location.pathname.startsWith('/admin') ? 'painel' : null;
  useEffect(() => {
    if (areaAtual === 'painel') import(/* webpackChunkName: "painel-admin" */ './pages/admin/AdminDashboard').catch(() => {});
    if (areaAtual === 'absoluto') import(/* webpackChunkName: "admin-absoluto" */ './pages/superadmin/SuperAdminDashboard').catch(() => {});
  }, [areaAtual]);

  let pathnameEfetivo = location.pathname;
  if (slugSubdominio && !rotaIndependeDeTenant(location.pathname)) {
    pathnameEfetivo = `/${slugSubdominio}${location.pathname === '/' ? '' : location.pathname}`;
  }

  return (
    <Suspense fallback={<TelaCarregando />}>
    <Routes location={{ ...location, pathname: pathnameEfetivo }}>
      {/* ================= ROTAS PÚBLICAS (SEM SIDEBAR) ================= */}
      <Route path="/" element={<Landing />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/cadastrar" element={<CadastroEmpresa setEmpresaLogada={setEmpresaId} />} />

      {/* As rotas de tenant (/:empresaSlug/...) só existem quando o slug veio de um domínio
          próprio de tenant (subdomínio ou domínio customizado, ver tenantSubdominio.js) — o
          acesso antigo por caminho no domínio raiz (schednext.com.br/nome-da-empresa) foi
          desativado agora que toda empresa tem seu próprio domínio/subdomínio. Sem esse
          guard, essas mesmas rotas casariam também com qualquer /alguma-coisa/login digitado
          direto no domínio raiz. */}
      {slugSubdominio && (
        <>
          <Route path="/:empresaSlug" element={<Login />} />
          <Route path="/:empresaSlug/login" element={<Login />} />
          <Route path="/:empresaSlug/entrar-magico" element={<EntrarMagico />} />
          <Route path="/:empresaSlug/cadastro" element={<Cadastro />} />
          <Route path="/:empresaSlug/recuperar-senha" element={<RecuperarSenha />} />
        </>
      )}

      <Route
        path="/admin/login"
        element={
          empresaId ? <Navigate to="/admin/dashboard" /> : <LoginAdmin setEmpresaLogada={setEmpresaId} />
        }
      />
      <Route path="/admin/recuperar-senha" element={<RecuperarSenhaAdmin />} />

      {/* ================= ADMIN ABSOLUTO (dono da plataforma, fora do tenant) ================= */}
      <Route path="/admin-absoluto/login" element={<SuperAdminLogin />} />
      <Route path="/admin-absoluto/recuperar-senha" element={<RecuperarSenhaSuperAdmin />} />
      <Route
        path="/admin-absoluto/dashboard"
        element={localStorage.getItem('superAdminToken') ? <SuperAdminDashboard /> : <Navigate to="/admin-absoluto/login" />}
      />
      <Route path="/admin-absoluto/*" element={<Navigate to="/admin-absoluto/login" />} />

      {/* ================= ROTAS COM SIDEBAR (LAYOUT ÚNICO) ================= */}
      <Route element={<Layout setEmpresaId={setEmpresaId} />}>

        {/* --- Rotas do Cliente (só existem via subdomínio/domínio próprio, ver acima) --- */}
        {slugSubdominio && (
          <>
            <Route path="/:empresaSlug/barbeiros" element={<Barbeiros />} />
            <Route path="/:empresaSlug/agenda" element={<Agenda />} />
            <Route path="/:empresaSlug/assinatura" element={<Assinatura />} />
            <Route path="/:empresaSlug/perfil" element={<Dashboard />} />
          </>
        )}

        {/* --- Rotas do Administrador (Protegidas) --- */}
        <Route
          path="/admin/dashboard"
          element={
            empresaId ? (
              <AdminDashboard empresaId={empresaId} onLogout={deslogarAdmin} />
            ) : (
              <Navigate to="/admin/login" />
            )
          }
        />

        <Route path="/admin/unidade/dashboard" element={empresaId ? <AdminUnidadeDashboard empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route
          path="/admin/barbeiros"
          element={
            empresaId ? (
              <AdminBarbeiros empresaId={empresaId} />
            ) : (
              <Navigate to="/admin/login" />
            )
          }
        />

        <Route
          path="/admin/servicos"
          element={empresaId ? <GestaoServicos empresaId={empresaId} /> : <Navigate to="/admin/login" />}
        />

        {/* ROTA DE CONFIGURAÇÕES DA CONTA (BARBEARIA) ADICIONADA E PROTEGIDA */}
        <Route
          path="/admin/conta"
          element={empresaId ? <AdminConta empresaId={empresaId} /> : <Navigate to="/admin/login" />}
        />
        <Route
          path="/admin/estoque"
          element={empresaId ? <AdminEstoque empresaId={empresaId} /> : <Navigate to="/admin/login" />}
        />

        <Route path="/admin/agendamentos" element={empresaId ? <AdminAgendamentos empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        {/* ROTA DE AÇÕES ADICIONADA AQUI DENTRO, COM PROTEÇÃO */}
        <Route path="/admin/acoes" element={empresaId ? <AdminAcoes /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/clientes" element={empresaId ? <AdminClientes empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/assinaturas" element={empresaId ? <AdminAssinaturas empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/unidades" element={empresaId ? <AdminUnidades empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/api-keys" element={empresaId ? <AdminApiKeys empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/relatorios" element={empresaId ? <AdminRelatorios empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/dominio" element={empresaId ? <AdminDominio empresaId={empresaId} /> : <Navigate to="/admin/login" />} />

        <Route path="/admin/whatsapp" element={empresaId ? <AdminWhatsapp /> : <Navigate to="/admin/login" />} />
        <Route path="/admin/mercadopago" element={empresaId ? <AdminMercadoPago /> : <Navigate to="/admin/login" />} />

      </Route>

      {/* Redirecionamento de segurança para qualquer rota Admin não mapeada */}
      <Route path="/admin/*" element={<Navigate to="/admin/login" />} />

      {/* Rota 404 básica ou redirecionamento */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </Suspense>
  );
}

const DOMINIO_RAIZ = 'schednext.com.br';

// Domínio principal, subdomínios *.schednext.com.br e localhost já são resolvidos na hora (ver
// utils/tenantSubdominio.js); só domínio próprio de tenant (plano Enterprise) precisa perguntar
// pra API antes de montar as rotas.
function hostConhecido() {
  const host = window.location.hostname;
  return host === DOMINIO_RAIZ || host.endsWith(`.${DOMINIO_RAIZ}`) || host === 'localhost' || host === '127.0.0.1';
}

// Lê a sessão do admin já no primeiro render. Antes isso rodava num useEffect com um estado
// "carregando" que começava em true, então todo carregamento piscava uma tela
// "Carregando sistema..." por um quadro, mesmo sem nada pra esperar.
function lerEmpresaIdInicial() {
  const adminSalvo = localStorage.getItem('adminToken');
  if (!adminSalvo) return localStorage.getItem('empresaId');
  try {
    const data = JSON.parse(adminSalvo);
    localStorage.setItem('empresaId', data.empresa_id);
    return data.empresa_id;
  } catch (e) {
    console.error("Erro ao processar token do admin:", e);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('empresaId');
    return null;
  }
}

// Mesmo visual da tela de abertura do public/index.html (classes sn-preload*), pra transição
// entre "baixando o JS" e "resolvendo domínio próprio" não trocar de cara.
function TelaCarregando() {
  return (
    <div className="sn-preload" role="status" aria-label="Carregando">
      <div className="sn-preload-marca">SCHEDNEXT</div>
      <div className="sn-preload-linha"><span /></div>
    </div>
  );
}

function App() {
  const [empresaId, setEmpresaId] = useState(lerEmpresaIdInicial);
  const [carregandoDominio, setCarregandoDominio] = useState(() => !hostConhecido());

  // Resolve domínio próprio de tenant (plano Enterprise) antes do primeiro render das rotas
  // (ver utils/tenantSubdominio.js e a rota pública GET /dominio/resolver no backend).
  useEffect(() => {
    if (hostConhecido()) return;
    const resolverDominioCustomizado = async () => {
      const host = window.location.hostname;
      try {
        const res = await fetch(`${API_URL}/dominio/resolver?host=${encodeURIComponent(host)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.slug) sessionStorage.setItem('dominioCustomizadoSlug', data.slug);
        }
      } catch (err) {
        console.error('Erro ao resolver domínio customizado:', err);
      } finally {
        setCarregandoDominio(false);
      }
    };
    resolverDominioCustomizado();
  }, []);

  const deslogarAdmin = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('empresaId');
    setEmpresaId(null);
  };

  if (carregandoDominio) return <TelaCarregando />;

  return (
    <ToastProvider>
    <ConfirmProvider>
    <div style={appStyles}>
      <Router>
        <HelpButton />
        {/* só aparece nas telas de acesso (.bb-page), ver app-oficio.css */}
        <BotaoTema className="oc-tema-flutuante" />
        <AppRoutes empresaId={empresaId} setEmpresaId={setEmpresaId} deslogarAdmin={deslogarAdmin} />
      </Router>
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}

const appStyles = {
  minHeight: '100vh',
  backgroundColor: '#f0f2f5',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'
};

export default App;