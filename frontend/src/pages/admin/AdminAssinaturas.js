import React, { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { obterTerminologia } from '../../utils/terminologia';

function AdminAssinaturas({ empresaId }) {
    const confirmar = useConfirm();
    const idEfetivo = empresaId || localStorage.getItem('empresaId');

    const [planos, setPlanos] = useState([]);
    const [servicos, setServicos] = useState([]);
    const [editando, setEditando] = useState(null);
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
    const [vertical, setVertical] = useState('barbearia');
    const termos = obterTerminologia(vertical);

    const [form, setForm] = useState({ nome: '', preco: '', descricao: '', servicos_ids: [] });

    const carregar = useCallback(async () => {
        if (!idEfetivo) return;
        try {
            const [resPlanos, resServicos, resEmpresa] = await Promise.all([
                fetch(`http://localhost:4000/admin/assinaturas/${idEfetivo}`),
                fetch(`http://localhost:4000/admin/servicos?empresa=${idEfetivo}`),
                fetch(`http://localhost:4000/admin/empresa/${idEfetivo}`)
            ]);
            setPlanos(await resPlanos.json() || []);
            setServicos(await resServicos.json() || []);
            const dadosEmpresa = await resEmpresa.json();
            if (dadosEmpresa?.vertical) setVertical(dadosEmpresa.vertical);
        } catch (err) { console.error(err); }
    }, [idEfetivo]);

    useEffect(() => { carregar(); }, [carregar]);

    const mostrarFeedback = (texto, tipo = 'sucesso') => {
        setMensagem({ texto, tipo });
        setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3500);
    };

    const toggleServico = (id) => {
        if (editando) {
            setEditando(prev => ({
                ...prev,
                servicos_ids: prev.servicos_ids.includes(id)
                    ? prev.servicos_ids.filter(s => s !== id)
                    : [...prev.servicos_ids, id]
            }));
        } else {
            setForm(prev => ({
                ...prev,
                servicos_ids: prev.servicos_ids.includes(id)
                    ? prev.servicos_ids.filter(s => s !== id)
                    : [...prev.servicos_ids, id]
            }));
        }
    };

    const handleCriar = async (e) => {
        e.preventDefault();
        if (form.servicos_ids.length === 0) return mostrarFeedback('Selecione ao menos um serviço.', 'erro');
        try {
            const res = await fetch('http://localhost:4000/admin/assinaturas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, empresa_id: idEfetivo })
            });
            if (res.ok) {
                mostrarFeedback('Plano criado com sucesso.');
                setForm({ nome: '', preco: '', descricao: '', servicos_ids: [] });
                carregar();
            } else {
                mostrarFeedback('Erro ao criar plano.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const handleAtualizar = async () => {
        if (editando.servicos_ids.length === 0) return mostrarFeedback('Selecione ao menos um serviço.', 'erro');
        try {
            const res = await fetch(`http://localhost:4000/admin/assinaturas/${editando.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editando)
            });
            if (res.ok) {
                mostrarFeedback('Plano atualizado com sucesso.');
                setEditando(null);
                carregar();
            } else {
                mostrarFeedback('Erro ao atualizar plano.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const toggleAtivo = async (plano) => {
        const ok = await confirmar(`Deseja ${plano.ativo ? 'desativar' : 'reativar'} o plano "${plano.nome}"?`, {
            detail: plano.ativo
                ? 'O plano para de ficar disponível para novas assinaturas imediatamente.'
                : 'O plano volta a ficar disponível para novas assinaturas.',
            confirmText: plano.ativo ? 'Desativar' : 'Reativar',
            danger: !!plano.ativo
        });
        if (!ok) return;

        try {
            const res = await fetch(`http://localhost:4000/admin/assinaturas/${plano.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: !plano.ativo })
            });
            if (res.ok) {
                mostrarFeedback('Status do plano atualizado!');
                carregar();
            } else {
                mostrarFeedback('Não foi possível atualizar o status.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const excluir = async (id, nome) => {
        const ok = await confirmar(`Excluir o plano "${nome}"?`, {
            detail: 'Clientes vinculados perderão o acesso a este plano.',
            confirmText: 'Excluir',
            danger: true
        });
        if (!ok) return;
        try {
            await fetch(`http://localhost:4000/admin/assinaturas/${id}`, { method: 'DELETE' });
            mostrarFeedback('Plano excluído.');
            carregar();
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const abrirEdicao = (plano) => {
        setEditando({ ...plano, servicos_ids: plano.servicos_ids || [] });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const FormularioServicos = ({ ids, onToggle }) => (
        <div style={s.gridServicos}>
            {servicos.map(sv => {
                const sel = ids.includes(sv.id);
                return (
                    <label key={sv.id} style={{ ...s.itemServico, backgroundColor: sel ? '#f0fdf4' : '#f9fafb', borderColor: sel ? '#a7f3d0' : '#e5e7eb' }}>
                        <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => onToggle(sv.id)}
                            style={{ accentColor: '#111827', width: '15px', height: '15px', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '13px', color: sel ? '#065f46' : '#374151', fontWeight: sel ? '600' : '400' }}>
                            {sv.nome}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            R$ {parseFloat(sv.valor).toFixed(2).replace('.', ',')}
                        </span>
                    </label>
                );
            })}
        </div>
    );

    return (
        <div style={s.container}>
            <header style={s.header}>
                <div>
                    <h2 style={s.title}><Icons.Diamond color="#111827" /> Planos de Assinatura</h2>
                    <p style={s.subtitle}>Crie e gerencie os planos de assinatura {termos.artigoContraido} {termos.local.toLowerCase()}.</p>
                </div>
            </header>

            {mensagem.texto && (
                <div style={{ ...s.alerta, backgroundColor: mensagem.tipo === 'sucesso' ? '#ecfdf5' : '#fef2f2', color: mensagem.tipo === 'sucesso' ? '#065f46' : '#991b1b', border: `1px solid ${mensagem.tipo === 'sucesso' ? '#a7f3d0' : '#fecaca'}` }}>
                    {mensagem.tipo === 'sucesso' ? <Icons.CheckCircle color="#059669" /> : <Icons.Alert color="#dc2626" />}
                    <span>{mensagem.texto}</span>
                </div>
            )}

            {/* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO */}
            <div style={s.cardForm}>
                <h4 style={s.cardTitle}>
                    {editando
                        ? <><Icons.Edit color="#4b5563" /> Editar Plano</>
                        : <><Icons.Plus color="#4b5563" /> Novo Plano</>
                    }
                </h4>

                <div style={s.formGrid}>
                    <div style={s.inputGroup}>
                        <label style={s.label}>Nome do Plano</label>
                        <input
                            style={s.input}
                            placeholder="Ex: Plano Básico, Plano Premium..."
                            value={editando ? editando.nome : form.nome}
                            onChange={e => editando ? setEditando(p => ({ ...p, nome: e.target.value })) : setForm(p => ({ ...p, nome: e.target.value }))}
                            required
                        />
                    </div>
                    <div style={s.inputGroup}>
                        <label style={s.label}>Preço Mensal (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            style={s.input}
                            placeholder="0,00"
                            value={editando ? editando.preco : form.preco}
                            onChange={e => editando ? setEditando(p => ({ ...p, preco: e.target.value })) : setForm(p => ({ ...p, preco: e.target.value }))}
                            required
                        />
                    </div>
                    <div style={{ ...s.inputGroup, gridColumn: 'span 2' }}>
                        <label style={s.label}>Descrição (opcional)</label>
                        <input
                            style={s.input}
                            placeholder="Ex: Inclui 4 cortes por mês sem custo adicional"
                            value={editando ? editando.descricao || '' : form.descricao}
                            onChange={e => editando ? setEditando(p => ({ ...p, descricao: e.target.value })) : setForm(p => ({ ...p, descricao: e.target.value }))}
                        />
                    </div>
                </div>

                <div style={s.inputGroup}>
                    <label style={s.label}>Serviços Inclusos no Plano</label>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 10px 0' }}>
                        O cliente assinante poderá agendar estes serviços sem custo.
                    </p>
                    <FormularioServicos
                        ids={editando ? (editando.servicos_ids || []) : form.servicos_ids}
                        onToggle={toggleServico}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    {editando ? (
                        <>
                            <button onClick={handleAtualizar} style={s.btnPrincipal}>Salvar Alterações</button>
                            <button onClick={() => setEditando(null)} style={s.btnCancelar}>Cancelar</button>
                        </>
                    ) : (
                        <button onClick={handleCriar} style={s.btnPrincipal}>Criar Plano</button>
                    )}
                </div>
            </div>

            {/* LISTAGEM */}
            <div style={s.cardTabela}>
                <table style={s.table}>
                    <thead>
                        <tr>
                            <th style={s.th}>Plano</th>
                            <th style={s.th}>Serviços Inclusos</th>
                            <th style={{ ...s.th, textAlign: 'center' }}>Preço / Mês</th>
                            <th style={{ ...s.th, textAlign: 'center' }}>Assinantes</th>
                            <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
                            <th style={{ ...s.th, textAlign: 'right' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {planos.length > 0 ? planos.map(p => (
                            <tr key={p.id} style={{ ...s.tr, opacity: p.ativo ? 1 : 0.6 }}>
                                <td style={s.td}>
                                    <strong style={{ color: '#111827', fontSize: '14px' }}>{p.nome}</strong>
                                    {p.descricao && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>{p.descricao}</p>}
                                </td>
                                <td style={s.td}>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {(p.servicos_nomes || '').split(',').filter(Boolean).map((nome, i) => (
                                            <span key={i} style={s.badgeServico}>{nome.trim()}</span>
                                        ))}
                                    </div>
                                </td>
                                <td style={{ ...s.td, textAlign: 'center' }}>
                                    <strong style={{ fontSize: '16px', color: '#059669' }}>
                                        R$ {parseFloat(p.preco || 0).toFixed(2).replace('.', ',')}
                                    </strong>
                                </td>
                                <td style={{ ...s.td, textAlign: 'center' }}>
                                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#6366f1' }}>{p.total_assinantes || 0}</span>
                                </td>
                                <td style={{ ...s.td, textAlign: 'center' }}>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                                        backgroundColor: p.ativo ? '#ecfdf5' : '#fef2f2',
                                        color: p.ativo ? '#065f46' : '#dc2626'
                                    }}>
                                        {p.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td style={{ ...s.td, textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => toggleAtivo(p)} style={{ ...s.btnIcone, backgroundColor: p.ativo ? '#fef2f2' : '#ecfdf5' }} title={p.ativo ? 'Desativar' : 'Ativar'}>
                                            <Icons.Power color={p.ativo ? '#dc2626' : '#059669'} />
                                        </button>
                                        <button onClick={() => abrirEdicao(p)} style={s.btnIcone} title="Editar">
                                            <Icons.Edit color="#4b5563" />
                                        </button>
                                        <button onClick={() => excluir(p.id, p.nome)} style={{ ...s.btnIcone, backgroundColor: '#fef2f2' }} title="Excluir">
                                            <Icons.Trash color="#dc2626" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                                    Nenhum plano criado ainda.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const Icons = {
    Diamond: ({ color }) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'bottom' }}><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>,
    Edit: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    Plus: ({ color }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    Power: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>,
    Trash: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    CheckCircle: ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
    Alert: ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
};

const s = {
    container: { padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
    header: { marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
    title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
    subtitle: { color: '#6b7280', fontSize: '15px', margin: 0 },
    alerta: { padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' },
    cardForm: { background: '#fff', padding: '28px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '20px' },
    cardTitle: { margin: 0, color: '#111827', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' },
    formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
    input: { padding: '11px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', color: '#111827', boxSizing: 'border-box' },
    gridServicos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' },
    itemServico: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', transition: '0.2s' },
    btnPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
    btnCancelar: { background: '#f3f4f6', color: '#4b5563', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    cardTabela: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f3f4f6' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '13px 20px', background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' },
    tr: { borderBottom: '1px solid #f3f4f6' },
    td: { padding: '16px 20px', fontSize: '13px', verticalAlign: 'middle', color: '#374151' },
    badgeServico: { background: '#eef2ff', color: '#4f46e5', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px' },
    btnIcone: { background: '#f3f4f6', border: 'none', padding: '7px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
};

export default AdminAssinaturas;