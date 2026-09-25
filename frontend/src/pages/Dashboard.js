import { useState, useEffect } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { formatarTelefone } from '../utils/telefone';
import { useToast } from '../components/Toast';
import LoadingButton from '../components/LoadingButton';
import { obterTerminologia } from '../utils/terminologia';
import { formatarDataSemFuso } from '../utils/dataSemFuso';
import { API_URL } from '../services/api';

function Dashboard() {
  const location = useLocation();
  // Pegamos os dados, o setDados (caso precise atualizar) e o userId direto do Layout
  const { dados, setDados, userId } = useOutletContext(); 
  
  const [abaAtiva, setAbaAtiva] = useState('agendamentos');

  // Identifica se estamos no painel administrativo. startsWith (não includes): "includes"
  // casava qualquer slug de tenant que contivesse "/admin" como prefixo (ex: empresaSlug
  // "admin-servicos" gera o path "/admin-servicos/perfil"), fazendo a página de perfil do
  // CLIENTE desse tenant renderizar a visão administrativa por engano (mesma classe de bug
  // já corrigida em components/Layout.js).
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  
  // Pega o ID da empresa do localStorage se for Admin
  const adminToken = localStorage.getItem('adminToken');
  const empresaId = adminToken ? JSON.parse(adminToken).empresa_id : null;

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const aba = query.get('aba');
    if (aba) setAbaAtiva(aba);
  }, [location.search]);

  const renderConteudo = () => {
    // --- VISÃO ADMINISTRATIVA ---
    if (isAdmin) {
      switch (abaAtiva) {
        case 'agendamentos':
          return <AgendamentosAdminView empresaId={empresaId} />;
        case 'inicio':
          // Se você tiver uma EstatisticasView ou similar
          return <div style={{ padding: '20px' }}><h3>Painel de Controle</h3><p>Bem-vindo ao admin.</p></div>;
        default:
          return <AgendamentosAdminView empresaId={empresaId} />;
      }
    }

    // --- VISÃO DO CLIENTE ---
    switch (abaAtiva) {
      case 'agendamentos':
        return (
          <AgendamentosView userId={userId} extra={<FidelidadeView userId={userId} />} />
        );
      case 'dados':
        return <DadosView dadosIniciais={dados} userId={userId} />;
      case 'privacidade':
        // No Layout.js já temos a aba de privacidade embutida, 
        // mas mantemos aqui caso você use o componente separado
        return <PrivacidadeView userId={userId} emailAtual={dados?.email} />;
      default:
        return <AgendamentosView userId={userId} />;
    }
  };

  return (
    <div className="oc-pagina oc-perfil">
      {renderConteudo()}
    </div>
  );
}

// --- COMPONENTE ATUALIZADO ---
function AgendamentosView({ userId, extra = null }) {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  
  // Estados para Modal de Avaliação
  const [modalAberto, setModalAberto] = useState(false);
  const [agSelecionado, setAgSelecionado] = useState(null);
  const [notaEmoji, setNotaEmoji] = useState(0);
  const [hoverEmoji, setHoverEmoji] = useState(0);
  const [comentarioTexto, setComentarioTexto] = useState('');

  // --- NOVO ESTADO: Modal de Cancelamento Profissional ---
  const [modalCancelamento, setModalCancelamento] = useState({ aberto: false, id: null, motivo: '' });

  const carregarAgendamentos = () => {
    fetch(`${API_URL}/meus-agendamentos/${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Falha ao carregar agendamentos')))
      .then(dados => setLista(Array.isArray(dados) ? dados : []))
      .catch(err => console.error("Erro ao carregar lista:", err));
  };

  useEffect(() => {
    carregarAgendamentos();
  }, [userId]);

  const abrirModalAvaliacao = (ag) => {
    setAgSelecionado(ag);
    setNotaEmoji(0);
    setComentarioTexto('');
    setModalAberto(true);
  };

  const handleSalvarAvaliacao = async () => {
    if (notaEmoji === 0) return toast.error("Selecione uma nota antes de enviar.");
    try {
      const res = await fetch(`${API_URL}/avaliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendamento_id: agSelecionado.id,
          cliente_id: userId,
          barbeiro_id: agSelecionado.barbeiro_id,
          nota: notaEmoji,
          comentario: comentarioTexto
        })
      });
      if (res.ok) {
        toast.success("Avaliação enviada!");
        setModalAberto(false);
        carregarAgendamentos();
      } else {
        toast.error("Não foi possível enviar a avaliação. Tente novamente.");
      }
    } catch (err) {
      toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    }
  };

  // --- NOVA FUNÇÃO: Confirmar Cancelamento via Modal ---
  const confirmarCancelamentoManual = async () => {
    try {
      const res = await fetch(`${API_URL}/cancelar-agendamento/${modalCancelamento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: modalCancelamento.motivo })
      });
      if (res.ok) {
        toast.success("Agendamento cancelado. Você receberá um e-mail de confirmação.");
        setModalCancelamento({ aberto: false, id: null, motivo: '' });
        carregarAgendamentos();
      } else {
        toast.error("Não foi possível cancelar o agendamento. Tente novamente.");
      }
    } catch (err) {
      toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    }
  };

  const getStatusDisplay = (status, ehPassado) => {
    if (ehPassado && status === 'pendente') return { texto: 'EXPIRADO', cor: 'var(--fx-muted)' };
    const estilos = {
      confirmado: { texto: 'CONFIRMADO', cor: '#28a745' },
      cancelado: { texto: 'CANCELADO', cor: '#dc3545' },
      concluido: { texto: 'CONCLUÍDO', cor: '#007bff' },
      pendente: { texto: 'PENDENTE', cor: '#f39c12' },
    };
    return estilos[status] || { texto: 'PENDENTE', cor: '#f39c12' };
  };

  return (
    <div>
      <header className="oc-cabeca">
        <span className="oc-kicker">Histórico</span>
        <h1 className="oc-titulo">SEUS HORÁRIOS.</h1>
      </header>
      {extra}

      {/* --- MODAL DE CANCELAMENTO PROFISSIONAL --- */}
      {modalCancelamento.aberto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ color: '#d33', marginBottom: '10px' }}>Cancelar Agendamento?</h3>
            <p style={{ fontSize: '14px', color: 'var(--fx-muted)' }}>Poderia nos informar o motivo do cancelamento?</p>
            
            <textarea
              style={{ ...styles.textArea, height: '80px', marginTop: '15px' }}
              placeholder="Ex: Tive um imprevisto no trabalho..."
              value={modalCancelamento.motivo}
              onChange={(e) => setModalCancelamento({...modalCancelamento, motivo: e.target.value})}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                style={{ ...styles.btnPreto, flex: 1, backgroundColor: 'var(--fx-surface-2)', color: 'var(--fx-text)' }} 
                onClick={() => setModalCancelamento({ aberto: false, id: null, motivo: '' })}
              >
                Voltar
              </button>
              <button 
                style={{ ...styles.btnVerde, flex: 1, background: '#dc3545', color: '#fff', marginTop: 0 }}
                onClick={confirmarCancelamentoManual}
              >
                Confirmar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AVALIAÇÃO (MANTIDO) */}
      {modalAberto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>Avaliar Atendimento</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '20px 0' }}>
              {[1, 2, 3, 4, 5].map((num) => (
                <span key={num}
                  style={{ cursor: 'pointer', color: (hoverEmoji || notaEmoji) >= num ? '#ffc107' : '#e4e5e9', display: 'inline-flex' }}
                  onMouseEnter={() => setHoverEmoji(num)}
                  onMouseLeave={() => setHoverEmoji(0)}
                  onClick={() => setNotaEmoji(num)}
                >
                  <svg width="34" height="34" viewBox="0 0 24 24" fill={(hoverEmoji || notaEmoji) >= num ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </span>
              ))}
            </div>
            <textarea
              style={styles.textArea}
              placeholder="Conte como foi sua experiência..."
              value={comentarioTexto}
              onChange={(e) => setComentarioTexto(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
              <button style={{ ...styles.btnPreto, flex: 1 }} onClick={() => setModalAberto(false)}>Cancelar</button>
              <button style={{ ...styles.btnVerde, flex: 1, marginTop: 0 }} onClick={handleSalvarAvaliacao}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* LINHA DO TEMPO DE AGENDAMENTOS */}
      {(() => {
        // ATENÇÃO: data_hora vem do banco "ingênuo", os números representam o horário de
        // parede pretendido (ex: 09:00), só que salvos com rótulo UTC (+00), sem conversão real
        // de fuso. Por isso NUNCA usar toLocaleDateString/toLocaleTimeString aqui. Extraímos os
        // componentes com os getters UTC, que pegam exatamente os números gravados.
        const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
        const itens = lista.map((ag) => {
          const dataAg = new Date(ag.data_hora);
          // Horário de Brasília é sempre UTC-3 (sem horário de verão): instante real = gravado + 3h.
          const instanteReal = new Date(dataAg.getTime() + 3 * 60 * 60 * 1000);
          const ehPassado = instanteReal < new Date();
          return {
            ag,
            dia: String(dataAg.getUTCDate()).padStart(2, '0'),
            mes: MESES[dataAg.getUTCMonth()],
            ano: dataAg.getUTCFullYear(),
            hora: `${String(dataAg.getUTCHours()).padStart(2, '0')}:${String(dataAg.getUTCMinutes()).padStart(2, '0')}`,
            ehPassado,
            instante: instanteReal.getTime(),
            status: getStatusDisplay(ag.status, ehPassado)
          };
        });
        const proximos = itens.filter((it) => !it.ehPassado && it.ag.status !== 'cancelado').sort((x, y) => x.instante - y.instante);
        const destaque = proximos[0];
        const resto = itens.filter((it) => it !== destaque);

        const acao = (it) => {
          const { ag, ehPassado } = it;
          if (ag.status === 'concluido') {
            return ag.ja_avaliado > 0
              ? <span className="oc-tl-tag ok">Avaliado</span>
              : <button type="button" onClick={() => abrirModalAvaliacao(ag)} className="oc-btn oc-btn-primario oc-btn-p">Avaliar</button>;
          }
          if (!ehPassado && ag.status !== 'cancelado') {
            return <button type="button" onClick={() => setModalCancelamento({ aberto: true, id: ag.id, motivo: '' })} className="oc-btn oc-btn-contorno oc-btn-p oc-btn-perigo">Cancelar</button>;
          }
          return ag.status === 'cancelado' ? null : <span className="oc-tl-tag">Aguardando finalizar</span>;
        };

        if (itens.length === 0) {
          return <div className="oc-vazio"><strong>NENHUM HORÁRIO AINDA.</strong><p>Quando você agendar, ele aparece aqui.</p></div>;
        }

        return (
          <>
            {destaque && (
              <div className="oc-proximo">
                <span className="oc-rotulo"><b>●</b> Próximo horário</span>
                <div className="oc-proximo-corpo">
                  <div className="oc-proximo-data">
                    <span className="oc-proximo-dia">{destaque.dia}</span>
                    <span className="oc-proximo-mes">{destaque.mes} {destaque.ano}</span>
                  </div>
                  <div className="oc-proximo-info">
                    <span className="oc-proximo-hora">{destaque.hora}</span>
                    <span>com <b>{destaque.ag.barbeiro}</b></span>
                    <span className="oc-tl-status" style={{ '--cor': destaque.status.cor }}>{destaque.status.texto}</span>
                  </div>
                  <div className="oc-proximo-acao">{acao(destaque)}</div>
                </div>
              </div>
            )}
            <div className="oc-tl">
              {resto.map((it) => (
                <div key={it.ag.id} className={`oc-tl-item ${it.ehPassado ? 'passado' : ''} ${it.ag.status === 'cancelado' ? 'cancelado' : ''}`}>
                  <div className="oc-tl-data"><b>{it.dia}</b><span>{it.mes}</span></div>
                  <span className="oc-tl-ponto" style={{ '--cor': it.status.cor }} />
                  <div className="oc-tl-info">
                    <strong>{it.ag.barbeiro}</strong>
                    <span>{it.hora} · {it.ano}</span>
                  </div>
                  <span className="oc-tl-status" style={{ '--cor': it.status.cor }}>{it.status.texto}</span>
                  <div className="oc-tl-acao">{acao(it)}</div>
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}

function DadosView() {
  const toast = useToast();
  // Pegamos os dados e o userId direto do Layout
  const { dados, setDados, userId } = useOutletContext();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome_completo: '', telefone: '', foto_url: '' });

  // Só preenche o formulário quando o 'dados' deixar de ser null (vindo do banco)
  useEffect(() => {
    if (dados && Object.keys(dados).length > 0) {
      setForm({
        nome_completo: dados.nome_completo || '',
        telefone: formatarTelefone(dados.telefone || ''),
        foto_url: dados.foto_url || ''
      });
    }
  }, [dados]);

  const handleSalvar = async () => {
    if (!userId) return toast.error("Não foi possível identificar seu usuário. Faça login novamente.");

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/atualizar-perfil/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_completo: form.nome_completo,
          telefone: form.telefone,
          nascimento: dados?.data_nascimento || null,
          foto_url: form.foto_url
        })
      });

      if (res.ok) {
        toast.success("Perfil atualizado com sucesso!");
        setEditando(false);
        setDados(prev => ({ ...prev, nome_completo: form.nome_completo, telefone: form.telefone, foto_url: form.foto_url }));
      } else {
        toast.error("Não foi possível atualizar o perfil. Tente novamente.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <header className="oc-cabeca">
        <span className="oc-kicker">Perfil</span>
        <h1 className="oc-titulo">MINHA CONTA.</h1>
      </header>
      <div className="oc-painel" style={{ maxWidth: '520px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={styles.fotoGrande}>
          {form.foto_url ? <img src={form.foto_url} style={styles.imgFull} alt="Perfil" /> : (
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="var(--fx-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          )}
        </div>
        <button 
          onClick={() => setEditando(true)}
          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
        >
          {editando ? "Editando..." : "Editar Perfil"}
        </button>
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Nome Completo</label>
        <input 
          style={{ ...styles.input, backgroundColor: editando ? 'var(--fx-surface)' : 'var(--fx-surface-2)' }} 
          value={form.nome_completo} 
          onChange={e => setForm({ ...form, nome_completo: e.target.value })} 
          disabled={!editando} 
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Telefone</label>
        <input 
          style={{ ...styles.input, backgroundColor: editando ? 'var(--fx-surface)' : 'var(--fx-surface-2)' }} 
          value={form.telefone}
          maxLength={15}
          onChange={e => setForm({ ...form, telefone: formatarTelefone(e.target.value) })}
          disabled={!editando} 
        />
      </div>

      {editando && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <LoadingButton style={styles.btnVerde} loading={salvando} onClick={handleSalvar}>Salvar</LoadingButton>
          <button 
            style={styles.btnCancelarNovo} 
            onClick={() => {
              setEditando(false);
              setForm({
                nome_completo: dados?.nome_completo || '',
                telefone: formatarTelefone(dados?.telefone || ''),
                foto_url: dados?.foto_url || ''
              });
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

function PrivacidadeView({ userId, emailAtual }) {
  const toast = useToast();
  const [passo, setPasso] = useState(1);
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoEmail, setNovoEmail] = useState('');

  useEffect(() => { 
    if (emailAtual) setNovoEmail(emailAtual); 
  }, [emailAtual]);

  const solicitarCodigo = async () => {
    try {
      const res = await fetch(`${API_URL}/seguranca-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      });
      if (res.ok) {
        toast.success("Enviamos um código para o seu e-mail cadastrado.");
        setPasso(2);
      } else {
        toast.error("Não foi possível enviar o código. Tente novamente.");
      }
    } catch (err) {
      toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    }
  };

  const salvarAlteracoes = async () => {
    if (!codigo || !novaSenha || !novoEmail) {
      toast.error("Preencha todos os campos.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/seguranca-update/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: novoEmail, 
          senha: novaSenha, 
          codigo: codigo 
        })
      });

      if (res.ok) {
        toast.success("E-mail e senha atualizados com sucesso!");
        setPasso(1);
        setCodigo('');
        setNovaSenha('');
      } else {
        const data = await res.json();
        toast.error(data.error || "Código incorreto.");
      }
    } catch (err) {
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  };

  return (
    <div>
      <h2 style={styles.titulo}>Segurança da Conta</h2>
      
      {passo === 1 ? (
        <div style={{ padding: '20px', backgroundColor: 'var(--fx-surface-2)', borderRadius: '8px' }}>
          <p style={{ marginBottom: '15px', color: 'var(--fx-muted)' }}>
            Para alterar seu e-mail de acesso ou sua senha, você precisará confirmar um código enviado ao seu e-mail atual.
          </p>
          <button style={styles.btnPreto} onClick={solicitarCodigo}>
            Solicitar Código de Alteração
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Código enviado por e-mail</label>
            <input 
              style={styles.input} 
              placeholder="Digite o código de 6 dígitos" 
              value={codigo} 
              onChange={e => setCodigo(e.target.value)} 
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Novo E-mail</label>
            <input 
              style={styles.input} 
              placeholder="Seu novo e-mail" 
              value={novoEmail} 
              onChange={e => setNovoEmail(e.target.value)} 
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Nova Senha</label>
            <input 
              style={styles.input} 
              type="password" 
              placeholder="Sua nova senha" 
              value={novaSenha} 
              onChange={e => setNovaSenha(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={styles.btnVerde} onClick={salvarAlteracoes}>Confirmar e Salvar</button>
            <button style={{ ...styles.btnPreto, backgroundColor: 'var(--fx-surface-3)' }} onClick={() => setPasso(1)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  viewContainer: { 
    maxWidth: '600px', 
    margin: '20px auto', 
    backgroundColor: 'var(--fx-surface)', 
    padding: '30px', 
    borderRadius: '16px', 
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)' 
  },
  titulo: {
    borderBottom: '2px solid #f4f4f4',
    paddingBottom: '10px',
    marginBottom: '25px',
    textAlign: 'center',
    fontSize: '22px',
    color: 'var(--fx-text)'
  },
  fotoGrande: { 
    width: '120px', 
    height: '120px', 
    borderRadius: '50%', 
    background: 'var(--fx-surface-2)', 
    margin: '0 auto 15px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontSize: '50px', 
    border: '4px solid var(--fx-line)', 
    overflow: 'hidden',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
  },
  imgFull: { width: '100%', height: '100%', objectFit: 'cover' },
  btnEscolher: { 
    backgroundColor: 'var(--fx-surface-3)', 
    color: '#fff', 
    padding: '8px 18px', 
    borderRadius: '20px', 
    cursor: 'pointer', 
    fontSize: '13px',
    transition: '0.3s',
    display: 'inline-block'
  },
  input: { 
    width: '100%', 
    padding: '12px 15px', 
    border: '1px solid var(--fx-line)', 
    borderRadius: '10px', 
    boxSizing: 'border-box',
    fontSize: '16px',
    backgroundColor: 'var(--fx-surface)',
    color: 'var(--fx-text)',
    outline: 'none',
    transition: 'border-color 0.3s'
  },
  inputGroup: { 
    marginBottom: '20px',
    textAlign: 'left' 
  },
  label: { 
    display: 'block', 
    marginBottom: '8px', 
    fontWeight: '600', 
    color: 'var(--fx-muted)',
    fontSize: '14px',
    marginLeft: '5px'
  },
  // --- BOTÕES DE AÇÃO (SIMÉTRICOS) ---
  btnVerde: {
    flex: 1,
    padding: '14px',
    background: 'linear-gradient(135deg, #4c74f0, #2554eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '15px',
    transition: '0.3s',
    boxShadow: '0 4px 12px rgba(37, 84, 235, 0.25)'
  },
  btnCancelarNovo: { 
    flex: 1,
    padding: '14px', 
    backgroundColor: 'var(--fx-surface-2)', // Cinza suave para equilíbrio
    color: 'var(--fx-muted)', 
    border: 'none', 
    borderRadius: '12px', 
    cursor: 'pointer', 
    fontWeight: 'bold', 
    fontSize: '15px',
    transition: '0.3s'
  },
  // -----------------------------------
  btnPreto: { 
    padding: '12px 20px', 
    backgroundColor: 'var(--fx-surface-3)', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '10px', 
    cursor: 'pointer',
    fontSize: '14px'
  },
  btnIcon: { 
    background: 'none', 
    border: 'none', 
    cursor: 'pointer', 
    fontSize: '18px',
    padding: '5px'
  },
  tabela: { 
    border: '1px solid var(--fx-line)', 
    borderRadius: '12px',
    overflow: 'hidden'
  },
  linha: { 
    display: 'grid', 
    gridTemplateColumns: '1.2fr 1fr 1fr 1fr', 
    padding: '15px', 
    borderBottom: '1px solid var(--fx-line)', 
    alignItems: 'center',
    fontSize: '14px'
  },
  btnCancelar: { 
    backgroundColor: 'transparent', 
    color: '#dc3545', 
    border: '1px solid #dc3545', 
    padding: '6px 12px', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '12px', 
    fontWeight: 'bold',
    transition: '0.2s'
  },
  btnAvaliar: { 
    backgroundColor: '#ffc107', 
    color: 'var(--fx-text)', 
    border: 'none', 
    padding: '6px 12px', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '12px', 
    fontWeight: 'bold' 
  },
  cardFidelidade: {
    backgroundColor: 'var(--fx-surface-3)',
    color: '#fff',
    padding: '25px',
    borderRadius: '16px',
    marginBottom: '25px',
    textAlign: 'center',
    borderLeft: '6px solid #ffc107',
    boxShadow: '0 6px 15px rgba(0,0,0,0.15)'
  },
  barraProgresso: {
    height: '12px',
    backgroundColor: 'var(--fx-surface-3)',
    borderRadius: '6px',
    marginTop: '15px',
    overflow: 'hidden'
  },
  progressoPreenchido: {
    height: '100%',
    backgroundColor: '#ffc107',
    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    backdropFilter: 'blur(4px)'
  },
  modalContent: {
    backgroundColor: 'var(--fx-surface)',
    padding: '30px',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    boxSizing: 'border-box'
  },
  textArea: {
    width: '100%',
    height: '110px',
    padding: '15px',
    borderRadius: '15px',
    border: '1px solid var(--fx-line)',
    fontSize: '15px',
    fontFamily: 'inherit',
    backgroundColor: 'var(--fx-surface-2)',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    marginTop: '10px'
  },
  // --- NOVOS ESTILOS DO CARD DE FIDELIDADE PREMIUM ---
  cardFidelidadeNovo: {
    background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
    color: '#fff',
    padding: '25px',
    borderRadius: '16px',
    marginBottom: '25px',
    borderLeft: '6px solid #ffc107',
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
  },
  fidelidadeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    paddingBottom: '10px'
  },
  fidelidadeRegras: {
    background: 'rgba(0,0,0,0.3)',
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '15px',
    color: 'var(--fx-muted)',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  barraProgressoNova: {
    height: '10px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  progressoPreenchidoNovo: {
    height: '100%',
    background: 'linear-gradient(90deg, #ffc107 0%, #ff9800 100%)',
    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

function AgendamentosAdminView({ empresaId }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  const [barbeirosSelecionados, setBarbeirosSelecionados] = useState([]);
  const [vertical, setVertical] = useState('barbearia');
  const termos = obterTerminologia(vertical);

  useEffect(() => {
    fetch(`${API_URL}/admin/agendamentos-geral/${empresaId}`).then(r => r.json()).then(setDados => setAgendamentos(setDados));
    fetch(`${API_URL}/barbeiros/${empresaId}`).then(r => r.json()).then(setBarbeiros);
    fetch(`${API_URL}/admin/empresa/${empresaId}`).then(r => r.json()).then(d => d?.vertical && setVertical(d.vertical)).catch(() => {});
  }, [empresaId]);

  const toggleBarbeiro = (id) => {
    setBarbeirosSelecionados(prev => prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]);
  };

  const abrirWhatsapp = (tel, nome, data, hora) => {
    const msg = `Olá ${nome}, confirmamos seu horário dia ${data.split('-').reverse().join('/')} às ${hora}. Podemos confirmar?`;
    window.open(`https://api.whatsapp.com/send?phone=55${tel.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filtrados = agendamentos.filter(a => {
    const bateData = a.data === filtroData;
    const bateBarbeiro = barbeirosSelecionados.length === 0 || barbeirosSelecionados.includes(a.barbeiro_id);
    return bateData && bateBarbeiro;
  });

  return (
    <div>
      <h2 style={styles.titulo}>Gestão de Agendamentos</h2>
      
      {/* Filtros */}
      <div style={{ background: 'var(--fx-surface)', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Filtrar por Data:</label>
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} style={styles.input} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{termos.profissionalPlural}:</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setBarbeirosSelecionados([])} style={barbeirosSelecionados.length === 0 ? styles.btnFiltroAtivo : styles.btnFiltro}>Todos</button>
            {barbeiros.map(b => (
              <button key={b.id} onClick={() => toggleBarbeiro(b.id)} style={barbeirosSelecionados.includes(b.id) ? styles.btnFiltroAtivo : styles.btnFiltro}>{b.nome}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ background: 'var(--fx-surface)', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--fx-surface-3)', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Hora</th>
              <th style={{ padding: '15px' }}>Cliente</th>
              <th style={{ padding: '15px' }}>{termos.profissional}</th>
              <th style={{ padding: '15px' }}>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length > 0 ? filtrados.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--fx-line)' }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{a.hora}</td>
                <td style={{ padding: '15px' }}>{a.cliente_nome}</td>
                <td style={{ padding: '15px' }}>{a.barbeiro_nome}</td>
                <td style={{ padding: '15px' }}>
                  <button onClick={() => abrirWhatsapp(a.cliente_telefone, a.cliente_nome, a.data, a.hora)} style={{ border: 'none', background: '#25D366', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>Zap</span>
                  </button>
                </td>
              </tr>
            )) : <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--fx-muted)' }}>Nenhum agendamento para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FidelidadeView({ userId }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (userId) {
      fetch(`${API_URL}/fidelidade/${userId}`)
        .then(r => r.json())
        .then(setInfo)
        .catch(err => console.error("Erro fidelidade:", err));
    }
  }, [userId]);

  // Se não tiver campanha ativa, o card simplesmente não aparece na tela
  if (!info || !info.ativa) return null; 


  const casas = Math.max(1, Math.min(20, info.objetivo || 0));
  return (
    <div className="oc-carimbos">
      <div className="oc-carimbos-topo">
        <div>
          <span className="oc-rotulo"><b>●</b> {info.nome}</span>
          <p className="oc-carimbos-premio">Complete {info.objetivo} atendimentos e ganhe <b>{info.premio}</b></p>
        </div>
        <div className="oc-carimbos-contagem"><b>{info.progresso}</b>/{info.objetivo}</div>
      </div>
      <div className="oc-carimbos-grade" style={{ gridTemplateColumns: `repeat(${Math.min(casas, 10)}, 1fr)` }}>
        {Array.from({ length: casas }).map((_, k) => (
          <span key={k} className={`oc-carimbo-casa ${k < info.progresso ? 'feito' : ''} ${k === casas - 1 ? 'premio' : ''}`} style={{ animationDelay: `${k * 0.05}s` }}>
            {k === casas - 1 ? '★' : k < info.progresso ? '✓' : String(k + 1).padStart(2, '0')}
          </span>
        ))}
      </div>
      <div className="oc-carimbos-rodape">
        <small>Válido até {formatarDataSemFuso(info.data_fim)}{info.valor_minimo > 0 ? ` · serviços acima de R$ ${info.valor_minimo}` : ''}</small>
        <strong className={info.ganhouPremio ? 'ok' : ''}>{info.ganhouPremio ? 'Prêmio liberado!' : `Faltam ${info.faltam}`}</strong>
      </div>
    </div>
  );
}

export default Dashboard;