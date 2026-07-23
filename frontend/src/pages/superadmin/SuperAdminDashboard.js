import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { API_URL } from '../../services/api';

const STATUS_LABEL = { novo: 'Novo', contatado: 'Contatado', fechado: 'Fechado' };
const STATUS_COR = { novo: '#2563eb', contatado: '#d97706', fechado: '#059669' };

// Dashboard do admin absoluto — só mostra os leads do formulário de contato do plano
// Enterprise por enquanto (ver backend/src/routes/superAdmin.js). Fora da árvore de rotas de
// tenant de propósito (não usa empresaId nem slug nenhum).
function SuperAdminDashboard() {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();

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

  const sair = () => {
    localStorage.removeItem('superAdminToken');
    navigate('/admin-absoluto/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1115', color: '#e5e7eb', padding: '32px 24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', margin: 0 }}>Leads do plano Enterprise</h1>
          <button onClick={sair} style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>

        {carregando && <p>Carregando...</p>}
        {!carregando && leads.length === 0 && <p style={{ color: '#9ca3af' }}>Nenhum contato recebido ainda.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {leads.map((lead) => (
            <div key={lead.id} style={{ background: '#161a21', border: '1px solid #262b34', borderRadius: '10px', padding: '16px' }}>
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
      </div>
    </div>
  );
}

const btnSecundario = { background: 'transparent', color: '#e5e7eb', border: '1px solid #374151', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' };
const btnPrimario = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 };

export default SuperAdminDashboard;
