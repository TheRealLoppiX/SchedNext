import { useState, useEffect } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { formatarTelefone } from '../utils/telefone';
import { useToast } from '../components/Toast';
import LoadingButton from '../components/LoadingButton';
import { obterTerminologia } from '../utils/terminologia';

function ModalAvaliacao({ isOpen, onClose, onSubmit, barbeiroNome }) {
  const [nota, setNota] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');

  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h3>Avaliar serviço</h3>
        <p>Como foi seu atendimento com <b>{barbeiroNome}</b>?</p>
        
        <div style={{ margin: '20px 0' }}>
          {[1, 2, 3, 4, 5].map((estrela) => (
            <span
              key={estrela}
              style={{
                fontSize: '35px',
                cursor: 'pointer',
                color: (hover || nota) >= estrela ? '#ffc107' : '#e4e5e9',
                transition: 'color 0.2s'
              }}
              onClick={() => setNota(estrela)}
              onMouseEnter={() => setHover(estrela)}
              onMouseLeave={() => setHover(0)}
            >
              ★
            </span>
          ))}
        </div>

        <textarea
          placeholder="Deixe um comentário (opcional)"
          style={styles.textArea}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button style={{ ...styles.btnPreto, flex: 1 }} onClick={onClose}>Cancelar</button>
          <button 
            style={{ ...styles.btnVerde, flex: 1, marginTop: 0 }} 
            onClick={() => onSubmit(nota, comentario)}
            disabled={nota === 0}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const location = useLocation();
  // Pegamos os dados, o setDados (caso precise atualizar) e o userId direto do Layout
  const { dados, setDados, userId } = useOutletContext(); 
  
  const [abaAtiva, setAbaAtiva] = useState('agendamentos');

  // Identifica se estamos no painel administrativo
  const isAdmin = location.pathname.includes('/admin');
  
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
          <>
            <FidelidadeView userId={userId} />
            <AgendamentosView userId={userId} />
          </>
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
    <div style={{ padding: '20px' }}>
      <div style={styles.viewContainer}>
        {renderConteudo()}
      </div>
    </div>
  );
}

// --- COMPONENTE ATUALIZADO ---
function AgendamentosView({ userId }) {
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
    fetch(`http://localhost:4000/meus-agendamentos/${userId}`)
      .then(r => r.json())
      .then(setLista)
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
      const res = await fetch(`http://localhost:4000/avaliar`, {
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
      const res = await fetch(`http://localhost:4000/cancelar-agendamento/${modalCancelamento.id}`, {
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
    if (ehPassado && status === 'pendente') return { texto: 'EXPIRADO', cor: '#999' };
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
      <h2 style={styles.titulo}>🗓️ Meus Agendamentos</h2>

      {/* --- MODAL DE CANCELAMENTO PROFISSIONAL --- */}
      {modalCancelamento.aberto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ color: '#d33', marginBottom: '10px' }}>Cancelar Agendamento?</h3>
            <p style={{ fontSize: '14px', color: '#666' }}>Poderia nos informar o motivo do cancelamento?</p>
            
            <textarea
              style={{ ...styles.textArea, height: '80px', marginTop: '15px' }}
              placeholder="Ex: Tive um imprevisto no trabalho..."
              value={modalCancelamento.motivo}
              onChange={(e) => setModalCancelamento({...modalCancelamento, motivo: e.target.value})}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                style={{ ...styles.btnPreto, flex: 1, backgroundColor: '#eee', color: '#333' }} 
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
                  style={{ fontSize: '40px', cursor: 'pointer', color: (hoverEmoji || notaEmoji) >= num ? '#ffc107' : '#e4e5e9' }}
                  onMouseEnter={() => setHoverEmoji(num)}
                  onMouseLeave={() => setHoverEmoji(0)}
                  onClick={() => setNotaEmoji(num)}
                >★</span>
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

      {/* TABELA DE AGENDAMENTOS */}
      <div style={styles.tabela}>
        {lista.map((ag, i) => {
          // ATENÇÃO: data_hora vem do banco "ingênuo" — os números representam o horário de
          // parede pretendido (ex: 09:00), só que salvos com rótulo UTC (+00), sem conversão real
          // de fuso. Por isso NUNCA usar toLocaleDateString/toLocaleTimeString aqui (eles fariam
          // uma conversão de fuso de verdade e mostrariam 3h a menos). Extraímos os componentes
          // com os getters UTC, que pegam exatamente os números gravados.
          const dataAg = new Date(ag.data_hora);
          const dataFormatada = `${String(dataAg.getUTCDate()).padStart(2, '0')}/${String(dataAg.getUTCMonth() + 1).padStart(2, '0')}/${dataAg.getUTCFullYear()}`;
          const horaFormatada = `${String(dataAg.getUTCHours()).padStart(2, '0')}:${String(dataAg.getUTCMinutes()).padStart(2, '0')}`;
          // Para saber se já passou, precisamos do instante real: como o horário de Brasília é
          // sempre UTC-3 (sem horário de verão), o instante real é o valor gravado + 3h.
          const instanteReal = new Date(dataAg.getTime() + 3 * 60 * 60 * 1000);
          const ehPassado = instanteReal < new Date();
          const statusVisual = getStatusDisplay(ag.status, ehPassado);
          const podeAvaliar = ag.status === 'concluido';

          return (
            <div key={i} style={styles.linha}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '500' }}>{dataFormatada}</span>
                <small style={{ color: '#888' }}>{horaFormatada}</small>
              </div>

              <b>{ag.barbeiro}</b>
              
              <span style={{ color: statusVisual.cor, fontWeight: 'bold', fontSize: '13px' }}>{statusVisual.texto}</span>

              <div style={{ textAlign: 'right' }}>
                {podeAvaliar ? (
                  ag.ja_avaliado > 0 ? (
                    <span style={{ color: '#28a745', fontSize: '13px', fontWeight: 'bold' }}>✅ Avaliado</span>
                  ) : (
                    <button onClick={() => abrirModalAvaliacao(ag)} style={styles.btnAvaliar}>⭐ Avaliar</button>
                  )
                ) : (
                  (!ehPassado && ag.status !== 'cancelado') ? (
                    <button 
                       onClick={() => setModalCancelamento({ aberto: true, id: ag.id, motivo: '' })} 
                       style={styles.btnCancelar}
                    >
                      Cancelar
                    </button>
                  ) : (
                    ag.status === 'cancelado'
                    ? <span style={{ fontSize: '12px', color: '#999' }}>Cancelado</span>
                    : <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Aguardando finalizar</span>
                  )
                )}
              
              </div>
            </div>
          );
        })}
      </div>
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
      const res = await fetch(`http://localhost:4000/atualizar-perfil/${userId}`, {
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
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={styles.titulo}>Minha Conta</h2>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={styles.fotoGrande}>
          {form.foto_url ? <img src={form.foto_url} style={styles.imgFull} alt="Perfil" /> : "👤"}
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
          style={{ ...styles.input, backgroundColor: editando ? '#fff' : '#f9f9f9' }} 
          value={form.nome_completo} 
          onChange={e => setForm({ ...form, nome_completo: e.target.value })} 
          disabled={!editando} 
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Telefone</label>
        <input 
          style={{ ...styles.input, backgroundColor: editando ? '#fff' : '#f9f9f9' }} 
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
      const res = await fetch(`http://localhost:4000/seguranca-codigo`, {
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
      const res = await fetch(`http://localhost:4000/seguranca-update/${userId}`, {
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
      <h2 style={styles.titulo}>🔒 Segurança da Conta</h2>
      
      {passo === 1 ? (
        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <p style={{ marginBottom: '15px', color: '#666' }}>
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
            <button style={{ ...styles.btnPreto, backgroundColor: '#666' }} onClick={() => setPasso(1)}>Cancelar</button>
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
    backgroundColor: '#fff', 
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
    color: '#333'
  },
  fotoGrande: { 
    width: '120px', 
    height: '120px', 
    borderRadius: '50%', 
    background: '#f8f9fa', 
    margin: '0 auto 15px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontSize: '50px', 
    border: '4px solid #eee', 
    overflow: 'hidden',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
  },
  imgFull: { width: '100%', height: '100%', objectFit: 'cover' },
  btnEscolher: { 
    backgroundColor: '#333', 
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
    border: '1px solid #ddd', 
    borderRadius: '10px', 
    boxSizing: 'border-box',
    fontSize: '16px',
    backgroundColor: '#fff',
    color: '#333',
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
    color: '#666',
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
    backgroundColor: '#f1f1f1', // Cinza suave para equilíbrio
    color: '#666', 
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
    backgroundColor: '#1a1a1a', 
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
    border: '1px solid #eee', 
    borderRadius: '12px',
    overflow: 'hidden'
  },
  linha: { 
    display: 'grid', 
    gridTemplateColumns: '1.2fr 1fr 1fr 1fr', 
    padding: '15px', 
    borderBottom: '1px solid #eee', 
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
    color: '#000', 
    border: 'none', 
    padding: '6px 12px', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontSize: '12px', 
    fontWeight: 'bold' 
  },
  cardFidelidade: {
    backgroundColor: '#1a1a1a',
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
    backgroundColor: '#333',
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
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
  },
  textArea: {
    width: '100%',
    height: '110px',
    padding: '15px',
    borderRadius: '15px',
    border: '1px solid #ddd',
    fontSize: '15px',
    fontFamily: 'inherit',
    backgroundColor: '#f9f9f9',
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
    color: '#ccc',
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
    fetch(`http://localhost:4000/admin/agendamentos-geral/${empresaId}`).then(r => r.json()).then(setDados => setAgendamentos(setDados));
    fetch(`http://localhost:4000/barbeiros/${empresaId}`).then(r => r.json()).then(setBarbeiros);
    fetch(`http://localhost:4000/admin/empresa/${empresaId}`).then(r => r.json()).then(d => d?.vertical && setVertical(d.vertical)).catch(() => {});
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
      <h2 style={styles.titulo}>📅 Gestão de Agendamentos</h2>
      
      {/* Filtros */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
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
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1a1a1a', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Hora</th>
              <th style={{ padding: '15px' }}>Cliente</th>
              <th style={{ padding: '15px' }}>{termos.profissional}</th>
              <th style={{ padding: '15px' }}>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length > 0 ? filtrados.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{a.hora}</td>
                <td style={{ padding: '15px' }}>{a.cliente_nome}</td>
                <td style={{ padding: '15px' }}>{a.barbeiro_nome}</td>
                <td style={{ padding: '15px' }}>
                  <button onClick={() => abrirWhatsapp(a.cliente_telefone, a.cliente_nome, a.data, a.hora)} style={{ border: 'none', background: '#25D366', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>Zap</span>
                  </button>
                </td>
              </tr>
            )) : <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Nenhum agendamento para este filtro.</td></tr>}
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
      fetch(`http://localhost:4000/fidelidade/${userId}`)
        .then(r => r.json())
        .then(setInfo)
        .catch(err => console.error("Erro fidelidade:", err));
    }
  }, [userId]);

  // Se não tiver campanha ativa, o card simplesmente não aparece na tela
  if (!info || !info.ativa) return null; 

  // Evita divisão por zero e calcula a porcentagem da barra
  const pct = info.objetivo > 0 ? (info.progresso / info.objetivo) * 100 : 0;

  return (
    <div style={styles.cardFidelidadeNovo}>
      <div style={styles.fidelidadeHeader}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>⭐ {info.nome}</h3>
        <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Ação Ativa
        </span>
      </div>

      <p style={{ fontSize: '14px', color: '#e5e7eb', margin: '15px 0 5px 0' }}>
        Complete <b>{info.objetivo} cortes</b> e ganhe:
      </p>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffc107', marginBottom: '15px' }}>
        🎁 {info.premio}
      </div>

      <div style={styles.fidelidadeRegras}>
        <small>📅 Válido até: {new Date(info.data_fim).toLocaleDateString('pt-BR')}</small>
        {info.valor_minimo > 0 && <small>💰 Serviços acima de: R$ {info.valor_minimo}</small>}
      </div>

      <div style={styles.barraProgressoNova}>
        <div style={{ ...styles.progressoPreenchidoNovo, width: `${pct}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px' }}>
        <span style={{ color: '#ccc' }}>{info.progresso} / {info.objetivo} concluídos</span>
        <span style={{ color: info.ganhouPremio ? '#28a745' : '#ffc107', fontWeight: 'bold' }}>
          {info.ganhouPremio ? "🎉 PRÊMIO LIBERADO!" : `Faltam ${info.faltam}`}
        </span>
      </div>
    </div>
  );
}

export default Dashboard;