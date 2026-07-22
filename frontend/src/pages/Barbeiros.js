import { useEffect, useState } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { format, startOfDay, addDays, setHours, setMinutes, isBefore, isSameDay, isAfter, getDay } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import usePaletaTenant from '../hooks/usePaletaTenant';
import { API_URL } from '../services/api';

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
    const aplicarFiltroReal = async () => {
      const regrasDia = getHorarioDoDia(dataSelecionada);
      
      // 1. Verificação inteligente baseada no AdminConta
      if (!regrasDia.aberto) {
        setEmpresaFechada(true);
        setBarbeirosFiltrados([]);
        return;
      }

      setEmpresaFechada(false);

      if (!horaSelecionada) {
        setBarbeirosFiltrados(barbeiros.filter(b => b.ativo == 1 || b.ativo == true || b.ativo === 'Ativo'));
        return;
      }

      const dataF = format(dataSelecionada, 'yyyy-MM-dd');
      try {
        const response = await fetch(`${API_URL}/disponibilidade-filtro?data=${dataF}&hora=${horaSelecionada}&empresa=${empresaSlug}`);
        const dataStatus = await response.json(); 

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

  const renderEstrelas = (media) => {
    const valorMedia = parseFloat(media) || 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px' }}>
        <div style={{ color: '#ffc107', fontSize: '18px' }}>
          {[1, 2, 3, 4, 5].map((estrela) => (
            <span key={estrela}>{estrela <= Math.round(valorMedia) ? '★' : '☆'}</span>
          ))}
        </div>
        <span style={{ fontSize: '13px', color: '#888' }}>{valorMedia > 0 ? valorMedia.toFixed(1) : 'Novo'}</span>
      </div>
    );
  };

  return (
    <div style={s.wrapper}>
      <h2 style={s.header}>Olá, {nomeCliente}!</h2>
      <p style={s.subHeader}>Bem-vindo à <strong>{nomeEmpresa}</strong></p>

      {unidades.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', justifyContent: 'center' }}>
          <button
            onClick={() => setUnidadeSelecionada(null)}
            style={{ ...s.chipUnidade, ...(unidadeSelecionada === null ? s.chipUnidadeAtiva : {}) }}
          >
            Todas as unidades
          </button>
          {unidades.map((u) => (
            <button
              key={u.id}
              onClick={() => setUnidadeSelecionada(u.id)}
              style={{ ...s.chipUnidade, ...(unidadeSelecionada === u.id ? s.chipUnidadeAtiva : {}) }}
            >
              {u.nome}
            </button>
          ))}
        </div>
      )}
      
      <div style={s.filterSection}>
        <div style={s.carouselRow}>
          <button style={s.btnSeta} onClick={() => setInicioSemana(addDays(inicioSemana, -7))} disabled={isSameDay(inicioSemana, startOfDay(new Date()))}>‹</button>
          <div style={s.scrollArea}>
            {gerarDias().map((dia, i) => {
              const sel = isSameDay(dia, dataSelecionada);
              return (
                <div key={i} onClick={() => { setDataSelecionada(dia); setHoraSelecionada(''); }} style={{ ...s.bubble, background: sel ? 'linear-gradient(135deg, #4c74f0, #2554eb)' : '#fff', color: sel ? '#ffffff' : '#000', border: sel ? '1px solid #2554eb' : '1px solid #eee' }}>
                  <span style={s.bubbleLabel}>{format(dia, 'EEE', { locale: ptBR }).toUpperCase()}</span>
                  <span style={s.bubbleValue}>{format(dia, 'dd/MM')}</span>
                </div>
              );
            })}
          </div>
          <button style={s.btnSeta} onClick={() => setInicioSemana(addDays(inicioSemana, 7))}>›</button>
        </div>

        <div style={{ ...s.carouselRow, marginTop: '15px' }}>
          <button style={s.btnSeta} onClick={() => { document.getElementById('h-scroll').scrollLeft -= 150 }}>‹</button>
          <div id="h-scroll" style={s.scrollArea}>
            {/* AGORA LÊ A REGRA DINÂMICA AO INVÉS DE APENAS DOMINGO */}
            {!empresaFechada && listaHorarios.length > 0 ? (
              listaHorarios.map((h, i) => {
                const sel = h === horaSelecionada;
                return (
                  <div key={i} 
                    onClick={() => setHoraSelecionada(sel ? '' : h)} 
                    style={{ ...s.bubble, minWidth: '70px', background: sel ? 'linear-gradient(135deg, #4c74f0, #2554eb)' : '#fff', color: sel ? '#ffffff' : '#000', border: sel ? '1px solid #2554eb' : '1px solid #eee' }}>
                    <span style={{ ...s.bubbleValue, fontSize: '15px' }}>{h}</span>
                  </div>
                );
              })
            ) : (
              <p style={{ color: '#999', fontSize: '12px', padding: '10px' }}>
                {empresaFechada ? "Fechado neste dia" : "Sem horários para hoje."}
              </p>
            )}
          </div>
          <button style={s.btnSeta} onClick={() => { document.getElementById('h-scroll').scrollLeft += 150 }}>›</button>
        </div>
      </div>

      <div style={s.containerHorizontal}>
        {empresaFechada ? (
          <div style={s.emptyState}>
            <h3 style={{ color: '#d9534f' }}>Fechado para agendamentos</h3>
            <p>Não funcionamos neste dia. Tente outra data!</p>
          </div>
        ) : barbeirosFiltrados.length > 0 ? (
          barbeirosFiltrados.map(b => (
            <div key={b.id} style={s.card}>
              <div style={s.avatar}>
                {b.foto_url ? <img src={b.foto_url} alt={b.nome} style={s.imgAvatar} /> : b.nome.charAt(0).toUpperCase()}
              </div>
              <h3 style={s.name}>{b.nome}</h3>
      {isAssinante && (
        <div style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: '700', marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          💎 Assinante
        </div>
      )}
              {renderEstrelas(b.media_estrelas)}
              <p style={s.description}>Profissional qualificado para seu estilo.</p>
              
              {horaSelecionada ? (
                <button
                  onClick={() => navigate(`/${empresaSlug}/agenda?barbeiro=${b.id}&data=${format(dataSelecionada, 'yyyy-MM-dd')}&hora=${horaSelecionada}${unidadeSelecionada ? `&unidade=${unidadeSelecionada}` : ''}`)}
                  style={s.btn}
                >
                  Agendar para às {horaSelecionada}
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/${empresaSlug}/agenda?barbeiro=${b.id}&data=${format(dataSelecionada, 'yyyy-MM-dd')}${unidadeSelecionada ? `&unidade=${unidadeSelecionada}` : ''}`)}
                  style={s.btnDisponibilidade}
                >
                  Ver disponibilidade
                </button>
              )}
            </div>
          ))
        ) : (
          <div style={s.emptyState}>
            <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Nenhum barbeiro disponível</p>
            <p>Tente outro horário ou data.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrapper: { padding: '40px 20px', minHeight: '100vh', backgroundColor: '#f8f9fa', textAlign: 'center' },
  header: { fontSize: '32px', color: '#1a1a1a', margin: '0 0 10px 0' },
  subHeader: { color: '#666', marginBottom: '30px', fontSize: '18px' },
  chipUnidade: { padding: '8px 16px', borderRadius: '20px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#374151' },
  chipUnidadeAtiva: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', border: '1px solid #2554eb' },
  filterSection: { maxWidth: '650px', margin: '0 auto 40px auto', backgroundColor: '#fff', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  carouselRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  scrollArea: { display: 'flex', gap: '10px', overflowX: 'auto', flex: 1, padding: '5px', scrollbarWidth: 'none' },
  bubble: { minWidth: '60px', padding: '10px 5px', borderRadius: '15px', border: '1px solid #eee', cursor: 'pointer', textAlign: 'center', flexShrink: 0 },
  bubbleLabel: { fontSize: '9px', fontWeight: 'bold', display: 'block' },
  bubbleValue: { fontSize: '13px', fontWeight: 'bold' },
  btnSeta: { border: 'none', background: '#f0f0f0', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' },
  containerHorizontal: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '25px', maxWidth: '1200px', margin: '0 auto' },
  card: { backgroundColor: '#fff', width: '280px', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  avatar: { width: '80px', height: '80px', backgroundColor: '#333', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', marginBottom: '15px', overflow: 'hidden', flexShrink: 0 },
  imgAvatar: { width: '100%', height: '100%', objectFit: 'cover' },
  name: { fontSize: '20px', color: '#333', marginBottom: '5px' },
  description: { fontSize: '14px', color: '#777', lineHeight: '1.5', marginBottom: '20px' },
  btn: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' },
  btnDisponibilidade: { backgroundColor: '#fff', color: '#1d4ed8', border: '1px solid #2554eb', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' },
  emptyState: { padding: '40px', color: '#999', width: '100%' }
};

export default Barbeiros;