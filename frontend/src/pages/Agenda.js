import { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import DatePicker, { registerLocale } from 'react-datepicker';
import ptBR from 'date-fns/locale/pt-BR';
import {
  setHours, setMinutes, format, isSameDay, startOfMinute,
  addMinutes, isBefore, isAfter, isEqual, parseISO, startOfDay
} from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { API_URL } from '../services/api';

registerLocale('pt-BR', ptBR);

function Agenda() {
  const location = useLocation();
  const navigate = useNavigate();
  const { empresaSlug } = useParams();
  const queryParams = new URLSearchParams(location.search);
  
  // Parâmetros da URL
  const dataQuery = queryParams.get('data'); 
  const horaQuery = queryParams.get('hora'); 
  const barbeiroId = queryParams.get('barbeiro');
  const unidadeId = queryParams.get('unidade');

  const [servicos, setServicos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [isAssinante, setIsAssinante] = useState(false);
  const [servicosPlano, setServicosPlano] = useState([]); // ids dos servicos inclusos no plano
  const [empresaHorarios, setEmpresaHorarios] = useState(null);

  
  // Inicialização inteligente da data
  const [dataHora, setDataHora] = useState(() => {
    if (dataQuery) {
      // Se tiver data e hora, combina ambos
      if (horaQuery) return parseISO(`${dataQuery}T${horaQuery}:00`);
      // Se tiver só data, define como o início desse dia (00:00) para busca de horários
      return parseISO(`${dataQuery}T00:00:00`);
    }
    return startOfMinute(new Date());
  });

  const [horariosOcupados, setHorariosOcupados] = useState({ agendados: [], bloqueios: [] });
  const [mensagem, setMensagem] = useState('');
  const [barbeiroNome, setBarbeiroNome] = useState('');
  
  const [notificacoes, setNotificacoes] = useState([]);
  const [exibirNotificacoes, setExibirNotificacoes] = useState(false);
  // Sem fallback: esta página só renderiza dentro do Layout, que já redireciona pro login
  // quando não há usuario_id. Um fallback pro ID 1 faria qualquer corrida nesse redirect
  // atribuir o agendamento ao cliente de ID 1 (de qualquer tenant, já que IDs são globais).
  const userId = localStorage.getItem('usuario_id');

  // Verifica se o usuario e assinante
  useEffect(() => {
    if (userId) {
      fetch(`${API_URL}/usuario/${userId}/assinante`)
        .then(r => r.json())
        .then(d => {
          setIsAssinante(!!d.assinante);
          if (d.servicos_ids) setServicosPlano(d.servicos_ids);
        })
        .catch(() => {});
    }
  }, [userId]);

  const [inicioSemana, setInicioSemana] = useState(() => {
    return dataQuery ? startOfDay(parseISO(dataQuery)) : startOfDay(new Date());
  });
  
  // AJUSTE: Só seleciona a hora se ela vier explicitamente na URL
  const [horaSelecionada, setHoraSelecionada] = useState(() => {
    if (dataQuery && horaQuery) {
      return parseISO(`${dataQuery}T${horaQuery}:00`);
    }
    return null; // Opcional: cliente escolhe na grade
  });

  // AJUSTE: jaFiltrou agora exige os dois. Se só houver data, mostra a grade.
  const jaFiltrou = !!(dataQuery && horaQuery);

  const duracaoTotal = carrinho.reduce((acc, item) => {
    const s = servicos.find(serv => String(serv.id) === String(item.id));
    return acc + (s ? parseInt(s.duracao) : 30); 
  }, 0);

  // --- BUSCA NOTIFICAÇÕES ---
  useEffect(() => {
    const buscarNotif = () => {
      fetch(`${API_URL}/notificacoes/${userId}`)
        .then(res => res.json())
        .then(data => setNotificacoes(data))
        .catch(err => console.error("Erro ao buscar notificações:", err));
    };
    buscarNotif();
    const interval = setInterval(buscarNotif, 60000); 
    return () => clearInterval(interval);
  }, [userId]);

  const toggleNotificacoes = async () => {
    setExibirNotificacoes(!exibirNotificacoes);
    if (!exibirNotificacoes && notificacoes.some(n => !n.lida)) {
      await fetch(`${API_URL}/notificacoes/ler-todas/${userId}`, { method: 'PUT' });
      setNotificacoes(notificacoes.map(n => ({ ...n, lida: 1 })));
    }
  };

  // --- BUSCA SERVIÇOS E BARBEIRO ---
  useEffect(() => {
    fetch(`${API_URL}/barbeiros?empresa=${empresaSlug}`)
      .then(res => res.json())
      .then(data => {
        const barbeiro = data.find(b => String(b.id) === String(barbeiroId));
        if (barbeiro) {
          setBarbeiroNome(barbeiro.nome);
          if (barbeiro.horarios_funcionamento) {
            setEmpresaHorarios(JSON.parse(barbeiro.horarios_funcionamento));
          }
        }
      });

    if (barbeiroId) {
      fetch(`${API_URL}/servicos-por-barbeiro/${barbeiroId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServicos(data);
          } else {
            setServicos([]);
          }
        })
        .catch(err => {
          console.error("Falha na carga de serviços:", err);
          setServicos([]);
        });
    }
  }, [barbeiroId, empresaSlug]);

  // --- BUSCA HORÁRIOS OCUPADOS ---
  useEffect(() => {
    if (!barbeiroId) return;
    const dataFormatada = format(dataHora, 'yyyy-MM-dd');
    fetch(`${API_URL}/horarios-ocupados?barbeiro_id=${barbeiroId}&data=${dataFormatada}`)
      .then(res => res.json())
      .then(data => {
        setHorariosOcupados({
            agendados: data.agendados || [],
            bloqueios: data.bloqueios || []
        });
      })
      .catch(() => setHorariosOcupados({ agendados: [], bloqueios: [] }));
  }, [dataHora, barbeiroId]);

  // --- LÓGICA DE EXCLUSÃO DE HORÁRIOS ---
  const renderExcludeTimes = () => {
    const temposParaExcluir = [];
    const agora = new Date();

    if (isSameDay(dataHora, agora)) {
      let cursorPassado = setHours(setMinutes(new Date(dataHora), 0), 0);
      while (isBefore(cursorPassado, agora)) {
        temposParaExcluir.push(new Date(cursorPassado));
        cursorPassado = addMinutes(cursorPassado, 15);
      }
    }

    horariosOcupados.agendados.forEach(h => {
      if (!h.hora) return;
      const [hora, minuto] = h.hora.split(':');
      let dataOcupada = setHours(setMinutes(new Date(dataHora), parseInt(minuto)), parseInt(hora));
      const duracao = parseInt(h.duracao_total) || 30; 
      for (let i = 0; i < duracao; i += 15) {
        temposParaExcluir.push(addMinutes(dataOcupada, i));
      }
    });

    horariosOcupados.bloqueios.forEach(b => {
      if (!b.hora_inicio || !b.hora_fim) return;
      const [hIni, mIni] = b.hora_inicio.split(':').map(Number);
      const [hFim, mFim] = b.hora_fim.split(':').map(Number);
      let cursorBloqueio = setHours(setMinutes(new Date(dataHora), mIni), hIni);
      let dataFimBloqueio = setHours(setMinutes(new Date(dataHora), mFim), hFim);
      while (isBefore(cursorBloqueio, dataFimBloqueio)) {
        temposParaExcluir.push(new Date(cursorBloqueio));
        cursorBloqueio = addMinutes(cursorBloqueio, 15);
      }
    });

    return temposParaExcluir;
  };

  // Horário de fechamento real do dia (configurado em AdminConta), com 19:00 só como
  // fallback pra quando a empresa ainda não configurou horários, usado tanto aqui quanto em
  // gerarSlotsHorario, que já tinha essa mesma lógica.
  const obterFechamentoDoDia = (data) => {
    let hFecha = 19, mFecha = 0;
    if (empresaHorarios) {
      const regra = empresaHorarios[data.getDay()];
      if (regra && regra.aberto && regra.fecha) {
        [hFecha, mFecha] = regra.fecha.split(':').map(Number);
      }
    }
    return setHours(setMinutes(new Date(data), mFecha), hFecha);
  };

  // --- VALIDAÇÃO DE CONFLITO ---
  const erroConflito = (() => {
    if (!horaSelecionada || carrinho.length === 0) return null;
    const inicioDesejado = startOfMinute(dataHora);
    const fimDesejado = addMinutes(inicioDesejado, duracaoTotal);
    const limiteExpediente = obterFechamentoDoDia(dataHora);

    if (isAfter(fimDesejado, limiteExpediente)) return `O serviço ultrapassa o expediente (${format(limiteExpediente, 'HH:mm')})`;
    
    const ocupados = renderExcludeTimes();
    for (let i = 0; i < duracaoTotal; i += 15) {
        const momentoSendoTestado = addMinutes(inicioDesejado, i);
        const estaOcupado = ocupados.some(bloqueado => 
            isEqual(startOfMinute(momentoSendoTestado), startOfMinute(bloqueado))
        );
        if (estaOcupado) return "Esse horário (ou parte dele) já está ocupado.";
    }
    return null;
  })();

  const confirmarAgendamento = async () => {
    if (!horaSelecionada || erroConflito || carrinho.length === 0) {
        if (!horaSelecionada) setMensagem('Selecione um horário para continuar.');
        return;
    }
    setMensagem('Aguarde...');

    try {
      const res = await fetch(`${API_URL}/agendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          usuario_id: userId,
          barbeiro_id: barbeiroId, 
          empresa_slug: empresaSlug, 
          data_hora: format(dataHora, 'yyyy-MM-dd HH:mm:00'),
          servicos: carrinho,
          unidade_id: unidadeId || null
        })
      });

      const data = await res.json();
      if (res.ok) { 
          setMensagem('Agendado com sucesso'); 
          setCarrinho([]); 
          const dataFormatada = format(dataHora, 'yyyy-MM-dd');
          fetch(`${API_URL}/horarios-ocupados?barbeiro_id=${barbeiroId}&data=${dataFormatada}`)
            .then(res => res.json()).then(newData => {
                setHorariosOcupados({
                  agendados: newData.agendados || [],
                  bloqueios: newData.bloqueios || []
                });
            });
      } else { 
          setMensagem(`Erro: ${data.error || 'Horário indisponível'}`);
      }
    } catch (err) {
      setMensagem('Erro de conexão. Tente novamente.');
    }
  };

  const adicionarAoCarrinho = (servico) => {
    const jaExiste = carrinho.some(item => item.id === servico.id);
    if (!jaExiste) setCarrinho([...carrinho, { id: servico.id }]);
  };

  const gerarDias = () => {
    return [...Array(7)].map((_, i) => {
      const d = new Date(inicioSemana);
      d.setDate(inicioSemana.getDate() + i);
      return d;
    });
  };

  const gerarSlotsHorario = () => {
    const slots = [];
    const agora = new Date();
    const ocupados = renderExcludeTimes();

    // Le horarios de funcionamento configurados no AdminConta
    let hAbre = 8, mAbre = 0, hFecha = 19, mFecha = 0;
    if (empresaHorarios) {
      const diaSemana = dataHora.getDay();
      const regra = empresaHorarios[diaSemana];
      if (regra && regra.aberto && regra.abre && regra.fecha) {
        [hAbre, mAbre] = regra.abre.split(':').map(Number);
        [hFecha, mFecha] = regra.fecha.split(':').map(Number);
      } else if (regra && !regra.aberto) {
        return []; // Fechado neste dia
      }
    }

    let cursor = setHours(setMinutes(new Date(dataHora), mAbre), hAbre);
    const fim = setHours(setMinutes(new Date(dataHora), mFecha), hFecha);

    while (isBefore(cursor, fim)) {
      const estaOcupado = ocupados.some(bloqueado => isEqual(cursor, bloqueado));
      const ehPassado = isBefore(cursor, agora);
      slots.push({ 
        hora: format(cursor, 'HH:mm'), 
        data: new Date(cursor), 
        disponivel: !estaOcupado && !ehPassado 
      });
      cursor = addMinutes(cursor, 15);
    }
    return slots;
  };

  return (
    <div style={styles.body}>
      <div style={styles.notificacaoContainer}>
        <div onClick={toggleNotificacoes} style={styles.sininhoIcon}>
          🔔 {notificacoes.filter(n => !n.lida).length > 0 && (
            <span style={styles.badge}>{notificacoes.filter(n => !n.lida).length}</span>
          )}
        </div>
        {exibirNotificacoes && (
          <div style={styles.dropdown}>
            <h4 style={styles.dropdownTitle}>Notificações</h4>
            <div style={styles.listaNotif}>
              {notificacoes.length === 0 ? <p style={{fontSize:'12px', textAlign:'center', padding:'10px'}}>Sem avisos.</p> : 
               notificacoes.map(n => (
                <div key={n.id} style={{ ...styles.itemNotif, backgroundColor: n.lida ? '#fff' : '#f0faff' }}>
                  <small style={{fontSize:'10px'}}>{new Date(n.criado_em).toLocaleString()}</small>
                  <p style={{margin:0, fontSize:'12px'}}>{n.mensagem}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={styles.container}>
        <h2 style={styles.header}>Agendar com: <span style={{color: '#1d4ed8'}}>{barbeiroNome || '...'}</span></h2>
        
        {jaFiltrou ? (
          <div style={styles.filtroResumo}>
            <p style={{margin: 0, fontSize: '14px', color: '#555'}}>
              Horário selecionado: <br/>
              <strong>{format(dataHora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong>
            </p>
            <button
              onClick={() => {
                // Atualiza a URL via router (não window.history) para o React re-renderizar
                // sem precisar de reload. Preserva o carrinho e o restante do estado. Mantém
                // "unidade" na URL: sem isso, o próximo agendamento ia com unidade_id null,
                // mesmo o cliente tendo escolhido uma unidade específica em Barbeiros.js.
                const unidadeParam = unidadeId ? `&unidade=${unidadeId}` : '';
                navigate(`${location.pathname}?barbeiro=${barbeiroId}&data=${format(dataHora, 'yyyy-MM-dd')}${unidadeParam}`, { replace: true });
                setHoraSelecionada(null);
              }}
              style={styles.btnTrocarHorario}
            >
              Escolher outro horário neste dia
            </button>
          </div>
        ) : (
          <div style={styles.inputGroup}>
            <label style={styles.label}>Selecione o melhor horário para você:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
              <button 
                disabled={isBefore(inicioSemana, startOfDay(new Date()))} 
                onClick={() => {
                  const nova = new Date(inicioSemana);
                  nova.setDate(nova.getDate() - 7);
                  if (!isBefore(nova, startOfDay(new Date()))) setInicioSemana(nova);
                }} 
                style={{ ...styles.btnSeta, opacity: isBefore(inicioSemana, startOfDay(new Date())) ? 0.3 : 1 }}
              >‹</button>
              
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, padding: '5px' }}>
                {gerarDias().map((dia, i) => {
                  const selecionado = isSameDay(dia, dataHora);
                  const ehDiaPassado = isBefore(startOfDay(dia), startOfDay(new Date()));
                  return (
                    <div 
                      key={i} 
                      onClick={() => { 
                        if (!ehDiaPassado) {
                          setDataHora(dia); 
                          setHoraSelecionada(null); // Limpa seleção ao trocar dia
                        }
                      }}
                      style={{
                        minWidth: '60px', padding: '10px 5px', borderRadius: '12px',
                        cursor: ehDiaPassado ? 'not-allowed' : 'pointer',
                        background: selecionado ? 'linear-gradient(135deg, #4c74f0, #2554eb)' : '#fff',
                        color: ehDiaPassado ? '#ccc' : (selecionado ? '#ffffff' : '#000'),
                        border: selecionado ? '1px solid #2554eb' : '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{format(dia, 'EEE', { locale: ptBR }).toUpperCase()}</span>
                      <span style={{ fontSize: '13px' }}>{format(dia, 'dd/MM')}</span>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => {
                const nova = new Date(inicioSemana);
                nova.setDate(nova.getDate() + 7);
                setInicioSemana(nova);
              }} style={styles.btnSeta}>›</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {gerarSlotsHorario().map((slot, i) => {
                const selecionado = horaSelecionada && isEqual(slot.data, horaSelecionada);
                return (
                  <button
                    key={i}
                    disabled={!slot.disponivel}
                    onClick={() => { setHoraSelecionada(slot.data); setDataHora(slot.data); }}
                    style={{
                      padding: '10px 5px', borderRadius: '8px', border: selecionado ? '1px solid #2554eb' : '1px solid #eee', fontSize: '13px',
                      background: !slot.disponivel ? '#f2f2f2' : (selecionado ? 'linear-gradient(135deg, #4c74f0, #2554eb)' : '#fff'),
                      color: !slot.disponivel ? '#ccc' : (selecionado ? '#ffffff' : '#000'),
                      cursor: slot.disponivel ? 'pointer' : 'not-allowed',
                      textDecoration: slot.disponivel ? 'none' : 'line-through'
                    }}
                  >
                    {slot.hora}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={styles.servicesBox}>
          <h4 style={{marginTop: 0, fontSize: '14px'}}>Serviços disponíveis:</h4>
          {servicos.map(s => {
            const noCarrinho = carrinho.some(item => item.id === s.id);
            return (
              <div key={s.id} style={styles.serviceItem}>
                <span style={{fontSize: '14px'}}>
                  {s.nome}
                  {!isAssinante && <strong> • R$ {parseFloat(s.valor).toFixed(2).replace('.',',')}</strong>}
                  {isAssinante && servicosPlano.includes(s.id) && (
                    <span style={{marginLeft:'6px',background:'#ede9fe',color:'#6d28d9',fontSize:'11px',fontWeight:'700',padding:'2px 7px',borderRadius:'4px',textTransform:'uppercase',letterSpacing:'0.3px'}}>Plano</span>
                  )}
                  {isAssinante && !servicosPlano.includes(s.id) && (
                    <span style={{marginLeft:'4px',fontSize:'13px',color:'#6b7280'}}>• R$ {parseFloat(s.valor).toFixed(2).replace('.',',')}</span>
                  )}
                </span>
                <button 
                  onClick={() => adicionarAoCarrinho(s)} 
                  disabled={noCarrinho}
                  style={{...styles.addBtn, background: noCarrinho ? '#e0e0e0' : 'linear-gradient(135deg, #4c74f0, #2554eb)', color: noCarrinho ? '#999' : '#ffffff'}}
                >
                  {noCarrinho ? '✓' : 'Adicionar'}
                </button>
              </div>
            );
          })}
        </div>

        <div style={styles.cartBox}>
          <h4 style={styles.cartTitle}>🛒 Resumo:</h4>
          {carrinho.map((item, index) => {
            const serv = servicos.find(s => String(s.id) === String(item.id));
            const noPlano = isAssinante && servicosPlano.includes(item.id);
            return (
              <div key={index} style={styles.cartItem}>
                <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <span>{serv?.nome}</span>
                  {noPlano && <span style={{background:'#ede9fe',color:'#6d28d9',fontSize:'10px',fontWeight:'700',padding:'1px 6px',borderRadius:'4px'}}>Plano</span>}
                  {isAssinante && !noPlano && <span style={{fontSize:'12px',color:'#6b7280'}}>R$ {parseFloat(serv?.valor||0).toFixed(2).replace('.',',')}</span>}
                </div>
                <button onClick={() => setCarrinho(carrinho.filter((_, i) => i !== index))} style={styles.removeBtn}>✕</button>
              </div>
            );
          })}
          {carrinho.length > 0 && horaSelecionada && (
            <p style={{fontSize: '12px', color: '#666', marginTop: '10px', textAlign: 'left'}}>
              Agendado para: <strong>{format(horaSelecionada, 'HH:mm')}</strong> ({duracaoTotal} min)
            </p>
          )}
        </div>

        {(() => {
          if (!isAssinante) {
            const total = carrinho.reduce((a,c) => a + (parseFloat(servicos.find(s=>s.id===c.id)?.valor)||0), 0);
            return <h3 style={styles.total}>Total: R$ {total.toFixed(2).replace('.',',')}</h3>;
          }
          const totalExtra = carrinho
            .filter(c => !servicosPlano.includes(c.id))
            .reduce((a,c) => a + (parseFloat(servicos.find(s=>s.id===c.id)?.valor)||0), 0);
          return (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              <div style={{padding:'10px 14px',background:'#faf5ff',border:'1px solid #c4b5fd',borderRadius:'8px',display:'flex',alignItems:'center',gap:'8px'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>
                <span style={{fontSize:'13px',fontWeight:'600',color:'#6d28d9'}}>Coberto pelo plano de assinatura</span>
              </div>
              {totalExtra > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:'8px'}}>
                  <span style={{fontSize:'13px',color:'#374151',fontWeight:'500'}}>Serviço adicional</span>
                  <span style={{fontSize:'16px',fontWeight:'700',color:'#111827'}}>R$ {totalExtra.toFixed(2).replace('.',',')}</span>
                </div>
              )}
            </div>
          );
        })()}

        {erroConflito && (
          <p style={{ fontSize: '13px', color: '#991b1b', margin: '0 0 10px 0', textAlign: 'left' }}>
            ⚠️ {erroConflito}
          </p>
        )}

        <button
          onClick={confirmarAgendamento}
          disabled={carrinho.length === 0 || !!erroConflito}
          style={{ ...styles.confirmBtn, background: (carrinho.length > 0 && !erroConflito) ? 'linear-gradient(135deg, #4c74f0, #2554eb)' : '#ccc', color: (carrinho.length > 0 && !erroConflito) ? '#ffffff' : '#fff' }}
        >
          Confirmar Agendamento
        </button>

        {mensagem && (
          <div style={{ ...styles.msgBanner, backgroundColor: mensagem.includes('sucesso') ? '#f0fdf4' : '#fef2f2', color: mensagem.includes('sucesso') ? '#166534' : '#991b1b', border: mensagem.includes('sucesso') ? '1px solid #bbf7d0' : '1px solid #fecaca', fontWeight: '500', fontSize: '13px' }}>
            {mensagem}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  body: { backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px 20px', fontFamily: '"Inter", sans-serif' },
  container: { backgroundColor: '#fff', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', width: '100%', maxWidth: '450px', textAlign: 'center' },
  header: { fontSize: '22px', fontWeight: '700', marginBottom: '25px', color: '#333' },
  inputGroup: { marginBottom: '25px', textAlign: 'center' },
  filtroResumo: { backgroundColor: '#f0faff', padding: '15px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #cce5ff' },
  btnTrocarHorario: { marginTop: '10px', border: 'none', background: 'none', color: '#1d4ed8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' },
  label: { fontWeight: '600', fontSize: '14px', color: '#666', marginBottom: '15px', display: 'block' },
  servicesBox: { backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '20px', textAlign: 'left', border: '1px solid #f0f0f0' },
  serviceItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '8px', borderBottom: '1px solid #fafafa' },
  addBtn: { padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  cartTitle: { textAlign: 'left', marginBottom: '15px', fontSize: '14px', color: '#444' },
  cartBox: { backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '12px', marginBottom: '20px' },
  cartItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', borderBottom: '1px solid #eee' },
  removeBtn: { border: 'none', background: 'none', cursor: 'pointer', color: '#ff4d4f', fontWeight: 'bold' },
  total: { fontSize: '24px', fontWeight: '800', margin: '20px 0', color: '#1a1a1a' },
  confirmBtn: { width: '100%', padding: '16px', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' },
  msgBanner: { marginTop: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' },
  notificacaoContainer: { position: 'fixed', top: '20px', right: '20px', zIndex: 1000 },
  sininhoIcon: { fontSize: '22px', cursor: 'pointer', backgroundColor: '#fff', padding: '12px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', position: 'relative' },
  badge: { position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ff4d4f', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px' },
  dropdown: { position: 'absolute', top: '60px', right: '0', backgroundColor: 'white', width: '280px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #eee' },
  dropdownTitle: { padding: '12px', fontWeight: 'bold', borderBottom: '1px solid #eee' },
  listaNotif: { maxHeight: '300px', overflowY: 'auto' },
  itemNotif: { padding: '10px', borderBottom: '1px solid #eee' },
  btnSeta: { 
    border: 'none', background: '#f0f0f0', borderRadius: '50%', 
    width: '30px', height: '30px', cursor: 'pointer', fontSize: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center' 
  },
};

export default Agenda;