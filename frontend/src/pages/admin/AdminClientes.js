import React, { useState, useEffect, useCallback } from 'react';
import { formatarTelefone } from '../../utils/telefone';
import { emailValido } from '../../utils/validacao';
import { formatarDataSemFuso, ehMesDiaIgual } from '../../utils/dataSemFuso';
import { useConfirm } from '../../components/ConfirmDialog';
import useEscToClose from '../../hooks/useEscToClose';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

function AdminClientes({ empresaId }) {
    const confirmar = useConfirm();
    const idEfetivo = empresaId || localStorage.getItem('empresaId');

    const [clientes, setClientes] = useState([]);
    const [busca, setBusca] = useState('');
    const buscaDebounced = useDebouncedValue(busca, 300);
    const [filtro, setFiltro] = useState('todos');
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    useEscToClose(!!clienteSelecionado, () => setClienteSelecionado(null));
    const [loadingId, setLoadingId] = useState(null);
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
    const [planosDisponiveis, setPlanosDisponiveis] = useState([]);
    const [selecionados, setSelecionados] = useState([]);
    const [processandoLote, setProcessandoLote] = useState(false);
    const [permiteIA, setPermiteIA] = useState(false);
    const [permiteWhatsapp, setPermiteWhatsapp] = useState(false);
    const [nomeEmpresa, setNomeEmpresa] = useState('');
    const [sugestaoIA, setSugestaoIA] = useState('');
    const [salvandoEdicao, setSalvandoEdicao] = useState(false);
    const [riscoFaltas, setRiscoFaltas] = useState(null);
    const [gerandoSugestao, setGerandoSugestao] = useState(false);
    const [mostrarBaixaManual, setMostrarBaixaManual] = useState(false);
    const [baixaFormaPagamento, setBaixaFormaPagamento] = useState('dinheiro');
    const [baixaObservacoes, setBaixaObservacoes] = useState('');
    const [pixAssinaturaInfo, setPixAssinaturaInfo] = useState(null);

    useEffect(() => {
        if (!idEfetivo) return;
        fetch(`${API_URL}/admin/empresa/${idEfetivo}`)
            .then(r => r.json())
            .then(d => {
                setPermiteIA(!!d?.plano_plataforma?.permite_ia);
                setPermiteWhatsapp(!!d?.plano_plataforma?.permite_whatsapp_bot);
                if (d?.nome) setNomeEmpresa(d.nome);
            })
            .catch(() => {});
    }, [idEfetivo]);

    const gerarSugestaoFollowUp = async (cliente) => {
        setGerandoSugestao(true);
        setSugestaoIA('');
        try {
            const res = await fetch(`${API_URL}/admin/ia/sugestao-followup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clienteNome: (cliente.nome_completo || '').split(' ')[0], nomeEmpresa })
            });
            const data = await res.json();
            setSugestaoIA(res.ok ? data.mensagem : (data.error || 'Não foi possível gerar a sugestão.'));
        } catch (err) {
            setSugestaoIA('Erro de conexão. Tente novamente.');
        } finally {
            setGerandoSugestao(false);
        }
    };

    const carregarClientes = useCallback(async () => {
        if (!idEfetivo) return;
        try {
            const [resC, resP] = await Promise.all([
                fetch(`${API_URL}/admin/clientes/${idEfetivo}`),
                fetch(`${API_URL}/admin/assinaturas/${idEfetivo}`)
            ]);
            const dataC = await resC.json();
            const dataP = await resP.json();
            setClientes(Array.isArray(dataC) ? dataC : []);
            setPlanosDisponiveis(Array.isArray(dataP) ? dataP.filter(p => p.ativo) : []);
        } catch (err) { console.error(err); }
    }, [idEfetivo]);

    useEffect(() => { carregarClientes(); }, [carregarClientes]);
    useEffect(() => { setSelecionados([]); }, [filtro, buscaDebounced]);

    // Risco de não comparecimento (regra simples em cima do histórico, ver
    // routes/clientes.js GET /admin/clientes/:id/risco-faltas) — recalculado toda vez que o
    // modal de um cliente diferente abre.
    useEffect(() => {
        if (!clienteSelecionado?.id) { setRiscoFaltas(null); return; }
        setRiscoFaltas(null);
        fetch(`${API_URL}/admin/clientes/${clienteSelecionado.id}/risco-faltas`)
            .then(r => r.ok ? r.json() : null)
            .then(setRiscoFaltas)
            .catch(() => setRiscoFaltas(null));
    }, [clienteSelecionado?.id]);

    const mostrarFeedback = (texto, tipo = 'sucesso') => {
        setMensagem({ texto, tipo });
        setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3500);
    };

    const toggleAssinante = async (cliente) => {
        setLoadingId(cliente.id);
        const novoStatus = !cliente.assinante;
        try {
            const res = await fetch(`${API_URL}/admin/clientes/${cliente.id}/assinante`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assinante: novoStatus })
            });
            if (res.ok) {
                mostrarFeedback(novoStatus ? `${cliente.nome_completo} ativado como Assinante.` : `${cliente.nome_completo} removido dos assinantes.`);
                carregarClientes();
                if (clienteSelecionado?.id === cliente.id) {
                    setClienteSelecionado(prev => ({ ...prev, assinante: novoStatus ? 1 : 0 }));
                }
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        setLoadingId(null);
    };

    const enviarFollowUp = async (cliente, tipo, canal = 'email') => {
        setLoadingId(cliente.id + tipo + canal);
        try {
            const res = await fetch(`${API_URL}/admin/clientes/followup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cliente_id: cliente.id, tipo, canal, empresa_id: idEfetivo })
            });
            if (res.ok) {
                const meio = canal === 'whatsapp' ? 'WhatsApp' : 'e-mail';
                mostrarFeedback(`Mensagem enviada por ${meio} para ${cliente.nome_completo} com sucesso.`);
            } else {
                mostrarFeedback('Erro ao enviar a mensagem.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        setLoadingId(null);
    };

    const vincularPlano = async (clienteId, planoId) => {
        try {
            const res = await fetch(`${API_URL}/admin/clientes/${clienteId}/plano`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plano_id: planoId || null })
            });
            if (res.ok) {
                mostrarFeedback(planoId ? 'Plano vinculado com sucesso.' : 'Assinatura removida.');
                carregarClientes();
                if (clienteSelecionado?.id === clienteId) {
                    setClienteSelecionado(prev => ({ ...prev, plano_id: planoId || null, assinante: planoId ? 1 : 0 }));
                }
            }
        } catch (err) { mostrarFeedback('Erro de conexao.', 'erro'); }
    };

    // Baixa manual da mensalidade do ciclo atual — cliente pagou por fora (chave Pix da própria
    // barbearia, dinheiro no balcão) ou presencialmente atrasado. Fazer isso ANTES de finalizar
    // o checkout do atendimento do dia já libera o preço de assinante nesse mesmo atendimento
    // (o backend lê status_assinatura direto do banco no fechamento de caixa).
    const darBaixaManual = async (cliente) => {
        setLoadingId(cliente.id + 'baixa');
        try {
            const res = await fetch(`${API_URL}/admin/clientes/${cliente.id}/assinatura/baixa-manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forma_pagamento: baixaFormaPagamento, observacoes: baixaObservacoes || null })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarFeedback(`Mensalidade de ${cliente.nome_completo} dada como paga.`);
                setMostrarBaixaManual(false);
                setBaixaObservacoes('');
                carregarClientes();
                if (clienteSelecionado?.id === cliente.id) {
                    setClienteSelecionado(prev => ({ ...prev, status_assinatura: 'em_dia' }));
                }
            } else {
                mostrarFeedback(data.error || 'Erro ao registrar a baixa.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        setLoadingId(null);
    };

    // Cobrança/lembrete sob demanda — Pix gera um QR novo (mostrado aqui mesmo pro admin
    // repassar ou o cliente escanear na hora), cartão só reenvia lembrete (Mercado Pago não
    // aceita cobrança avulsa de preapproval fora do ciclo). formaPagamento='pix' também serve
    // pra CONFIGURAR a cobrança automática de Pix pela primeira vez (cliente ainda sem nenhuma
    // forma configurada) — cartão só o próprio cliente configura, pelo perfil dele.
    const cobrarAgora = async (cliente, formaPagamento) => {
        setLoadingId(cliente.id + 'cobrar');
        setPixAssinaturaInfo(null);
        try {
            const res = await fetch(`${API_URL}/admin/clientes/${cliente.id}/assinatura/cobrar-agora`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formaPagamento ? { forma_pagamento: formaPagamento } : {})
            });
            const data = await res.json();
            if (res.ok) {
                if (data.forma_pagamento === 'pix') {
                    setPixAssinaturaInfo({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
                    mostrarFeedback(`Pix gerado e enviado por e-mail/WhatsApp para ${cliente.nome_completo}.`);
                    if (clienteSelecionado?.id === cliente.id) {
                        setClienteSelecionado(prev => ({ ...prev, assinatura_forma_pagamento: 'pix' }));
                    }
                } else {
                    mostrarFeedback(`Lembrete de mensalidade enviado para ${cliente.nome_completo}.`);
                }
            } else {
                mostrarFeedback(data.error || 'Erro ao cobrar agora.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        setLoadingId(null);
    };

    const copiarCodigoPixAssinatura = () => {
        if (!pixAssinaturaInfo?.qr_code) return;
        navigator.clipboard.writeText(pixAssinaturaInfo.qr_code).catch(() => {});
    };

    const salvarEdicao = async () => {
        if (!emailValido(clienteSelecionado.email)) {
            return mostrarFeedback('Insira um e-mail válido antes de salvar.', 'erro');
        }
        setSalvandoEdicao(true);
        try {
            // 1. Salva dados pessoais
            const res = await fetch(`${API_URL}/admin/clientes/${clienteSelecionado.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome_completo: clienteSelecionado.nome_completo,
                    telefone: clienteSelecionado.telefone,
                    email: clienteSelecionado.email,
                    data_nascimento: clienteSelecionado.data_nascimento,
                    notas: clienteSelecionado.notas
                })
            });
            if (!res.ok) return mostrarFeedback('Erro ao salvar dados.', 'erro');

            // 2. Salva plano/assinatura (so aplicado ao clicar em Salvar)
            await fetch(`${API_URL}/admin/clientes/${clienteSelecionado.id}/plano`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plano_id: clienteSelecionado.plano_id || null })
            });

            mostrarFeedback('Cliente atualizado com sucesso.');
            setClienteSelecionado(null);
            carregarClientes();
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
        finally { setSalvandoEdicao(false); }
    };

    const excluirCliente = async (id, nome) => {
        const ok = await confirmar(`Excluir ${nome} definitivamente?`, {
            detail: 'Essa ação não pode ser desfeita.',
            confirmText: 'Excluir',
            danger: true
        });
        if (!ok) return;
        try {
            const res = await fetch(`${API_URL}/admin/clientes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                mostrarFeedback('Cliente excluído.');
                setClienteSelecionado(null);
                carregarClientes();
            } else {
                mostrarFeedback('Erro ao excluir.', 'erro');
            }
        } catch (err) { mostrarFeedback('Erro de conexão.', 'erro'); }
    };

    const diasSemCortar = (ultimoAgendamento) => {
        if (!ultimoAgendamento) return null;
        return Math.floor((new Date() - new Date(ultimoAgendamento)) / (1000 * 60 * 60 * 24));
    };

    const aniversarioHoje = (dataNasc) => ehMesDiaIgual(dataNasc, new Date());

    const clientesFiltrados = clientes.filter(c => {
        const bate = (c.nome_completo || '').toLowerCase().includes(buscaDebounced.toLowerCase()) ||
                     (c.telefone || '').includes(buscaDebounced) ||
                     (c.email || '').toLowerCase().includes(buscaDebounced.toLowerCase());
        if (filtro === 'assinantes') return bate && c.assinante;
        if (filtro === 'inativos') return bate && diasSemCortar(c.ultimo_agendamento) > 30;
        return bate;
    });

    // --- AÇÕES EM LOTE (heurística 7: antes só dava pra agir um cliente por vez) ---
    const idsVisiveis = clientesFiltrados.map(c => c.id);
    const todosVisiveisSelecionados = idsVisiveis.length > 0 && idsVisiveis.every(id => selecionados.includes(id));

    const toggleSelecionado = (id) => {
        setSelecionados(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    };

    const toggleSelecionarTodosVisiveis = () => {
        setSelecionados(prev => todosVisiveisSelecionados
            ? prev.filter(id => !idsVisiveis.includes(id))
            : [...new Set([...prev, ...idsVisiveis])]);
    };

    const clientesSelecionadosObjs = clientes.filter(c => selecionados.includes(c.id));

    const enviarFollowUpEmLote = async () => {
        const ok = await confirmar(`Enviar e-mail "sentimos sua falta" para ${selecionados.length} cliente(s)?`, {
            confirmText: 'Enviar'
        });
        if (!ok) return;

        setProcessandoLote(true);
        try {
            const resultados = await Promise.all(clientesSelecionadosObjs.map(c =>
                fetch(`${API_URL}/admin/clientes/followup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cliente_id: c.id, tipo: 'saudade', canal: 'email', empresa_id: idEfetivo })
                }).then(r => r.ok)
            ));
            const sucesso = resultados.filter(Boolean).length;
            mostrarFeedback(`${sucesso} de ${resultados.length} e-mails enviados com sucesso.`, sucesso === resultados.length ? 'sucesso' : 'erro');
            setSelecionados([]);
        } catch (err) {
            mostrarFeedback('Erro de conexão ao enviar os e-mails em lote.', 'erro');
        } finally {
            setProcessandoLote(false);
        }
    };

    const excluirEmLote = async () => {
        const ok = await confirmar(`Excluir ${selecionados.length} cliente(s) definitivamente?`, {
            detail: 'Essa ação não pode ser desfeita.',
            confirmText: 'Excluir todos',
            danger: true
        });
        if (!ok) return;

        setProcessandoLote(true);
        try {
            const resultados = await Promise.all(selecionados.map(id =>
                fetch(`${API_URL}/admin/clientes/${id}`, { method: 'DELETE' }).then(r => r.ok)
            ));
            const sucesso = resultados.filter(Boolean).length;
            mostrarFeedback(`${sucesso} de ${resultados.length} clientes excluídos.`, sucesso === resultados.length ? 'sucesso' : 'erro');
            setSelecionados([]);
            carregarClientes();
        } catch (err) {
            mostrarFeedback('Erro de conexão ao excluir em lote.', 'erro');
        } finally {
            setProcessandoLote(false);
        }
    };

    return (
        <div className="admin-page-container" style={s.container}>
            <header style={s.header}>
                <div>
                    <h2 style={s.title}><Icons.Users color="#111827" /> Clientes</h2>
                    <p style={s.subtitle}>Gerencie sua base de clientes, assinantes e disparos de follow-up.</p>
                </div>
            </header>

            {mensagem.texto && (
                <div style={{
                    ...s.alerta,
                    backgroundColor: mensagem.tipo === 'sucesso' ? '#ecfdf5' : '#fef2f2',
                    color: mensagem.tipo === 'sucesso' ? '#065f46' : '#991b1b',
                    border: `1px solid ${mensagem.tipo === 'sucesso' ? '#a7f3d0' : '#fecaca'}`
                }}>
                    {mensagem.tipo === 'sucesso' ? <Icons.CheckCircle color="#059669" /> : <Icons.Alert color="#dc2626" />}
                    <span>{mensagem.texto}</span>
                </div>
            )}

            {/* BARRA SUPERIOR: STATS + FILTROS */}
            <div style={s.barraTop}>
                <div style={s.statsRow}>
                    <div style={s.statPill}>
                        <span style={s.statNum}>{clientes.length}</span>
                        <span style={s.statLabel}>Total</span>
                    </div>
                    <div style={{ ...s.statPill, borderColor: '#c4b5fd' }}>
                        <span style={{ ...s.statNum, color: '#6d28d9' }}>{clientes.filter(c => c.assinante).length}</span>
                        <span style={s.statLabel}>Assinantes</span>
                    </div>
                    <div style={{ ...s.statPill, borderColor: '#fcd34d' }}>
                        <span style={{ ...s.statNum, color: '#92400e' }}>{clientes.filter(c => diasSemCortar(c.ultimo_agendamento) > 30).length}</span>
                        <span style={s.statLabel}>Inativos +30d</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        style={s.inputBusca}
                        placeholder="Buscar por nome, telefone ou e-mail..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                    />
                    <div style={s.filtrosBtns}>
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'assinantes', label: 'Assinantes' },
                            { key: 'inativos', label: 'Inativos +30d' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFiltro(f.key)}
                                style={{ ...s.btnFiltro, ...(filtro === f.key ? s.btnFiltroAtivo : {}) }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* BARRA DE AÇÕES EM LOTE */}
            {selecionados.length > 0 && (
                <div style={s.barraLote}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>
                        {selecionados.length} selecionado(s)
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <LoadingButton loading={processandoLote} onClick={enviarFollowUpEmLote} style={s.btnLote}>
                            <Icons.Mail color="#1d4ed8" /> Enviar "sentimos sua falta"
                        </LoadingButton>
                        <LoadingButton loading={processandoLote} onClick={excluirEmLote} style={{ ...s.btnLote, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                            <Icons.Trash color="#dc2626" /> Excluir selecionados
                        </LoadingButton>
                        <button onClick={() => setSelecionados([])} style={{ ...s.btnLote, background: 'none', border: 'none' }}>Limpar seleção</button>
                    </div>
                </div>
            )}

            {/* TABELA */}
            <div style={s.cardTabela}>
                <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                    <thead>
                        <tr>
                            <th style={{ ...s.th, width: '36px' }}>
                                <input type="checkbox" checked={todosVisiveisSelecionados} onChange={toggleSelecionarTodosVisiveis} style={{ cursor: 'pointer' }} title="Selecionar todos" />
                            </th>
                            <th style={s.th}>Cliente</th>
                            <th style={s.th}>Contato</th>
                            <th style={s.th}>Aniversário</th>
                            <th style={s.th}>Agendamentos</th>
                            <th style={s.th}>Último Corte</th>
                            <th style={s.th}>Plano</th>
                            <th style={{ ...s.th, textAlign: 'right' }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientesFiltrados.length > 0 ? clientesFiltrados.map(c => {
                            const dias = diasSemCortar(c.ultimo_agendamento);
                            const inativo = dias !== null && dias > 30;
                            const quaseInativo = dias !== null && dias > 14 && dias <= 30;
                            const aniversario = aniversarioHoje(c.data_nascimento);

                            return (
                                <tr key={c.id} style={{ ...s.tr, backgroundColor: selecionados.includes(c.id) ? '#eff6ff' : (aniversario ? '#fffbeb' : 'white') }}>
                                    <td style={s.td}>
                                        <input type="checkbox" checked={selecionados.includes(c.id)} onChange={() => toggleSelecionado(c.id)} style={{ cursor: 'pointer' }} />
                                    </td>
                                    <td style={s.td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={s.avatar}>
                                                {(c.nome_completo || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                    <strong style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>
                                                        {c.nome_completo}
                                                    </strong>
                                                    {c.assinante && <Icons.Diamond color="#6d28d9" />}
                                                    {aniversario && <Icons.Gift color="#d97706" />}
                                                </div>
                                                {c.assinante && <span style={s.badgeAssinante}>Assinante</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={s.td}>
                                        <span style={{ display: 'block', fontSize: '13px', color: '#374151', fontWeight: '500' }}>{c.telefone || '—'}</span>
                                        <span style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{c.email}</span>
                                    </td>
                                    <td style={s.td}>
                                        <span style={{ fontSize: '13px', fontWeight: aniversario ? '700' : '500', color: aniversario ? '#d97706' : '#374151' }}>
                                            {c.data_nascimento ? formatarDataSemFuso(c.data_nascimento, { somenteDiaMes: true }) : '—'}
                                        </span>
                                    </td>
                                    <td style={s.td}>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>{c.agendamentos_mes || 0}</span>
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}> / mês</span>
                                        <br />
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{c.agendamentos_ano || 0} / ano</span>
                                    </td>
                                    <td style={s.td}>
                                        {dias === null ? (
                                            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Nunca agendou</span>
                                        ) : (
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: inativo ? '#dc2626' : quaseInativo ? '#d97706' : '#059669' }}>
                                                {dias === 0 ? 'Hoje' : `${dias}d atrás`}
                                            </span>
                                        )}
                                    </td>
                                    <td style={s.td}>
                                        <span style={{
                                            display: 'inline-block', padding: '5px 12px',
                                            borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                            textTransform: 'uppercase', letterSpacing: '0.3px',
                                            backgroundColor: c.assinante ? '#ede9fe' : '#f3f4f6',
                                            color: c.assinante ? '#6d28d9' : '#6b7280',
                                            border: c.assinante ? '1px solid #c4b5fd' : '1px solid #e5e7eb'
                                        }}>
                                            {c.assinante ? 'Assinante' : 'Comum'}
                                        </span>
                                    </td>
                                    <td style={{ ...s.td, textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                            <button onClick={() => { setClienteSelecionado({ ...c, telefone: formatarTelefone(c.telefone || '') }); setSugestaoIA(''); setMostrarBaixaManual(false); setBaixaObservacoes(''); setPixAssinaturaInfo(null); }} style={s.btnIcone} title="Editar">
                                                <Icons.Edit color="#4b5563" />
                                            </button>
                                            <button
                                                onClick={() => enviarFollowUp(c, 'saudade', 'email')}
                                                disabled={loadingId === c.id + 'saudadeemail'}
                                                style={{ ...s.btnIcone, backgroundColor: '#eff6ff' }}
                                                title="Enviar 'Sentimos sua falta' por e-mail"
                                            >
                                                <Icons.Mail color="#1d4ed8" />
                                            </button>
                                            {permiteWhatsapp && c.telefone && (
                                                <button
                                                    onClick={() => enviarFollowUp(c, 'saudade', 'whatsapp')}
                                                    disabled={loadingId === c.id + 'saudadewhatsapp'}
                                                    style={{ ...s.btnIcone, backgroundColor: '#ecfdf5' }}
                                                    title="Enviar 'Sentimos sua falta' por WhatsApp"
                                                >
                                                    <Icons.Whatsapp color="#059669" />
                                                </button>
                                            )}
                                            {aniversario && (
                                                <button
                                                    onClick={() => enviarFollowUp(c, 'aniversario', 'email')}
                                                    disabled={loadingId === c.id + 'aniversarioemail'}
                                                    style={{ ...s.btnIcone, backgroundColor: '#fffbeb' }}
                                                    title="Enviar parabéns por e-mail"
                                                >
                                                    <Icons.Gift color="#d97706" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="8" style={{ padding: '50px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                                    Nenhum cliente encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* MODAL DE EDIÇÃO */}
            {clienteSelecionado && (
                <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) setClienteSelecionado(null); }}>
                    <div style={s.modal}>
                        <div style={s.modalHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ ...s.avatar, width: '48px', height: '48px', fontSize: '18px' }}>
                                    {(clienteSelecionado.nome_completo || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#111827' }}>
                                            {clienteSelecionado.nome_completo}
                                        </h3>
                                        {clienteSelecionado.assinante && <Icons.Diamond color="#6d28d9" size={16} />}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                        {clienteSelecionado.assinante && <span style={s.badgeAssinante}>Assinante</span>}
                                        {riscoFaltas && (riscoFaltas.risco === 'alto' || riscoFaltas.risco === 'medio') && (
                                            <span
                                                title={`${riscoFaltas.faltas} de ${riscoFaltas.total} atendimentos passados cancelados ou sem comparecimento (${riscoFaltas.percentual}%)`}
                                                style={{ ...s.badgeAssinante, backgroundColor: riscoFaltas.risco === 'alto' ? '#fef2f2' : '#fffbeb', color: riscoFaltas.risco === 'alto' ? '#dc2626' : '#b45309' }}
                                            >
                                                ⚠️ Risco de falta {riscoFaltas.risco === 'alto' ? 'alto' : 'médio'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setClienteSelecionado(null)} style={s.btnFechar}>✕</button>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {[
                                { valor: clienteSelecionado.agendamentos_mes || 0, label: 'Agend. no mês', cor: '#6366f1' },
                                { valor: clienteSelecionado.agendamentos_ano || 0, label: 'Agend. no ano', cor: '#059669' },
                                {
                                    valor: diasSemCortar(clienteSelecionado.ultimo_agendamento) === null ? '—' : `${diasSemCortar(clienteSelecionado.ultimo_agendamento)}d`,
                                    label: 'Dias sem cortar',
                                    cor: diasSemCortar(clienteSelecionado.ultimo_agendamento) > 30 ? '#dc2626' : '#111827'
                                }
                            ].map((item, i) => (
                                <div key={i} style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '14px 10px', textAlign: 'center' }}>
                                    <strong style={{ fontSize: '24px', fontWeight: '800', color: item.cor, display: 'block' }}>{item.valor}</strong>
                                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Campos */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            {[
                                { label: 'Nome Completo', key: 'nome_completo', type: 'text' },
                                { label: 'Telefone', key: 'telefone', type: 'text' },
                                { label: 'E-mail', key: 'email', type: 'email' },
                                { label: 'Data de Nascimento', key: 'data_nascimento', type: 'date' },
                            ].map(campo => {
                                const valorCampo = campo.key === 'data_nascimento'
                                    ? (clienteSelecionado[campo.key]?.split('T')[0] || '')
                                    : (clienteSelecionado[campo.key] || '');
                                const emailInvalido = campo.key === 'email' && valorCampo.length > 0 && !emailValido(valorCampo);
                                return (
                                    <div key={campo.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={s.label}>{campo.label}</label>
                                        <input
                                            type={campo.type}
                                            style={{ ...s.inputModal, ...(emailInvalido ? { borderColor: '#dc2626' } : {}) }}
                                            maxLength={campo.key === 'telefone' ? 15 : undefined}
                                            value={valorCampo}
                                            onChange={e => setClienteSelecionado(p => ({
                                                ...p,
                                                [campo.key]: campo.key === 'telefone' ? formatarTelefone(e.target.value) : e.target.value
                                            }))}
                                        />
                                        {emailInvalido && <small style={{ color: '#dc2626', fontSize: '11px' }}>Formato de e-mail inválido.</small>}
                                    </div>
                                );
                            })}
                            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={s.label}>Notas Internas</label>
                                <textarea
                                    style={{ ...s.inputModal, height: '75px', resize: 'vertical' }}
                                    placeholder="Preferências, observações sobre o cliente..."
                                    value={clienteSelecionado.notas || ''}
                                    onChange={e => setClienteSelecionado(p => ({ ...p, notas: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Painel assinatura */}
                        <div style={{ borderRadius: '10px', padding: '16px', backgroundColor: clienteSelecionado.assinante ? '#faf5ff' : '#f9fafb', border: `1px solid ${clienteSelecionado.assinante ? '#c4b5fd' : '#e5e7eb'}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Icons.Diamond color={clienteSelecionado.assinante ? '#6d28d9' : '#9ca3af'} size={18} />
                                    <div>
                                        <strong style={{ fontSize: '14px', color: clienteSelecionado.assinante ? '#6d28d9' : '#374151', display: 'block' }}>Plano Assinante</strong>
                                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{clienteSelecionado.assinante ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (clienteSelecionado.assinante) {
                                            setClienteSelecionado(prev => ({ ...prev, assinante: 0, plano_id: null }));
                                            return;
                                        }
                                        // O backend deriva "assinante" da presença de plano_id (ver
                                        // routes/assinaturas.js) — sem um plano escolhido, "Ativar" marcava
                                        // assinante=1 no state local só pra "Salvar Alterações" enviar
                                        // plano_id=null, que no servidor não ativa nada: o modal fechava
                                        // com "Cliente atualizado com sucesso" mas a assinatura nunca saía
                                        // do papel.
                                        if (!clienteSelecionado.plano_id) {
                                            if (planosDisponiveis.length === 0) {
                                                return mostrarFeedback('Cadastre um plano de assinatura antes de ativar um cliente.', 'erro');
                                            }
                                            return mostrarFeedback('Escolha um plano no campo abaixo para ativar a assinatura.', 'erro');
                                        }
                                        setClienteSelecionado(prev => ({ ...prev, assinante: 1 }));
                                    }}
                                    style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: clienteSelecionado.assinante ? '#dc2626' : '#6d28d9', color: '#fff' }}
                                >
                                    {clienteSelecionado.assinante ? 'Remover' : 'Ativar'}
                                </button>
                            </div>
                            {planosDisponiveis.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <label style={s.label}>Plano Vinculado</label>
                                    <select style={{ ...s.inputModal, cursor: 'pointer' }} value={clienteSelecionado.plano_id || ''} onChange={e => setClienteSelecionado(prev => ({ ...prev, plano_id: e.target.value ? Number(e.target.value) : null, assinante: e.target.value ? 1 : 0 }))}>
                                        <option value=''>Sem plano (cliente comum)</option>
                                        {planosDisponiveis.map(p => (
                                            <option key={p.id} value={p.id}>{p.nome} · R$ {parseFloat(p.preco).toFixed(2).replace('.', ',')}/mês</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {!!clienteSelecionado.assinante && !!clienteSelecionado.plano_id && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
                                            backgroundColor: clienteSelecionado.status_assinatura === 'inadimplente' ? '#fee2e2' : '#d1fae5',
                                            color: clienteSelecionado.status_assinatura === 'inadimplente' ? '#991b1b' : '#065f46'
                                        }}>
                                            {clienteSelecionado.status_assinatura === 'inadimplente' ? 'Mensalidade em atraso' : 'Mensalidade em dia'}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                            Cobrança automática: {clienteSelecionado.assinatura_forma_pagamento === 'pix' ? 'Pix' : clienteSelecionado.assinatura_forma_pagamento === 'cartao' ? 'Cartão' : 'não configurada (cliente configura pelo próprio perfil, ou gere um Pix abaixo)'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => setMostrarBaixaManual(v => !v)}
                                            style={{ ...s.btnFollowUp, backgroundColor: '#eff6ff', color: '#1d4ed8' }}
                                        >
                                            Dar baixa manual
                                        </button>
                                        {clienteSelecionado.assinatura_forma_pagamento ? (
                                            <LoadingButton
                                                loading={loadingId === clienteSelecionado.id + 'cobrar'}
                                                onClick={() => cobrarAgora(clienteSelecionado)}
                                                style={{ ...s.btnFollowUp, backgroundColor: '#fff7ed', color: '#c2410c', border: 'none' }}
                                            >
                                                Cobrar agora
                                            </LoadingButton>
                                        ) : (
                                            <LoadingButton
                                                loading={loadingId === clienteSelecionado.id + 'cobrar'}
                                                onClick={() => cobrarAgora(clienteSelecionado, 'pix')}
                                                style={{ ...s.btnFollowUp, backgroundColor: '#ecfdf5', color: '#059669', border: 'none' }}
                                            >
                                                Gerar Pix e configurar cobrança automática
                                            </LoadingButton>
                                        )}
                                    </div>

                                    {pixAssinaturaInfo && (
                                        <div style={{ textAlign: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px' }}>
                                            {pixAssinaturaInfo.qr_code_base64 && (
                                                <img
                                                    src={`data:image/png;base64,${pixAssinaturaInfo.qr_code_base64}`}
                                                    alt="QR Code do Pix da assinatura"
                                                    style={{ width: '160px', maxWidth: '100%', height: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '6px', background: '#fff' }}
                                                />
                                            )}
                                            <div style={{ marginTop: '8px' }}>
                                                <button type="button" onClick={copiarCodigoPixAssinatura} style={{ ...s.btnFollowUp, backgroundColor: '#fff' }}>Copiar código Pix</button>
                                            </div>
                                            <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af' }}>Já enviado por e-mail/WhatsApp pro cliente — dá baixa automaticamente quando for pago.</p>
                                        </div>
                                    )}

                                    {mostrarBaixaManual && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px' }}>
                                            <label style={s.label}>Forma de pagamento</label>
                                            <select style={{ ...s.inputModal, cursor: 'pointer' }} value={baixaFormaPagamento} onChange={e => setBaixaFormaPagamento(e.target.value)}>
                                                <option value='dinheiro'>Dinheiro</option>
                                                <option value='pix'>Pix (chave da barbearia)</option>
                                                <option value='credito'>Cartão de crédito (fora do Mercado Pago)</option>
                                                <option value='debito'>Cartão de débito (fora do Mercado Pago)</option>
                                            </select>
                                            <label style={s.label}>Observações (opcional)</label>
                                            <textarea
                                                style={{ ...s.inputModal, minHeight: '50px', resize: 'vertical' }}
                                                value={baixaObservacoes}
                                                onChange={e => setBaixaObservacoes(e.target.value)}
                                                placeholder="Ex: pago no balcão junto com o corte de hoje"
                                            />
                                            <LoadingButton
                                                loading={loadingId === clienteSelecionado.id + 'baixa'}
                                                onClick={() => darBaixaManual(clienteSelecionado)}
                                                style={s.btnSalvarModal}
                                            >
                                                Confirmar baixa
                                            </LoadingButton>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {permiteIA && (
                            <div style={s.cardSugestaoIA}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>✨ Sugestão de mensagem com IA</span>
                                    <button onClick={() => gerarSugestaoFollowUp(clienteSelecionado)} disabled={gerandoSugestao} style={s.btnGerarSugestao}>
                                        {gerandoSugestao ? 'Gerando...' : 'Gerar'}
                                    </button>
                                </div>
                                {sugestaoIA && <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>{sugestaoIA}</p>}
                            </div>
                        )}

                        {/* Botões */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <LoadingButton loading={salvandoEdicao} onClick={salvarEdicao} style={s.btnSalvarModal}>Salvar Alterações</LoadingButton>
                            <button onClick={() => enviarFollowUp(clienteSelecionado, 'saudade', 'email')} style={s.btnFollowUp}>
                                <Icons.Mail color="#1d4ed8" /> Sentimos sua falta (e-mail)
                            </button>
                            {permiteWhatsapp && clienteSelecionado.telefone && (
                                <button onClick={() => enviarFollowUp(clienteSelecionado, 'saudade', 'whatsapp')} style={{ ...s.btnFollowUp, backgroundColor: '#ecfdf5', color: '#059669' }}>
                                    <Icons.Whatsapp color="#059669" /> Por WhatsApp
                                </button>
                            )}
                            <button onClick={() => excluirCliente(clienteSelecionado.id, clienteSelecionado.nome_completo)} style={s.btnExcluir} title="Excluir cliente">
                                <Icons.Trash color="#dc2626" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const Icons = {
    Users: ({ color }) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'bottom' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    Edit: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    Trash: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    Mail: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
    Gift: ({ color }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>,
    Whatsapp: ({ color }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>,
    Diamond: ({ color, size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>,
    CheckCircle: ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
    Alert: ({ color }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
};

const s = {
    container: { padding: '40px', maxWidth: '1300px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
    header: { marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
    title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
    subtitle: { color: '#6b7280', fontSize: '15px', margin: 0 },
    alerta: { padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' },
    barraTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' },
    statsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    statPill: { background: '#fff', border: '1px solid #e5e7eb', padding: '12px 20px', borderRadius: '10px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    statNum: { fontSize: '22px', fontWeight: '800', color: '#111827', lineHeight: 1 },
    statLabel: { fontSize: '12px', color: '#6b7280', fontWeight: '500' },
    inputBusca: { padding: '11px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', width: '100%', maxWidth: '280px', color: '#111827', boxSizing: 'border-box' },
    filtrosBtns: { display: 'flex', gap: '6px' },
    btnFiltro: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#6b7280', transition: '0.2s', whiteSpace: 'nowrap' },
    btnFiltroAtivo: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', border: '1px solid #2554eb', fontWeight: '700' },
    barraLote: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', flexWrap: 'wrap' },
    btnLote: { padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', cursor: 'pointer', fontWeight: '600', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
    cardTabela: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f3f4f6' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '13px 20px', background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' },
    tr: { borderBottom: '1px solid #f3f4f6' },
    td: { padding: '15px 20px', fontSize: '13px', verticalAlign: 'middle', color: '#374151' },
    avatar: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#334155', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 },
    badgeAssinante: { background: '#ede9fe', color: '#6d28d9', fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.3px' },
    btnPlano: { padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.3px' },
    btnIcone: { background: '#f3f4f6', border: 'none', padding: '7px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 },
    modal: { backgroundColor: '#fff', padding: '30px', borderRadius: '14px', width: '90%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '18px', borderBottom: '1px solid #f0f0f0' },
    btnFechar: { background: 'none', border: 'none', fontSize: '18px', color: '#9ca3af', cursor: 'pointer', lineHeight: 1 },
    label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
    inputModal: { padding: '11px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#111827' },
    btnSalvarModal: { flex: 2, padding: '12px', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
    btnFollowUp: { flex: 2, padding: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
    cardSugestaoIA: { background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '14px', marginBottom: '14px' },
    btnGerarSugestao: { padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#6d28d9', color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer' },
    btnExcluir: { padding: '12px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default AdminClientes;