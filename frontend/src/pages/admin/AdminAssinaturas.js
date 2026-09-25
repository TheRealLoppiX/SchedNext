import React, { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { obterTerminologia } from '../../utils/terminologia';
import { API_URL } from '../../services/api';

function AdminAssinaturas({ empresaId }) {
    const confirmar = useConfirm();
    const idEfetivo = empresaId || localStorage.getItem('empresaId');

    const [planos, setPlanos] = useState([]);
    const [servicos, setServicos] = useState([]);
    const [editando, setEditando] = useState(null);
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
    const [vertical, setVertical] = useState('barbearia');
    const termos = obterTerminologia(vertical);

    const [form, setForm] = useState({ nome: '', preco: '', descricao: '', servicos: [] });

    const [permiteCampanhas, setPermiteCampanhas] = useState(false);
    const [campanhas, setCampanhas] = useState([]);
    const [editandoCampanha, setEditandoCampanha] = useState(null);
    const [salvandoCampanha, setSalvandoCampanha] = useState(false);

    const carregar = useCallback(async () => {
        if (!idEfetivo) return;
        try {
            const [resPlanos, resServicos, resEmpresa, resCampanhas] = await Promise.all([
                fetch(`${API_URL}/admin/assinaturas/${idEfetivo}`),
                fetch(`${API_URL}/admin/servicos?empresa=${idEfetivo}`),
                fetch(`${API_URL}/admin/empresa/${idEfetivo}`),
                fetch(`${API_URL}/admin/campanhas-assinatura`)
            ]);
            setPlanos(await resPlanos.json() || []);
            setServicos(await resServicos.json() || []);
            const dadosEmpresa = await resEmpresa.json();
            if (dadosEmpresa?.vertical) setVertical(dadosEmpresa.vertical);
            setPermiteCampanhas(!!dadosEmpresa?.plano_plataforma?.permite_campanhas_assinatura);
            setCampanhas(await resCampanhas.json() || []);
        } catch (err) { console.error(err); }
    }, [idEfetivo]);

    useEffect(() => { carregar(); }, [carregar]);

    const mostrarFeedback = (texto, tipo = 'sucesso') => {
        setMensagem({ texto, tipo });
        setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3500);
    };

    const toggleServico = (id) => {
        const alvo = editando ? setEditando : setForm;
        alvo(prev => ({
            ...prev,
            servicos: prev.servicos.some(s => s.id === id)
                ? prev.servicos.filter(s => s.id !== id)
                : [...prev.servicos, { id, limite_mensal: null }]
        }));
    };

    const alterarLimiteServico = (id, limite_mensal) => {
        const alvo = editando ? setEditando : setForm;
        alvo(prev => ({
            ...prev,
            servicos: prev.servicos.map(s => s.id === id ? { ...s, limite_mensal } : s)
        }));
    };

    const [salvando, setSalvando] = useState(false);

    const handleCriar = async (e) => {
        e.preventDefault();
        if (form.servicos.length === 0) return mostrarFeedback('Selecione ao menos um serviço.', 'erro');
        setSalvando(true);
        try {
            const res = await fetch(`${API_URL}/admin/assinaturas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, empresa_id: idEfetivo })
            });
            if (res.ok) {
                mostrarFeedback('Plano criado com sucesso.');
                setForm({ nome: '', preco: '', descricao: '', servicos: [] });
                carregar();
            } else {
                mostrarFeedback('Erro ao criar plano.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        finally { setSalvando(false); }
    };

    const handleAtualizar = async () => {
        if (editando.servicos.length === 0) return mostrarFeedback('Selecione ao menos um serviço.', 'erro');
        setSalvando(true);
        try {
            const res = await fetch(`${API_URL}/admin/assinaturas/${editando.id}`, {
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
        finally { setSalvando(false); }
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
            const res = await fetch(`${API_URL}/admin/assinaturas/${plano.id}/status`, {
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
            const res = await fetch(`${API_URL}/admin/assinaturas/${id}`, { method: 'DELETE' });
            if (res.ok) {
                mostrarFeedback('Plano excluído.');
                carregar();
            } else {
                const dados = await res.json().catch(() => ({}));
                mostrarFeedback(dados.error || 'Não foi possível excluir o plano.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const formatarValor = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

    const abrirNovaCampanha = () => setEditandoCampanha({
        plano_assinatura_id: planos.find(p => Number(p.preco) > 0)?.id || '',
        nome: '',
        inicio: '',
        fim: '',
        precos_por_ciclo: [{ numero_ciclo: 1, valor: '' }]
    });

    const abrirEdicaoCampanha = (c) => setEditandoCampanha({
        id: c.id,
        plano_assinatura_id: c.plano_assinatura?.id || '',
        nome: c.nome,
        inicio: c.inicio.slice(0, 10),
        fim: c.fim.slice(0, 10),
        precos_por_ciclo: c.campanha_assinatura_precos_ciclo.map(p => ({ numero_ciclo: p.numero_ciclo, valor: p.valor }))
    });

    const atualizarCicloCampanha = (idx, campo, valor) => {
        setEditandoCampanha(prev => ({ ...prev, precos_por_ciclo: prev.precos_por_ciclo.map((p, i) => i === idx ? { ...p, [campo]: valor } : p) }));
    };
    const addCicloCampanha = () => setEditandoCampanha(prev => ({ ...prev, precos_por_ciclo: [...prev.precos_por_ciclo, { numero_ciclo: prev.precos_por_ciclo.length + 1, valor: '' }] }));
    const removerCicloCampanha = (idx) => setEditandoCampanha(prev => ({ ...prev, precos_por_ciclo: prev.precos_por_ciclo.filter((_, i) => i !== idx) }));

    const salvarCampanha = async () => {
        if (!editandoCampanha.nome.trim() || !editandoCampanha.plano_assinatura_id || !editandoCampanha.inicio || !editandoCampanha.fim) {
            return mostrarFeedback('Preencha nome, plano e o período da campanha.', 'erro');
        }
        if (!editandoCampanha.precos_por_ciclo.length || editandoCampanha.precos_por_ciclo.some(p => p.valor === '' || p.numero_ciclo === '')) {
            return mostrarFeedback('Preencha o número e o valor de cada ciclo.', 'erro');
        }
        setSalvandoCampanha(true);
        try {
            const url = editandoCampanha.id ? `${API_URL}/admin/campanhas-assinatura/${editandoCampanha.id}` : `${API_URL}/admin/campanhas-assinatura`;
            const res = await fetch(url, {
                method: editandoCampanha.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plano_assinatura_id: editandoCampanha.plano_assinatura_id,
                    nome: editandoCampanha.nome,
                    inicio: editandoCampanha.inicio,
                    fim: editandoCampanha.fim,
                    precos_por_ciclo: editandoCampanha.precos_por_ciclo.map(p => ({ numero_ciclo: Number(p.numero_ciclo), valor: Number(p.valor) }))
                })
            });
            const data = await res.json();
            if (res.ok) { mostrarFeedback(data.message || 'Campanha salva.'); setEditandoCampanha(null); carregar(); }
            else mostrarFeedback(data.error || 'Não foi possível salvar a campanha.', 'erro');
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        finally { setSalvandoCampanha(false); }
    };

    const alternarAtivaCampanha = async (c) => {
        const ok = await confirmar(`${c.ativa ? 'Desativar' : 'Ativar'} a campanha "${c.nome}"?`, {
            detail: c.ativa
                ? 'Quem já entrou nela cai no preço cheio a partir do próximo ciclo. Novos assinantes deixam de ver essa promoção.'
                : 'Volta a valer pra novas assinaturas dentro da janela de datas já definida.',
            confirmText: c.ativa ? 'Desativar' : 'Ativar',
            danger: !!c.ativa
        });
        if (!ok) return;
        try {
            const res = await fetch(`${API_URL}/admin/campanhas-assinatura/${c.id}/ativa`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativa: !c.ativa })
            });
            const data = await res.json();
            if (res.ok) { mostrarFeedback(data.message || 'Campanha atualizada.'); carregar(); } else mostrarFeedback(data.error || 'Erro ao atualizar.', 'erro');
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const excluirCampanha = async (c) => {
        const ok = await confirmar(`Excluir a campanha "${c.nome}"?`, {
            detail: 'Assinantes que já entraram nela caem no preço cheio a partir do próximo ciclo.',
            confirmText: 'Excluir',
            danger: true
        });
        if (!ok) return;
        try {
            const res = await fetch(`${API_URL}/admin/campanhas-assinatura/${c.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) { mostrarFeedback(data.message || 'Campanha excluída.'); carregar(); } else mostrarFeedback(data.error || 'Erro ao excluir.', 'erro');
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const abrirEdicao = (plano) => {
        setEditando({ ...plano, servicos: (plano.servicos || []).map(s => ({ id: s.id, limite_mensal: s.limite_mensal ?? null })) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const FormularioServicos = ({ selecionados, onToggle, onAlterarLimite }) => (
        <div style={s.gridServicos}>
            {servicos.map(sv => {
                const item = selecionados.find(s => s.id === sv.id);
                const sel = !!item;
                const ilimitado = sel && item.limite_mensal == null;
                return (
                    <div key={sv.id} style={{ ...s.itemServico, backgroundColor: sel ? 'var(--fx-green-bg)' : 'var(--fx-surface-2)', borderColor: sel ? 'var(--fx-green-line)' : 'var(--fx-line)', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
                            <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => onToggle(sv.id)}
                                style={{ accentColor: 'var(--fx-text)', width: '15px', height: '15px', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: '13px', color: sel ? 'var(--fx-green)' : 'var(--fx-text)', fontWeight: sel ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sv.nome}
                            </span>
                        </label>
                        <span style={{ fontSize: '12px', color: 'var(--fx-muted)', whiteSpace: 'nowrap' }}>
                            R$ {parseFloat(sv.valor).toFixed(2).replace('.', ',')}
                        </span>
                        {sel && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '4px', paddingLeft: '25px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    disabled={ilimitado}
                                    placeholder="Limite/mês"
                                    value={ilimitado ? '' : item.limite_mensal}
                                    onChange={e => onAlterarLimite(sv.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                                    style={{ ...s.inputLimite, opacity: ilimitado ? 0.5 : 1 }}
                                />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--fx-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    <input
                                        type="checkbox"
                                        checked={ilimitado}
                                        onChange={() => onAlterarLimite(sv.id, ilimitado ? 1 : null)}
                                        style={{ accentColor: 'var(--fx-text)', width: '13px', height: '13px' }}
                                    />
                                    Ilimitado
                                </label>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="admin-page-container" style={s.container}>
            <header style={s.header}>
                <div>
                    <h2 style={s.title}>Planos de Assinatura</h2>
                    <p style={s.subtitle}>Crie e gerencie os planos de assinatura {termos.artigoContraido} {termos.local.toLowerCase()}.</p>
                </div>
            </header>

            {mensagem.texto && (
                <div style={{ ...s.alerta, backgroundColor: mensagem.tipo === 'sucesso' ? 'var(--fx-green-bg)' : 'var(--fx-red-bg)', color: mensagem.tipo === 'sucesso' ? 'var(--fx-green)' : 'var(--fx-red)', border: `1px solid ${mensagem.tipo === 'sucesso' ? 'var(--fx-green-line)' : 'var(--fx-red-line)'}` }}>
                    {mensagem.tipo === 'sucesso' ? <Icons.CheckCircle color="var(--fx-green)" /> : <Icons.Alert color="var(--fx-red)" />}
                    <span>{mensagem.texto}</span>
                </div>
            )}

            {/* FORMULÁRIO DE CRIAÇÃO / EDIÇÃO */}
            <div style={s.cardForm}>
                <h4 style={s.cardTitle}>
                    {editando
                        ? <><Icons.Edit color="var(--fx-muted)" /> Editar Plano</>
                        : <><Icons.Plus color="var(--fx-muted)" /> Novo Plano</>
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
                    <div style={{ ...s.inputGroup, gridColumn: '1 / -1' }}>
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
                    <p style={{ fontSize: '12px', color: 'var(--fx-faint)', margin: '0 0 10px 0' }}>
                        O cliente assinante poderá agendar estes serviços sem custo, até o limite mensal definido (ou sem limite).
                    </p>
                    <FormularioServicos
                        selecionados={editando ? (editando.servicos || []) : form.servicos}
                        onToggle={toggleServico}
                        onAlterarLimite={alterarLimiteServico}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    {editando ? (
                        <>
                            <LoadingButton loading={salvando} onClick={handleAtualizar} style={s.btnPrincipal}>Salvar Alterações</LoadingButton>
                            <button onClick={() => setEditando(null)} style={s.btnCancelar}>Cancelar</button>
                        </>
                    ) : (
                        <LoadingButton loading={salvando} onClick={handleCriar} style={s.btnPrincipal}>Criar Plano</LoadingButton>
                    )}
                </div>
            </div>

            {/* LISTAGEM */}
            <div style={s.cardTabela}>
                <div style={{ overflowX: 'auto' }}>
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
                                    <strong style={{ color: 'var(--fx-text)', fontSize: '14px' }}>{p.nome}</strong>
                                    {p.descricao && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--fx-faint)' }}>{p.descricao}</p>}
                                </td>
                                <td style={s.td}>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {(p.servicos || []).map(sv => (
                                            <span key={sv.id} style={s.badgeServico}>
                                                {sv.nome} · {sv.limite_mensal == null ? 'ilimitado' : `${sv.limite_mensal}/mês`}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td style={{ ...s.td, textAlign: 'center' }}>
                                    <strong style={{ fontSize: '16px', color: 'var(--fx-green)' }}>
                                        R$ {parseFloat(p.preco || 0).toFixed(2).replace('.', ',')}
                                    </strong>
                                </td>
                                <td style={{ ...s.td, textAlign: 'center' }}>
                                    <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--fx-violet)' }}>{p.total_assinantes || 0}</span>
                                </td>
                                <td style={{ ...s.td, textAlign: 'center' }}>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                                        backgroundColor: p.ativo ? 'var(--fx-green-bg)' : 'var(--fx-red-bg)',
                                        color: p.ativo ? 'var(--fx-green)' : 'var(--fx-red)'
                                    }}>
                                        {p.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td style={{ ...s.td, textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => toggleAtivo(p)} style={{ ...s.btnIcone, backgroundColor: p.ativo ? 'var(--fx-red-bg)' : 'var(--fx-green-bg)' }} title={p.ativo ? 'Desativar' : 'Ativar'}>
                                            <Icons.Power color={p.ativo ? 'var(--fx-red)' : 'var(--fx-green)'} />
                                        </button>
                                        <button onClick={() => abrirEdicao(p)} style={s.btnIcone} title="Editar">
                                            <Icons.Edit color="var(--fx-muted)" />
                                        </button>
                                        <button onClick={() => excluir(p.id, p.nome)} style={{ ...s.btnIcone, backgroundColor: 'var(--fx-red-bg)' }} title="Excluir">
                                            <Icons.Trash color="var(--fx-red)" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: 'var(--fx-faint)', fontSize: '14px' }}>
                                    Nenhum plano criado ainda.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* CAMPANHAS PROMOCIONAIS DE PREÇO ESCALONADO */}
            <div style={{ marginTop: '30px' }}>
                <header style={s.header}>
                    <div>
                        <h2 style={s.title}>Campanhas Promocionais</h2>
                        <p style={s.subtitle}>Preço diferente por ciclo pra atrair novos assinantes (ex: 1º mês R$19,90, 2º R$29,90, demais no preço cheio).</p>
                    </div>
                </header>

                {!permiteCampanhas ? (
                    <div style={s.upsell}>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--fx-muted)' }}>
                            Criar campanhas promocionais de preço escalonado é um recurso exclusivo de planos superiores. Fale com o suporte para fazer upgrade.
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <button onClick={abrirNovaCampanha} style={s.btnPrincipal}>+ Nova campanha</button>
                        </div>

                        <div style={s.cardTabela}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={s.table}>
                                    <thead>
                                        <tr>
                                            {['Campanha', 'Plano', 'Período', 'Preços por ciclo', 'Status', 'Ações'].map(h => (
                                                <th key={h} style={{ ...s.th, ...(h === 'Ações' ? { textAlign: 'right' } : {}) }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campanhas.length > 0 ? campanhas.map(c => {
                                            const expirada = new Date(c.fim) < new Date();
                                            return (
                                                <tr key={c.id} style={s.tr}>
                                                    <td style={s.td}><strong style={{ color: 'var(--fx-text)' }}>{c.nome}</strong></td>
                                                    <td style={s.td}>{c.plano_assinatura?.nome || '-'}</td>
                                                    <td style={s.td}>{new Date(c.inicio).toLocaleDateString('pt-BR')} - {new Date(c.fim).toLocaleDateString('pt-BR')}</td>
                                                    <td style={s.td}>{c.campanha_assinatura_precos_ciclo.map(p => `${p.numero_ciclo}º: ${formatarValor(p.valor)}`).join(' · ')}, demais: cheio</td>
                                                    <td style={s.td}>
                                                        <span style={{
                                                            padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
                                                            backgroundColor: c.ativa && !expirada ? 'var(--fx-green-bg)' : 'var(--fx-surface-2)',
                                                            color: c.ativa && !expirada ? 'var(--fx-green)' : 'var(--fx-muted)'
                                                        }}>
                                                            {!c.ativa ? 'Desativada' : expirada ? 'Expirada' : 'Ativa'}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...s.td, textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                            <button onClick={() => abrirEdicaoCampanha(c)} style={s.btnIcone} title="Editar"><Icons.Edit color="var(--fx-muted)" /></button>
                                                            <button onClick={() => alternarAtivaCampanha(c)} style={{ ...s.btnIcone, backgroundColor: c.ativa ? 'var(--fx-red-bg)' : 'var(--fx-green-bg)' }} title={c.ativa ? 'Desativar' : 'Ativar'}>
                                                                <Icons.Power color={c.ativa ? 'var(--fx-red)' : 'var(--fx-green)'} />
                                                            </button>
                                                            <button onClick={() => excluirCampanha(c)} style={{ ...s.btnIcone, backgroundColor: 'var(--fx-red-bg)' }} title="Excluir"><Icons.Trash color="var(--fx-red)" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: 'var(--fx-faint)', fontSize: '14px' }}>
                                                    Nenhuma campanha criada ainda.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {editandoCampanha && (
                    <div style={s.overlay} onClick={() => setEditandoCampanha(null)}>
                        <div style={s.modal} onClick={ev => ev.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--fx-text)' }}>{editandoCampanha.id ? 'Editar campanha' : 'Nova campanha'}</h3>
                                <button onClick={() => setEditandoCampanha(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--fx-faint)', lineHeight: 1 }}>×</button>
                            </div>

                            <div style={s.inputGroup}>
                                <label style={s.label}>Nome da campanha</label>
                                <input style={s.input} value={editandoCampanha.nome} onChange={e => setEditandoCampanha({ ...editandoCampanha, nome: e.target.value })} placeholder="Ex: Promoção de Verão" />
                            </div>

                            <div style={s.inputGroup}>
                                <label style={s.label}>Plano</label>
                                <select style={s.input} value={editandoCampanha.plano_assinatura_id} onChange={e => setEditandoCampanha({ ...editandoCampanha, plano_assinatura_id: e.target.value })}>
                                    {planos.filter(p => Number(p.preco) > 0).map(p => <option key={p.id} value={p.id}>{p.nome} · {formatarValor(p.preco)}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ ...s.inputGroup, flex: 1 }}>
                                    <label style={s.label}>Início</label>
                                    <input type="date" style={s.input} value={editandoCampanha.inicio} onChange={e => setEditandoCampanha({ ...editandoCampanha, inicio: e.target.value })} />
                                </div>
                                <div style={{ ...s.inputGroup, flex: 1 }}>
                                    <label style={s.label}>Fim</label>
                                    <input type="date" style={s.input} value={editandoCampanha.fim} onChange={e => setEditandoCampanha({ ...editandoCampanha, fim: e.target.value })} />
                                </div>
                            </div>

                            <div style={s.inputGroup}>
                                <label style={s.label}>Preço por ciclo</label>
                                {editandoCampanha.precos_por_ciclo.map((p, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                                        <input type="number" min="1" style={{ ...s.input, width: '70px' }} value={p.numero_ciclo} onChange={e => atualizarCicloCampanha(idx, 'numero_ciclo', e.target.value)} title="Número do ciclo" />
                                        <span style={{ fontSize: '12px', color: 'var(--fx-faint)', whiteSpace: 'nowrap' }}>º ciclo →</span>
                                        <input type="number" min="0" step="0.01" style={{ ...s.input, flex: 1 }} value={p.valor} onChange={e => atualizarCicloCampanha(idx, 'valor', e.target.value)} placeholder="Valor (R$)" />
                                        {editandoCampanha.precos_por_ciclo.length > 1 && (
                                            <button onClick={() => removerCicloCampanha(idx)} style={{ background: 'none', border: 'none', color: 'var(--fx-blue)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Remover</button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addCicloCampanha} style={{ background: 'none', border: 'none', color: 'var(--fx-blue)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Adicionar ciclo</button>
                                <p style={{ fontSize: '12px', color: 'var(--fx-faint)', marginTop: '6px' }}>Ciclos além do último definido aqui cobram o preço cheio do plano automaticamente.</p>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button onClick={() => setEditandoCampanha(null)} style={{ ...s.btnCancelar, flex: 1 }}>Cancelar</button>
                                <LoadingButton loading={salvandoCampanha} onClick={salvarCampanha} style={{ ...s.btnPrincipal, flex: 2 }}>Salvar</LoadingButton>
                            </div>
                        </div>
                    </div>
                )}
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
    header: { marginBottom: '30px', paddingBottom: '4px' },
    title: { fontFamily: 'var(--oc-display)', fontWeight: 400, fontSize: 'clamp(44px, 5.4vw, 76px)', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.005em', color: 'var(--fx-text)', margin: '0 0 10px 0' },
    subtitle: { color: 'var(--fx-muted)', fontSize: '15px', margin: 0 },
    alerta: { padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' },
    cardForm: { background: 'var(--fx-card)', padding: '28px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid var(--fx-line)', display: 'flex', flexDirection: 'column', gap: '20px' },
    cardTitle: { margin: 0, color: 'var(--fx-text)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '12px', fontWeight: '700', color: 'var(--fx-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    input: { padding: '11px 14px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', fontSize: '14px', outline: 'none', color: 'var(--fx-text)', boxSizing: 'border-box' },
    gridServicos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' },
    itemServico: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid', transition: '0.2s' },
    inputLimite: { width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', fontSize: '12px', outline: 'none', color: 'var(--fx-text)', boxSizing: 'border-box' },
    btnPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
    btnCancelar: { background: 'var(--fx-surface-2)', color: 'var(--fx-muted)', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
    cardTabela: { background: 'var(--fx-card)', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid var(--fx-line)' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '13px 20px', background: 'var(--fx-surface-2)', color: 'var(--fx-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--fx-line)', textAlign: 'left' },
    tr: { borderBottom: '1px solid var(--fx-line)' },
    td: { padding: '16px 20px', fontSize: '13px', verticalAlign: 'middle', color: 'var(--fx-text)' },
    badgeServico: { background: 'var(--fx-violet-bg)', color: 'var(--fx-violet)', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px' },
    btnIcone: { background: 'var(--fx-surface-2)', border: 'none', padding: '7px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
    upsell: { background: 'var(--fx-card)', padding: '24px', borderRadius: '12px', border: '1px dashed var(--fx-line-2)' },
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(17,24,39,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '20px' },
    modal: { background: 'var(--fx-card)', padding: '28px', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', boxSizing: 'border-box' },
};

export default AdminAssinaturas;