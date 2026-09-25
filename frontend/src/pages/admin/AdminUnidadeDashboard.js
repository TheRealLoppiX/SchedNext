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

  if (carregandoUnidades) return <p style={{ padding: '40px', textAlign: 'center', color: 'var(--fx-muted)' }}>Carregando...</p>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Dashboard da unidade</h2>

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
        <p style={{ color: 'var(--fx-muted)' }}>Nenhuma unidade encontrada.</p>
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
            <p style={{ color: 'var(--fx-muted)', padding: '20px 0' }}>Carregando dados da unidade...</p>
          ) : (
            <>
              {aba === 'agenda' && (
                <div style={styles.grid}>
                  {agendamentos.length === 0 ? (
                    <p style={{ color: 'var(--fx-faint)' }}>Nenhum agendamento nesta unidade ainda.</p>
                  ) : agendamentos.map((ag) => (
                    <div key={ag.id} style={styles.card}>
                      <strong>{ag.cliente_nome}</strong>
                      <div style={{ fontSize: '13px', color: 'var(--fx-muted)' }}>{ag.data} às {ag.hora}</div>
                      <div style={{ fontSize: '13px', color: 'var(--fx-text)' }}>{ag.servicos}</div>
                      <div style={{ fontSize: '13px', color: 'var(--fx-text)' }}>{ag.barbeiro_nome || 'Sem profissional'}</div>
                      <span style={{ ...styles.badge, ...corStatus(ag.status) }}>{ag.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {aba === 'equipe' && (
                <div style={styles.grid}>
                  {equipe.length === 0 ? (
                    <p style={{ color: 'var(--fx-faint)' }}>Nenhum profissional atribuído a esta unidade ainda.</p>
                  ) : equipe.map((b) => (
                    <div key={b.id} style={styles.card}>
                      <strong>{b.nome}</strong>
                      <div style={{ fontSize: '13px', color: b.ativo ? 'var(--fx-green)' : 'var(--fx-red)' }}>{b.ativo ? 'Ativo' : 'Inativo'}</div>
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
  if (status === 'concluido') return { backgroundColor: 'var(--fx-green-bg)', color: 'var(--fx-green)' };
  if (status === 'cancelado') return { backgroundColor: 'var(--fx-red-bg)', color: 'var(--fx-red)' };
  return { backgroundColor: 'var(--fx-blue-bg)', color: 'var(--fx-blue)' };
}


const styles = {
  container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontFamily: 'var(--oc-display)', fontWeight: 400, fontSize: 'clamp(44px, 5.4vw, 76px)', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.005em', color: 'var(--fx-text)', margin: '0 0 10px 0' },
  label: { display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12px', color: 'var(--fx-muted)', textTransform: 'uppercase' },
  select: { padding: '10px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', fontSize: '14px', minWidth: '220px' },
  abas: { display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--fx-line)', paddingBottom: '10px' },
  btnAba: { padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-text)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  btnAbaAtiva: { background: 'var(--fx-strong)', color: '#fff', borderColor: 'var(--fx-strong)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  card: { backgroundColor: 'var(--fx-card)', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--fx-line)', display: 'flex', flexDirection: 'column', gap: '4px' },
  badge: { display: 'inline-block', marginTop: '6px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', width: 'fit-content' },
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' },
  cardStat: { backgroundColor: 'var(--fx-card)', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--fx-line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  numStat: { fontSize: '28px', fontWeight: '800', color: 'var(--fx-text)' },
  labelStat: { fontSize: '12px', color: 'var(--fx-muted)', textTransform: 'uppercase', fontWeight: '700' }
};

export default AdminUnidadeDashboard;
