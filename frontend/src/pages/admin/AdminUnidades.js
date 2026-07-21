import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import EmptyState from '../../components/EmptyState';
import { API_URL } from '../../services/api';

function AdminUnidades({ empresaId }) {
  const toast = useToast();
  const confirmar = useConfirm();

  const [unidades, setUnidades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  const idEfetivo = empresaId || localStorage.getItem('empresaId');

  const carregar = useCallback(async () => {
    if (!idEfetivo) return setCarregando(false);
    try {
      const [resEmpresa, resUnidades] = await Promise.all([
        fetch(`${API_URL}/admin/empresa/${idEfetivo}`),
        fetch(`${API_URL}/admin/unidades/${idEfetivo}`)
      ]);
      const dadosEmpresa = await resEmpresa.json();
      const dadosUnidades = await resUnidades.json();
      setPermitido(!!dadosEmpresa?.plano_plataforma?.permite_multi_unidade);
      setUnidades(Array.isArray(dadosUnidades) ? dadosUnidades : []);
    } catch (err) {
      console.error('Erro ao carregar unidades:', err);
    } finally {
      setCarregando(false);
    }
  }, [idEfetivo]);

  useEffect(() => { carregar(); }, [carregar]);

  const cadastrarUnidade = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return toast.error('Informe o nome da unidade.');
    setCadastrando(true);
    try {
      const res = await fetch(`${API_URL}/admin/unidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: idEfetivo, nome: novoNome, endereco: novoEndereco })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Unidade cadastrada!');
        setNovoNome('');
        setNovoEndereco('');
        carregar();
      } else {
        toast.error(data.error || 'Não foi possível cadastrar a unidade.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setCadastrando(false);
    }
  };

  const alternarStatus = async (unidade) => {
    const acao = unidade.ativo ? 'desativar' : 'reativar';
    const ok = await confirmar(`Deseja ${acao} a unidade "${unidade.nome}"?`, {
      detail: unidade.ativo ? 'Ela deixa de aparecer para clientes escolherem no agendamento.' : 'Ela volta a aparecer para os clientes.',
      confirmText: acao === 'desativar' ? 'Desativar' : 'Reativar',
      danger: unidade.ativo
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/unidades/${unidade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !unidade.ativo })
      });
      if (res.ok) {
        toast.success(unidade.ativo ? 'Unidade desativada.' : 'Unidade reativada.');
        carregar();
      } else {
        toast.error('Não foi possível atualizar a unidade.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  const excluirUnidade = async (unidade) => {
    const ok = await confirmar(`Excluir a unidade "${unidade.nome}" definitivamente?`, {
      detail: 'Profissionais vinculados a ela não são excluídos, só ficam sem unidade.',
      confirmText: 'Excluir',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/unidades/${unidade.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Unidade excluída.');
        carregar();
      } else {
        toast.error('Não foi possível excluir a unidade.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando unidades...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>🏢 Unidades</h2>
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Gerenciar múltiplas unidades (filiais) é um recurso exclusivo do <strong>plano Enterprise</strong>.
            Fale com o suporte para fazer upgrade e cadastrar mais de uma localização.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏢 Unidades</h2>
      <p style={styles.subtitle}>Gerencie as filiais do seu negócio — cada uma com sua própria equipe.</p>

      <form onSubmit={cadastrarUnidade} style={styles.cardForm}>
        <div style={styles.formRow}>
          <input
            style={styles.input}
            placeholder="Nome da unidade (ex: Unidade Centro)"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Endereço (opcional)"
            value={novoEndereco}
            onChange={(e) => setNovoEndereco(e.target.value)}
          />
          <LoadingButton type="submit" loading={cadastrando} style={styles.btnCadastrar}>Cadastrar</LoadingButton>
        </div>
      </form>

      {unidades.length === 0 ? (
        <EmptyState icon="🏢" title="Nenhuma unidade cadastrada ainda." hint="Cadastre a primeira unidade acima." />
      ) : (
        <div style={styles.grid}>
          {unidades.map((u) => (
            <div key={u.id} style={{ ...styles.card, borderTop: u.ativo ? '4px solid #059669' : '4px solid #dc2626' }}>
              <h3 style={styles.nomeCard}>{u.nome}</h3>
              {u.endereco && <p style={styles.endereco}>{u.endereco}</p>}
              <span style={{ ...styles.badge, backgroundColor: u.ativo ? '#d1fae5' : '#fee2e2', color: u.ativo ? '#065f46' : '#991b1b' }}>
                {u.ativo ? 'Ativa' : 'Inativa'}
              </span>
              <div style={styles.acoes}>
                <button onClick={() => alternarStatus(u)} style={styles.btnSecundario}>{u.ativo ? 'Desativar' : 'Reativar'}</button>
                <button onClick={() => excluirUnidade(u)} style={styles.btnExcluir}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0' },
  subtitle: { color: '#6b7280', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px dashed #d1d5db' },
  cardForm: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', marginBottom: '24px' },
  formRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { flex: '1 1 200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
  btnCadastrar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' },
  nomeCard: { margin: '0 0 6px', fontSize: '16px', color: '#111827' },
  endereco: { fontSize: '13px', color: '#6b7280', margin: '0 0 10px' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  acoes: { display: 'flex', gap: '8px', marginTop: '14px' },
  btnSecundario: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px' },
  btnExcluir: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px' }
};

export default AdminUnidades;
