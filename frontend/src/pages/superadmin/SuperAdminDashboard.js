import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

const STATUS_LABEL = { novo: 'Novo', contatado: 'Contatado', fechado: 'Fechado' };
const STATUS_COR = { novo: '#2563eb', contatado: '#d97706', fechado: '#059669' };

const FLAGS_PLANO = [
  ['permite_paleta_customizada', 'Paleta customizada'],
  ['permite_whatsapp_bot', 'Bot de WhatsApp'],
  ['permite_remover_marca', 'Remover marca'],
  ['permite_ia', 'Recursos com IA'],
  ['permite_multi_unidade', 'Múltiplas unidades'],
  ['permite_api_publica', 'API pública'],
  ['permite_relatorios_avancados', 'Relatórios avançados'],
  ['permite_dominio_customizado', 'Domínio próprio']
];

const PLANO_VAZIO = {
  nome: '', preco_mensal: '', limite_profissionais: '', limite_agendamentos_mes: '',
  permite_paleta_customizada: false, permite_whatsapp_bot: false, permite_remover_marca: false,
  permite_ia: false, permite_multi_unidade: false, permite_api_publica: false,
  permite_relatorios_avancados: false, permite_dominio_customizado: false
};

// Dashboard do admin absoluto — gerencia leads do plano Enterprise, planos da plataforma,
// empresas cadastradas e métricas gerais. Fora da árvore de rotas de tenant de propósito (não
// usa empresaId nem slug nenhum).
function SuperAdminDashboard() {
  const [aba, setAba] = useState('metricas');
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();

  const sair = () => {
    localStorage.removeItem('superAdminToken');
    navigate('/admin-absoluto/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1115', color: '#e5e7eb', padding: '32px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ fontSize: '22px', margin: 0 }}>Painel da plataforma</h1>
          <button onClick={sair} style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            ['metricas', 'Métricas'],
            ['empresas', 'Empresas'],
            ['planos', 'Planos'],
            ['leads', 'Leads Enterprise']
          ].map(([valor, rotulo]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              style={{
                background: aba === valor ? '#2563eb' : 'transparent',
                color: aba === valor ? '#fff' : '#9ca3af',
                border: '1px solid ' + (aba === valor ? '#2563eb' : '#374151'),
                borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {aba === 'metricas' && <AbaMetricas toast={toast} />}
        {aba === 'empresas' && <AbaEmpresas toast={toast} confirmar={confirmar} />}
        {aba === 'planos' && <AbaPlanos toast={toast} />}
        {aba === 'leads' && <AbaLeads toast={toast} confirmar={confirmar} />}
      </div>
    </div>
  );
}

function AbaMetricas({ toast }) {
  const [metricas, setMetricas] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/super-admin/metricas`)
      .then((r) => r.json())
      .then(setMetricas)
      .catch(() => toast.error('Erro ao carregar métricas.'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) return <p>Carregando...</p>;
  if (!metricas) return <p style={{ color: '#9ca3af' }}>Não foi possível carregar as métricas.</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <CardMetrica label="Empresas na plataforma" valor={metricas.total_empresas} />
        <CardMetrica label="MRR (planos pagos ativos)" valor={metricas.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div style={cardEstilo}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#e5e7eb' }}>Empresas por status</h3>
          {Object.entries(metricas.empresas_por_status).map(([status, qtd]) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', padding: '4px 0' }}>
              <span>{status}</span><span>{qtd}</span>
            </div>
          ))}
        </div>
        <div style={cardEstilo}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#e5e7eb' }}>Empresas por plano</h3>
          {Object.entries(metricas.empresas_por_plano).map(([plano, qtd]) => (
            <div key={plano} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', padding: '4px 0' }}>
              <span>{plano}</span><span>{qtd}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardMetrica({ label, valor }) {
  return (
    <div style={cardEstilo}>
      <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>{label}</span>
      <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '6px' }}>{valor}</div>
    </div>
  );
}

function AbaEmpresas({ toast, confirmar }) {
  const [empresas, setEmpresas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/empresas${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`);
      const data = await res.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  useEffect(() => { carregar(); }, [carregar]);

  const alternarSuspensao = async (empresa) => {
    const suspender = empresa.status_assinatura !== 'suspensa';
    const ok = await confirmar(`${suspender ? 'Suspender' : 'Reativar'} a empresa "${empresa.nome}"?`, {
      detail: suspender ? 'O login do admin dessa empresa fica bloqueado imediatamente.' : 'O login volta a funcionar normalmente.',
      confirmText: suspender ? 'Suspender' : 'Reativar',
      danger: suspender
    });
    if (!ok) return;

    const res = await fetch(`${API_URL}/super-admin/empresas/${empresa.id}/${suspender ? 'suspender' : 'reativar'}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) { toast.success(data.message); carregar(); }
    else toast.error(data.error || 'Não foi possível atualizar a empresa.');
  };

  return (
    <div>
      <input
        placeholder="Buscar por nome, slug ou e-mail..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ ...inputEstilo, marginBottom: '16px', maxWidth: '360px' }}
      />

      {carregando ? <p>Carregando...</p> : empresas.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>Nenhuma empresa encontrada.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
            <thead>
              <tr>
                {['Nome', 'Slug', 'E-mail', 'Plano', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #262b34', color: '#9ca3af' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td style={tdEstilo}>{e.nome}</td>
                  <td style={tdEstilo}>{e.slug}</td>
                  <td style={tdEstilo}>{e.email}</td>
                  <td style={tdEstilo}>{e.plano_plataforma?.nome || '—'}</td>
                  <td style={tdEstilo}>
                    <span style={{ color: e.status_assinatura === 'suspensa' ? '#ef4444' : '#9ca3af' }}>{e.status_assinatura || '—'}</span>
                  </td>
                  <td style={tdEstilo}>
                    <button
                      onClick={() => alternarSuspensao(e)}
                      style={{ ...btnSecundario, color: e.status_assinatura === 'suspensa' ? '#059669' : '#ef4444', borderColor: e.status_assinatura === 'suspensa' ? '#059669' : '#ef4444' }}
                    >
                      {e.status_assinatura === 'suspensa' ? 'Reativar' : 'Suspender'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AbaPlanos({ toast }) {
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/planos`);
      const data = await res.json();
      setPlanos(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar planos.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const url = criandoNovo ? `${API_URL}/super-admin/planos` : `${API_URL}/super-admin/planos/${editando.id}`;
      const res = await fetch(url, {
        method: criandoNovo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editando,
          preco_mensal: editando.preco_mensal === '' ? null : editando.preco_mensal,
          limite_profissionais: editando.limite_profissionais === '' ? null : editando.limite_profissionais,
          limite_agendamentos_mes: editando.limite_agendamentos_mes === '' ? null : editando.limite_agendamentos_mes
        })
      });
      if (res.ok) {
        toast.success('Plano salvo!');
        setEditando(null);
        setCriandoNovo(false);
        carregar();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Não foi possível salvar o plano.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <button onClick={() => { setCriandoNovo(true); setEditando({ ...PLANO_VAZIO }); }} style={{ ...btnPrimario, marginBottom: '16px' }}>
        + Novo plano
      </button>

      {carregando ? <p>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {planos.map((p) => (
            <div key={p.id} style={cardEstilo}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong>{p.nome}</strong>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    {p.preco_mensal == null ? 'Sob consulta' : `R$ ${Number(p.preco_mensal).toFixed(2)}/mês`} ·{' '}
                    {p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`} ·{' '}
                    {p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {FLAGS_PLANO.filter(([chave]) => p[chave]).map(([chave, rotulo]) => (
                      <span key={chave} style={{ fontSize: '11px', background: '#1f2937', color: '#a5b4fc', padding: '2px 8px', borderRadius: '10px' }}>{rotulo}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => { setCriandoNovo(false); setEditando({ ...p }); }} style={btnSecundario}>Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div style={overlayEstilo}>
          <div style={{ ...cardEstilo, maxWidth: '480px', width: '90%' }}>
            <h3 style={{ margin: '0 0 14px' }}>{criandoNovo ? 'Novo plano' : `Editar: ${editando.nome}`}</h3>

            <label style={labelEstilo}>Nome</label>
            <input style={inputEstilo} value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />

            <label style={labelEstilo}>Preço mensal (vazio = sob consulta)</label>
            <input type="number" style={inputEstilo} value={editando.preco_mensal ?? ''} onChange={(e) => setEditando({ ...editando, preco_mensal: e.target.value })} />

            <label style={labelEstilo}>Limite de profissionais (vazio = ilimitado)</label>
            <input type="number" style={inputEstilo} value={editando.limite_profissionais ?? ''} onChange={(e) => setEditando({ ...editando, limite_profissionais: e.target.value })} />

            <label style={labelEstilo}>Limite de agendamentos/mês (vazio = ilimitado)</label>
            <input type="number" style={inputEstilo} value={editando.limite_agendamentos_mes ?? ''} onChange={(e) => setEditando({ ...editando, limite_agendamentos_mes: e.target.value })} />

            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {FLAGS_PLANO.map(([chave, rotulo]) => (
                <label key={chave} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e5e7eb' }}>
                  <input type="checkbox" checked={!!editando[chave]} onChange={(e) => setEditando({ ...editando, [chave]: e.target.checked })} />
                  {rotulo}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
              <button onClick={() => { setEditando(null); setCriandoNovo(false); }} style={btnSecundario}>Cancelar</button>
              <LoadingButton loading={salvando} onClick={salvar} style={btnPrimario}>Salvar</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AbaLeads({ toast, confirmar }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarLeads = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/super-admin/leads-enterprise`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar leads.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregarLeads(); }, [carregarLeads]);

  const atualizarStatus = async (id, status) => {
    const res = await fetch(`${API_URL}/super-admin/leads-enterprise/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) { toast.success('Status atualizado.'); carregarLeads(); }
    else toast.error('Não foi possível atualizar o status.');
  };

  const ativarEmpresa = async (lead) => {
    const ok = await confirmar(`Ativar o plano Enterprise pra "${lead.nome_empresa}"?`, {
      detail: 'Isso muda o plano da empresa pra Enterprise imediatamente. A cobrança do valor combinado é feita manualmente, fora do sistema, por enquanto.',
      confirmText: 'Ativar'
    });
    if (!ok) return;

    const res = await fetch(`${API_URL}/super-admin/leads-enterprise/${lead.id}/ativar-empresa`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) { toast.success(data.message); carregarLeads(); }
    else toast.error(data.error || 'Não foi possível ativar o plano.');
  };

  if (carregando) return <p>Carregando...</p>;
  if (leads.length === 0) return <p style={{ color: '#9ca3af' }}>Nenhum contato recebido ainda.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {leads.map((lead) => (
        <div key={lead.id} style={cardEstilo}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong style={{ fontSize: '15px' }}>{lead.nome_empresa}</strong>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                CNPJ {lead.cnpj} · {lead.localizacao} · {new Date(lead.criado_em).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: STATUS_COR[lead.status] || '#9ca3af' }}>
              {STATUS_LABEL[lead.status] || lead.status}
            </span>
          </div>

          <div style={{ fontSize: '13px', marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <span><strong>Clientes esperados:</strong> {lead.clientes_esperados}</span>
            <span><strong>E-mail:</strong> {lead.email_contato}</span>
            {lead.telefone_contato && <span><strong>Telefone:</strong> {lead.telefone_contato}</span>}
            {lead.empresa_id && <span><strong>Empresa (id):</strong> {lead.empresa_id}</span>}
          </div>
          {lead.observacoes && <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '8px' }}>{lead.observacoes}</p>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {lead.status !== 'contatado' && (
              <button onClick={() => atualizarStatus(lead.id, 'contatado')} style={btnSecundario}>Marcar como contatado</button>
            )}
            {lead.status !== 'fechado' && (
              <button onClick={() => atualizarStatus(lead.id, 'fechado')} style={btnSecundario}>Marcar como fechado</button>
            )}
            {lead.empresa_id && lead.status !== 'fechado' && (
              <button onClick={() => ativarEmpresa(lead)} style={btnPrimario}>Ativar plano Enterprise</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const cardEstilo = { background: '#161a21', border: '1px solid #262b34', borderRadius: '10px', padding: '16px' };
const tdEstilo = { padding: '8px', borderBottom: '1px solid #1f242c' };
const btnSecundario = { background: 'transparent', color: '#e5e7eb', border: '1px solid #374151', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' };
const btnPrimario = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 };
const inputEstilo = { width: '100%', boxSizing: 'border-box', background: '#0f1115', border: '1px solid #374151', color: '#e5e7eb', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', marginBottom: '10px' };
const labelEstilo = { display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '4px', marginTop: '6px' };
const overlayEstilo = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };

export default SuperAdminDashboard;
