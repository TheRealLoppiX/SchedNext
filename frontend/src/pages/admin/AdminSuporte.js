import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

// E-mail de suporte mostrado pros planos sem IA (Grátis/Essencial) — ajustar aqui se a caixa de
// entrada real for outra.
const EMAIL_SUPORTE = 'suporte@schednext.com.br';

const INTERVALO_POLL_MS = 8000; // só ativo com conversa escalada (ver useEffect abaixo), pra pegar resposta do time sem precisar recarregar a página

function AdminSuporte() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [conversa, setConversa] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [escalando, setEscalando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const pollRef = useRef(null);
  const fimListaRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/suporte`);
      const dados = await res.json();
      setPermitido(!!dados.permitido);
      setConversa(dados.conversa || null);
      setMensagens(dados.mensagens || []);
    } catch (err) {
      console.error('Erro ao carregar suporte:', err);
    }
  }, []);

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Só faz polling enquanto tem conversa escalada — é quando uma resposta pode chegar sem a
  // própria empresa ter feito nada (o time respondendo do outro lado).
  useEffect(() => {
    if (conversa?.status !== 'aguardando_humano') return;
    pollRef.current = setInterval(carregar, INTERVALO_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [conversa?.status, carregar]);

  useEffect(() => {
    fimListaRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

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
        carregar();
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
      detail: 'Você pode iniciar uma conversa nova a qualquer momento depois.',
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

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}><Icons.Help color="#111827" /> Suporte</h2>
        <div style={styles.cardForm}>
          <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#374151' }}>Ficou com alguma dúvida sobre o SchedNext? Fale com a gente por e-mail:</p>
          <a href={`mailto:${EMAIL_SUPORTE}`} style={styles.linkEmail}>{EMAIL_SUPORTE}</a>
          <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#9ca3af' }}>
            Chat com IA e atendimento direto por aqui são recursos dos planos <strong>Profissional</strong> e <strong>Enterprise</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}><Icons.Help color="#111827" /> Suporte</h2>
      <p style={styles.subtitle}>Pergunte qualquer coisa sobre o SchedNext. Se a resposta automática não resolver, é só chamar o nosso time.</p>

      <div style={styles.cardChat}>
        {conversa?.status === 'aguardando_humano' && (
          <div style={styles.bannerEscalado}>Encaminhado pro nosso time — a resposta aparece aqui mesmo, sem precisar recarregar.</div>
        )}

        <div style={styles.listaMensagens}>
          {mensagens.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '20px' }}>Digite sua dúvida abaixo pra começar.</p>
          )}
          {mensagens.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.remetente === 'empresa' ? 'flex-end' : 'flex-start' }}>
              <div style={m.remetente === 'empresa' ? styles.bolhaEmpresa : (m.remetente === 'super_admin' ? styles.bolhaHumano : styles.bolhaIa)}>
                {m.remetente === 'super_admin' && <div style={styles.rotuloHumano}>Time SchedNext</div>}
                {m.texto}
              </div>
            </div>
          ))}
          <div ref={fimListaRef} />
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
      </div>
    </div>
  );
}

const Icons = {
  Help: ({ color }) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'bottom' }}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
};

const styles = {
  container: { padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0' },
  subtitle: { color: '#6b7280', fontSize: '15px', marginBottom: '25px' },
  cardForm: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' },
  linkEmail: { fontSize: '16px', fontWeight: '700', color: '#2554eb', textDecoration: 'none' },
  cardChat: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', height: '560px', overflow: 'hidden' },
  bannerEscalado: { padding: '10px 16px', backgroundColor: '#eef2ff', color: '#3730a3', fontSize: '12.5px', fontWeight: '600', borderBottom: '1px solid #e0e7ff' },
  listaMensagens: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  bolhaEmpresa: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '10px 14px', borderRadius: '14px 14px 2px 14px', maxWidth: '75%', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  bolhaIa: { backgroundColor: '#f3f4f6', color: '#111827', padding: '10px 14px', borderRadius: '14px 14px 14px 2px', maxWidth: '75%', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  bolhaHumano: { backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '10px 14px', borderRadius: '14px 14px 14px 2px', maxWidth: '75%', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' },
  rotuloHumano: { fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px', opacity: 0.75 },
  linhaEnvio: { display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid #f3f4f6' },
  inputMensagem: { flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
  btnEnviar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  linhaAcoes: { display: 'flex', gap: '8px', padding: '0 16px 14px', flexWrap: 'wrap' },
  btnSecundario: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px' },
  btnExcluir: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px' }
};

export default AdminSuporte;
