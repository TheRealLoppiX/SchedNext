import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

function AdminDominio({ empresaId }) {
  const toast = useToast();
  const confirmar = useConfirm();

  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [dominioAtual, setDominioAtual] = useState(null);
  const [verificado, setVerificado] = useState(false);
  const [dominioAlvo, setDominioAlvo] = useState('schednext.com.br');
  const [novoDominio, setNovoDominio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [mensagemVerificacao, setMensagemVerificacao] = useState('');

  const idEfetivo = empresaId || localStorage.getItem('empresaId');

  const carregar = useCallback(async () => {
    if (!idEfetivo) return setCarregando(false);
    try {
      const [resEmpresa, resDominio] = await Promise.all([
        fetch(`${API_URL}/admin/empresa/${idEfetivo}`),
        fetch(`${API_URL}/admin/dominio/${idEfetivo}`)
      ]);
      const dadosEmpresa = await resEmpresa.json();
      const dadosDominio = await resDominio.json();
      setPermitido(!!dadosEmpresa?.plano_plataforma?.permite_dominio_customizado);
      setDominioAtual(dadosDominio?.dominio_customizado || null);
      setVerificado(!!dadosDominio?.dominio_verificado);
      if (dadosDominio?.dominio_alvo) setDominioAlvo(dadosDominio.dominio_alvo);
    } catch (err) {
      console.error('Erro ao carregar domínio:', err);
    } finally {
      setCarregando(false);
    }
  }, [idEfetivo]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarDominio = async (e) => {
    e.preventDefault();
    if (!novoDominio.trim()) return toast.error('Informe um domínio.');
    setSalvando(true);
    setMensagemVerificacao('');
    try {
      const res = await fetch(`${API_URL}/admin/dominio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dominio: novoDominio.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Domínio salvo! Agora configure o DNS e clique em "Verificar".');
        setNovoDominio('');
        carregar();
      } else {
        toast.error(data.error || 'Não foi possível salvar o domínio.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const verificarDominio = async () => {
    setVerificando(true);
    setMensagemVerificacao('');
    try {
      const res = await fetch(`${API_URL}/admin/dominio/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setVerificado(!!data.dominio_verificado);
        setMensagemVerificacao(data.mensagem || '');
        if (data.dominio_verificado) toast.success('Domínio verificado!');
      } else {
        toast.error(data.error || 'Não foi possível verificar o domínio.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setVerificando(false);
    }
  };

  const removerDominio = async () => {
    const ok = await confirmar(`Remover o domínio "${dominioAtual}"?`, {
      detail: 'O acesso por esse domínio deixa de funcionar imediatamente.',
      confirmText: 'Remover',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/dominio`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Domínio removido.');
        setDominioAtual(null);
        setVerificado(false);
        setMensagemVerificacao('');
      } else {
        toast.error('Não foi possível remover o domínio.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>🌐 Domínio próprio</h2>
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Usar seu próprio domínio (ex: agenda.suaempresa.com.br) em vez do subdomínio da SchedNext é um recurso exclusivo do <strong>plano Enterprise</strong>.
            Fale com o suporte para fazer upgrade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🌐 Domínio próprio</h2>
      <p style={styles.subtitle}>Use um domínio ou subdomínio seu para os clientes acessarem sua agenda.</p>

      {dominioAtual ? (
        <div style={styles.cardAtual}>
          <div style={styles.linhaTopo}>
            <div>
              <strong style={{ fontSize: '16px' }}>{dominioAtual}</strong>
              <div style={{ marginTop: '4px' }}>
                <span style={{ ...styles.badge, backgroundColor: verificado ? '#d1fae5' : '#fef3c7', color: verificado ? '#065f46' : '#92400e' }}>
                  {verificado ? 'Verificado e ativo' : 'Aguardando verificação de DNS'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <LoadingButton loading={verificando} onClick={verificarDominio} style={styles.btnSecundario}>Verificar</LoadingButton>
              <button onClick={removerDominio} style={styles.btnExcluir}>Remover</button>
            </div>
          </div>

          {!verificado && (
            <div style={styles.instrucoes}>
              <p style={{ margin: '0 0 8px', fontWeight: '600', fontSize: '13px' }}>Configure o DNS do seu domínio:</p>
              <table style={styles.tabelaDns}>
                <thead>
                  <tr><th style={styles.th}>Tipo</th><th style={styles.th}>Nome</th><th style={styles.th}>Valor</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}>CNAME</td>
                    <td style={styles.td}>{dominioAtual}</td>
                    <td style={styles.td}><code>{dominioAlvo}</code></td>
                  </tr>
                </tbody>
              </table>
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6b7280' }}>
                A propagação do DNS pode levar de alguns minutos a algumas horas. Depois de configurar, clique em "Verificar".
              </p>
              {mensagemVerificacao && <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#92400e' }}>{mensagemVerificacao}</p>}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={salvarDominio} style={styles.cardForm}>
          <label style={styles.label}>Domínio (ex: agenda.suaempresa.com.br)</label>
          <div style={styles.formRow}>
            <input
              style={styles.input}
              placeholder="agenda.suaempresa.com.br"
              value={novoDominio}
              onChange={(e) => setNovoDominio(e.target.value)}
            />
            <LoadingButton type="submit" loading={salvando} style={styles.btnCadastrar}>Salvar</LoadingButton>
          </div>
        </form>
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
  label: { display: 'block', fontSize: '13px', color: '#374151', fontWeight: '600', marginBottom: '8px' },
  formRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { flex: '1 1 260px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
  btnCadastrar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  cardAtual: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' },
  linhaTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  btnSecundario: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px' },
  btnExcluir: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px' },
  instrucoes: { marginTop: '18px', paddingTop: '18px', borderTop: '1px solid #f3f4f6' },
  tabelaDns: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: '600' },
  td: { padding: '8px', borderBottom: '1px solid #f3f4f6', color: '#111827' }
};

export default AdminDominio;
