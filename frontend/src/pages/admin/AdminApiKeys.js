import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import EmptyState from '../../components/EmptyState';
import { API_URL } from '../../services/api';

function AdminApiKeys({ empresaId }) {
  const toast = useToast();
  const confirmar = useConfirm();

  const [chaves, setChaves] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [gerando, setGerando] = useState(false);
  const [chaveGerada, setChaveGerada] = useState(null);

  const idEfetivo = empresaId || localStorage.getItem('empresaId');

  const carregar = useCallback(async () => {
    if (!idEfetivo) return setCarregando(false);
    try {
      const [resEmpresa, resChaves] = await Promise.all([
        fetch(`${API_URL}/admin/empresa/${idEfetivo}`),
        fetch(`${API_URL}/admin/api-keys/${idEfetivo}`)
      ]);
      const dadosEmpresa = await resEmpresa.json();
      const dadosChaves = await resChaves.json();
      setPermitido(!!dadosEmpresa?.plano_plataforma?.permite_api_publica);
      setChaves(Array.isArray(dadosChaves) ? dadosChaves : []);
    } catch (err) {
      console.error('Erro ao carregar chaves de API:', err);
    } finally {
      setCarregando(false);
    }
  }, [idEfetivo]);

  useEffect(() => { carregar(); }, [carregar]);

  const gerarChave = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return toast.error('Dê um nome pra essa chave.');
    setGerando(true);
    try {
      const res = await fetch(`${API_URL}/admin/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: idEfetivo, nome: novoNome })
      });
      const data = await res.json();
      if (res.ok) {
        setChaveGerada(data.chave);
        setNovoNome('');
        carregar();
      } else {
        toast.error(data.error || 'Não foi possível gerar a chave.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  const revogarChave = async (chave) => {
    const ok = await confirmar(`Revogar a chave "${chave.nome}"?`, {
      detail: 'Qualquer integração usando essa chave para de funcionar imediatamente.',
      confirmText: 'Revogar',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/api-keys/${chave.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Chave revogada.');
        carregar();
      } else {
        toast.error('Não foi possível revogar a chave.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: 'var(--fx-muted)' }}>Carregando...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>API pública</h2>
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--fx-muted)' }}>
            Integrar seus próprios sistemas com o SchedNext via API é um recurso exclusivo do <strong>plano Enterprise</strong>.
            Fale com o suporte para fazer upgrade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>API pública</h2>
      <p style={styles.subtitle}>Gere chaves para integrar seus próprios sistemas ao SchedNext.</p>

      {chaveGerada && (
        <div style={styles.avisoChave}>
          <strong>Copie sua chave agora, ela não será mostrada de novo:</strong>
          <code style={styles.codigoChave}>{chaveGerada}</code>
          <button onClick={() => setChaveGerada(null)} style={styles.btnFecharAviso}>Já copiei, fechar</button>
        </div>
      )}

      <form onSubmit={gerarChave} style={styles.cardForm}>
        <div style={styles.formRow}>
          <input
            style={styles.input}
            placeholder='Nome da chave (ex: "Integração site institucional")'
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <LoadingButton type="submit" loading={gerando} style={styles.btnGerar}>Gerar chave</LoadingButton>
        </div>
      </form>

      {chaves.length === 0 ? (
        <EmptyState title="Nenhuma chave gerada ainda." hint="Gere a primeira chave acima para começar a integrar." />
      ) : (
        <div style={styles.tabela}>
          {chaves.map((c) => (
            <div key={c.id} style={styles.linha}>
              <div>
                <strong>{c.nome}</strong>
                <div style={{ fontSize: '12px', color: 'var(--fx-muted)' }}>
                  <code>{c.key_preview}</code> · criada em {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                  {c.ultimo_uso_em && ` · último uso em ${new Date(c.ultimo_uso_em).toLocaleDateString('pt-BR')}`}
                </div>
              </div>
              {c.ativo ? (
                <button onClick={() => revogarChave(c)} style={styles.btnRevogar}>Revogar</button>
              ) : (
                <span style={styles.badgeRevogada}>Revogada</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const styles = {
  container: { padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontFamily: 'var(--oc-display)', fontWeight: 400, fontSize: 'clamp(44px, 5.4vw, 76px)', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.005em', color: 'var(--fx-text)', margin: '0 0 10px 0' },
  subtitle: { color: 'var(--fx-muted)', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: 'var(--fx-surface-2)', borderRadius: '10px', border: '1px dashed var(--fx-line-2)' },
  avisoChave: { padding: '18px', backgroundColor: 'var(--fx-amber-bg)', border: '1px solid var(--fx-amber-line)', borderRadius: '10px', marginBottom: '20px' },
  codigoChave: { display: 'block', margin: '10px 0', padding: '10px', background: 'var(--fx-strong)', color: '#4ade80', borderRadius: '6px', fontSize: '13px', wordBreak: 'break-all' },
  btnFecharAviso: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--fx-strong)', color: '#fff', cursor: 'pointer', fontSize: '13px' },
  cardForm: { backgroundColor: 'var(--fx-card)', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--fx-line)', marginBottom: '24px' },
  formRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { flex: '1 1 260px', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', fontSize: '14px' },
  btnGerar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  tabela: { display: 'flex', flexDirection: 'column', gap: '10px' },
  linha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--fx-card)', padding: '16px', borderRadius: '10px', border: '1px solid var(--fx-line)' },
  btnRevogar: { padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--fx-red-line)', background: 'var(--fx-red-bg)', color: 'var(--fx-red)', cursor: 'pointer', fontSize: '13px' },
  badgeRevogada: { fontSize: '12px', color: 'var(--fx-faint)', fontWeight: '600' }
};

export default AdminApiKeys;
