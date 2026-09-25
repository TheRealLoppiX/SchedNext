import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { obterTerminologia } from '../../utils/terminologia';
import { API_URL } from '../../services/api';

function AdminAgendamentos({ empresaId }) {
  const toast = useToast();
  const [agendamentos, setAgendamentos] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [vertical, setVertical] = useState('barbearia');
  const termos = obterTerminologia(vertical);

  // Estados dos Filtros
  const [filtroNome, setFiltroNome] = useState('');
  const filtroNomeDebounced = useDebouncedValue(filtroNome, 300);
  const [filtroData, setFiltroData] = useState(''); 
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [barbeirosSelecionados, setBarbeirosSelecionados] = useState([]);

  const idEfetivo = empresaId || localStorage.getItem('empresaId');

  useEffect(() => {
    if (idEfetivo) {
      fetch(`${API_URL}/admin/agendamentos/${idEfetivo}`)
        .then(res => res.json())
        .then(data => setAgendamentos(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro ao buscar agendamentos:", err));

      fetch(`${API_URL}/admin/equipe/${idEfetivo}`)
        .then(res => res.json())
        .then(data => setBarbeiros(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro ao carregar equipe:", err));

      fetch(`${API_URL}/admin/empresa/${idEfetivo}`)
        .then(res => res.json())
        .then(d => d?.vertical && setVertical(d.vertical))
        .catch(() => {});
    }
  }, [idEfetivo]);

  const toggleBarbeiro = (id) => {
    setBarbeirosSelecionados(prev =>
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  const getStatusInfo = (ag) => {
    if (ag.status === 'cancelado') return { label: 'Cancelado', bg: 'var(--fx-red-bg)', cor: 'var(--fx-red)' };
    if (ag.status === 'concluido') return { label: 'Concluído', bg: '#d4edda', cor: '#155724' };

    const agora = new Date();
    const dataAg = new Date(`${ag.data}T${ag.hora}`);
    
    // Criamos uma variável com o horário do agendamento + 10 minutos de tolerância
    const tolerancia = new Date(dataAg.getTime() + 10 * 60000);

    if (dataAg > agora) {
      // Se o horário ainda não chegou
      return { label: 'Agendado', bg: 'var(--fx-violet-bg)', cor: 'var(--fx-violet)' };
    } else if (agora > tolerancia) {
      // Se já passou o horário E já passou dos 10 minutos de tolerância
      return { label: 'Não Compareceu', bg: 'var(--fx-surface-2)', cor: 'var(--fx-muted)' };
    } else {
      // Se passou o horário, mas ainda está dentro dos 10 minutos
      return { label: 'Em Tolerância', bg: 'var(--fx-amber-bg)', cor: 'var(--fx-amber)' };
    }
  };

  const abrirWhatsapp = (tel) => {
    if (!tel) return toast.error("O cliente não possui um telefone cadastrado válido.");
    const num = tel.replace(/\D/g, '');
    window.open(`https://wa.me/55${num}`, '_blank');
  };

  // Filtros aplicados sem o erro do "toLowerCase"
  const agendamentosFiltrados = agendamentos.filter(ag => {
    const infoStatus = getStatusInfo(ag);
    
    // Tratamento à prova de balas caso venha undefined
    const nomeSeguro = ag.cliente_nome || '';
    
    const bateNome = nomeSeguro.toLowerCase().includes(filtroNomeDebounced.toLowerCase());
    const bateData = filtroData ? ag.data === filtroData : true;
    const bateStatus = filtroStatus === 'todos' || infoStatus.label.toLowerCase().includes(filtroStatus.toLowerCase());
    const bateBarbeiro = barbeirosSelecionados.length === 0 || barbeirosSelecionados.includes(ag.barbeiro_id);

    return bateNome && bateData && bateStatus && bateBarbeiro;
  });

  return (
    <div className="admin-page-container" style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>Gestão de Agendamentos</h2>
          <p style={styles.subtitle}>Acompanhe e filtre todos os agendamentos da recepção.</p>
        </div>
      </header>

      {/* ÁREA DE FILTROS */}
      <div style={styles.cardForm}>
        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Buscar por Cliente</label>
            <input
              placeholder="Nome do cliente..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Data Específica</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                style={{ ...styles.input, flex: 1 }}
              />
              {filtroData && (
                <button onClick={() => setFiltroData('')} style={styles.btnClear} title="Ver todas as datas">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Filtrar Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={styles.input}
            >
              <option value="todos">Todos os Status</option>
              <option value="agendado">Agendados (Antes do horário)</option>
              <option value="concluído">Concluídos</option>
              <option value="cancelado">Cancelados</option>
              <option value="atrasado">Atrasados / Pendentes</option>
              <option value="não compareceu">Não Compareceu</option>
            </select>
          </div>
        </div>

        {/* FILTRO DE BARBEIROS (Multi-seleção) */}
        <div style={{ marginTop: '25px' }}>
          <label style={styles.label}>Filtrar por {termos.profissionalPlural}:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button
              onClick={() => setBarbeirosSelecionados([])}
              style={barbeirosSelecionados.length === 0 ? styles.btnFiltroAtivo : styles.btnFiltro}
            >
              Todos
            </button>
            {barbeiros.map(b => (
              <button
                key={b.id}
                onClick={() => toggleBarbeiro(b.id)}
                style={barbeirosSelecionados.includes(b.id) ? styles.btnFiltroAtivo : styles.btnFiltro}
              >
                {b.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABELA DE RESULTADOS */}
      <div style={styles.cardTabela}>
        <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '20%' }}>DATA / HORA</th>
              <th style={{ ...styles.th, width: '25%' }}>CLIENTE</th>
              <th style={{ ...styles.th, width: '20%' }}>BARBEIRO</th>
              <th style={{ ...styles.th, width: '20%', textAlign: 'center' }}>STATUS</th>
              <th style={{ ...styles.th, width: '15%', textAlign: 'center' }}>AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {agendamentosFiltrados.length > 0 ? agendamentosFiltrados.map(ag => {
              const status = getStatusInfo(ag);
              return (
                <tr key={ag.id} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{ag.data.split('-').reverse().join('/')}</strong><br />
                    <span style={{ color: 'var(--fx-muted)', fontSize: '13px' }}>{ag.hora}</span>
                  </td>
                  <td style={styles.td}>
                    <strong>{ag.cliente_nome}</strong>
                  </td>
                  <td style={styles.td}>{ag.barbeiro_nome}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <span style={{
                      backgroundColor: status.bg,
                      color: status.cor,
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      whiteSpace: 'nowrap'
                    }}>
                      {status.label}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button onClick={() => abrirWhatsapp(ag.cliente_telefone)} style={styles.btnZap} title="Abrir WhatsApp">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--fx-card)" aria-hidden="true">
                        <path d="M12.01 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.07-1.33A9.94 9.94 0 0 0 12.01 22C17.53 22 22 17.52 22 12S17.53 2 12.01 2zm5.85 14.27c-.25.7-1.24 1.27-2.02 1.44-.55.11-1.26.2-3.66-.79-3.07-1.27-5.05-4.38-5.2-4.58-.15-.2-1.24-1.65-1.24-3.15s.78-2.23 1.06-2.54c.28-.31.6-.38.8-.38.2 0 .4.002.57.01.18.008.43-.07.67.51.25.6.85 2.08.92 2.23.07.15.12.33.02.53-.09.2-.14.33-.28.5-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.27.37-.22.62-.13.25.09 1.6.75 1.87.89.27.14.45.21.52.32.07.11.07.65-.18 1.35z"/>
                      </svg>
                      Chamar
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--fx-faint)' }}>
                  Nenhum agendamento encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}


const styles = {
  container: { padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { marginBottom: '30px', paddingBottom: '4px' },
  title: { fontFamily: 'var(--oc-display)', fontWeight: 400, fontSize: 'clamp(44px, 5.4vw, 76px)', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.005em', color: 'var(--fx-text)', margin: '0 0 10px 0' },
  subtitle: { color: 'var(--fx-muted)', fontSize: '15px', margin: 0 },
  
  cardForm: { background: 'var(--fx-card)', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '13px', fontWeight: '600', color: 'var(--fx-muted)' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid var(--fx-line)', fontSize: '14px', boxSizing: 'border-box', background: 'var(--fx-card)' },
  
  btnClear: { padding: '12px 15px', background: 'var(--fx-red-bg)', color: 'var(--fx-red)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  btnFiltro: { padding: '8px 16px', borderRadius: '20px', border: '1px solid var(--fx-line)', background: 'var(--fx-card)', cursor: 'pointer', fontSize: '13px', color: 'var(--fx-muted)', fontWeight: '600', transition: '0.2s' },
  btnFiltroAtivo: { padding: '8px 16px', borderRadius: '20px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '700', transition: '0.2s' },
  
  cardTabela: { background: 'var(--fx-card)', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden' },
  table: { width: '100%', minWidth: '640px', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: { padding: '15px 20px', background: 'var(--fx-surface-2)', color: 'var(--fx-faint)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid var(--fx-line)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--fx-line)', transition: 'background-color 0.2s' },
  td: { padding: '18px 20px', fontSize: '14px', verticalAlign: 'middle', color: 'var(--fx-text)' },
  
  btnZap: { backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', transition: '0.2s', margin: '0 auto' }
};

export default AdminAgendamentos;