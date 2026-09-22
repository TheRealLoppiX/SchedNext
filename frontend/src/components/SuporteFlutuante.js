import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import LoadingButton from './LoadingButton';
import { API_URL } from '../services/api';

// E-mail de suporte mostrado pros planos sem IA (Grátis/Essencial) — ajustar aqui se a caixa de
// entrada real for outra. suporte@ é reservado só pra suporte técnico (contato@ é comercial/
// Enterprise, nunca misturar os dois).
const EMAIL_SUPORTE = 'suporte@schednext.com.br';

const INTERVALO_POLL_MS = 8000; // só ativo com conversa escalada (ver useEffect abaixo)

// Botão flutuante de FAQ ("?") que expande num painel de chat — substitui o antigo módulo
// dedicado (Admin -> Suporte). Fica montado globalmente em Layout.js pra estar disponível em
// qualquer tela do painel, sem precisar navegar pra outro lugar.
function SuporteFlutuante() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [permitido, setPermitido] = useState(false);

  const [aba, setAba] = useState('atual'); // 'atual' | 'historico'
  const [conversa, setConversa] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [itemHistoricoAberto, setItemHistoricoAberto] = useState(null); // { conversa, mensagens }

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [escalando, setEscalando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const pollRef = useRef(null);
  const fimListaRef = useRef(null);

  const carregarAtual = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/suporte`);
      const dados = await res.json();
      setPermitido(!!dados.permitido);
      setConversa(dados.conversa || null);
      setMensagens(dados.mensagens || []);
    } catch (err) {
      console.error('Erro ao carregar suporte:', err);
    } finally {
      setCarregado(true);
    }
  }, []);

  // Só carrega quando o painel abre pela primeira vez, não no login da conta inteira — é um
  // widget secundário, não vale pagar o custo de rede em toda tela do painel.
  useEffect(() => {
    if (aberto && !carregado) carregarAtual();
  }, [aberto, carregado, carregarAtual]);

  useEffect(() => {
    if (!aberto || conversa?.status !== 'aguardando_humano') return;
    pollRef.current = setInterval(carregarAtual, INTERVALO_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [aberto, conversa?.status, carregarAtual]);

  useEffect(() => {
    if (aba === 'atual') fimListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aba]);

  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    try {
      const res = await fetch(`${API_URL}/admin/suporte/historico`);
      const dados = await res.json();
      setHistorico(Array.isArray(dados) ? dados : []);
    } catch (err) {
      toast.error('Erro ao carregar histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirAba = (novaAba) => {
    setAba(novaAba);
    setItemHistoricoAberto(null);
    if (novaAba === 'historico') carregarHistorico();
  };

  const abrirItemHistorico = async (id) => {
    try {
      const res = await fetch(`${API_URL}/admin/suporte/historico/${id}`);
      const dados = await res.json();
      if (res.ok) setItemHistoricoAberto(dados);
      else toast.error('Não foi possível abrir essa conversa.');
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    const msg = texto.trim();
    if (!msg || enviando) return;

    setTexto('');
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/admin/suporte/mensagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: msg })
      });
      const dados = await res.json();
      if (res.ok) {
        setConversa(dados.conversa);
        setMensagens(dados.mensagens);
      } else {
        toast.error(dados.error || 'Não foi possível enviar a mensagem.');
        setTexto(msg);
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
      setTexto(msg);
    } finally {
      setEnviando(false);
    }
  };

  const falarComTime = async () => {
    setEscalando(true);
    try {
      const res = await fetch(`${API_URL}/admin/suporte/escalar`, { method: 'POST' });
      if (res.ok) {
        toast.success('Encaminhado pro nosso time. A resposta aparece aqui mesmo.');
        carregarAtual();
      } else {
        toast.error('Não foi possível encaminhar agora.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setEscalando(false);
    }
  };

  const encerrar = async () => {
    const ok = await confirmar('Encerrar esta conversa de suporte?', {
      detail: 'Ela continua disponível no histórico. Você pode iniciar uma conversa nova a qualquer momento.',
      confirmText: 'Encerrar'
    });
    if (!ok) return;

    setEncerrando(true);
    try {
      const res = await fetch(`${API_URL}/admin/suporte/resolver`, { method: 'POST' });
      if (res.ok) {
        setConversa(null);
        setMensagens([]);
        toast.success('Conversa encerrada.');
      } else {
        toast.error('Não foi possível encerrar agora.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setEncerrando(false);
    }
  };

  const renderBolha = (m) => (
    <div key={m.id} style={{ display: 'flex', justifyContent: m.remetente === 'empresa' ? 'flex-end' : 'flex-start' }}>
      <div style={m.remetente === 'empresa' ? styles.bolhaEmpresa : (m.remetente === 'super_admin' ? styles.bolhaHumano : styles.bolhaIa)}>
        {m.remetente === 'super_admin' && <div style={styles.rotuloHumano}>{m.nome_admin || 'Time SchedNext'}</div>}
        {m.texto}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setAberto((v) => !v)}
        style={styles.botaoFab}
        title="Suporte"
        aria-label="Abrir suporte"
      >
        {aberto ? <Icons.Close /> : <Icons.Help />}
      </button>

      {aberto && (
        <div style={styles.painel}>
          <div style={styles.cabecalho}>
            <strong style={{ fontSize: '15px' }}>Suporte</strong>
            {permitido && (
              <div style={styles.abas}>
                <button onClick={() => abrirAba('atual')} style={aba === 'atual' ? styles.abaAtiva : styles.aba}>Conversa</button>
                <button onClick={() => abrirAba('historico')} style={aba === 'historico' ? styles.abaAtiva : styles.aba}>Histórico</button>
              </div>
            )}
          </div>

          {!carregado ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '30px 0' }}>Carregando...</p>
          ) : !permitido ? (
            <div style={{ padding: '18px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#374151' }}>Ficou com alguma dúvida sobre o SchedNext? Fale com a gente por e-mail:</p>
              <a href={`mailto:${EMAIL_SUPORTE}`} style={styles.linkEmail}>{EMAIL_SUPORTE}</a>
              <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                Chat com IA e atendimento direto por aqui são recursos dos planos <strong>Profissional</strong> e <strong>Enterprise</strong>.
              </p>
            </div>
          ) : aba === 'historico' ? (
            <div style={styles.corpo}>
              {itemHistoricoAberto ? (
                <>
                  <button onClick={() => setItemHistoricoAberto(null)} style={styles.btnVoltar}>&larr; Voltar ao histórico</button>
                  <div style={styles.listaMensagens}>
                    {itemHistoricoAberto.mensagens.map(renderBolha)}
                  </div>
                </>
              ) : carregandoHistorico ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '20px' }}>Carregando...</p>
              ) : historico.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '20px' }}>Nenhuma conversa anterior ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
                  {historico.map((c) => (
                    <button key={c.id} onClick={() => abrirItemHistorico(c.id)} style={styles.itemHistorico}>
                      <span>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                      <span style={{ ...styles.badgeStatus, ...(c.status === 'resolvido' ? styles.badgeResolvido : styles.badgeAberto) }}>
                        {c.status === 'resolvido' ? 'Resolvido' : (c.atendido_por_nome ? `Com ${c.atendido_por_nome}` : 'Aguardando')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {conversa?.status === 'aguardando_humano' && (
                <div style={styles.bannerEscalado}>
                  {conversa.atendido_por_nome ? `${conversa.atendido_por_nome} está te atendendo.` : 'Encaminhado pro nosso time.'} A resposta aparece aqui mesmo.
                </div>
              )}

              <div style={styles.corpo}>
                <div style={styles.listaMensagens}>
                  {mensagens.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '20px' }}>Digite sua dúvida abaixo pra começar.</p>
                  )}
                  {mensagens.map(renderBolha)}
                  <div ref={fimListaRef} />
                </div>
              </div>

              <form onSubmit={enviar} style={styles.linhaEnvio}>
                <input
                  type="text"
                  placeholder="Escreva sua dúvida..."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  style={styles.inputMensagem}
                  disabled={enviando}
                />
                <LoadingButton loading={enviando} type="submit" style={styles.btnEnviar}>Enviar</LoadingButton>
              </form>

              <div style={styles.linhaAcoes}>
                {conversa && conversa.status !== 'aguardando_humano' && (
                  <LoadingButton loading={escalando} onClick={falarComTime} style={styles.btnSecundario}>Falar com o time</LoadingButton>
                )}
                {conversa && (
                  <LoadingButton loading={encerrando} onClick={encerrar} style={styles.btnExcluir}>Encerrar conversa</LoadingButton>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const Icons = {
  Help: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Close: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

const styles = {
  botaoFab: {
    position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #4c74f0, #2554eb)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(37,84,235,0.4)',
    zIndex: 1000
  },
  painel: {
    position: 'fixed', bottom: '92px', right: '24px', width: '360px', maxWidth: 'calc(100vw - 32px)', height: '500px',
    maxHeight: 'calc(100vh - 140px)', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000,
    fontFamily: "'Inter', -apple-system, sans-serif"
  },
  cabecalho: { padding: '14px 16px', borderBottom: '1px solid #f3f4f6', color: '#111827' },
  abas: { display: 'flex', gap: '6px', marginTop: '10px' },
  aba: { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '12.5px', cursor: 'pointer', fontWeight: '600' },
  abaAtiva: { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #2554eb', background: '#eef2ff', color: '#2554eb', fontSize: '12.5px', cursor: 'pointer', fontWeight: '700' },
  linkEmail: { fontSize: '15px', fontWeight: '700', color: '#2554eb', textDecoration: 'none' },
  bannerEscalado: { padding: '8px 16px', backgroundColor: '#eef2ff', color: '#3730a3', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid #e0e7ff' },
  corpo: { flex: 1, overflowY: 'auto' },
  listaMensagens: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px' },
  bolhaEmpresa: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '9px 13px', borderRadius: '14px 14px 2px 14px', maxWidth: '80%', fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  bolhaIa: { backgroundColor: '#f3f4f6', color: '#111827', padding: '9px 13px', borderRadius: '14px 14px 14px 2px', maxWidth: '80%', fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  bolhaHumano: { backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '9px 13px', borderRadius: '14px 14px 14px 2px', maxWidth: '80%', fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  rotuloHumano: { fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px', opacity: 0.75 },
  linhaEnvio: { display: 'flex', gap: '8px', padding: '10px 14px', borderTop: '1px solid #f3f4f6' },
  inputMensagem: { flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13.5px' },
  btnEnviar: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  linhaAcoes: { display: 'flex', gap: '8px', padding: '0 14px 12px', flexWrap: 'wrap' },
  btnSecundario: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '12px' },
  btnExcluir: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px' },
  btnVoltar: { margin: '10px 14px 0', background: 'none', border: 'none', color: '#2554eb', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' },
  itemHistorico: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f3f4f6', background: '#fafafa', cursor: 'pointer', fontSize: '13px', color: '#374151' },
  badgeStatus: { fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' },
  badgeResolvido: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  badgeAberto: { backgroundColor: '#fef3c7', color: '#92400e' }
};

export default SuporteFlutuante;
