import { useEffect, useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { format, startOfDay, addDays, setHours, setMinutes, isBefore, isSameDay, isAfter, getDay } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import usePaletaTenant from '../hooks/usePaletaTenant';
import { API_URL } from '../services/api';
import { obterTerminologia } from '../utils/terminologia';

function Barbeiros() {
  const [barbeiros, setBarbeiros] = useState([]);
  const [barbeirosFiltrados, setBarbeirosFiltrados] = useState([]);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [empresaPlano, setEmpresaPlano] = useState(null);
  const [unidades, setUnidades] = useState([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(null);
  
  // NOVO ESTADO: Guarda os horários dinâmicos da barbearia
  const [empresaHorarios, setEmpresaHorarios] = useState(null);
  const [empresaFechada, setEmpresaFechada] = useState(false);
  const [isAssinante, setIsAssinante] = useState(false);
  
  const [dataSelecionada, setDataSelecionada] = useState(startOfDay(new Date()));
  const [horaSelecionada, setHoraSelecionada] = useState(''); 
  const [inicioSemana, setInicioSemana] = useState(startOfDay(new Date()));

  const navigate = useNavigate();
  const { empresaSlug } = useParams();
  const { dados } = useOutletContext();
  const nomeCliente = dados?.nome_completo ? dados.nome_completo.split(' ')[0] : 'Cliente';
  const termos = obterTerminologia(empresaPlano?.vertical);

  usePaletaTenant(empresaPlano);

  useEffect(() => {
    fetch(`${API_URL}/empresa/slug/${empresaSlug}`)
      .then(r => r.json())
      .then(setEmpresaPlano)
      .catch(() => {});
  }, [empresaSlug]);

  useEffect(() => {
    const uid = localStorage.getItem('usuario_id');
    if (uid) {
      fetch(`${API_URL}/usuario/${uid}/assinante`)
        .then(r => r.json())
        .then(d => setIsAssinante(!!d.assinante))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/unidades?empresa=${empresaSlug}`)
      .then(r => r.json())
      .then(data => setUnidades(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [empresaSlug]);

  useEffect(() => {
    const query = unidadeSelecionada ? `&unidade_id=${unidadeSelecionada}` : '';
    fetch(`${API_URL}/barbeiros?empresa=${empresaSlug}${query}`)
      .then(res => res.json())
      .then(data => {
        // Sem essa validação, uma resposta de erro (objeto, não array) quebrava o próximo
        // efeito na hora de rodar `barbeiros.filter(...)`.
        if (!Array.isArray(data)) {
          setBarbeiros([]);
          return;
        }
        setBarbeiros(data);
        const nomeFmt = data[0]?.nome_empresa || empresaSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        setNomeEmpresa(nomeFmt);

        // Lê os horários configurados no AdminConta e salva no estado
        if (data[0]?.horarios_funcionamento) {
            setEmpresaHorarios(JSON.parse(data[0].horarios_funcionamento));
        }
      })
      .catch(() => setBarbeiros([]));
  }, [empresaSlug, unidadeSelecionada]);

  // FUNÇÃO MÁGICA: Pega a regra do dia exato (0=Dom, 1=Seg...)
  const getHorarioDoDia = (data) => {
      const diaSemana = getDay(data);
      if (empresaHorarios && empresaHorarios[diaSemana]) {
          return empresaHorarios[diaSemana];
      }
      // Se não achar, cria um padrão onde Domingo (0) é fechado
      return { aberto: diaSemana !== 0, abre: '08:00', fecha: '20:00' };
  };

  useEffect(() => {
    // Cliente pode trocar de dia/horário rapidamente antes da resposta anterior voltar; sem
    // essa flag, uma resposta antiga (de outro dia/hora) que chegue DEPOIS sobrescreve
    // barbeirosFiltrados com a disponibilidade errada.
    let cancelado = false;
    const aplicarFiltroReal = async () => {
      const regrasDia = getHorarioDoDia(dataSelecionada);

      // 1. Verificação inteligente baseada no AdminConta
      if (!regrasDia.aberto) {
        if (!cancelado) {
          setEmpresaFechada(true);
          setBarbeirosFiltrados([]);
        }
        return;
      }

      if (!cancelado) setEmpresaFechada(false);

      if (!horaSelecionada) {
        if (!cancelado) setBarbeirosFiltrados(barbeiros.filter(b => b.ativo == 1 || b.ativo == true || b.ativo === 'Ativo'));
        return;
      }

      const dataF = format(dataSelecionada, 'yyyy-MM-dd');
      try {
        const response = await fetch(`${API_URL}/disponibilidade-filtro?data=${dataF}&hora=${horaSelecionada}&empresa=${empresaSlug}`);
        const dataStatus = await response.json();
        if (cancelado) return;

        if (dataStatus.fechado) {
          setEmpresaFechada(true);
          setBarbeirosFiltrados([]);
          return;
        }

        const idsOcupados = dataStatus.idsOcupados || [];
        const resultado = barbeiros.filter(b => {
          const isAtivo = b.ativo == 1 || b.ativo == true || b.ativo === 'Ativo';
          return isAtivo && !idsOcupados.includes(b.id);
        });
        setBarbeirosFiltrados(resultado);
      } catch (err) {
        console.error("Erro ao filtrar:", err);
      }
    };
    aplicarFiltroReal();
    return () => { cancelado = true; };
  }, [dataSelecionada, horaSelecionada, barbeiros, empresaSlug, empresaHorarios]);

  const gerarHorariosDisponiveis = () => {
    const regrasDia = getHorarioDoDia(dataSelecionada);
    if (!regrasDia.aberto) return [];

    const slots = [];
    const agora = new Date();

    // Pega exatamente a hora que abre e fecha configuradas no painel
    const [hAbre, mAbre] = regrasDia.abre.split(':').map(Number);
    const [hFecha, mFecha] = regrasDia.fecha.split(':').map(Number);

    let cursor = setHours(setMinutes(new Date(dataSelecionada), mAbre), hAbre);
    const fim = setHours(setMinutes(new Date(dataSelecionada), mFecha), hFecha);

    while (isBefore(cursor, fim)) {
      const hStr = format(cursor, 'HH:mm');
      if (isSameDay(dataSelecionada, agora)) {
        if (isAfter(cursor, agora)) slots.push(hStr);
      } else {
        slots.push(hStr);
      }
      // Pula de 15 em 15 minutos na visão do cliente
      cursor = new Date(cursor.getTime() + 15 * 60000);
    }
    return slots;
  };

  const listaHorarios = gerarHorariosDisponiveis();

  useEffect(() => {
    if (horaSelecionada && !listaHorarios.includes(horaSelecionada)) {
      setHoraSelecionada('');
    }
  }, [dataSelecionada, listaHorarios]);

  const gerarDias = () => [...Array(7)].map((_, i) => addDays(inicioSemana, i));

  const iniciais = (nome) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  const nota = (media) => {
    const v = parseFloat(media) || 0;
    return v > 0 ? v.toFixed(1) : null;
  };

  // Horários agrupados por período, no estilo painel de embarque.
  const periodos = [
    { nome: 'Manhã', filtro: (h) => h < '12:00' },
    { nome: 'Tarde', filtro: (h) => h >= '12:00' && h < '18:00' },
    { nome: 'Noite', filtro: (h) => h >= '18:00' }
  ].map((p) => ({ ...p, horas: listaHorarios.filter(p.filtro) })).filter((p) => p.horas.length > 0);

  const irParaAgenda = (b) => navigate(`/${empresaSlug}/agenda?barbeiro=${b.id}&data=${format(dataSelecionada, 'yyyy-MM-dd')}${horaSelecionada ? `&hora=${horaSelecionada}` : ''}${unidadeSelecionada ? `&unidade=${unidadeSelecionada}` : ''}`);

  return (
    <div className="oc-pagina">
      <header className="oc-cabeca">
        <span className="oc-kicker">{nomeEmpresa || '...'} · Agenda online</span>
        <h1 className="oc-titulo">OLÁ, {nomeCliente.toUpperCase()}.</h1>
        <p className="oc-sub">Escolha o dia, o horário e quem vai te atender.</p>
      </header>

      {unidades.length > 1 && (
        <div className="oc-chips">
          <button type="button" onClick={() => setUnidadeSelecionada(null)} className={unidadeSelecionada === null ? 'ativo' : ''}>Todas as unidades</button>
          {unidades.map((u) => (
            <button type="button" key={u.id} onClick={() => setUnidadeSelecionada(u.id)} className={unidadeSelecionada === u.id ? 'ativo' : ''}>{u.nome}</button>
          ))}
        </div>
      )}

      <section className="oc-painel">
        <div className="oc-painel-cab">
          <span className="oc-rotulo"><b>01</b> Dia</span>
          <div className="oc-setas">
            <button type="button" aria-label="Semana anterior" onClick={() => setInicioSemana(addDays(inicioSemana, -7))} disabled={isSameDay(inicioSemana, startOfDay(new Date()))}>‹</button>
            <button type="button" aria-label="Próxima semana" onClick={() => setInicioSemana(addDays(inicioSemana, 7))}>›</button>
          </div>
        </div>
        <div className="oc-regua">
          {gerarDias().map((dia) => {
            const sel = isSameDay(dia, dataSelecionada);
            const fechado = !getHorarioDoDia(dia).aberto;
            return (
              <button type="button" key={dia.toISOString()} className={`oc-dia ${sel ? 'ativo' : ''} ${fechado ? 'fechado' : ''}`} onClick={() => { setDataSelecionada(dia); setHoraSelecionada(''); }}>
                <span className="oc-dia-semana">{format(dia, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)}</span>
                <span className="oc-dia-num">{format(dia, 'dd')}</span>
                <span className="oc-dia-mes">{fechado ? 'fechado' : format(dia, 'MMM', { locale: ptBR }).replace('.', '')}</span>
              </button>
            );
          })}
        </div>

        <div className="oc-painel-cab">
          <span className="oc-rotulo"><b>02</b> Horário</span>
          <span className="oc-dica">{horaSelecionada ? <>Mostrando quem está livre às <b>{horaSelecionada}</b></> : 'Opcional: filtra quem está livre'}</span>
        </div>
        {!empresaFechada && periodos.length > 0 ? (
          <div className="oc-embarque">
            {periodos.map((per) => (
              <div className="oc-embarque-linha" key={per.nome}>
                <span className="oc-embarque-periodo">{per.nome}</span>
                <div className="oc-embarque-horas">
                  {per.horas.map((h) => (
                    <button type="button" key={h} className={`oc-flap ${h === horaSelecionada ? 'ativo' : ''}`} onClick={() => setHoraSelecionada(h === horaSelecionada ? '' : h)}>
                      <span>{h}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="oc-vazio-linha">{empresaFechada ? 'Fechado neste dia.' : 'Sem horários para hoje. Escolha outro dia.'}</p>
        )}
      </section>

      <section>
        <div className="oc-secao-cab">
          <span className="oc-rotulo"><b>03</b> {termos.profissional}</span>
          {!empresaFechada && <span className="oc-contagem">{barbeirosFiltrados.length} {barbeirosFiltrados.length === 1 ? 'disponível' : 'disponíveis'}{horaSelecionada ? ` às ${horaSelecionada}` : ''}</span>}
        </div>

        {empresaFechada ? (
          <div className="oc-vazio">
            <strong>FECHADO NESTE DIA.</strong>
            <p>Não funcionamos nessa data. Escolha outro dia na régua acima.</p>
          </div>
        ) : barbeirosFiltrados.length > 0 ? (
          <div className="oc-pros">
            {barbeirosFiltrados.map((b, i) => (
              <article key={b.id} className="oc-pro" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="oc-pro-retrato">
                  {b.foto_url ? <img src={b.foto_url} alt={b.nome} /> : <span className="oc-pro-monograma">{iniciais(b.nome)}</span>}
                  <span className="oc-pro-indice">{String(i + 1).padStart(2, '0')}</span>
                  <span className="oc-pro-status"><i />{horaSelecionada ? `Livre às ${horaSelecionada}` : 'Atendendo'}</span>
                  <span className="oc-pro-scan" />
                </div>
                <div className="oc-pro-info">
                  <div className="oc-pro-linha">
                    <h3>{b.nome}</h3>
                    <span className="oc-pro-nota">{nota(b.media_estrelas) ? <>★ {nota(b.media_estrelas)}</> : 'NOVO'}</span>
                  </div>
                  <span className="oc-pro-esp">{b.especialidade || 'Profissional'}</span>
                  {isAssinante && <span className="oc-selo">Assinante</span>}
                  <button type="button" onClick={() => irParaAgenda(b)} className={`oc-btn ${horaSelecionada ? 'oc-btn-primario' : 'oc-btn-contorno'}`}>
                    {horaSelecionada ? `Agendar às ${horaSelecionada}` : 'Ver horários'}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="oc-vazio">
            <strong>NINGUÉM LIVRE NESSE HORÁRIO.</strong>
            <p>Tente outro horário ou outro dia.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Barbeiros;