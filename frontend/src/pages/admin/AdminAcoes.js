import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import EmptyState from '../../components/EmptyState';

function AdminAcoes() {
    const toast = useToast();
    const confirmar = useConfirm();
    const empresaId = localStorage.getItem('empresaId');
    const [campanhas, setCampanhas] = useState([]);
    const [servicos, setServicos] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [lancando, setLancando] = useState(false);

    const [form, setForm] = useState({ nome: '', data_inicio: '', data_fim: '', cortes_necessarios: '', valor_minimo: '0.00', tipo_premio: 'servico', premio_selecionado: '', valor_desconto: '' });

    const carregarDados = useCallback(async () => {
        if (!empresaId) { setCarregando(false); return; }
        try {
            const [resCamp, resServ, resProd] = await Promise.all([
                fetch(`http://localhost:4000/admin/acoes/${empresaId}`),
                fetch(`http://localhost:4000/admin/servicos?empresa=${empresaId}`),
                fetch(`http://localhost:4000/admin/estoque/${empresaId}`)
            ]);
            setCampanhas(await resCamp.json() || []);
            setServicos(await resServ.json() || []);
            setProdutos(await resProd.json() || []);
        } catch (err) {
            console.error(err);
            toast.error('Não foi possível carregar as ações. Tente recarregar a página.');
        } finally {
            setCarregando(false);
        }
    }, [empresaId]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        let premioFinal;
        if (form.tipo_premio === 'servico') premioFinal = `Serviço: ${form.premio_selecionado}`;
        else if (form.tipo_premio === 'produto') premioFinal = `Produto: ${form.premio_selecionado}`;
        else if (form.tipo_premio === 'desconto_percent') premioFinal = `${form.valor_desconto}% de desconto`;
        else if (form.tipo_premio === 'desconto_valor') premioFinal = `R$ ${form.valor_desconto} de desconto`;

        setLancando(true);
        try {
            const res = await fetch('http://localhost:4000/admin/acoes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, empresa_id: empresaId, premio_descritivo: premioFinal })
            });
            if (res.ok) {
                setForm({ nome: '', data_inicio: '', data_fim: '', cortes_necessarios: '', valor_minimo: '0.00', tipo_premio: 'servico', premio_selecionado: '', valor_desconto: '' });
                carregarDados();
                toast.success("Campanha criada e ativada!");
            } else {
                toast.error("Não foi possível criar a campanha. Tente novamente.");
            }
        } catch (err) {
            toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
        } finally {
            setLancando(false);
        }
    };

    const alternarStatus = async (id, statusAtual) => {
        try {
            const res = await fetch(`http://localhost:4000/admin/acoes/${id}/status`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empresa_id: empresaId, ativar: !statusAtual })
            });
            if (res.ok) {
                carregarDados();
                toast.success(statusAtual ? 'Ação desativada.' : 'Ação ativada.');
            } else {
                toast.error('Não foi possível atualizar o status. Tente novamente.');
            }
        } catch (err) {
            toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
        }
    };

    const excluir = async (id) => {
        const ok = await confirmar("Excluir esta ação definitivamente?", { confirmText: 'Excluir', danger: true });
        if (!ok) return;

        try {
            const res = await fetch(`http://localhost:4000/admin/acoes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                carregarDados();
                toast.success('Ação excluída.');
            } else {
                toast.error('Não foi possível excluir a ação.');
            }
        } catch (err) {
            toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
        }
    };

    return (
        <div style={s.container}>
            <header style={s.header}>
                <h2 style={s.title}>⭐ Ações & Fidelidade</h2>
                <p style={s.subtitle}>Crie campanhas sazonais e programe prêmios para reter clientes.</p>
            </header>

            <div style={s.card}>
                <h3 style={s.cardTitle}>Criar Nova Ação</h3>
                <form onSubmit={handleSubmit} style={s.formGrid}>
                    <div style={s.inputGroup}>
                        <label style={s.label}>Nome da Ação (Ex: Mês do Cliente)</label>
                        <input style={s.input} required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{...s.inputGroup, flex: 1}}>
                            <label style={s.label}>Data Início</label>
                            <input type="date" style={s.input} required value={form.data_inicio} onChange={e => setForm({...form, data_inicio: e.target.value})} />
                        </div>
                        <div style={{...s.inputGroup, flex: 1}}>
                            <label style={s.label}>Data Fim</label>
                            <input type="date" style={s.input} required value={form.data_fim} onChange={e => setForm({...form, data_fim: e.target.value})} />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{...s.inputGroup, flex: 1}}>
                            <label style={s.label}>Meta (Qtd. Cortes)</label>
                            <input type="number" min="1" style={s.input} required value={form.cortes_necessarios} onChange={e => setForm({...form, cortes_necessarios: e.target.value})} />
                        </div>
                        <div style={{...s.inputGroup, flex: 1}}>
                            <label style={s.label}>Valor Mínimo (R$)</label>
                            <input type="number" step="0.01" style={s.input} value={form.valor_minimo} onChange={e => setForm({...form, valor_minimo: e.target.value})} title="Deixe 0 se qualquer valor for válido" />
                        </div>
                    </div>

                    <div style={s.inputGroup}>
                        <label style={s.label}>Prêmio (O que ele ganha?)</label>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <select style={{...s.input, flex: 1}} value={form.tipo_premio} onChange={e => setForm({...form, tipo_premio: e.target.value, premio_selecionado: '', valor_desconto: ''})}>
                                <option value="servico">Dar um Serviço</option>
                                <option value="produto">Dar um Produto</option>
                                <option value="desconto_percent">Desconto em %</option>
                                <option value="desconto_valor">Desconto em R$</option>
                            </select>

                            {(form.tipo_premio === 'servico' || form.tipo_premio === 'produto') && (
                                <select style={{...s.input, flex: 2}} required value={form.premio_selecionado} onChange={e => setForm({...form, premio_selecionado: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {form.tipo_premio === 'servico'
                                        ? servicos.map(sv => <option key={sv.id} value={sv.nome}>{sv.nome}</option>)
                                        : produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)
                                    }
                                </select>
                            )}

                            {form.tipo_premio === 'desconto_percent' && (
                                <div style={{ display: 'flex', alignItems: 'center', flex: 2, gap: '8px' }}>
                                    <input
                                        type="number" min="1" max="100" step="1"
                                        style={{...s.input, flex: 1}}
                                        placeholder="Ex: 10"
                                        required
                                        value={form.valor_desconto}
                                        onChange={e => setForm({...form, valor_desconto: e.target.value, premio_selecionado: e.target.value + '%'})}
                                    />
                                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#374151' }}>%</span>
                                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>de desconto</span>
                                </div>
                            )}

                            {form.tipo_premio === 'desconto_valor' && (
                                <div style={{ display: 'flex', alignItems: 'center', flex: 2, gap: '8px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#374151' }}>R$</span>
                                    <input
                                        type="number" min="0.01" step="0.01"
                                        style={{...s.input, flex: 1}}
                                        placeholder="Ex: 15,00"
                                        required
                                        value={form.valor_desconto}
                                        onChange={e => setForm({...form, valor_desconto: e.target.value, premio_selecionado: 'R$ ' + e.target.value})}
                                    />
                                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>de desconto</span>
                                </div>
                            )}
                        </div>

                        {/* Preview do prêmio */}
                        {form.premio_selecionado && (
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>
                                    {form.tipo_premio === 'servico' ? '🎟️' : form.tipo_premio === 'produto' ? '🎁' : '💰'}
                                </span>
                                <div>
                                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>O cliente vai ganhar:</span>
                                    <strong style={{ color: '#065f46', fontSize: '14px' }}>
                                        {form.tipo_premio === 'servico' && `Serviço gratuito: ${form.premio_selecionado}`}
                                        {form.tipo_premio === 'produto' && `Produto gratuito: ${form.premio_selecionado}`}
                                        {form.tipo_premio === 'desconto_percent' && `${form.valor_desconto}% de desconto no próximo serviço`}
                                        {form.tipo_premio === 'desconto_valor' && `R$ ${form.valor_desconto} de desconto no próximo serviço`}
                                    </strong>
                                </div>
                            </div>
                        )}
                    </div>

                    <LoadingButton loading={lancando} style={s.btnPrincipal}>Lançar Ação</LoadingButton>
                </form>
            </div>

            <div style={s.card}>
                <table style={s.table}>
                    <thead>
                        <tr>
                            <th style={s.th}>Ação</th>
                            <th style={s.th}>Validade</th>
                            <th style={s.th}>Regra</th>
                            <th style={s.th}>Prêmio</th>
                            <th style={s.th}>Status</th>
                            <th style={s.th}>Opções</th>
                        </tr>
                    </thead>
                    <tbody>
                        {carregando ? (
                            <tr><td colSpan={6} style={s.td}>Carregando ações...</td></tr>
                        ) : campanhas.length === 0 ? (
                            <tr><td colSpan={6}>
                                <EmptyState
                                    icon="⭐"
                                    title="Nenhuma ação de fidelidade cadastrada ainda."
                                    hint="Use o formulário acima para lançar a primeira campanha."
                                />
                            </td></tr>
                        ) : campanhas.map(c => (
                            <tr key={c.id} style={{...s.tr, opacity: c.ativa ? 1 : 0.6}}>
                                <td style={s.td}><b>{c.nome}</b></td>
                                <td style={s.td}>{new Date(c.data_inicio).toLocaleDateString('pt-BR')} a {new Date(c.data_fim).toLocaleDateString('pt-BR')}</td>
                                <td style={s.td}>{c.cortes_necessarios}x (Min: R${c.valor_minimo})</td>
                                <td style={{...s.td, color: '#059669', fontWeight: 'bold'}}>{c.premio_descritivo}</td>
                                <td style={s.td}>
                                    <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: c.ativa ? '#d1fae5' : '#f3f4f6', color: c.ativa ? '#065f46' : '#6b7280' }}>
                                        {c.ativa ? 'ATIVA' : 'INATIVA'}
                                    </span>
                                </td>
                                <td style={s.td}>
                                    <button onClick={() => alternarStatus(c.id, c.ativa)} style={s.btnIcon}>{c.ativa ? 'Desativar' : 'Ativar'}</button>
                                    <button onClick={() => excluir(c.id)} style={{...s.btnIcon, color: 'red'}}>Excluir</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const s = {
    container: { padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
    header: { marginBottom: '30px' },
    title: { fontSize: '28px', color: '#111827', margin: '0 0 5px 0' },
    subtitle: { color: '#6b7280', margin: 0 },
    card: { background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #f3f4f6' },
    cardTitle: { margin: '0 0 20px 0', fontSize: '18px' },
    formGrid: { display: 'flex', flexDirection: 'column', gap: '15px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { fontSize: '12px', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' },
    btnPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', padding: '15px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '15px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' },
    tr: { borderBottom: '1px solid #f3f4f6' },
    td: { padding: '15px', fontSize: '14px', color: '#374151' },
    btnIcon: { background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', fontWeight: 'bold', marginRight: '10px' }
};

export default AdminAcoes;