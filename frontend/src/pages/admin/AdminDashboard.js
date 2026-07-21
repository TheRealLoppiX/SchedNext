import React, { useEffect, useState, useCallback } from 'react';
import AgendaModal from './AgendaModal';
import './AdminDashboard.css';
import { obterTerminologia } from '../../utils/terminologia';

function AdminDashboard({ empresaId: propEmpresaId }) {
  const [stats, setStats] = useState({
    total: 0, concluidos: 0, cancelados: 0, nao_compareceu: 0,
    novos_clientes: 0, taxa_conclusao: 0, taxa_cancelamento: 0, taxa_nao_compareceu: 0
  });
  
  const [barbeiros, setBarbeiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  
  const dataHoje = new Date().toLocaleDateString('en-CA');
  const [dataInicio, setDataInicio] = useState(dataHoje);
  const [dataFim, setDataFim] = useState(dataHoje);

  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [dataAgenda, setDataAgenda] = useState(dataHoje);
  const [diasCalendario, setDiasCalendario] = useState([]);
  
  const [horaEncaixe, setHoraEncaixe] = useState(null);
  const [agendamentoCheckout, setAgendamentoCheckout] = useState(null);
  
  const empresaIdEfetivo = propEmpresaId || localStorage.getItem('empresaId');
  const [vertical, setVertical] = useState('barbearia');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [permiteIA, setPermiteIA] = useState(false);
  const [resumoIA, setResumoIA] = useState('');
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const termos = obterTerminologia(vertical);

  useEffect(() => {
    if (!empresaIdEfetivo) return;
    fetch(`http://localhost:4000/admin/empresa/${empresaIdEfetivo}`)
      .then(r => r.json())
      .then(d => {
        if (d?.vertical) setVertical(d.vertical);
        if (d?.nome) setNomeEmpresa(d.nome);
        setPermiteIA(!!d?.plano_plataforma?.permite_ia);
      })
      .catch(() => {});
  }, [empresaIdEfetivo]);

  const gerarResumoIA = async () => {
    setGerandoResumo(true);
    setResumoIA('');
    try {
      const res = await fetch('http://localhost:4000/admin/ia/resumo-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, nomeEmpresa })
      });
      const data = await res.json();
      if (res.ok) setResumoIA(data.resumo);
      else setResumoIA(data.error || 'Não foi possível gerar o resumo.');
    } catch (err) {
      setResumoIA('Erro de conexão. Tente novamente.');
    } finally {
      setGerandoResumo(false);
    }
  };

  useEffect(() => {
    const d = new Date();
    const formatLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    let start = formatLocal(d);
    let end = formatLocal(d);

    if (filtroPeriodo === 'semana') {
      const first = d.getDate() - d.getDay();
      start = formatLocal(new Date(d.getFullYear(), d.getMonth(), first));
      end = formatLocal(new Date(d.getFullYear(), d.getMonth(), first + 6));
    } else if (filtroPeriodo === 'mes') {
      // Usa mesSelecionado e anoSelecionado para filtrar mes especifico
      start = formatLocal(new Date(anoSelecionado, mesSelecionado, 1));
      end = formatLocal(new Date(anoSelecionado, mesSelecionado + 1, 0));
    } else if (filtroPeriodo === 'ano') {
      // Usa anoSelecionado para filtrar ano especifico
      start = formatLocal(new Date(anoSelecionado, 0, 1));
      end = formatLocal(new Date(anoSelecionado, 11, 31));
    } else if (filtroPeriodo === 'dia') {
      start = formatLocal(d);
      end = formatLocal(d);
    }

    if (filtroPeriodo !== '') {
      setDataInicio(start);
      setDataFim(end);
    }
  }, [filtroPeriodo, anoSelecionado, mesSelecionado]);

  const [anchorDate, setAnchorDate] = useState(new Date());

  useEffect(() => {
    const dias = [];
    const dataBase = new Date(anchorDate);
    dataBase.setDate(dataBase.getDate() - 3);
    for (let i = 0; i < 15; i++) {
      const curr = new Date(dataBase);
      curr.setDate(dataBase.getDate() + i);
      const str = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      dias.push({ obj: curr, str: str });
    }
    setDiasCalendario(dias);
  }, [anchorDate]);

  const carregarDadosDashboard = useCallback(async () => {
    if (!empresaIdEfetivo) return;
    setLoading(true);

    try {
      let urlParams = '';
      if (dataInicio || dataFim) urlParams = `?dataInicio=${dataInicio}&dataFim=${dataFim}`;
      
      const [resStats, resBarbeiros, resAgs] = await Promise.all([
        fetch(`http://localhost:4000/admin/stats/${empresaIdEfetivo}${urlParams}`),
        fetch(`http://localhost:4000/admin/equipe/${empresaIdEfetivo}`),
        fetch(`http://localhost:4000/admin/agendamentos/${empresaIdEfetivo}`)
      ]);

      if (resStats.ok) setStats(await resStats.json());
      if (resBarbeiros.ok) setBarbeiros(await resBarbeiros.json());
      if (resAgs.ok) setAgendamentos(await resAgs.json());
      
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaIdEfetivo, dataInicio, dataFim]);

  useEffect(() => {
    carregarDadosDashboard();
    const interval = setInterval(carregarDadosDashboard, 30000);
    return () => clearInterval(interval);
  }, [carregarDadosDashboard]);

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setFiltroPeriodo('');
  };

  const agendamentosDoDia = agendamentos.filter(ag => {
    if (!ag) return false;
    const stringData = String(ag.data_hora || ag.data);
    const dataLimpa = stringData.split('T')[0].split(' ')[0];
    return dataLimpa === dataAgenda;
  });

  // Mesma definição usada em AdminAgendamentos.js: "não compareceu" não existe como status real
  // no banco (ENUM só tem pendente/confirmado/concluido/cancelado) — é calculado por tempo
  // decorrido além da tolerância. Antes esta tela mostrava uma estatística do backend que nunca
  // refletia essa mesma regra (sempre zerada); agora as duas telas concordam.
  const TOLERANCIA_MIN = 10;
  const ehNaoCompareceu = (ag) => {
    if (!ag || ag.status === 'cancelado' || ag.status === 'concluido') return false;
    const dataStr = String(ag.data_hora || ag.data).split('T')[0].split(' ')[0];
    const horaStr = ag.hora || String(ag.data_hora || '').split('T')[1]?.substring(0, 5);
    if (!dataStr || !horaStr) return false;
    const dataAg = new Date(`${dataStr}T${horaStr}`);
    const tolerancia = new Date(dataAg.getTime() + TOLERANCIA_MIN * 60000);
    return new Date() > tolerancia;
  };

  const agendamentosNoPeriodo = agendamentos.filter(ag => {
    if (!ag) return false;
    const dataStr = String(ag.data_hora || ag.data).split('T')[0].split(' ')[0];
    return (!dataInicio || dataStr >= dataInicio) && (!dataFim || dataStr <= dataFim);
  });
  const naoCompareceramCount = agendamentosNoPeriodo.filter(ehNaoCompareceu).length;
  const taxaNaoCompareceu = agendamentosNoPeriodo.length > 0
    ? Math.round((naoCompareceramCount / agendamentosNoPeriodo.length) * 100)
    : 0;

  const gerarHorarios15Min = () => {
    const slots = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 20 && m > 0) continue;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  };
  const slotsHorarios = gerarHorarios15Min();

  // Função para checar se a hora do slot já passou hoje
  const isHoraPassada = (horaSlot) => {
    const hoje = new Date().toLocaleDateString('en-CA');
    if (dataAgenda !== hoje) {
        // Se estiver olhando pra um dia no passado, TUDO já passou. Se for no futuro, NADA passou.
        return dataAgenda < hoje; 
    }
    
    // Se for hoje, compara as horas
    const agora = new Date();
    const [h, m] = horaSlot.split(':').map(Number);
    
    const slotTime = new Date();
    slotTime.setHours(h, m, 0, 0);
    
    return slotTime < agora;
  };

  if (loading && !stats.total) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Atualizando dashboard...</p>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>Visão Geral</h2>
          <p style={styles.subtitle}>Resumo do desempenho {termos.artigoContraido} {termos.local.toLowerCase()}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="filtros-rapidos-container">
            {['ano', 'mes', 'semana', 'dia'].map(periodo => (
              <button
                key={periodo}
                className={`btn-filtro-rapido ${filtroPeriodo === periodo ? 'ativo' : ''}`}
                onClick={() => setFiltroPeriodo(periodo)}
              >
                {periodo === 'mes' ? 'Mês' : periodo.charAt(0).toUpperCase() + periodo.slice(1)}
              </button>
            ))}
          </div>

          {/* Select de ano - aparece nos filtros Ano e Mes */}
          {(filtroPeriodo === 'ano' || filtroPeriodo === 'mes') && (
            <select
              value={anoSelecionado}
              onChange={e => setAnoSelecionado(Number(e.target.value))}
              style={styles.selectFiltro}
            >
              {Array.from({ length: new Date().getFullYear() - 2023 + 1 }, (_, i) => 2024 + i).reverse().map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          )}

          {/* Select de mes - aparece apenas no filtro Mes */}
          {filtroPeriodo === 'mes' && (
            <select
              value={mesSelecionado}
              onChange={e => setMesSelecionado(Number(e.target.value))}
              style={styles.selectFiltro}
            >
              {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((nome, i) => (
                <option key={i} value={i}>{nome}</option>
              ))}
            </select>
          )}

          {filtroPeriodo !== '' && (
            <button onClick={limparFiltros} style={styles.btnLimparFiltro} title="Voltar a ver todos os agendamentos, sem filtro de período">
              ✕ Limpar filtro
            </button>
          )}
        </div>
      </header>

      <div style={styles.gridStats}>
        <div style={styles.card}>
          <div style={styles.cardHeader}><span style={styles.cardLabel}>Agendamentos</span><Icons.Calendar color="#6b7280" /></div>
          <div style={styles.cardBody}><span style={styles.bigNumber}>{stats.total}</span></div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardHeader}><span style={styles.cardLabel}>Concluídos</span><Icons.CheckCircle color="#059669" /></div>
          <div style={styles.cardBody}><span style={styles.bigNumber}>{stats.concluidos}</span><span style={{...styles.badge, color: '#059669', background: '#ecfdf5'}}>{stats.taxa_conclusao}%</span></div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardHeader}><span style={styles.cardLabel}>Não Compareceu</span><Icons.AlertTriangle color="#d97706" /></div>
          <div style={styles.cardBody}><span style={styles.bigNumber}>{naoCompareceramCount}</span><span style={{...styles.badge, color: '#d97706', background: '#fffbeb'}}>{taxaNaoCompareceu}%</span></div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardHeader}><span style={styles.cardLabel}>Cancelados</span><Icons.XCircle color="#dc2626" /></div>
          <div style={styles.cardBody}><span style={styles.bigNumber}>{stats.cancelados}</span><span style={{...styles.badge, color: '#dc2626', background: '#fef2f2'}}>{stats.taxa_cancelamento}%</span></div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardHeader}><span style={styles.cardLabel}>Novos Clientes</span><Icons.Users color="#0891b2" /></div>
          <div style={styles.cardBody}><span style={styles.bigNumber}>{stats.novos_clientes}</span></div>
        </div>
      </div>

      {permiteIA && (
        <div style={styles.cardResumoIA}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontWeight: '700', color: '#111827' }}>✨ Resumo executivo com IA</span>
            <button onClick={gerarResumoIA} disabled={gerandoResumo} style={styles.btnGerarResumo}>
              {gerandoResumo ? 'Gerando...' : resumoIA ? 'Gerar de novo' : 'Gerar resumo'}
            </button>
          </div>
          {resumoIA && <p style={{ marginTop: '12px', color: '#374151', fontSize: '14px', lineHeight: '1.6' }}>{resumoIA}</p>}
        </div>
      )}

      <hr style={{ margin: '40px 0', border: '0', borderTop: '1px solid #e5e7eb' }} />

      <h3 style={{ fontSize: '20px', color: '#111827', marginBottom: '20px', fontWeight: 'bold' }}>Agenda da Equipe</h3>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          className="btn-filtro-rapido"
          style={{ border: '1px solid #e5e7eb', flexShrink: 0 }}
          onClick={() => setAnchorDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
          })}
          title="Semana anterior"
        >
          ‹
        </button>

        <div className="calendario-horizontal-scroll" style={{ flex: 1, marginBottom: 0 }}>
          {diasCalendario.map(diaObj => {
            const isSelected = dataAgenda === diaObj.str;
            const nomeDia = diaObj.obj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const numeroDia = diaObj.obj.getDate();

            return (
              <div key={diaObj.str} className={`dia-card-agenda ${isSelected ? 'ativo' : ''}`} onClick={() => setDataAgenda(diaObj.str)}>
                <span className="dia-nome-agenda">{nomeDia}</span>
                <span className="dia-numero-agenda">{numeroDia}</span>
              </div>
            );
          })}
        </div>

        <button
          className="btn-filtro-rapido"
          style={{ border: '1px solid #e5e7eb', flexShrink: 0 }}
          onClick={() => setAnchorDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
          })}
          title="Próxima semana"
        >
          ›
        </button>
      </div>

      <div className="agenda-viva-scroll">
        {barbeiros.map(barbeiro => {
          const agendaBarbeiro = agendamentosDoDia.filter(ag => ag.barbeiro_id === barbeiro.id);
          
          return (
            <div key={barbeiro.id} className="coluna-agenda">
              
              <div className="coluna-header">
                <div className="barbeiro-info">
                  {barbeiro.foto_url ? (
                    <img src={barbeiro.foto_url} alt={barbeiro.nome} className="avatar-mini" />
                  ) : (
                    <div className="avatar-placeholder">{barbeiro.nome.charAt(0)}</div>
                  )}
                  <strong>{barbeiro.nome}</strong>
                </div>
                <span className="qtd-badge">{agendaBarbeiro.filter(ag => ag.status === 'pendente' || ag.status === 'confirmado').length}</span>
              </div>

              <div className="coluna-body-slots">
                {(() => {
                  const elementos = [];
                  let minOcupadoAte = 0; 

                  for (let i = 0; i < slotsHorarios.length; i++) {
                    const hora = slotsHorarios[i];
                    const [h, m] = hora.split(':').map(Number);
                    const minAtual = h * 60 + m;

                    if (minAtual < minOcupadoAte) continue;

                    const ag = agendaBarbeiro.find(a => a.hora === hora);

                    if (ag) {
                      const duracao = ag.duracao ? parseInt(ag.duracao) : 30;
                      minOcupadoAte = minAtual + duracao;

                      // Padrao: azul para confirmado/pendente
                      let corBorda = '#3b82f6'; let corTexto = '#1d4ed8'; let bgStatus = '#eff6ff';
                      let statusLabel = ag.status.toUpperCase();
                      if (ag.status === 'cancelado') { corBorda = '#ef4444'; corTexto = '#dc2626'; bgStatus = '#fee2e2'; }
                      else if (ag.status === 'concluido') { corBorda = '#10b981'; corTexto = '#059669'; bgStatus = '#d1fae5'; }
                      else if (ehNaoCompareceu(ag)) { corBorda = '#6b7280'; corTexto = '#4b5563'; bgStatus = '#f3f4f6'; statusLabel = 'NÃO COMPARECEU'; }

                      elementos.push(
                        <div
                          key={ag.id}
                          className="card-vivo"
                          style={{ borderLeftColor: corBorda, cursor: 'pointer' }}
                          onClick={() => {
                            setBarbeiroSelecionado(barbeiro);
                            setAgendamentoCheckout(ag);
                            setHoraEncaixe(null);
                          }}
                        >
                          <div className="card-vivo-topo">
                            <span className="hora-viva">{ag.hora}</span>
                            <span className="status-viva" style={{ color: corTexto, backgroundColor: bgStatus }}>
                              {statusLabel}
                            </span>
                          </div>
                          <strong className="cliente-viva">{ag.cliente_nome}</strong>
                          <p className="servico-viva">{ag.servico_nome}</p>
                        </div>
                      );
                    } else {
                      // Oculta o botão de novo encaixe se a hora já tiver passado (e o dia for hoje ou antes)
                      const jaPassou = isHoraPassada(hora);

                      if (!jaPassou) {
                          elementos.push(
                            <div 
                              key={`${barbeiro.id}-${hora}`} 
                              className="slot-livre"
                              onClick={() => {
                                setBarbeiroSelecionado(barbeiro);
                                setHoraEncaixe(hora);
                                setAgendamentoCheckout(null);
                              }}
                            >
                              <span className="slot-hora-texto">{hora}</span>
                              <span className="slot-livre-texto">+ Novo Encaixe</span>
                            </div>
                          );
                      }
                    }
                  }
                  return elementos;
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {barbeiroSelecionado && (
        <AgendaModal 
          barbeiro={barbeiroSelecionado}
          empresaId={empresaIdEfetivo}
          dataSelecionada={dataAgenda}
          horaPreSelecionada={horaEncaixe}
          agendamentoCheckout={agendamentoCheckout}
          onClose={() => {
            setBarbeiroSelecionado(null);
            setHoraEncaixe(null);
            setAgendamentoCheckout(null);
            carregarDadosDashboard();
          }}
        />
      )}

    </div> 
  ); 
}

const Icons = {
  Calendar: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  CheckCircle: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  AlertTriangle: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  XCircle: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>,
  Users: ({color}) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
};

const styles = {
  container: { padding: '30px 40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' },
  title: { fontSize: '26px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
  subtitle: { color: '#6b7280', fontSize: '14px', margin: 0 },
  selectFiltro: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: '600', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' },
  btnLimparFiltro: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '13px', fontWeight: '600', color: '#dc2626', background: '#fef2f2', cursor: 'pointer' },
  
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' },
  cardResumoIA: { marginTop: '20px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '18px' },
  btnGerarResumo: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#6d28d9', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  card: { background: '#fff', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  cardLabel: { fontSize: '13px', color: '#4b5563', fontWeight: '600' },
  cardBody: { display: 'flex', alignItems: 'baseline', gap: '10px' },
  bigNumber: { fontSize: '32px', fontWeight: '800', color: '#111827', letterSpacing: '-1px' },
  badge: { padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }
};

export default AdminDashboard;