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
  const [dadosAssinante, setDadosAssinante] = useState({ assinante: false, plano_nome: '' });
  const [empresaTenant, setEmpresaTenant] = useState(null);

  usePaletaTenant(empresaTenant);
 
  const [codigo, setCodigo] = useState('');
  const [novosDados, setNovosDados] = useState({ email: '', senha: '' });
  const [carregando, setCarregando] = useState(false);

  const isAdminPath = location.pathname.includes('/admin');
  const userId = localStorage.getItem('usuario_id');
  const adminToken = localStorage.getItem('adminToken');

  

  useEffect(() => {
    if (isAdminPath && !adminToken) return navigate('/admin/login');
    if (!isAdminPath && !userId) return navigate(`/${empresaSlug}/login`);

    const buscarPerfil = async () => {
      if (isAdminPath) {
        const adminStorage = localStorage.getItem('adminToken');
        if (adminStorage) {
          const adminData = JSON.parse(adminStorage);
          const empresaId = adminData.empresa_id;

          try {
            const res = await fetch(`${API_URL}/admin/empresa/${empresaId}`);
            const data = await res.json();
            if (data) {
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
                  const resPlano = await fetch(`${API_URL}/admin/assinaturas/plano/${assData.plano_id}`);
                  const planoData = await resPlano.json();
                  setDadosAssinante({ assinante: true, plano_nome: planoData.nome || 'Assinante' });
                } else {
                  setDadosAssinante({ assinante: false, plano_nome: '' });
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
    fetch(`${API_URL}/empresa/slug/${empresaSlug}`)
      .then((r) => r.json())
      .then(setEmpresaTenant)
      .catch(() => {});
  }, [isAdminPath, empresaSlug]);

  const handleSair = () => {
    // Apaga APENAS os dados de quem está clicando em Sair
    if (isAdminPath) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('empresaId');
      // Precisa limpar o estado `empresaId` lá em cima no App.js também — sem isso, a rota
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <aside
        style={{
          width: aberto ? '250px' : '70px',
          background: '#16161a', color: '#fff', transition: '0.3s',
          borderRight: '1px solid rgba(37, 84, 235,0.25)',
          position: 'fixed', height: '100vh', zIndex: 1000,
          overflowY: 'auto', overflowX: 'hidden'
        }}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
      >
        <button style={s.btnMenu}>
           <Icons.Menu />
        </button>
        <div style={{...s.sidebarContent, display: aberto ? 'block' : 'none'}}>
             <div style={s.fotoCirculo}>
                {dados?.foto_url ? <img src={dados.foto_url} alt="Perfil" style={s.imgPerfil} /> : <Icons.User color="#fff" />}
             </div>
             <p style={s.nomeTexto}>{dados?.nome_completo || 'Carregando...'}</p>
             {!isAdminPath && dadosAssinante.assinante && (
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '-8px', marginBottom: '8px' }}>
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>
                 <span style={{ fontSize: '11px', fontWeight: '700', color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{dadosAssinante.plano_nome}</span>
               </div>
             )}
             <nav style={s.nav}>
                {isAdminPath ? (
                  <>
                    <button 
                       onClick={() => navigate('/admin/dashboard')} 
                       style={{...s.navItem, backgroundColor: (isRotaAdminAtiva('/admin/dashboard') && !location.search) ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                       <Icons.Stats /> Dashboard
                    </button>

                    <button 
                       onClick={() => navigate('/admin/agendamentos')} 
                       style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/agendamentos') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                       <Icons.Calendar /> Agendamentos
                    </button>

                    <button 
                       onClick={() => navigate('/admin/clientes')} 
                       style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/clientes') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                       <Icons.Users /> Clientes
                    </button>

                    <button 
                       onClick={() => navigate('/admin/assinaturas')} 
                       style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/assinaturas') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                       <Icons.Diamond /> Assinaturas
                    </button>

                    <button 
                       onClick={() => navigate('/admin/barbeiros')} 
                       style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/barbeiros') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                        <Icons.Users /> Gestão de {termos.profissionalPlural}
                    </button>

                    <button 
                       onClick={() => navigate('/admin/servicos')} 
                       style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/servicos') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                       <Icons.Scissors /> Gestão de Serviços
                    </button>

                    <button onClick={() => navigate('/admin/estoque')} style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/estoque') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.Package /> Gestão de Estoque
                    </button>

                    <button onClick={() => navigate('/admin/acoes')} style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/acoes') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.Star /> Ações & Fidelidade
                    </button>

                    <button onClick={() => navigate('/admin/unidades')} style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/unidades') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.Store /> Unidades
                    </button>

                    <button onClick={() => navigate('/admin/api-keys')} style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/api-keys') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.Settings /> API
                    </button>

                    <button 
                       onClick={() => navigate('/admin/conta')} 
                       style={{...s.navItem, backgroundColor: isRotaAdminAtiva('/admin/conta') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}
                    >
                       <Icons.Settings /> Perfil
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => navigate(`/${empresaSlug}/barbeiros`)} style={s.navItem}>
                      <Icons.Home /> Início
                    </button>
                    <button onClick={() => navigate(`/${empresaSlug}/perfil?aba=agendamentos`)} style={{...s.navItem, backgroundColor: isAtiva('agendamentos') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.Calendar /> Agendamentos
                    </button>
                    <button onClick={() => navigate(`/${empresaSlug}/perfil?aba=dados`)} style={{...s.navItem, backgroundColor: isAtiva('dados') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.User color="currentColor" /> Minha Conta
                    </button>
                    <button onClick={() => navigate(`/${empresaSlug}/perfil?aba=privacidade`)} style={{...s.navItem, backgroundColor: isAtiva('privacidade') ? 'rgba(37, 84, 235,0.18)' : 'transparent'}}>
                      <Icons.Lock /> Privacidade
                    </button>
                  </>
                )}
                <hr style={{opacity: 0.1, margin: '15px 0'}} />
                <button onClick={handleSair} style={{...s.navItem, color: '#ff4444', fontWeight: 'bold'}}>
                  <Icons.Logout /> Sair
                </button>
             </nav>
        </div>
      </aside>

      {/* A MÁGICA FOI DESFEITA AQUI: Agora a aba agendamentos do cliente é repassada para o Dashboard Original dele */}
      <main style={{ flex: 1, marginLeft: '70px', padding: '20px' }}>
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
        ) : (
          /* PASSA O CONTEXTO PARA OS FILHOS (ISSO DEVOLVE A VISÃO ORIGINAL DO CLIENTE) */
          <Outlet context={{ dados, setDados, userId, empresaId: dados?.empresa_id }} />
        )}
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

};

const s = {
  sidebarContent: { padding: '20px 10px' },
  btnMenu: { background: 'none', border: 'none', color: '#fff', padding: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fotoCirculo: { width: '60px', height: '60px', borderRadius: '50%', background: '#333', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #5d3fd3', flexShrink: 0 },
  imgPerfil: { width: '100%', height: '100%', objectFit: 'cover' },
  nomeTexto: { textAlign: 'center', fontSize: '14px', marginBottom: '25px', color: '#fff', fontWeight: '500' },
  nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
  navItem: { padding: '12px', border: 'none', borderRadius: '8px', color: '#fff', background: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', fontSize: '14px', transition: '0.2s' },
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