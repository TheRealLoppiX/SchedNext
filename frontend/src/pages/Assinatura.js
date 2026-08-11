import { useEffect, useState, useCallback } from 'react';
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
  const [statusCobranca, setStatusCobranca] = useState(null);
  const [processando, setProcessando] = useState(false);

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

  const assinar = async () => {
    setProcessando(true);
    try {
      const res = await fetch(`${API_URL}/usuario/${userId}/assinatura-cobranca/assinar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível iniciar a assinatura.');
        return;
      }
      window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
      toast.success('Finalize a autorização na aba que abriu. A cobrança automática ativa assim que for confirmada.');
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

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  const cobrancaAtiva = statusCobranca === 'authorized';

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
                {assinante && <span style={styles.badgeAtivo}>Assinante</span>}
              </div>
              {plano?.preco != null && (
                <p style={{ margin: '8px 0 0', fontSize: '15px', color: '#374151' }}>R$ {Number(plano.preco).toFixed(2)}/mês</p>
              )}
            </div>

            <div style={{ ...styles.card, marginTop: '16px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}>Cobrança automática</h3>
              {cobrancaAtiva ? (
                <>
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#059669', fontWeight: '600' }}>✅ Ativa — seu cartão é cobrado automaticamente todo mês.</p>
                  <LoadingButton loading={processando} onClick={cancelar} style={styles.btnCancelar}>Cancelar cobrança automática</LoadingButton>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6b7280' }}>
                    Ainda não tem cobrança automática configurada. Assine pra não precisar combinar o pagamento por fora todo mês.
                  </p>
                  <LoadingButton loading={processando} onClick={assinar} style={styles.btnAssinar}>Assinar agora</LoadingButton>
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
  btnAssinar: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '700', cursor: 'pointer' },
  btnCancelar: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: '600', cursor: 'pointer' }
};

export default Assinatura;
