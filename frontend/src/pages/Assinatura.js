import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';
import LoadingButton from '../components/LoadingButton';
import { API_URL } from '../services/api';

function Assinatura() {
  const toast = useToast();
  const userId = localStorage.getItem('usuario_id');

  const [carregando, setCarregando] = useState(true);
  const [planoId, setPlanoId] = useState(null);
  const [plano, setPlano] = useState(null);
  const [assinante, setAssinante] = useState(false);
  const [statusAssinatura, setStatusAssinatura] = useState(null);
  const [formaConfigurada, setFormaConfigurada] = useState(null);
  const [statusCobranca, setStatusCobranca] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [formaEscolhida, setFormaEscolhida] = useState('cartao');
  const [pixInfo, setPixInfo] = useState(null);
  const pixPollRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [resAssinante, resCobranca] = await Promise.all([
        fetch(`${API_URL}/usuario/${userId}/assinante`),
        fetch(`${API_URL}/usuario/${userId}/assinatura-cobranca`)
      ]);
      const dadosAssinante = await resAssinante.json();
      const dadosCobranca = await resCobranca.json();

      setAssinante(!!dadosAssinante.assinante);
      setPlanoId(dadosAssinante.plano_id || null);
      setStatusAssinatura(dadosAssinante.status_assinatura || null);
      setFormaConfigurada(dadosAssinante.assinatura_forma_pagamento || null);
      setStatusCobranca(dadosCobranca.status || null);

      if (dadosAssinante.plano_id) {
        const resPlano = await fetch(`${API_URL}/assinaturas/plano/${dadosAssinante.plano_id}`);
        if (resPlano.ok) setPlano(await resPlano.json());
      }
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err);
    } finally {
      setCarregando(false);
    }
  }, [userId]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => () => { if (pixPollRef.current) clearInterval(pixPollRef.current); }, []);

  const iniciarPollingPix = () => {
    let tentativas = 0;
    const LIMITE_TENTATIVAS = 150; // 150 x 4s = 10 minutos, mesmo limite do Pix de agendamento
    pixPollRef.current = setInterval(async () => {
      tentativas += 1;
      try {
        const res = await fetch(`${API_URL}/usuario/${userId}/assinatura-cobranca/pix/status`);
        const dados = await res.json();
        if (dados.status === 'pago') {
          clearInterval(pixPollRef.current);
          pixPollRef.current = null;
          setPixInfo((atual) => (atual ? { ...atual, pago: true } : atual));
          carregar();
        } else if (dados.status === 'falhou' || tentativas >= LIMITE_TENTATIVAS) {
          clearInterval(pixPollRef.current);
          pixPollRef.current = null;
          setPixInfo((atual) => (atual ? { ...atual, falhou: true } : atual));
        }
      } catch (err) {
        console.error('Erro ao consultar status do Pix da assinatura:', err);
      }
    }, 4000);
  };

  const assinar = async () => {
    setProcessando(true);
    try {
      const res = await fetch(`${API_URL}/usuario/${userId}/assinatura-cobranca/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forma_pagamento: formaEscolhida })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível iniciar a assinatura.');
        return;
      }

      if (formaEscolhida === 'pix') {
        setPixInfo({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, pago: false, falhou: false });
        iniciarPollingPix();
      } else {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
        toast.success('Finalize a autorização na aba que abriu. A cobrança automática ativa assim que for confirmada.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const cancelar = async () => {
    setProcessando(true);
    try {
      const res = await fetch(`${API_URL}/usuario/${userId}/assinatura-cobranca/cancelar`, { method: 'POST' });
      if (res.ok) {
        toast.success('Cobrança automática cancelada.');
        setPixInfo(null);
        carregar();
      } else {
        toast.error('Não foi possível cancelar agora.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const copiarCodigoPix = () => {
    if (!pixInfo?.qr_code) return;
    navigator.clipboard.writeText(pixInfo.qr_code).catch(() => {});
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  const cobrancaAtivaCartao = formaConfigurada === 'cartao' && statusCobranca === 'authorized';
  const cobrancaAtivaPix = formaConfigurada === 'pix' && statusAssinatura !== 'inadimplente';
  const cobrancaAtiva = cobrancaAtivaCartao || cobrancaAtivaPix;
  const inadimplente = statusAssinatura === 'inadimplente';

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <h2 style={styles.header}>Assinatura</h2>

        {!planoId ? (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Você ainda não tem um plano de assinatura atribuído. Fale com o estabelecimento pra saber mais.
          </p>
        ) : (
          <>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '18px' }}>{plano?.nome || 'Seu plano'}</strong>
                {assinante && !inadimplente && <span style={styles.badgeAtivo}>Assinante</span>}
                {assinante && inadimplente && <span style={styles.badgeInadimplente}>Mensalidade em atraso</span>}
              </div>
              {plano?.preco != null && (
                <p style={{ margin: '8px 0 0', fontSize: '15px', color: '#374151' }}>R$ {Number(plano.preco).toFixed(2)}/mês</p>
              )}
            </div>

            {inadimplente && (
              <div style={{ ...styles.card, marginTop: '16px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>
                  Não identificamos o pagamento da sua mensalidade. Enquanto isso, o preço e a cota do seu plano ficam suspensos — regularize abaixo ou diretamente com o estabelecimento.
                </p>
              </div>
            )}

            <div style={{ ...styles.card, marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}>Cobrança automática</h3>
              {cobrancaAtiva && !inadimplente ? (
                <>
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                    ✅ Ativa por {formaConfigurada === 'pix' ? 'Pix' : 'cartão'} — {formaConfigurada === 'pix' ? 'você recebe um Pix novo por e-mail e WhatsApp todo mês.' : 'seu cartão é cobrado automaticamente todo mês.'}
                  </p>
                  <LoadingButton loading={processando} onClick={cancelar} style={styles.btnCancelar}>Cancelar cobrança automática</LoadingButton>
                </>
              ) : pixInfo ? (
                <div style={styles.pixBox}>
                  {pixInfo.pago ? (
                    <p style={{ margin: 0, textAlign: 'center', color: '#166534', fontWeight: '700', fontSize: '14px' }}>✅ Pagamento recebido!</p>
                  ) : pixInfo.falhou ? (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, color: '#991b1b', fontWeight: '700', fontSize: '14px' }}>⚠️ Não foi possível confirmar o pagamento.</p>
                      <LoadingButton loading={processando} onClick={() => setPixInfo(null)} style={{ ...styles.btnAssinar, marginTop: '10px' }}>Gerar novo Pix</LoadingButton>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#374151', fontWeight: '600' }}>Pague por Pix pra ativar sua mensalidade</p>
                      {pixInfo.qr_code_base64 && (
                        <img
                          src={`data:image/png;base64,${pixInfo.qr_code_base64}`}
                          alt="QR Code do Pix"
                          style={{ width: '180px', maxWidth: '100%', height: 'auto', aspectRatio: '1', border: '1px solid #eee', borderRadius: '8px', padding: '6px', background: '#fff' }}
                        />
                      )}
                      <div style={{ marginTop: '10px' }}>
                        <button type="button" onClick={copiarCodigoPix} style={styles.btnCopiarPix}>Copiar código Pix</button>
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#9ca3af' }}>Aguardando confirmação do pagamento...</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6b7280' }}>
                    {inadimplente
                      ? 'Regularize sua mensalidade por cartão ou Pix, ou combine o pagamento diretamente com o estabelecimento.'
                      : 'Ainda não tem cobrança automática configurada. Assine pra não precisar combinar o pagamento por fora todo mês — é opcional, a primeira mensalidade pode ser paga presencialmente.'}
                  </p>
                  <div style={styles.formaPagamentoRow}>
                    <button
                      type="button"
                      onClick={() => setFormaEscolhida('cartao')}
                      style={{ ...styles.btnForma, ...(formaEscolhida === 'cartao' ? styles.btnFormaAtiva : {}) }}
                    >
                      Cartão
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaEscolhida('pix')}
                      style={{ ...styles.btnForma, ...(formaEscolhida === 'pix' ? styles.btnFormaAtiva : {}) }}
                    >
                      Pix
                    </button>
                  </div>
                  <LoadingButton loading={processando} onClick={assinar} style={styles.btnAssinar}>
                    {formaEscolhida === 'pix' ? 'Gerar Pix' : 'Assinar agora'}
                  </LoadingButton>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  body: { backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '40px 20px', fontFamily: '"Inter", sans-serif' },
  container: { backgroundColor: '#fff', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', width: '100%', maxWidth: '450px', boxSizing: 'border-box' },
  header: { fontSize: '22px', fontWeight: '700', marginBottom: '20px', color: '#333' },
  card: { backgroundColor: '#f9fafb', padding: '18px', borderRadius: '12px', border: '1px solid #f0f0f0' },
  badgeAtivo: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: '#d1fae5', color: '#065f46' },
  badgeInadimplente: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#991b1b' },
  formaPagamentoRow: { display: 'flex', gap: '8px', marginBottom: '14px' },
  btnForma: { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  btnFormaAtiva: { border: '1px solid #2554eb', background: '#eef2ff', color: '#2554eb' },
  btnAssinar: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '700', cursor: 'pointer' },
  btnCancelar: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: '600', cursor: 'pointer' },
  pixBox: { padding: '4px' },
  btnCopiarPix: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }
};

export default Assinatura;
