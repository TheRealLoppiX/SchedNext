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

  const [unidadeExpandida, setUnidadeExpandida] = useState(null);
  const [adminsPorUnidade, setAdminsPorUnidade] = useState({});
  const [formAdmin, setFormAdmin] = useState({ nome: '', email: '', senha: '' });
  const [criandoAdmin, setCriandoAdmin] = useState(false);

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

  const carregarAdmins = async (unidadeId) => {
    try {
      const res = await fetch(`${API_URL}/admin/unidades/${unidadeId}/admins`);
      const data = await res.json();
      setAdminsPorUnidade((prev) => ({ ...prev, [unidadeId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error('Erro ao carregar administradores da unidade:', err);
    }
  };

  const toggleExpandir = (unidadeId) => {
    if (unidadeExpandida === unidadeId) {
      setUnidadeExpandida(null);
      return;
    }
    setUnidadeExpandida(unidadeId);
    setFormAdmin({ nome: '', email: '', senha: '' });
    if (!adminsPorUnidade[unidadeId]) carregarAdmins(unidadeId);
  };

  const criarAdmin = async (unidadeId) => {
    if (!formAdmin.nome.trim() || !formAdmin.email.trim() || !formAdmin.senha) {
      return toast.error('Preencha nome, e-mail e senha.');
    }
    setCriandoAdmin(true);
    try {
      const res = await fetch(`${API_URL}/admin/unidades/${unidadeId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formAdmin)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Administrador da unidade criado!');
        setFormAdmin({ nome: '', email: '', senha: '' });
        carregarAdmins(unidadeId);
      } else {
        toast.error(data.error || 'Não foi possível criar o administrador.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setCriandoAdmin(false);
    }
  };

  const alternarStatusAdmin = async (unidadeId, admin) => {
    try {
      const res = await fetch(`${API_URL}/admin/unidade-admins/${admin.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !admin.ativo })
      });
      if (res.ok) {
        toast.success(admin.ativo ? 'Administrador desativado.' : 'Administrador reativado.');
        carregarAdmins(unidadeId);
      } else {
        toast.error('Não foi possível atualizar o administrador.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  const removerAdmin = async (unidadeId, admin) => {
    const ok = await confirmar(`Remover o acesso de ${admin.nome} a esta unidade?`, { confirmText: 'Remover', danger: true });
    if (!ok) return;
    try {
      const res = await fetch(`${API_URL}/admin/unidade-admins/${admin.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Administrador removido.');
        carregarAdmins(unidadeId);
      } else {
        toast.error('Não foi possível remover o administrador.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    }
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando unidades...</p>;

  if (!permitido) {
    return (
      <div className="admin-page-container" style={styles.container}>
        <h2 style={styles.title}><Icons.Building color="#111827" /> Unidades</h2>
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
    <div className="admin-page-container" style={styles.container}>
      <h2 style={styles.title}><Icons.Building color="#111827" /> Unidades</h2>
      <p style={styles.subtitle}>Gerencie as filiais do seu negócio, cada uma com sua própria equipe.</p>

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
              <button onClick={() => toggleExpandir(u.id)} style={styles.btnAdmins}>
                {unidadeExpandida === u.id ? 'Ocultar administradores' : 'Administradores desta unidade'}
              </button>

              {unidadeExpandida === u.id && (
                <div style={styles.painelAdmins}>
                  {(adminsPorUnidade[u.id] || []).map((admin) => (
                    <div key={admin.id} style={styles.linhaAdmin}>
                      <div>
                        <strong style={{ fontSize: '13px' }}>{admin.nome}</strong>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{admin.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ ...styles.badge, backgroundColor: admin.ativo ? '#d1fae5' : '#fee2e2', color: admin.ativo ? '#065f46' : '#991b1b' }}>
                          {admin.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <button onClick={() => alternarStatusAdmin(u.id, admin)} style={styles.btnMini}>{admin.ativo ? 'Desativar' : 'Reativar'}</button>
                        <button onClick={() => removerAdmin(u.id, admin)} style={styles.btnMiniExcluir}>Remover</button>
                      </div>
                    </div>
                  ))}
                  {(adminsPorUnidade[u.id] || []).length === 0 && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 10px' }}>Nenhum administrador nesta unidade ainda.</p>
                  )}

                  <div style={styles.formAdminRow}>
                    <input style={styles.inputPequeno} placeholder="Nome" value={formAdmin.nome} onChange={(e) => setFormAdmin({ ...formAdmin, nome: e.target.value })} />
                    <input style={styles.inputPequeno} placeholder="E-mail" value={formAdmin.email} onChange={(e) => setFormAdmin({ ...formAdmin, email: e.target.value })} />
                    <input style={styles.inputPequeno} placeholder="Senha" type="password" value={formAdmin.senha} onChange={(e) => setFormAdmin({ ...formAdmin, senha: e.target.value })} />
                    <LoadingButton loading={criandoAdmin} onClick={() => criarAdmin(u.id)} style={styles.btnCadastrarPequeno}>Adicionar</LoadingButton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Icons = {
  Building: ({ color }) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'bottom' }}><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path></svg>,
};

const styles = {
  container: { padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0' },
  subtitle: { color: '#6b7280', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px dashed #d1d5db' },
  cardForm: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', marginBottom: '24px' },
  formRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { flex: '1 1 200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
  btnCadastrar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6' },
  nomeCard: { margin: '0 0 6px', fontSize: '16px', color: '#111827' },
  endereco: { fontSize: '13px', color: '#6b7280', margin: '0 0 10px' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  acoes: { display: 'flex', gap: '8px', marginTop: '14px' },
  btnSecundario: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px' },
  btnExcluir: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px' },
  btnAdmins: { width: '100%', marginTop: '10px', padding: '8px', borderRadius: '6px', border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  painelAdmins: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' },
  linhaAdmin: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f9fafb', gap: '8px', flexWrap: 'wrap' },
  btnMini: { padding: '4px 8px', borderRadius: '5px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '11px' },
  btnMiniExcluir: { padding: '4px 8px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '11px' },
  formAdminRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' },
  inputPequeno: { flex: '1 1 100px', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' },
  btnCadastrarPequeno: { padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#111827', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }
};

export default AdminUnidades;
