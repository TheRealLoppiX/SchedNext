import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useToast } from './Toast';
import { obterTerminologia } from '../utils/terminologia';
import usePaletaTenant from '../hooks/usePaletaTenant';
import MarcaPlataforma from './MarcaPlataforma';
import { API_URL } from '../services/api';


function Layout({ setEmpresaId }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const { empresaSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [etapaPrivacidade, setEtapaPrivacidade] = useState(1);
  const [dadosAssinante, setDadosAssinante] = useState({ assinante: false, plano_nome: '', inadimplente: false });
  const [empresaTenant, setEmpresaTenant] = useState(null);
  // Controla se o slug da URL já foi confirmado como uma empresa de verdade — sem isso, um
  // navegador com sessão de cliente salva de OUTRA empresa conseguia abrir /:slug/barbeiros de
  // um slug inexistente e ver a página renderizada (vazia, mas aberta) em vez de barrada.
  const [empresaValidada, setEmpresaValidada] = useState(false);

  usePaletaTenant(empresaTenant);
 
  const [codigo, setCodigo] = useState('');
  const [novosDados, setNovosDados] = useState({ email: '', senha: '' });
  const [carregando, setCarregando] = useState(false);

  // startsWith (não includes): "includes" casava qualquer slug de tenant que contivesse
  // "admin" como substring (ex: "administracao-total"), fazendo as rotas de CLIENTE desse
  // tenant serem tratadas como rotas de admin por engano. Rotas de admin sempre vivem na raiz
  // "/admin/...", nunca sob "/:empresaSlug/...".
  const isAdminPath = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const userId = localStorage.getItem('usuario_id');
  const adminToken = localStorage.getItem('adminToken');

  // Admin de uma unidade só (ver routes/auth.js) — sidebar bem mais enxuta, sem os links que o
  // backend já barra pra esse tipo de login (ver server.js, ROTAS_PERMITIDAS_ADMIN_UNIDADE).
  let adminUnidadeId = null;
  try { adminUnidadeId = adminToken ? JSON.parse(adminToken).unidade_id || null : null; } catch (e) {}

  useEffect(() => {
    if (isAdminPath && !adminToken) return navigate('/admin/login');
    if (!isAdminPath && !userId) return navigate(`/${empresaSlug}/login`);

    const buscarPerfil = async () => {
      if (isAdminPath) {
        const adminStorage = localStorage.getItem('adminToken');
        if (adminStorage) {
          const adminData = JSON.parse(adminStorage);
          const empresaId = adminData.empresa_id;

          if (adminData.unidade_id) {
            // Admin de unidade não tem acesso a /admin/empresa/:id (fora da allowlist, ver
            // server.js) — busca o nome da própria unidade em vez do nome da empresa.
            try {
              const res = await fetch(`${API_URL}/admin/unidade/minhas`);
              const data = await res.json();
              const unidade = Array.isArray(data) ? data[0] : null;
              setDados({
                nome_completo: unidade?.nome || 'Painel da Unidade',
                foto_url: null,
                empresa_id: empresaId,
                vertical: 'barbearia'
              });
            } catch (err) {
              console.error('Erro ao buscar dados da unidade:', err);
            }
          } else {
            try {
              const res = await fetch(`${API_URL}/admin/empresa/${empresaId}`);
              const data = await res.json();
              // res.ok evita reintroduzir o bug de "vertical sempre vira barbearia": sem essa
              // checagem, qualquer falha temporária da API (ex: cold start do Render) fazia
              // `data` ser um objeto de erro sem `.vertical`, caindo sempre no fallback.
              if (res.ok && data) {
                setDados({
                  nome_completo: data.nome || "Painel Administrativo",
                  foto_url: data.logo_url || null,
                  empresa_id: empresaId,
                  vertical: data.vertical || 'barbearia'
                });
              }
            } catch (err) {
              console.error("Erro ao buscar dados da empresa:", err);
            }
          }
        }
      } else {
        if (userId) {
          try {
            const res = await fetch(`${API_URL}/usuarios/${userId}`);
            const data = await res.json();
            if (data) {
              setDados({
                nome_completo: data.nome_completo || "Usuário", 
                foto_url: data.foto_url || null,
                telefone: data.telefone || '',
                data_nascimento: data.data_nascimento || null
              });
              // Verificar assinatura
              try {
                const resAss = await fetch(`${API_URL}/usuario/${userId}/assinante`);
                const assData = await resAss.json();
                if (assData.assinante && assData.plano_id) {
                  const resPlano = await fetch(`${API_URL}/assinaturas/plano/${assData.plano_id}`);
                  const planoData = await resPlano.json();
                  setDadosAssinante({
                    assinante: true,
                    plano_nome: planoData.nome || 'Assinante',
                    inadimplente: assData.status_assinatura === 'inadimplente'
                  });
                } else {
                  setDadosAssinante({ assinante: false, plano_nome: '', inadimplente: false });
                }
              } catch(e) {}
            }
          } catch (err) {
            console.error("Erro ao buscar perfil do usuário:", err);
          }
        }
      }
    };

    buscarPerfil();
  }, [userId, adminToken, location.pathname, navigate, empresaSlug, isAdminPath]);

  useEffect(() => {
    if (isAdminPath || !empresaSlug) return;
    setEmpresaValidada(false);
    let cancelado = false;
    fetch(`${API_URL}/empresa/slug/${empresaSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Empresa não encontrada');
        return r.json();
      })
      .then((data) => {
        if (cancelado) return;
        setEmpresaTenant(data);
        setEmpresaValidada(true);
      })
      .catch(() => {
        if (cancelado) return;
        toast.error('Essa empresa não existe.');
        navigate('/', { replace: true });
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminPath, empresaSlug, navigate]);

  const handleSair = () => {
    // Apaga APENAS os dados de quem está clicando em Sair
    if (isAdminPath) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('empresaId');
      // Precisa limpar o estado `empresaId` lá em cima no App.js também. Sem isso, a rota
      // /admin/login ainda enxerga um empresaId "verdadeiro" (só em memória, já que o
      // localStorage foi limpo) e redireciona de volta pro /admin/dashboard, que tenta
      // buscar dados sem token válido e quebra. Era esse o bug do erro ao deslogar.
      if (setEmpresaId) setEmpresaId(null);
      navigate('/admin/login');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario_id');
      localStorage.removeItem('usuario_nome');
      navigate(`/${empresaSlug}/login`);
    }
  };

  const isAtiva = (aba) => location.search.includes(`aba=${aba}`);
  const isRotaAdminAtiva = (rota) => location.pathname === rota;
  const termos = obterTerminologia(dados?.vertical);

  // --- FUNÇÕES DE SEGURANÇA ---
  const solicitarCodigo = async () => {
    setCarregando(true);
    try {
      const r = await fetch(`${API_URL}/seguranca-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      });
      if (r.ok) setEtapaPrivacidade(2);
      else toast.error("Não foi possível enviar o código por e-mail. Tente novamente.");
    } catch (e) { toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes."); }
    finally { setCarregando(false); }
  };

  const validarCodigo = async () => {
    if (codigo.length !== 6) return toast.error("Digite os 6 dígitos do código.");
    setCarregando(true);
    try {
      const r = await fetch(`${API_URL}/seguranca-validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, codigo: codigo })
      });
      if (r.ok) setEtapaPrivacidade(3);
      else toast.error("Código inválido. Tente novamente.");
    } catch (e) { toast.error("Não foi possível validar o código. Tente novamente."); }
    finally { setCarregando(false); }
  };

  const finalizarAlteracao = async () => {
    if (!novosDados.email || !novosDados.senha) return toast.error("Preencha todos os campos.");
    setCarregando(true);
    try {
      const r = await fetch(`${API_URL}/seguranca-update/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novosDados.email, senha: novosDados.senha, codigo: codigo })
      });
      const res = await r.json();
      if (r.ok) {
        toast.success("Dados alterados com sucesso!");
        setEtapaPrivacidade(1);
        setCodigo('');
        setNovosDados(prev => ({ ...prev, senha: '' }));
      } else { toast.error(res.error || "Não foi possível salvar. Tente novamente."); }
    } catch (e) { toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes."); }
    finally { setCarregando(false); }
  };

  // Em telas touch (celular/tablet) não existe hover de verdade: o onMouseEnter/onMouseLeave
  // fica instável (às vezes não abre nunca, às vezes abre e nunca fecha, cobrindo a tela toda).
  // Por isso o hover só controla o menu em dispositivos que realmente têm mouse; no touch o
  // menu abre/fecha só pelo clique no botão de hambúrguer.
  const podeUsarHover = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // No touch o menu cobre a tela; escolher um item fecha ele (no desktop quem fecha é o mouse
  // saindo da barra).
  const irPara = (destino) => {
    navigate(destino);
    if (!podeUsarHover()) setAberto(false);
  };

  // Menu agrupado por seção, mesmo modelo do admin absoluto (pages/superadmin/
  // SuperAdminDashboard.js): recolhido mostra só os ícones, aberto mostra ícone + nome.
  const item = (label, icone, destino, ativo) => ({ label, icone, destino, ativo });
  const gruposMenu = isAdminPath
    ? (adminUnidadeId
      ? [{ titulo: 'Unidade', itens: [item('Dashboard da unidade', Icons.Stats, '/admin/unidade/dashboard', isRotaAdminAtiva('/admin/unidade/dashboard'))] }]
      : [
        { titulo: 'Visão geral', itens: [
          item('Dashboard', Icons.Stats, '/admin/dashboard', isRotaAdminAtiva('/admin/dashboard') && !location.search)
        ] },
        { titulo: 'Atendimento', itens: [
          item('Agendamentos', Icons.Calendar, '/admin/agendamentos', isRotaAdminAtiva('/admin/agendamentos')),
          item('Clientes', Icons.Users, '/admin/clientes', isRotaAdminAtiva('/admin/clientes')),
          item('Assinaturas', Icons.Diamond, '/admin/assinaturas', isRotaAdminAtiva('/admin/assinaturas')),
          item('Ações & Fidelidade', Icons.Star, '/admin/acoes', isRotaAdminAtiva('/admin/acoes'))
        ] },
        { titulo: 'Gestão', itens: [
          item(`Gestão de ${termos.profissionalPlural}`, Icons.Users, '/admin/barbeiros', isRotaAdminAtiva('/admin/barbeiros')),
          item('Gestão de Serviços', Icons.Scissors, '/admin/servicos', isRotaAdminAtiva('/admin/servicos')),
          item('Gestão de Estoque', Icons.Package, '/admin/estoque', isRotaAdminAtiva('/admin/estoque')),
          item('Unidades', Icons.Store, '/admin/unidades', isRotaAdminAtiva('/admin/unidades'))
        ] },
        { titulo: 'Análises', itens: [
          item('Relatórios', Icons.Chart, '/admin/relatorios', isRotaAdminAtiva('/admin/relatorios'))
        ] },
        { titulo: 'Integrações', itens: [
          item('WhatsApp', Icons.MessageCircle, '/admin/whatsapp', isRotaAdminAtiva('/admin/whatsapp')),
          item('Mercado Pago', Icons.CreditCard, '/admin/mercadopago', isRotaAdminAtiva('/admin/mercadopago')),
          item('Domínio', Icons.Globe, '/admin/dominio', isRotaAdminAtiva('/admin/dominio')),
          item('API', Icons.Code, '/admin/api-keys', isRotaAdminAtiva('/admin/api-keys'))
        ] },
        { titulo: 'Conta', itens: [
          item('Perfil', Icons.Settings, '/admin/conta', isRotaAdminAtiva('/admin/conta'))
        ] }
      ])
    : [{ titulo: null, itens: [
      item('Início', Icons.Home, `/${empresaSlug}/barbeiros`, location.pathname === `/${empresaSlug}/barbeiros`),
      item('Agendamentos', Icons.Calendar, `/${empresaSlug}/perfil?aba=agendamentos`, isAtiva('agendamentos')),
      item('Minha Conta', Icons.User, `/${empresaSlug}/perfil?aba=dados`, isAtiva('dados')),
      item('Assinatura', Icons.CreditCard, `/${empresaSlug}/assinatura`, location.pathname === `/${empresaSlug}/assinatura`),
      item('Privacidade', Icons.Lock, `/${empresaSlug}/perfil?aba=privacidade`, isAtiva('privacidade'))
    ] }];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {aberto && (
        <div className="bb-sidebar-overlay" onClick={() => setAberto(false)} />
      )}

      <button
        className="bb-mobile-menu-btn"
        onClick={() => setAberto(prev => !prev)}
        aria-label="Abrir menu"
      >
        <Icons.Menu />
      </button>

      <aside
        className={`bb-sidebar sa-sidebar${aberto ? ' aberto' : ''}`}
        style={{ ...s.sidebar, width: aberto ? '250px' : '70px', padding: aberto ? '14px 14px 20px' : '14px 10px 20px' }}
        onMouseEnter={() => { if (podeUsarHover()) setAberto(true); }}
        onMouseLeave={() => { if (podeUsarHover()) setAberto(false); }}
      >
        <button style={s.btnMenu} onClick={() => setAberto(prev => !prev)} aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}>
          <Icons.Menu />
        </button>

        {aberto && (
          <div style={s.sidebarTopo}>
            <div style={s.fotoCirculo}>
              {dados?.foto_url ? <img src={dados.foto_url} alt="Perfil" style={s.imgPerfil} /> : <Icons.User color="#fff" />}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={s.nomeTexto}>{dados?.nome_completo || 'Carregando...'}</p>
              {isAdminPath ? (
                <p style={s.subtituloTopo}>{adminUnidadeId ? 'Painel da unidade' : 'Painel administrativo'}</p>
              ) : dadosAssinante.assinante ? (
                <p style={{ ...s.subtituloTopo, color: dadosAssinante.inadimplente ? '#f87171' : '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {dadosAssinante.inadimplente ? 'Mensalidade em atraso' : dadosAssinante.plano_nome}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <nav style={s.nav}>
          {gruposMenu.map((grupo, gi) => (
            <div key={grupo.titulo || gi} style={aberto ? s.grupoMenu : s.grupoMenuRecolhido}>
              {aberto && grupo.titulo && <p style={s.grupoTitulo}>{grupo.titulo}</p>}
              {grupo.itens.map((item) => {
                const Icone = item.icone;
                return (
                  <button
                    key={item.label}
                    onClick={() => irPara(item.destino)}
                    title={item.label}
                    style={{ ...s.navItem, ...(aberto ? {} : s.navItemRecolhido), ...(item.ativo ? s.navItemAtivo : {}) }}
                  >
                    <Icone /> {aberto && item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <button onClick={handleSair} title="Sair" style={{ ...s.navSair, ...(aberto ? {} : s.navItemRecolhido) }}>
          <Icons.Logout /> {aberto && 'Sair'}
        </button>
      </aside>

      {/* A MÁGICA FOI DESFEITA AQUI: Agora a aba agendamentos do cliente é repassada para o Dashboard Original dele */}
      <main className="bb-main" style={{ flex: 1, marginLeft: '70px', padding: '20px' }}>
        {isAtiva('privacidade') ? (
          <div style={s.containerPrivacidade}>
            <div style={s.cardPrivacidade}>
              <h2 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Icons.Lock color="#333" /> Segurança da Conta
              </h2>
              <hr style={{ opacity: 0.1, marginBottom: '25px' }} />
              
              {etapaPrivacidade === 1 && (
                <div style={s.boxCinza}>
                  <p style={s.textoInformativo}>Para alterar seu e-mail ou senha, confirme o código que enviaremos agora.</p>
                  <button onClick={solicitarCodigo} style={s.btnPreto} disabled={carregando}>
                    {carregando ? "Enviando..." : "Solicitar Código de Alteração"}
                  </button>
                </div>
              )}

              {etapaPrivacidade === 2 && (
                <div style={s.formGroup}>
                  <label style={s.label}>Código de 6 dígitos enviado ao e-mail</label>
                  <input 
                    type="text" maxLength={6} value={codigo} 
                    onChange={(e) => setCodigo(e.target.value)} 
                    style={s.input} placeholder="000000"
                  />
                  <div style={s.flexBtns}>
                    <button onClick={validarCodigo} style={s.btnVerde} disabled={carregando}>
                      {carregando ? "Validando..." : "Validar Código"}
                    </button>
                    <button onClick={() => setEtapaPrivacidade(1)} style={s.btnCinza}>Voltar</button>
                  </div>
                </div>
              )}

              {etapaPrivacidade === 3 && (
                <div style={s.formGroup}>
                  <div style={{ textAlign: 'left', marginBottom: '15px' }}>
                    <label style={s.label}>Confirmar/Alterar E-mail</label>
                    <input 
                      type="email" value={novosDados.email} 
                      onChange={(e) => setNovosDados({...novosDados, email: e.target.value})}
                      style={s.input} 
                    />
                  </div>
                  <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                    <label style={s.label}>Nova Senha</label>
                    <input 
                      type="password" placeholder="Sua nova senha" 
                      style={s.input} value={novosDados.senha}
                      onChange={(e) => setNovosDados({...novosDados, senha: e.target.value})}
                    />
                  </div>
                  <div style={s.flexBtns}>
                    <button onClick={finalizarAlteracao} style={s.btnVerde} disabled={carregando}>
                      {carregando ? "Salvando..." : "Confirmar e Salvar"}
                    </button>
                    <button onClick={() => setEtapaPrivacidade(1)} style={s.btnCinza}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : isAdminPath || empresaValidada ? (
          /* PASSA O CONTEXTO PARA OS FILHOS (ISSO DEVOLVE A VISÃO ORIGINAL DO CLIENTE) */
          <Outlet context={{ dados, setDados, userId, empresaId: dados?.empresa_id }} />
        ) : null}
        {!isAdminPath && <MarcaPlataforma empresa={empresaTenant} />}
      </main>
    </div>
  );
}

// ÍCONES SVG CORRIGIDOS COM viewBox="0 0 24 24" PARA NÃO CORTAR
const Icons = {
  Star: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  Stats: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
  Calendar: ({color="currentColor"}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Scissors: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="10.48" x2="20" y2="16"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33H15a1.65 1.65 0 0 0-1 1.51v.09a2 2 0 0 1-2 2 2 2 0 0 1-2-2"></path></svg>,
  Logout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  User: ({color="currentColor"}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Lock: ({color="currentColor"}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Package: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Diamond: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>,
  Store: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><rect x="7" y="12" width="3" height="6"></rect><rect x="12" y="8" width="3" height="10"></rect><rect x="17" y="5" width="3" height="13"></rect></svg>,
  Globe: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
  MessageCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>,
  Code: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>,
  CreditCard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>,

};

const s = {
  // Mesma estrutura visual da sidebar do admin absoluto (SuperAdminDashboard.js): fixa,
  // recolhida em 70px e expandida pra 250px por cima do conteúdo (largura vem do estado `aberto`).
  sidebar: { background: '#16161a', color: '#fff', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 1000, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden', transition: 'width 0.3s', borderRight: '1px solid rgba(37, 84, 235,0.25)' },
  btnMenu: { background: 'none', border: 'none', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginBottom: '8px', flexShrink: 0 },
  sidebarTopo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  fotoCirculo: { width: '40px', height: '40px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #2554eb', flexShrink: 0 },
  imgPerfil: { width: '100%', height: '100%', objectFit: 'cover' },
  nomeTexto: { margin: 0, fontSize: '14px', color: '#fff', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subtituloTopo: { margin: 0, fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nav: { display: 'flex', flexDirection: 'column', flex: 1 },
  grupoMenu: { marginBottom: '14px' },
  grupoMenuRecolhido: { marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  grupoTitulo: { fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 6px 10px', whiteSpace: 'nowrap' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: 'transparent', color: '#d1d5db', border: 'none', borderRadius: '8px', padding: '9px 10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', marginBottom: '2px', transition: '0.15s', whiteSpace: 'nowrap' },
  navItemAtivo: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff' },
  navItemRecolhido: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navSair: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: 'transparent', color: '#f87171', border: 'none', borderRadius: '8px', padding: '9px 10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', whiteSpace: 'nowrap' },
  containerPrivacidade: { display: 'flex', justifyContent: 'center', paddingTop: '50px' },
  cardPrivacidade: { background: '#fff', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '450px', textAlign: 'center' },
  boxCinza: { background: '#f9f9f9', padding: '20px', borderRadius: '10px' },
  textoInformativo: { fontSize: '14px', color: '#666', lineHeight: '1.6', marginBottom: '20px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '8px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box' },
  formGroup: { display: 'flex', flexDirection: 'column' },
  flexBtns: { display: 'flex', gap: '10px', marginTop: '10px' },
  btnPreto: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', fontWeight: 'bold', cursor: 'pointer' },
  btnVerde: { flex: 2, padding: '14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', fontWeight: 'bold', cursor: 'pointer' },
  btnCinza: { flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: '#666', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }
};

export default Layout;
