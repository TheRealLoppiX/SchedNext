import React, { useEffect, useState, useCallback, useRef } from 'react';
import AgendaModal from './AgendaModal';
import './AdminDashboard.css';
import { obterTerminologia } from '../../utils/terminologia';
import { API_URL } from '../../services/api';
import { useToast } from '../../components/Toast';

function AdminDashboard({ empresaId: propEmpresaId }) {
  const toast = useToast();
  const [stats, setStats] = useState({
    total: 0, concluidos: 0, cancelados: 0, nao_compareceu: 0,
    novos_clientes: 0, taxa_conclusao: 0, taxa_cancelamento: 0, taxa_nao_compareceu: 0
  });
  
  const [barbeiros, setBarbeiros] = useState([]);
  const [loading, setLoading] = useState(true);
  // Espelha se o modal de encaixe/agenda está aberto, pra o auto-refresh (setInterval) saber
  // que não deve mexer na tela enquanto alguém preenche um formulário.
  const modalAbertoRef = useRef(false);
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

  const [agendamentoArrastando, setAgendamentoArrastando] = useState(null);
  const [slotDestaque, setSlotDestaque] = useState(null);
  const [movendo, setMovendo] = useState(false);

  const empresaIdEfetivo = propEmpresaId || localStorage.getItem('empresaId');
  const [vertical, setVertical] = useState('barbearia');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [permiteIA, setPermiteIA] = useState(false);
  const [resumoIA, setResumoIA] = useState('');
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const termos = obterTerminologia(vertical);

  useEffect(() => {
    if (!empresaIdEfetivo) return;
    fetch(`${API_URL}/admin/empresa/${empresaIdEfetivo}`)
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
      const res = await fetch(`${API_URL}/admin/ia/resumo-dashboard`, {
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

  // silencioso = atualização em segundo plano (auto-refresh): não liga o `loading`. Antes, todo
  // refresh de 30s ligava o loading e, com stats.total zerado (conta nova, período sem
  // agendamentos), o `if (loading && !stats.total)` mais abaixo trocava a tela inteira por
  // "Atualizando dashboard..." e DESMONTAVA o modal de encaixe, perdendo o que estava sendo digitado.
  // Só a busca mais recente pode mexer na tela: ao abrir, a primeira busca sai com o período
  // "hoje" antes do efeito que ajusta pro mês; se essa resposta chegasse depois da do mês, o
  // placar ficava com os números de hoje.
  const ultimaBuscaRef = useRef(0);
  const carregarDadosDashboard = useCallback(async (silencioso = false) => {
    if (!empresaIdEfetivo) return;
    const busca = ++ultimaBuscaRef.current;
    if (!silencioso) setLoading(true);

    try {
      let urlParams = '';
      if (dataInicio || dataFim) urlParams = `?dataInicio=${dataInicio}&dataFim=${dataFim}`;

      const [resStats, resBarbeiros, resAgs] = await Promise.all([
        fetch(`${API_URL}/admin/stats/${empresaIdEfetivo}${urlParams}`),
        fetch(`${API_URL}/admin/equipe/${empresaIdEfetivo}`),
        fetch(`${API_URL}/admin/agendamentos/${empresaIdEfetivo}`)
      ]);

      const [dStats, dBarbeiros, dAgs] = await Promise.all([
        resStats.ok ? resStats.json() : null,
        resBarbeiros.ok ? resBarbeiros.json() : null,
        resAgs.ok ? resAgs.json() : null
      ]);
      if (busca !== ultimaBuscaRef.current) return;
      if (dStats) setStats(dStats);
      if (dBarbeiros) setBarbeiros(dBarbeiros);
      if (dAgs) setAgendamentos(dAgs);

    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      if (busca === ultimaBuscaRef.current) setLoading(false);
    }
  }, [empresaIdEfetivo, dataInicio, dataFim]);

  useEffect(() => {
    carregarDadosDashboard();
    // Auto-refresh a cada 30s, mas só com a aba visível e sem modal aberto: com o modal aberto
    // (cadastro de encaixe, checkout) não há por que recarregar por baixo, e a lista é
    // atualizada de qualquer forma ao fechar o modal.
    const interval = setInterval(() => {
      if (document.hidden || modalAbertoRef.current) return;
      carregarDadosDashboard(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [carregarDadosDashboard]);

  // Arrastar-e-soltar pra reagendar (igual Outlook/Teams): pega o card em cima de um horário
  // livre e move o agendamento pra lá, sem precisar abrir o modal e reescrever tudo.
  const moverAgendamento = async (ag, barbeiro, novaHora) => {
    if (movendo) return;
    setMovendo(true);
    try {
      const res = await fetch(`${API_URL}/admin/reagendar-agendamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendamento_id: ag.id,
          barbeiro_id: barbeiro.id,
          data_hora: `${dataAgenda} ${novaHora}:00`
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Agendamento movido para ${novaHora}!`);
        carregarDadosDashboard();
      } else {
        toast.error(data.error || 'Não foi possível mover o agendamento.');
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setMovendo(false);
    }
  };

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
  // no banco (ENUM só tem pendente/confirmado/concluido/cancelado); é calculado por tempo
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

  modalAbertoRef.current = !!barbeiroSelecionado;

  if (loading && !stats.total) return <div className="oa-carregando">Atualizando painel...</div>;

  const hojeStr = new Date().toLocaleDateString('en-CA');
  const ativosPorDia = agendamentos.reduce((acc, ag) => {
    if (!ag || ag.status === 'cancelado') return acc;
    const d = String(ag.data_hora || ag.data).split('T')[0].split(' ')[0];
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const maxNoDia = Math.max(1, ...diasCalendario.map((d) => ativosPorDia[d.str] || 0));
  const pct = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const placas = [
    { rotulo: 'Agendamentos', valor: stats.total, icone: Icons.Calendar, cor: 'var(--oc-acento)' },
    { rotulo: 'Concluídos', valor: stats.concluidos, taxa: stats.taxa_conclusao, icone: Icons.CheckCircle, cor: 'var(--st-concluido)' },
    { rotulo: 'Não compareceu', valor: naoCompareceramCount, taxa: taxaNaoCompareceu, icone: Icons.AlertTriangle, cor: 'var(--st-pendente)' },
    { rotulo: 'Cancelados', valor: stats.cancelados, taxa: stats.taxa_cancelamento, icone: Icons.XCircle, cor: 'var(--st-cancelado)' },
    { rotulo: 'Novos clientes', valor: stats.novos_clientes, icone: Icons.Users, cor: 'var(--fx-violet)' }
  ];
  const diaAgendaObj = new Date(`${dataAgenda}T12:00:00`);
  const tituloDia = dataAgenda === hojeStr ? 'Hoje' : diaAgendaObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="admin-dashboard-container" style={styles.container}>
      <header className="oa-cabeca">
        <div>
          <h2 className="oa-titulo">Visão geral</h2>
          <p className="oa-sub">Resumo do desempenho {termos.artigoContraido} {termos.local.toLowerCase()}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="oa-segmento">
            {['ano', 'mes', 'semana', 'dia'].map(periodo => (
              <button
                key={periodo}
                type="button"
                className={filtroPeriodo === periodo ? 'ativo' : ''}
                onClick={() => setFiltroPeriodo(periodo)}
              >
                {periodo === 'mes' ? 'Mês' : periodo.charAt(0).toUpperCase() + periodo.slice(1)}
              </button>
            ))}
          </div>

          {(filtroPeriodo === 'ano' || filtroPeriodo === 'mes') && (
            <select className="oa-select" value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))}>
              {Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).reverse().map(ano => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          )}

          {filtroPeriodo === 'mes' && (
            <select className="oa-select" value={mesSelecionado} onChange={e => setMesSelecionado(Number(e.target.value))}>
              {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((nome, i) => (
                <option key={i} value={i}>{nome}</option>
              ))}
            </select>
          )}

          {filtroPeriodo !== '' && (
            <button type="button" onClick={limparFiltros} className="oa-limpar" title="Voltar a ver todos os agendamentos, sem filtro de período">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Limpar filtro
            </button>
          )}
        </div>
      </header>

      <div className="oa-placar">
        {placas.map((p) => {
          const Icone = p.icone;
          return (
            <div key={p.rotulo} className="oa-placa" style={{ '--cor': p.cor }}>
              <div className="oa-placa-rotulo"><span>{p.rotulo}</span><Icone color="currentColor" /></div>
              <div className="oa-placa-numero">
                {p.valor}
                {p.taxa !== undefined && <span className="oa-placa-taxa">{p.taxa}%</span>}
              </div>
              {p.taxa !== undefined && <div className="oa-placa-barra"><i style={{ width: `${pct(p.taxa)}%` }} /></div>}
            </div>
          );
        })}
      </div>

      {permiteIA && (
        <div className="oa-ia">
          <div className="oa-ia-marca">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" /></svg>
          </div>
          <div className="oa-ia-corpo">
            <strong>Resumo executivo com IA</strong>
            <small>Uma leitura rápida dos números do período selecionado.</small>
            {resumoIA && <p>{resumoIA}</p>}
          </div>
          <button type="button" onClick={gerarResumoIA} disabled={gerandoResumo} className="oc-btn oc-btn-contorno oc-btn-p">
            {gerandoResumo ? 'Gerando...' : resumoIA ? 'Gerar de novo' : 'Gerar resumo'}
          </button>
        </div>
      )}

      <div className="oa-secao">
        <div>
          <span className="oc-kicker" style={{ marginBottom: 0 }}>Agenda da equipe</span>
          <h3>{tituloDia}</h3>
        </div>
        <span className="oc-contagem">
          {agendamentosDoDia.filter(ag => ag.status === 'pendente' || ag.status === 'confirmado').length} na fila · arraste um card para reagendar
        </span>
      </div>

      <div className="oa-regua-linha">
        <button
          type="button"
          className="oa-seta"
          onClick={() => setAnchorDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
          })}
          title="Semana anterior"
          aria-label="Semana anterior"
        >
          ‹
        </button>

        <div className="oa-regua">
          {diasCalendario.map(diaObj => {
            const isSelected = dataAgenda === diaObj.str;
            const nomeDia = diaObj.obj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const qtd = ativosPorDia[diaObj.str] || 0;
            return (
              <button
                type="button"
                key={diaObj.str}
                className={`oa-dia${isSelected ? ' ativo' : ''}${diaObj.str === hojeStr ? ' hoje' : ''}`}
                onClick={() => setDataAgenda(diaObj.str)}
                title={`${qtd} agendamento${qtd === 1 ? '' : 's'}`}
              >
                <small>{diaObj.str === hojeStr ? 'hoje' : nomeDia}</small>
                <strong>{diaObj.obj.getDate()}</strong>
                <span className="oa-dia-marcas">
                  {Array.from({ length: qtd ? Math.max(1, Math.round((qtd / maxNoDia) * 4)) : 0 }).map((_, i) => <i key={i} />)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="oa-seta"
          onClick={() => setAnchorDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
          })}
          title="Próxima semana"
          aria-label="Próxima semana"
        >
          ›
        </button>
      </div>

      <div className="oa-quadro">
        {barbeiros.map(barbeiro => {
          const agendaBarbeiro = agendamentosDoDia.filter(ag => ag.barbeiro_id === barbeiro.id);
          const naFila = agendaBarbeiro.filter(ag => ag.status === 'pendente' || ag.status === 'confirmado').length;

          return (
            <div key={barbeiro.id} className="oa-coluna">
              <div className="oa-coluna-cab">
                <span className="oc-avatar-pro">
                  {barbeiro.foto_url ? <img src={barbeiro.foto_url} alt="" /> : barbeiro.nome.charAt(0)}
                </span>
                <div className="oa-coluna-nome">
                  <strong>{barbeiro.nome}</strong>
                  <small>{agendaBarbeiro.length} no dia</small>
                </div>
                <span className="oa-contador" title="Pendentes e confirmados">{naFila}</span>
              </div>

              <div className="oa-coluna-corpo">
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

                      let cor = ag.status === 'pendente' ? 'var(--st-pendente)' : 'var(--st-confirmado)';
                      let statusLabel = ag.status;
                      if (ag.status === 'cancelado') cor = 'var(--st-cancelado)';
                      else if (ag.status === 'concluido') { cor = 'var(--st-concluido)'; statusLabel = 'concluído'; }
                      else if (ehNaoCompareceu(ag)) { cor = 'var(--st-falta)'; statusLabel = 'não compareceu'; }

                      // Só dá pra arrastar agendamento ativo (cancelado/concluído/não compareceu
                      // ficam fixos, são registro histórico — ver mesma regra no backend).
                      const podeArrastar = ag.status === 'pendente' || ag.status === 'confirmado';
                      const inativo = ag.status === 'cancelado' || ag.status === 'concluido';

                      elementos.push(
                        <div
                          key={ag.id}
                          className={`oa-cartao${agendamentoArrastando?.id === ag.id ? ' arrastando' : ''}${inativo ? ' inativo' : ''}`}
                          style={{ '--cor': cor, cursor: podeArrastar ? 'grab' : 'pointer' }}
                          draggable={podeArrastar}
                          onDragStart={(e) => {
                            if (!podeArrastar) return;
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(ag.id));
                            setAgendamentoArrastando(ag);
                          }}
                          onDragEnd={() => {
                            setAgendamentoArrastando(null);
                            setSlotDestaque(null);
                          }}
                          onClick={() => {
                            setBarbeiroSelecionado(barbeiro);
                            setAgendamentoCheckout(ag);
                            setHoraEncaixe(null);
                          }}
                        >
                          <div className="oa-cartao-topo">
                            <span className="oa-cartao-hora">{ag.hora}<small>{duracao} min</small></span>
                            <span className="oa-status">{statusLabel}</span>
                          </div>
                          <strong>{ag.cliente_nome}</strong>
                          <p>{ag.servico_nome}</p>
                        </div>
                      );
                    } else {
                      // Oculta o botão de novo encaixe se a hora já tiver passado (e o dia for hoje ou antes)
                      const jaPassou = isHoraPassada(hora);

                      if (!jaPassou) {
                          const slotKey = `${barbeiro.id}-${hora}`;
                          const emDestaque = slotDestaque === slotKey;

                          elementos.push(
                            <div
                              key={slotKey}
                              className={`oa-livre${emDestaque ? ' destaque' : ''}`}
                              onClick={() => {
                                setBarbeiroSelecionado(barbeiro);
                                setHoraEncaixe(hora);
                                setAgendamentoCheckout(null);
                              }}
                              onDragOver={(e) => {
                                if (!agendamentoArrastando) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (slotDestaque !== slotKey) setSlotDestaque(slotKey);
                              }}
                              onDragLeave={() => {
                                if (slotDestaque === slotKey) setSlotDestaque(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setSlotDestaque(null);
                                if (!agendamentoArrastando) return;
                                const agArrastado = agendamentoArrastando;
                                setAgendamentoArrastando(null);
                                if (agArrastado.hora === hora && agArrastado.barbeiro_id === barbeiro.id) return;
                                moverAgendamento(agArrastado, barbeiro, hora);
                              }}
                            >
                              <span>{hora}</span>
                              <span>{agendamentoArrastando ? 'Soltar aqui' : '+ Encaixe'}</span>
                            </div>
                          );
                      }
                    }
                  }
                  if (elementos.length === 0) elementos.push(<div key="vazio" className="oa-vazio-coluna">Nenhum horário neste dia.</div>);
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
            carregarDadosDashboard(true);
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
  container: { maxWidth: '1240px', margin: '0 auto' }
};

export default AdminDashboard;