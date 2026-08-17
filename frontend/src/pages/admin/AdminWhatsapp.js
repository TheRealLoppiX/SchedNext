import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

const INTERVALO_POLL_MS = 5000;

function AdminWhatsapp() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [instancia, setInstancia] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const pollRef = useRef(null);

  const pararPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const carregarStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp`);
      const dados = await res.json();
      setPermitido(!!dados.permitido);
      setConectado(!!dados.conectado);
      setInstancia(dados.instancia || null);
      if (dados.conectado) {
        setQrcode(null);
        pararPoll();
      }
      return dados;
    } catch (err) {
      console.error('Erro ao carregar status do WhatsApp:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    carregarStatus().finally(() => setCarregando(false));
    return pararPoll;
  }, [carregarStatus]);

  // Enquanto tem QR pendente pra escanear, confere a cada 5s se já conectou (sem exigir que o
  // usuário fique clicando em nada — o pareamento no celular é instantâneo do lado do WhatsApp).
  useEffect(() => {
    if (!qrcode) return;
    pollRef.current = setInterval(() => { carregarStatus(); }, INTERVALO_POLL_MS);
    return pararPoll;
  }, [qrcode, carregarStatus]);

  const conectar = async () => {
    setConectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/conectar`, { method: 'POST' });
      const dados = await res.json();
      if (!res.ok) return toast.error(dados.error || 'Não foi possível conectar o WhatsApp.');
      setInstancia(dados.instancia);
      setQrcode(dados.qrcode);
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setConectando(false);
    }
  };

  const gerarNovoQrCode = async () => {
    setConectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/qrcode`);
      const dados = await res.json();
      if (!res.ok) return toast.error(dados.error || 'Não foi possível gerar um novo QR Code.');
      setQrcode(dados.qrcode);
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    const ok = await confirmar('Desconectar o WhatsApp desta empresa?', {
      detail: 'O bot de agendamento por WhatsApp para de funcionar até conectar de novo (vai precisar escanear o QR Code outra vez, possivelmente com outro número).',
      confirmText: 'Desconectar',
      danger: true
    });
    if (!ok) return;

    setDesconectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('WhatsApp desconectado.');
        setConectado(false);
        setInstancia(null);
        setQrcode(null);
      } else {
        toast.error('Não foi possível desconectar.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setDesconectando(false);
    }
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>💬 WhatsApp</h2>
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Deixar clientes marcarem horário direto pelo WhatsApp é um recurso exclusivo dos planos <strong>Profissional</strong> e <strong>Enterprise</strong>.
            Fale com o suporte para fazer upgrade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>💬 WhatsApp</h2>
      <p style={styles.subtitle}>Conecte um número de WhatsApp para seus clientes agendarem horário direto por lá.</p>

      {conectado ? (
        <div style={styles.cardAtual}>
          <div style={styles.linhaTopo}>
            <div>
              <strong style={{ fontSize: '16px' }}>{instancia}</strong>
              <div style={{ marginTop: '4px' }}>
                <span style={{ ...styles.badge, backgroundColor: '#d1fae5', color: '#065f46' }}>Conectado</span>
              </div>
            </div>
            <LoadingButton loading={desconectando} onClick={desconectar} style={styles.btnExcluir}>Desconectar</LoadingButton>
          </div>
        </div>
      ) : qrcode ? (
        <div style={styles.cardAtual}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#374151' }}>
            Abra o WhatsApp no celular que vai atender seus clientes e escaneie o QR Code abaixo em
            <strong> Configurações → Aparelhos conectados → Conectar um aparelho</strong>.
          </p>
          <div style={{ textAlign: 'center' }}>
            <img src={qrcode} alt="QR Code de conexão do WhatsApp" style={styles.qrImg} />
          </div>
          <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
            Essa página confere sozinha a cada poucos segundos se você já conectou. Se o QR expirar antes de escanear, gere um novo.
          </p>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <LoadingButton loading={conectando} onClick={gerarNovoQrCode} style={styles.btnSecundario}>Gerar novo QR Code</LoadingButton>
          </div>
        </div>
      ) : (
        <div style={styles.cardForm}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#374151' }}>Nenhum WhatsApp conectado ainda.</p>
          <LoadingButton loading={conectando} onClick={conectar} style={styles.btnCadastrar}>Conectar WhatsApp</LoadingButton>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0' },
  subtitle: { color: '#6b7280', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px dashed #d1d5db' },
  cardForm: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' },
  cardAtual: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' },
  linhaTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  btnCadastrar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  btnSecundario: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px' },
  btnExcluir: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px' },
  qrImg: { width: '220px', maxWidth: '100%', height: 'auto', aspectRatio: '1', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '8px' }
};

export default AdminWhatsapp;
