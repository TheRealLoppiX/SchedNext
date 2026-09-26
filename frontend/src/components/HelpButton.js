import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useEscToClose from '../hooks/useEscToClose';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import LoadingButton from './LoadingButton';
import { API_URL } from '../services/api';

const FAQ = [
  {
    q: 'Como eu marco um horário?',
    a: 'Escolha o profissional, depois a data e o horário disponível, selecione os serviços desejados e confirme.'
  },
  {
    q: 'Como cancelo um agendamento?',
    a: 'Na aba "Agendamentos" do seu perfil, abra o agendamento e toque em cancelar. Cancelamentos muito em cima da hora podem não ser permitidos.'
  },
  {
    q: 'Esqueci minha senha, e agora?',
    a: 'Na tela de login, toque em "Esqueci minha senha" e siga o código enviado por e-mail.'
  },
  {
    q: 'Sou dono do negócio, como acesso o painel administrativo?',
    a: 'Acesse a área /admin/login com o e-mail e a senha cadastrados da sua empresa.'
  },
  {
    q: 'Como funciona o programa de fidelidade?',
    a: 'Cada atendimento concluído conta para a campanha ativa do negócio. Ao atingir o número necessário, o prêmio é liberado.'
  }
];

// suporte@ é reservado só pra suporte técnico (contato@ é comercial/Enterprise, nunca misturar).
const EMAIL_SUPORTE = 'suporte@schednext.com.br';
const INTERVALO_POLL_MS = 8000;
const VELOCIDADE_DIGITACAO_MS = 14; // por caractere

// Revela o texto progressivamente, caractere por caractere, simulando o time/IA "digitando" —
// só quando `ativo` (decidido uma única vez em HelpButton, ver deveAnimar) é true; senão mostra
// o texto pronto direto. Roda inteiramente em JS porque o truque de CSS puro (width 0% -> 100%)
// só funciona bem numa linha só, e as respostas do chat quebram em várias linhas.
function TextoDigitando({ texto, ativo }) {
  const [exibido, setExibido] = useState(ativo ? '' : texto);
  const [terminou, setTerminou] = useState(!ativo);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    let i = 0;
    const passo = () => {
      if (cancelado) return;
      i += 1;
      setExibido(texto.slice(0, i));
      if (i < texto.length) setTimeout(passo, VELOCIDADE_DIGITACAO_MS);
      else setTerminou(true);
    };
    const primeiro = setTimeout(passo, VELOCIDADE_DIGITACAO_MS);
    return () => { cancelado = true; clearTimeout(primeiro); };
    // ativo já vem decidido de fora e nunca muda depois de montado — roda só uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{exibido}{!terminou && <span className="bb-cursor-digitando" aria-hidden="true" />}</>;
}

// Botão flutuante único de ajuda: perguntas frequentes (qualquer página logada, exceto a
// landing) em cima, e atendimento embaixo — chat com IA pra admin de empresa com IA liberada no
// plano (Profissional/Enterprise), e-mail de suporte pros demais casos. Antes eram dois botões
// flutuantes sobrepostos (este e o antigo SuporteFlutuante.js, só pro admin); unificados aqui
// pra não competir no mesmo canto da tela.
function HelpButton() {
  const toast = useToast();
  const confirmar = useConfirm();
  const location = useLocation();

  const [aberto, setAberto] = useState(false);
  const [visao, setVisao] = useState('home'); // 'home' | 'chat'
  const [abaChat, setAbaChat] = useState('atual'); // 'atual' | 'historico'

  useEscToClose(aberto, () => setAberto(false));

  const isAdminPath = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  let adminUnidadeId = null;
  try {
    const raw = localStorage.getItem('adminToken');
    adminUnidadeId = raw ? JSON.parse(raw).unidade_id || null : null;
  } catch (e) { /* token ausente/inválido: trata como não-admin-de-unidade */ }
  // Atendimento (e-mail ou chat) é só pro admin principal da empresa — admin de unidade não tem
  // essas rotas liberadas no backend (ver server.js, ROTAS_PERMITIDAS_ADMIN_UNIDADE).
  const mostrarAtendimento = isAdminPath && !adminUnidadeId;

  const [carregadoSuporte, setCarregadoSuporte] = useState(false);
  const [permitidoIA, setPermitidoIA] = useState(false);
  const [conversa, setConversa] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [itemHistoricoAberto, setItemHistoricoAberto] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [escalando, setEscalando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const pollRef = useRef(null);
  const fimListaRef = useRef(null);

  // Controla o efeito de "digitando" (ver TextoDigitando abaixo): só anima uma mensagem na
  // primeira vez que ela aparece nesta sessão do widget — reabrir o painel, trocar de aba ou
  // qualquer outro re-render não repete a animação em cima do que já foi mostrado.
  const mensagensVistasRef = useRef(new Set());
  const decisaoAnimarRef = useRef(new Map());
  const deveAnimar = (id) => {
    if (decisaoAnimarRef.current.has(id)) return decisaoAnimarRef.current.get(id);
    const animar = !mensagensVistasRef.current.has(id);
    decisaoAnimarRef.current.set(id, animar);
    mensagensVistasRef.current.add(id);
    return animar;
  };

  const carregarAtual = useCallback(async () => {
    const primeiraCarga = !carregadoSuporte;
    try {
      const res = await fetch(`${API_URL}/admin/suporte`);
      const dados = await res.json();
      setPermitidoIA(!!dados.permitido);
      setConversa(dados.conversa || null);
      // Mensagens já existentes na primeira busca (histórico da conversa ativa) aparecem
      // prontas — só as que chegarem DEPOIS (resposta nova da IA/time) digitam na tela.
      if (primeiraCarga) (dados.mensagens || []).forEach((m) => mensagensVistasRef.current.add(m.id));
      setMensagens(dados.mensagens || []);
    } catch (err) {
      console.error('Erro ao carregar suporte:', err);
    } finally {
      setCarregadoSuporte(true);
    }
  }, [carregadoSuporte]);

  // Carrega o status do suporte assim que o painel abre (só pra quem pode ter atendimento) —
  // decide se a segunda seção mostra o card de chat ou o de e-mail.
  useEffect(() => {
    if (aberto && mostrarAtendimento && !carregadoSuporte) carregarAtual();
  }, [aberto, mostrarAtendimento, carregadoSuporte, carregarAtual]);

  useEffect(() => {
    if (!aberto || visao !== 'chat' || abaChat !== 'atual' || conversa?.status !== 'aguardando_humano') return;
    pollRef.current = setInterval(carregarAtual, INTERVALO_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [aberto, visao, abaChat, conversa?.status, carregarAtual]);

  useEffect(() => {
    if (visao === 'chat' && abaChat === 'atual') fimListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, visao, abaChat]);

  const fechar = () => setAberto(false);
  const abrirChat = () => { setVisao('chat'); setAbaChat('atual'); };
  const voltarHome = () => { setVisao('home'); setItemHistoricoAberto(null); };

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

  const abrirAbaChat = (novaAba) => {
    setAbaChat(novaAba);
    setItemHistoricoAberto(null);
    if (novaAba === 'historico') carregarHistorico();
  };

  const abrirItemHistorico = async (id) => {
    try {
      const res = await fetch(`${API_URL}/admin/suporte/historico/${id}`);
      const dados = await res.json();
      if (res.ok) {
        // Conversa antiga: mostra tudo pronto, sem digitar de novo o que já foi lido antes.
        (dados.mensagens || []).forEach((m) => mensagensVistasRef.current.add(m.id));
        setItemHistoricoAberto(dados);
      } else {
        toast.error('Não foi possível abrir essa conversa.');
      }
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
      if (res.ok) { toast.success('Encaminhado pro nosso time. A resposta aparece aqui mesmo.'); carregarAtual(); }
      else toast.error('Não foi possível encaminhar agora.');
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
      if (res.ok) { setConversa(null); setMensagens([]); toast.success('Conversa encerrada.'); }
      else toast.error('Não foi possível encerrar agora.');
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setEncerrando(false);
    }
  };

  const renderBolha = (m) => (
    <div key={m.id} className="bb-help-bolha" style={{ display: 'flex', justifyContent: m.remetente === 'empresa' ? 'flex-end' : 'flex-start' }}>
      <div style={m.remetente === 'empresa' ? chatStyles.bolhaEmpresa : (m.remetente === 'super_admin' ? chatStyles.bolhaHumano : chatStyles.bolhaIa)}>
        {m.remetente === 'super_admin' && <div style={chatStyles.rotuloHumano}>{m.nome_admin || 'Time SchedNext'}</div>}
        {m.remetente === 'empresa' ? m.texto : <TextoDigitando texto={m.texto} ativo={deveAnimar(m.id)} />}
      </div>
    </div>
  );

  // Não faz sentido mostrar ajuda de "como cancelar agendamento"/"como acessar o admin"
  // pra quem ainda nem criou conta, a landing pública fica sem o botão.
  if (location.pathname === '/') return null;

  return (
    <>
      <button className="bb-help-fab" onClick={() => setAberto(true)} aria-label="Ajuda e suporte" title="Ajuda e suporte">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7" />
          <circle cx="12" cy="17.5" r="0.35" fill="#fff" stroke="none" />
        </svg>
      </button>
      {aberto && (
        <div className="bb-modal-overlay" onClick={fechar}>
          <div className="bb-help-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="bb-help-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {visao === 'chat' && (
                  <button onClick={voltarHome} aria-label="Voltar" style={chatStyles.btnVoltarHeader}>&larr;</button>
                )}
                {visao === 'chat' ? 'Suporte' : 'Ajuda'}
              </h3>
              <button className="bb-help-close" onClick={fechar} aria-label="Fechar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {visao === 'home' ? (
              <div style={{ overflowY: 'auto' }}>
                <p className="bb-help-secao-titulo">Perguntas frequentes</p>
                <div className="bb-help-list">
                  {FAQ.map((item, i) => (
                    <details key={i} className="bb-help-item">
                      <summary>{item.q}</summary>
                      <p>{item.a}</p>
                    </details>
                  ))}
                </div>

                {mostrarAtendimento && carregadoSuporte && (
                  <>
                    <p className="bb-help-secao-titulo">Atendimento</p>
                    {permitidoIA ? (
                      <div className="bb-help-chat-card" onClick={abrirChat} role="button" tabIndex={0}>
                        <div className="bb-help-chat-icone"><Icons.Chat /></div>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#111827' }}>Falar com o suporte</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--bb-text-muted)' }}>Chat com IA, com opção de falar com nosso time</p>
                        </div>
                      </div>
                    ) : (
                      <a href={`mailto:${EMAIL_SUPORTE}`} className="bb-help-chat-card" style={{ textDecoration: 'none' }}>
                        <div className="bb-help-chat-icone"><Icons.Mail /></div>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#111827' }}>{EMAIL_SUPORTE}</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--bb-text-muted)' }}>Chat com IA é exclusivo dos planos Profissional e Enterprise</p>
                        </div>
                      </a>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={chatStyles.abas}>
                  <button onClick={() => abrirAbaChat('atual')} style={abaChat === 'atual' ? chatStyles.abaAtiva : chatStyles.aba}>Conversa</button>
                  <button onClick={() => abrirAbaChat('historico')} style={abaChat === 'historico' ? chatStyles.abaAtiva : chatStyles.aba}>Histórico</button>
                </div>

                {abaChat === 'historico' ? (
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {itemHistoricoAberto ? (
                      <>
                        <button onClick={() => setItemHistoricoAberto(null)} style={chatStyles.btnVoltar}>&larr; Voltar ao histórico</button>
                        <div style={chatStyles.listaMensagens}>{itemHistoricoAberto.mensagens.map(renderBolha)}</div>
                      </>
                    ) : carregandoHistorico ? (
                      <p style={chatStyles.textoVazio}>Carregando...</p>
                    ) : historico.length === 0 ? (
                      <p style={chatStyles.textoVazio}>Nenhuma conversa anterior ainda.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 16px' }}>
                        {historico.map((c) => (
                          <button key={c.id} onClick={() => abrirItemHistorico(c.id)} style={chatStyles.itemHistorico}>
                            <span>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                            <span style={{ ...chatStyles.badgeStatus, ...(c.status === 'resolvido' ? chatStyles.badgeResolvido : chatStyles.badgeAberto) }}>
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
                      <div style={chatStyles.bannerEscalado}>
                        {conversa.atendido_por_nome ? `${conversa.atendido_por_nome} está te atendendo.` : 'Encaminhado pro nosso time.'} A resposta aparece aqui mesmo.
                      </div>
                    )}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <div style={chatStyles.listaMensagens}>
                        {mensagens.length === 0 && <p style={chatStyles.textoVazio}>Digite sua dúvida abaixo pra começar.</p>}
                        {mensagens.map(renderBolha)}
                        <div ref={fimListaRef} />
                      </div>
                    </div>
                    <form onSubmit={enviar} style={chatStyles.linhaEnvio}>
                      <input
                        type="text"
                        placeholder="Escreva sua dúvida..."
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        style={chatStyles.inputMensagem}
                        disabled={enviando}
                      />
                      <LoadingButton loading={enviando} type="submit" style={chatStyles.btnEnviar}>Enviar</LoadingButton>
                    </form>
                    <div style={chatStyles.linhaAcoes}>
                      {conversa && conversa.status !== 'aguardando_humano' && (
                        <LoadingButton loading={escalando} onClick={falarComTime} style={chatStyles.btnSecundario}>Falar com o time</LoadingButton>
                      )}
                      {conversa && (
                        <LoadingButton loading={encerrando} onClick={encerrar} style={chatStyles.btnExcluir}>Encerrar conversa</LoadingButton>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const Icons = {
  Chat: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>,
  Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
};

const chatStyles = {
  btnVoltarHeader: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  abas: { display: 'flex', gap: '6px', padding: '12px 16px 0' },
  aba: { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '12.5px', cursor: 'pointer', fontWeight: '600' },
  abaAtiva: { flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #2554eb', background: '#eef2ff', color: '#2554eb', fontSize: '12.5px', cursor: 'pointer', fontWeight: '700' },
  bannerEscalado: { margin: '10px 16px 0', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#eef2ff', color: '#3730a3', fontSize: '12px', fontWeight: '600' },
  listaMensagens: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 16px' },
  textoVazio: { textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '20px' },
  bolhaEmpresa: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '9px 13px', borderRadius: '14px 14px 2px 14px', maxWidth: '80%', fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  bolhaIa: { backgroundColor: '#f3f4f6', color: '#111827', padding: '9px 13px', borderRadius: '14px 14px 14px 2px', maxWidth: '80%', fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  bolhaHumano: { backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '9px 13px', borderRadius: '14px 14px 14px 2px', maxWidth: '80%', fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  rotuloHumano: { fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px', opacity: 0.75 },
  linhaEnvio: { display: 'flex', gap: '8px', padding: '10px 16px', borderTop: '1px solid #f3f4f6' },
  inputMensagem: { flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13.5px' },
  btnEnviar: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  linhaAcoes: { display: 'flex', gap: '8px', padding: '0 16px 14px', flexWrap: 'wrap' },
  btnSecundario: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '12px' },
  btnExcluir: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px' },
  btnVoltar: { margin: '10px 16px 0', background: 'none', border: 'none', color: '#2554eb', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' },
  itemHistorico: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f3f4f6', background: '#fafafa', cursor: 'pointer', fontSize: '13px', color: '#374151' },
  badgeStatus: { fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' },
  badgeResolvido: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  badgeAberto: { backgroundColor: '#fef3c7', color: '#92400e' }
};

export default HelpButton;
