import { useEffect, useState, useRef } from 'react';
import { useLocation, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import ptBR from 'date-fns/locale/pt-BR';
import {
  setHours, setMinutes, format, isSameDay, startOfMinute,
  addMinutes, isBefore, isAfter, isEqual, parseISO, startOfDay
} from 'date-fns';
import { API_URL } from '../services/api';


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
  const [restantesPlano, setRestantesPlano] = useState({}); // saldo por servico no ciclo atual (null = ilimitado)
  const [pendentesPlano, setPendentesPlano] = useState({}); // agendamentos ja marcados (pendente/confirmado) neste ciclo, por servico
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
  const [pixInfo, setPixInfo] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const pixPollRef = useRef(null);
  const [barbeiroNome, setBarbeiroNome] = useState('');
  const [barbeiroFoto, setBarbeiroFoto] = useState(null);
  // Guarda o que foi confirmado pra continuar mostrando no bilhete depois que o carrinho limpa.
  const [bilhete, setBilhete] = useState(null);
  // Pré-pagamento opcional: só existe se a empresa conectou o Mercado Pago (aceita_pix, ver
  // GET /empresa/slug/:slug). O cliente escolhe antes de confirmar; sem escolha, paga no local.
  const { empresa } = useOutletContext() || {};
  const aceitaPix = !!empresa?.aceita_pix;
  const [pagarAgora, setPagarAgora] = useState(false);
  
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
          if (d.restantes) setRestantesPlano(d.restantes);
          if (d.pendentes) setPendentesPlano(d.pendentes);
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
          setBarbeiroFoto(barbeiro.foto_url || null);
          if (barbeiro.horarios_funcionamento) {
            setEmpresaHorarios(JSON.parse(barbeiro.horarios_funcionamento));
          }
        }
      })
      .catch(err => console.error("Falha na carga de barbeiros:", err));

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
    // Cliente pode trocar de dia rapidamente (vários cliques seguidos nos botões de dia); sem
    // essa flag, uma resposta antiga (do dia anterior) que chegue DEPOIS da resposta do dia
    // atual sobrescreve horariosOcupados com os dados errados, liberando/bloqueando horários
    // do dia errado na grade.
    let cancelado = false;
    const dataFormatada = format(dataHora, 'yyyy-MM-dd');
    fetch(`${API_URL}/horarios-ocupados?barbeiro_id=${barbeiroId}&data=${dataFormatada}`)
      .then(res => res.json())
      .then(data => {
        if (cancelado) return;
        setHorariosOcupados({
            agendados: data.agendados || [],
            bloqueios: data.bloqueios || []
        });
      })
      .catch(() => { if (!cancelado) setHorariosOcupados({ agendados: [], bloqueios: [] }); });
    return () => { cancelado = true; };
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
    if (!horaSelecionada || erroConflito || carrinho.length === 0 || confirmando) {
        if (!horaSelecionada) setMensagem('Selecione um horário para continuar.');
        return;
    }
    setConfirmando(true);
    setMensagem('Aguarde...');
    setPixInfo(null);
    if (pixPollRef.current) { clearInterval(pixPollRef.current); pixPollRef.current = null; }

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
          unidade_id: unidadeId || null,
          pagar_agora: aceitaPix && pagarAgora
        })
      });

      const data = await res.json();
      if (res.ok) {
          setMensagem('Agendado com sucesso');
          setBilhete({
            itens: carrinho.map((c) => servicos.find((sv) => String(sv.id) === String(c.id))).filter(Boolean),
            data: dataHora,
            duracao: duracaoTotal,
            codigo: data.agendamento_id,
            pagarAgora: aceitaPix && pagarAgora
          });
          setCarrinho([]);
          const dataFormatada = format(dataHora, 'yyyy-MM-dd');
          fetch(`${API_URL}/horarios-ocupados?barbeiro_id=${barbeiroId}&data=${dataFormatada}`)
            .then(res => res.json()).then(newData => {
                setHorariosOcupados({
                  agendados: newData.agendados || [],
                  bloqueios: newData.bloqueios || []
                });
            });

          // Pagamento antecipado por Pix: só vem preenchido se a empresa tiver conectado o
          // Mercado Pago (ver POST /agendar em routes/agendamentos.js). Sem isso, o agendamento
          // segue exatamente como sempre funcionou.
          if (data.pix && data.agendamento_id) {
            setPixInfo({ ...data.pix, agendamento_id: data.agendamento_id, pago: false, falhou: false });
            // Limite de tentativas: sem isso, um Pix que nunca é pago (cliente desiste, QR
            // expira) deixava o polling rodando pra sempre a cada 4s enquanto a aba ficasse
            // aberta. 150 tentativas de 4s = 10 minutos, tempo de sobra pro pagador escanear
            // e confirmar um Pix (que costuma expirar em bem menos tempo que isso).
            let tentativas = 0;
            const LIMITE_TENTATIVAS = 150;
            pixPollRef.current = setInterval(async () => {
              tentativas += 1;
              try {
                const resStatus = await fetch(`${API_URL}/pix/${data.agendamento_id}/status`);
                const statusDados = await resStatus.json();
                if (statusDados.pagamento_status === 'pago') {
                  clearInterval(pixPollRef.current);
                  pixPollRef.current = null;
                  setPixInfo((atual) => (atual ? { ...atual, pago: true } : atual));
                } else if (statusDados.pagamento_status === 'falhou' || tentativas >= LIMITE_TENTATIVAS) {
                  clearInterval(pixPollRef.current);
                  pixPollRef.current = null;
                  setPixInfo((atual) => (atual ? { ...atual, falhou: true } : atual));
                }
              } catch (err) {
                console.error('Erro ao consultar status do Pix:', err);
              }
            }, 4000);
          }
      } else {
          setMensagem(`Erro: ${data.error || 'Horário indisponível'}`);
      }
    } catch (err) {
      setMensagem('Erro de conexão. Tente novamente.');
    } finally {
      setConfirmando(false);
    }
  };

  useEffect(() => () => { if (pixPollRef.current) clearInterval(pixPollRef.current); }, []);

  const copiarCodigoPix = () => {
    if (!pixInfo?.qr_code) return;
    navigator.clipboard.writeText(pixInfo.qr_code).catch(() => {});
  };

  // Clique no serviço alterna: adiciona se não estiver, remove se já estiver no carrinho.
  const alternarServico = (servico) => {
    setBilhete(null);
    setMensagem('');
    const jaExiste = carrinho.some(item => item.id === servico.id);
    setCarrinho(jaExiste ? carrinho.filter(item => item.id !== servico.id) : [...carrinho, { id: servico.id }]);
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

  const moeda = (v) => `R$ ${(parseFloat(v) || 0).toFixed(2).replace('.', ',')}`;
  const naoLidas = notificacoes.filter(n => !n.lida).length;
  const confirmado = !!bilhete && mensagem.includes('sucesso');
  const etapa = confirmado ? 4 : carrinho.length > 0 && horaSelecionada ? 4 : horaSelecionada ? 3 : 2;
  const itensBilhete = confirmado ? bilhete.itens : carrinho.map((c) => servicos.find((sv) => String(sv.id) === String(c.id))).filter(Boolean);
  const dataBilhete = confirmado ? bilhete.data : horaSelecionada;
  const duracaoBilhete = confirmado ? bilhete.duracao : duracaoTotal;
  const totalCheio = itensBilhete.reduce((a, sv) => a + (parseFloat(sv.valor) || 0), 0);
  const totalExtraPlano = itensBilhete.filter((sv) => !servicosPlano.includes(sv.id)).reduce((a, sv) => a + (parseFloat(sv.valor) || 0), 0);
  const valorAPagar = isAssinante ? totalExtraPlano : totalCheio;
  const slots = gerarSlotsHorario();
  const periodos = [
    { nome: 'Manhã', f: (h) => h < '12:00' },
    { nome: 'Tarde', f: (h) => h >= '12:00' && h < '18:00' },
    { nome: 'Noite', f: (h) => h >= '18:00' }
  ].map((p) => ({ ...p, slots: slots.filter((sl) => p.f(sl.hora)) })).filter((p) => p.slots.length > 0);
  const ETAPAS = ['Profissional', 'Horário', 'Serviços', 'Confirmar'];

  return (
    <div className="oc-pagina oc-agenda">
      <div className="oc-notif">
        <button type="button" onClick={toggleNotificacoes} className="oc-notif-botao" aria-label="Notificações">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          {naoLidas > 0 && <span className="oc-notif-badge">{naoLidas}</span>}
        </button>
        {exibirNotificacoes && (
          <div className="oc-notif-lista">
            <span className="oc-rotulo">Notificações</span>
            {notificacoes.length === 0 ? <p className="oc-notif-vazio">Sem avisos.</p> : notificacoes.map(n => (
              <div key={n.id} className={`oc-notif-item ${n.lida ? '' : 'nova'}`}>
                <small>{new Date(n.criado_em).toLocaleString()}</small>
                <p>{n.mensagem}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <header className="oc-cabeca">
        <button type="button" className="oc-voltar" onClick={() => navigate(`/${empresaSlug}/barbeiros`)}>← Trocar profissional</button>
        <span className="oc-kicker">Agendamento</span>
        <div className="oc-agenda-titulo">
          <span className="oc-avatar-pro oc-avatar-pro-g">
            {barbeiroFoto ? <img src={barbeiroFoto} alt="" /> : (barbeiroNome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase()}
          </span>
          <h1 className="oc-titulo">COM {(barbeiroNome || '...').toUpperCase()}.</h1>
        </div>
        <ol className="oc-etapas">
          {ETAPAS.map((nome, k) => (
            <li key={nome} className={k + 1 < etapa || confirmado ? 'feita' : k + 1 === etapa ? 'atual' : ''}>
              <span>{String(k + 1).padStart(2, '0')}</span>{nome}
            </li>
          ))}
        </ol>
      </header>

      <div className="oc-agenda-grade">
        <div className="oc-agenda-coluna">
          <section className="oc-painel">
            <div className="oc-painel-cab"><span className="oc-rotulo"><b>02</b> Horário</span></div>
            {jaFiltrou ? (
              <div className="oc-resumo-hora">
                <div>
                  <span className="oc-dica">Horário escolhido</span>
                  <strong>{format(dataHora, "EEEE, dd 'de' MMMM", { locale: ptBR })} · {format(dataHora, 'HH:mm')}</strong>
                </div>
                <button
                  type="button"
                  className="oc-btn oc-btn-contorno oc-btn-p"
                  onClick={() => {
                    // Atualiza a URL via router (não window.history) pra re-renderizar sem reload.
                    // Mantém "unidade" na URL: sem isso, o próximo agendamento ia com unidade_id null.
                    const unidadeParam = unidadeId ? `&unidade=${unidadeId}` : '';
                    navigate(`${location.pathname}?barbeiro=${barbeiroId}&data=${format(dataHora, 'yyyy-MM-dd')}${unidadeParam}`, { replace: true });
                    setHoraSelecionada(null);
                  }}
                >Outro horário neste dia</button>
              </div>
            ) : (
              <>
                <div className="oc-regua-com-setas">
                  <button type="button" className="oc-seta" aria-label="Semana anterior"
                    disabled={isSameDay(inicioSemana, startOfDay(new Date())) || isBefore(inicioSemana, startOfDay(new Date()))}
                    onClick={() => {
                      const nova = new Date(inicioSemana);
                      nova.setDate(nova.getDate() - 7);
                      if (!isBefore(nova, startOfDay(new Date()))) setInicioSemana(nova);
                    }}>‹</button>
                  <div className="oc-regua">
                    {gerarDias().map((dia) => {
                      const sel = isSameDay(dia, dataHora);
                      const passado = isBefore(startOfDay(dia), startOfDay(new Date()));
                      return (
                        <button type="button" key={dia.toISOString()} disabled={passado} className={`oc-dia ${sel ? 'ativo' : ''} ${passado ? 'fechado' : ''}`}
                          onClick={() => { if (!passado) { setDataHora(dia); setHoraSelecionada(null); } }}>
                          <span className="oc-dia-semana">{format(dia, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)}</span>
                          <span className="oc-dia-num">{format(dia, 'dd')}</span>
                          <span className="oc-dia-mes">{format(dia, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="oc-seta" aria-label="Próxima semana" onClick={() => {
                    const nova = new Date(inicioSemana);
                    nova.setDate(nova.getDate() + 7);
                    setInicioSemana(nova);
                  }}>›</button>
                </div>
                {periodos.length > 0 ? (
                  <div className="oc-embarque">
                    {periodos.map((per) => (
                      <div className="oc-embarque-linha" key={per.nome}>
                        <span className="oc-embarque-periodo">{per.nome}</span>
                        <div className="oc-embarque-horas">
                          {per.slots.map((slot) => {
                            const sel = horaSelecionada && isEqual(slot.data, horaSelecionada);
                            return (
                              <button type="button" key={slot.hora} disabled={!slot.disponivel}
                                className={`oc-flap ${sel ? 'ativo' : ''} ${slot.disponivel ? '' : 'ocupado'}`}
                                onClick={() => { setHoraSelecionada(slot.data); setDataHora(slot.data); setBilhete(null); setMensagem(''); }}>
                                <span>{slot.hora}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="oc-vazio-linha">Fechado neste dia. Escolha outra data.</p>}
              </>
            )}
          </section>

          <section className="oc-painel">
            <div className="oc-painel-cab">
              <span className="oc-rotulo"><b>03</b> Serviços</span>
              <span className="oc-dica">Toque pra adicionar ou tirar</span>
            </div>
            <div className="oc-servicos">
              {servicos.map(sv => {
                const noCarrinho = carrinho.some(item => item.id === sv.id);
                const noPlano = isAssinante && servicosPlano.includes(sv.id);
                const restante = noPlano ? restantesPlano[sv.id] : undefined;
                const esgotado = noPlano && restante != null && restante <= 0;
                const pendentes = noPlano ? (pendentesPlano[sv.id] || 0) : 0;
                // "restante" só reflete o que já foi debitado no fechamento de caixa; agendamentos
                // pendentes/confirmados deste ciclo já comprometem a cota na prática.
                const risco = noPlano && !esgotado && restante != null && pendentes >= restante;
                return (
                  <div key={sv.id} className={`oc-servico ${noCarrinho ? 'ativo' : ''}`}>
                    <button type="button" className="oc-servico-botao" onClick={() => alternarServico(sv)} aria-pressed={noCarrinho}>
                      <span className="oc-servico-check">{noCarrinho ? '✓' : '+'}</span>
                      <span className="oc-servico-nome">
                        {sv.nome}
                        {noPlano && <em className={`oc-plano-tag ${esgotado ? 'esgotado' : ''}`}>{esgotado ? 'Limite atingido' : restante != null ? `No plano · ${restante} restante(s)` : 'Incluso no plano'}</em>}
                      </span>
                      <span className="oc-servico-dur">{parseInt(sv.duracao) || 30} min</span>
                      <span className="oc-servico-preco">{noPlano && !esgotado ? 'Plano' : moeda(sv.valor)}</span>
                    </button>
                    {esgotado && <p className="oc-aviso">Você já usou todos os {sv.nome.toLowerCase()} inclusos no seu plano este mês. Esse aqui entra à parte, por {moeda(sv.valor)}.</p>}
                    {risco && <p className="oc-aviso">Você já tem {pendentes === 1 ? 'um agendamento' : `${pendentes} agendamentos`} de {sv.nome.toLowerCase()} marcado{pendentes > 1 ? 's' : ''} este mês. Se {pendentes === 1 ? 'ele for concluído' : 'todos forem concluídos'} pela barbearia, esse aqui pode passar do limite do seu plano e ser cobrado no valor integral ({moeda(sv.valor)}).</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className={`oc-bilhete ${confirmado ? 'confirmado' : ''}`}>
          <div className="oc-bilhete-topo">
            <span className="oc-rotulo"><b>04</b> Bilhete</span>
            <span className="oc-bilhete-codigo">{confirmado && bilhete.codigo ? `#${bilhete.codigo}` : 'Rascunho'}</span>
          </div>
          <div className="oc-bilhete-campos">
            <div className="oc-bilhete-pro">
              <small>Profissional</small>
              <span className="oc-bilhete-pro-linha">
                <span className="oc-avatar-pro">{barbeiroFoto ? <img src={barbeiroFoto} alt="" /> : (barbeiroNome || '?').charAt(0).toUpperCase()}</span>
                <strong>{barbeiroNome || '...'}</strong>
              </span>
            </div>
            <div><small>Data</small><strong>{dataBilhete ? format(dataBilhete, 'dd MMM', { locale: ptBR }) : '--'}</strong></div>
            <div><small>Hora</small><strong className="oc-bilhete-hora">{dataBilhete ? format(dataBilhete, 'HH:mm') : '--:--'}</strong></div>
            <div><small>Duração</small><strong>{duracaoBilhete ? `${duracaoBilhete} min` : '--'}</strong></div>
          </div>
          <div className="oc-bilhete-itens">
            {itensBilhete.length === 0 ? <p className="oc-dica">Nenhum serviço ainda.</p> : itensBilhete.map((sv) => (
              <div key={sv.id} className="oc-bilhete-item">
                <span>{sv.nome}</span>
                <span>{isAssinante && servicosPlano.includes(sv.id) ? 'Plano' : moeda(sv.valor)}</span>
              </div>
            ))}
          </div>
          <div className="oc-bilhete-picote" aria-hidden="true" />
          <div className="oc-bilhete-total">
            <small>{isAssinante ? 'A pagar à parte' : 'Total'}</small>
            <strong>{moeda(isAssinante ? totalExtraPlano : totalCheio)}</strong>
          </div>
          {isAssinante && <p className="oc-dica oc-bilhete-plano">Serviços do seu plano de assinatura não são cobrados aqui.</p>}

          {aceitaPix && valorAPagar > 0 && !confirmado && (
            <div className="oc-pagamento" role="radiogroup" aria-label="Forma de pagamento">
              <span className="oc-pagamento-titulo">Pagamento</span>
              <button type="button" role="radio" aria-checked={pagarAgora} className={`oc-pag-opcao ${pagarAgora ? 'ativo' : ''}`} onClick={() => setPagarAgora(true)}>
                <span className="oc-pag-radio" />
                <span className="oc-pag-texto"><strong>Pagar agora</strong><small>Pix na hora, horário garantido</small></span>
                <span className="oc-pag-selo">PIX</span>
              </button>
              <button type="button" role="radio" aria-checked={!pagarAgora} className={`oc-pag-opcao ${!pagarAgora ? 'ativo' : ''}`} onClick={() => setPagarAgora(false)}>
                <span className="oc-pag-radio" />
                <span className="oc-pag-texto"><strong>Pagar no local</strong><small>No dia do atendimento</small></span>
              </button>
            </div>
          )}
          {confirmado && <div className="oc-carimbo" aria-hidden="true">CONFIRMADO</div>}
          {confirmado && aceitaPix && valorAPagar > 0 && !bilhete.pagarAgora && (
            <p className="oc-dica oc-pag-local">Pagamento no local, no dia do atendimento.</p>
          )}
          {pixInfo && (
            <div className="oc-pix">
              {pixInfo.pago ? (
                <div className="oc-pix-pago"><span>✓</span><strong>Pagamento recebido</strong><small>Seu horário está garantido.</small></div>
              ) : pixInfo.falhou ? (
                <>
                  <p className="oc-erro">Não foi possível confirmar o pagamento.</p>
                  <p className="oc-dica">Seu agendamento continua reservado. Combine o pagamento diretamente com o estabelecimento.</p>
                </>
              ) : (
                <>
                  <span className="oc-rotulo"><b>●</b> Pague com Pix · {moeda(valorAPagar || (bilhete?.itens || []).reduce((a, sv) => a + (parseFloat(sv.valor) || 0), 0))}</span>
                  {pixInfo.qr_code_base64 && <img src={`data:image/png;base64,${pixInfo.qr_code_base64}`} alt="QR Code do Pix" className="oc-pix-qr" />}
                  <button type="button" onClick={copiarCodigoPix} className="oc-btn oc-btn-contorno oc-btn-bloco">Copiar código Pix</button>
                  <p className="oc-dica">Aguardando confirmação do pagamento...</p>
                </>
              )}
            </div>
          )}

          {erroConflito && !confirmado && <p className="oc-erro">{erroConflito}</p>}
          {!confirmado && (
            <button type="button" onClick={confirmarAgendamento} disabled={carrinho.length === 0 || !horaSelecionada || !!erroConflito || confirmando} className="oc-btn oc-btn-primario oc-btn-bloco">
              {confirmando ? 'Confirmando...' : !horaSelecionada ? 'Escolha um horário' : carrinho.length === 0 ? 'Escolha um serviço' : aceitaPix && pagarAgora && valorAPagar > 0 ? 'Confirmar e pagar com Pix' : 'Confirmar agendamento'}
            </button>
          )}
          {confirmado && (
            <div className="oc-bilhete-acoes">
              <p className="oc-ok">Agendado! Você recebe um lembrete antes do horário.</p>
              <button type="button" className="oc-btn oc-btn-contorno oc-btn-bloco" onClick={() => navigate(`/${empresaSlug}/perfil?aba=agendamentos`)}>Ver meus agendamentos</button>
            </div>
          )}
          {mensagem && !confirmado && mensagem !== 'Aguarde...' && <p className="oc-erro">{mensagem}</p>}

        </aside>
      </div>
    </div>
  );
}

export default Agenda;
