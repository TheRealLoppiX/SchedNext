import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../services/api';

// Dashboard operacional de UMA unidade: agenda, equipe e estatísticas básicas. Admin de unidade
// (ver routes/auth.js/middleware/adminAuth.js) só enxerga a própria unidade automaticamente;
// admin de empresa escolhe qual unidade ver através do seletor abaixo. Assinatura da
// plataforma, domínio, WhatsApp, Mercado Pago e API continuam fora daqui de propósito (ver
// server.js, ROTAS_PERMITIDAS_ADMIN_UNIDADE).
function AdminUnidadeDashboard() {
  const [unidades, setUnidades] = useState([]);
  const [unidadeId, setUnidadeId] = useState(null);
  const [carregandoUnidades, setCarregandoUnidades] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [aba, setAba] = useState('agenda');
  const [stats, setStats] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [equipe, setEquipe] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/admin/unidade/minhas`)
      .then((r) => r.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : [];
        setUnidades(lista);
        if (lista.length === 1) setUnidadeId(lista[0].id);
      })
      .catch((err) => console.error('Erro ao carregar unidades:', err))
      .finally(() => setCarregandoUnidades(false));
  }, []);

  const carregarDados = useCallback(async () => {
    if (!unidadeId) return;
    setCarregandoDados(true);
    try {
      const [resStats, resAgendamentos, resEquipe] = await Promise.all([
        fetch(`${API_URL}/admin/unidade/dashboard?unidade_id=${unidadeId}`),
        fetch(`${API_URL}/admin/unidade/agendamentos?unidade_id=${unidadeId}`),
        fetch(`${API_URL}/admin/unidade/equipe?unidade_id=${unidadeId}`)
      ]);
      setStats(await resStats.json());
      const dadosAgendamentos = await resAgendamentos.json();
      setAgendamentos(Array.isArray(dadosAgendamentos) ? dadosAgendamentos : []);
      const dadosEquipe = await resEquipe.json();
      setEquipe(Array.isArray(dadosEquipe) ? dadosEquipe : []);
    } catch (err) {
      console.error('Erro ao carregar dashboard da unidade:', err);
    } finally {
      setCarregandoDados(false);
    }
  }, [unidadeId]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  if (carregandoUnidades) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}><Icons.Building color="#111827" /> Dashboard da unidade</h2>

      {unidades.length > 1 && (
        <div style={{ marginBottom: '20px' }}>
          <label style={styles.label}>Unidade</label>
          <select value={unidadeId || ''} onChange={(e) => setUnidadeId(Number(e.target.value))} style={styles.select}>
            <option value="">Selecione uma unidade</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      )}

      {unidades.length === 0 && (
        <p style={{ color: '#6b7280' }}>Nenhuma unidade encontrada.</p>
      )}

      {unidadeId && (
        <>
          <div style={styles.abas}>
            {[
              { id: 'agenda', label: 'Agenda' },
              { id: 'equipe', label: 'Equipe' },
              { id: 'stats', label: 'Estatísticas' }
            ].map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                style={{ ...styles.btnAba, ...(aba === a.id ? styles.btnAbaAtiva : {}) }}
              >
                {a.label}
              </button>
            ))}
          </div>

          {carregandoDados ? (
            <p style={{ color: '#6b7280', padding: '20px 0' }}>Carregando dados da unidade...</p>
          ) : (
            <>
              {aba === 'agenda' && (
                <div style={styles.grid}>
                  {agendamentos.length === 0 ? (
                    <p style={{ color: '#9ca3af' }}>Nenhum agendamento nesta unidade ainda.</p>
                  ) : agendamentos.map((ag) => (
                    <div key={ag.id} style={styles.card}>
                      <strong>{ag.cliente_nome}</strong>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{ag.data} às {ag.hora}</div>
                      <div style={{ fontSize: '13px', color: '#374151' }}>{ag.servicos}</div>
                      <div style={{ fontSize: '13px', color: '#374151' }}>{ag.barbeiro_nome || 'Sem profissional'}</div>
                      <span style={{ ...styles.badge, ...corStatus(ag.status) }}>{ag.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {aba === 'equipe' && (
                <div style={styles.grid}>
                  {equipe.length === 0 ? (
                    <p style={{ color: '#9ca3af' }}>Nenhum profissional atribuído a esta unidade ainda.</p>
                  ) : equipe.map((b) => (
                    <div key={b.id} style={styles.card}>
                      <strong>{b.nome}</strong>
                      <div style={{ fontSize: '13px', color: b.ativo ? '#059669' : '#dc2626' }}>{b.ativo ? 'Ativo' : 'Inativo'}</div>
                    </div>
                  ))}
                </div>
              )}

              {aba === 'stats' && stats && (
                <div style={styles.gridStats}>
                  <div style={styles.cardStat}><span style={styles.numStat}>{stats.total}</span><span style={styles.labelStat}>Total</span></div>
                  <div style={styles.cardStat}><span style={styles.numStat}>{stats.concluidos}</span><span style={styles.labelStat}>Concluídos</span></div>
                  <div style={styles.cardStat}><span style={styles.numStat}>{stats.cancelados}</span><span style={styles.labelStat}>Cancelados</span></div>
                  <div style={styles.cardStat}><span style={styles.numStat}>{stats.nao_compareceu}</span><span style={styles.labelStat}>Não compareceu</span></div>
                  <div style={styles.cardStat}><span style={styles.numStat}>{stats.taxa_conclusao}%</span><span style={styles.labelStat}>Taxa de conclusão</span></div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function corStatus(status) {
  if (status === 'concluido') return { backgroundColor: '#d1fae5', color: '#065f46' };
  if (status === 'cancelado') return { backgroundColor: '#fee2e2', color: '#991b1b' };
  return { backgroundColor: '#e0f2fe', color: '#0369a1' };
}

const Icons = {
  Building: ({ color }) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'bottom' }}><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path></svg>,
};

const styles = {
  container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 20px 0' },
  label: { display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase' },
  select: { padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', minWidth: '220px' },
  abas: { display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' },
  btnAba: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  btnAbaAtiva: { background: '#111827', color: '#fff', borderColor: '#111827' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  card: { backgroundColor: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '4px' },
  badge: { display: 'inline-block', marginTop: '6px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', width: 'fit-content' },
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' },
  cardStat: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  numStat: { fontSize: '28px', fontWeight: '800', color: '#111827' },
  labelStat: { fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }
};

export default AdminUnidadeDashboard;
