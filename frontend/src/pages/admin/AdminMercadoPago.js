import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

function AdminMercadoPago() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [carregando, setCarregando] = useState(true);
  const [configurado, setConfigurado] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [taxa, setTaxa] = useState(0);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const carregarStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/mercadopago`);
      const dados = await res.json();
      setConfigurado(!!dados.configurado);
      setConectado(!!dados.conectado);
      setTaxa(dados.taxa_marketplace_percentual || 0);
    } catch (err) {
      console.error('Erro ao carregar status do Mercado Pago:', err);
    }
  }, []);

  useEffect(() => {
    carregarStatus().finally(() => setCarregando(false));
  }, [carregarStatus]);

  // Volta do OAuth do Mercado Pago com ?conectado=true ou ?erro=... na URL (ver
  // routes/mercadopago.js GET /mercadopago/oauth/callback) — mostra o toast e limpa a URL.
  useEffect(() => {
    if (searchParams.get('conectado') === 'true') {
      toast.success('Mercado Pago conectado com sucesso!');
      setSearchParams({}, { replace: true });
      carregarStatus();
    } else if (searchParams.get('erro')) {
      toast.error(searchParams.get('erro'));
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const conectar = async () => {
    setConectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/mercadopago/link-conectar`);
      const dados = await res.json();
      if (!res.ok) {
        toast.error(dados.error || 'Não foi possível iniciar a conexão.');
        setConectando(false);
        return;
      }
      window.location.href = dados.url;
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
      setConectando(false);
    }
  };

  const desconectar = async () => {
    const ok = await confirmar('Desconectar sua conta Mercado Pago?', {
      detail: 'Cobranças de Pix no agendamento e no fechamento de caixa param de funcionar até conectar de novo.',
      confirmText: 'Desconectar',
      danger: true
    });
    if (!ok) return;

    setDesconectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/mercadopago/desconectar`, { method: 'POST' });
      if (res.ok) {
        toast.success('Mercado Pago desconectado.');
        setConectado(false);
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

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>💳 Mercado Pago</h2>
      <p style={styles.subtitle}>Conecte sua conta Mercado Pago para cobrar Pix direto no agendamento do cliente e no fechamento de caixa.</p>

      {!configurado ? (
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            A integração com o Mercado Pago ainda não está disponível. Fale com o suporte.
          </p>
        </div>
      ) : conectado ? (
        <div style={styles.cardAtual}>
          <div style={styles.linhaTopo}>
            <div>
              <strong style={{ fontSize: '16px' }}>Conta conectada</strong>
              <div style={{ marginTop: '4px' }}>
                <span style={{ ...styles.badge, backgroundColor: '#d1fae5', color: '#065f46' }}>Conectado</span>
              </div>
            </div>
            <LoadingButton loading={desconectando} onClick={desconectar} style={styles.btnExcluir}>Desconectar</LoadingButton>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#6b7280' }}>
            A SchedNext fica com {taxa}% de cada Pix cobrado (taxa do seu plano atual) — o restante cai direto na sua conta Mercado Pago.
          </p>
        </div>
      ) : (
        <div style={styles.cardForm}>
          <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#374151' }}>Nenhuma conta conectada ainda.</p>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
            A SchedNext fica com {taxa}% de cada Pix cobrado no seu plano atual — o dinheiro cai direto na sua conta, sem passar pela SchedNext.
          </p>
          <LoadingButton loading={conectando} onClick={conectar} style={styles.btnCadastrar}>Conectar Mercado Pago</LoadingButton>
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
  btnExcluir: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px' }
};

export default AdminMercadoPago;
