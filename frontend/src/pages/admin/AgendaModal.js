import React, { useEffect, useState, useCallback } from 'react';
import { formatarTelefone } from '../../utils/telefone';
import { emailValido } from '../../utils/validacao';
import { useToast } from '../../components/Toast';
import useEscToClose from '../../hooks/useEscToClose';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

function AgendaModal({ barbeiro, empresaId, dataSelecionada, horaPreSelecionada, agendamentoCheckout, onClose }) {
    const toast = useToast();
    useEscToClose(true, onClose);

    const [modo, setModo] = useState('lista');
    const [confirmando, setConfirmando] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [atualizandoStatus, setAtualizandoStatus] = useState(false);
    const [agendamentos, setAgendamentos] = useState([]);
    const [servicos, setServicos] = useState([]);
    const [servicosSelecionados, setServicosSelecionados] = useState([]);
    const [horaAtiva, setHoraAtiva] = useState(null);

    const [buscaCliente, setBuscaCliente] = useState('');
    const [clientesEncontrados, setClientesEncontrados] = useState([]);
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    
    // Formulário de cliente completo com os 5 campos exigidos
    const [novoCliente, setNovoCliente] = useState({ nome: '', email: '', senha: '', tel: '', nasc: '' });

    const [modalFinalizar, setModalFinalizar] = useState(null);
    const [modalCancelamento, setModalCancelamento] = useState(null);
    const [justificativaCanc, setJustificativaCanc] = useState('');
    const [estoque, setEstoque] = useState([]);
    const [extrasSelecionados, setExtrasSelecionados] = useState([]);
    const [assinaturaCheckout, setAssinaturaCheckout] = useState({ assinante: false, servicos_ids: [], servicos_agendados_ids: [] });

    const dataFormatadaBr = dataSelecionada ? dataSelecionada.split('-').reverse().slice(0, 2).join('/') : '';

    useEffect(() => {
        if (agendamentoCheckout) {
            const agSeguro = { ...agendamentoCheckout, servicos: agendamentoCheckout.servicos || agendamentoCheckout.servico_nome || 'Serviço Padrão' };
            setModalFinalizar(agSeguro);
            setModo('lista');
        } else if (horaPreSelecionada) {
            setModo('adicionar');
            setHoraAtiva(horaPreSelecionada);
        } else {
            setModo('lista');
            setHoraAtiva(null);
        }
    }, [horaPreSelecionada, agendamentoCheckout]);

    const gerarHorarios = () => {
        const slots = [];
        for (let h = 8; h <= 20; h++) {
            for (let m = 0; m < 60; m += 15) {
                if (h === 20 && m > 0) continue;
                slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }
        return slots;
    };
    const todosHorarios = gerarHorarios();

    const carregarDados = useCallback(async () => {
        if (!empresaId || !barbeiro?.id || !dataSelecionada) return;
        try {
            const [resAgs, resServicos, resEstoque] = await Promise.all([
                fetch(`${API_URL}/admin/agendamentos/${empresaId}?dataInicio=${dataSelecionada}&dataFim=${dataSelecionada}`),
                fetch(`${API_URL}/admin/servicos?empresa=${empresaId}`),
                fetch(`${API_URL}/admin/estoque/${empresaId}`)
            ]);

            if (resAgs.ok) {
                const ags = await resAgs.json();
                setAgendamentos(ags.filter(ag => ag.barbeiro_id === barbeiro.id && (ag.data === dataSelecionada || (ag.data_hora && ag.data_hora.includes(dataSelecionada)))));
            }
            if (resServicos.ok) setServicos(await resServicos.json());
            if (resEstoque.ok) setEstoque(await resEstoque.json());
        } catch (err) { console.error(err); }
    }, [empresaId, barbeiro, dataSelecionada]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    useEffect(() => {
        if (buscaCliente.length > 2) {
            const delayDebounceFn = setTimeout(async () => {
                try {
                    const res = await fetch(`${API_URL}/admin/buscar-clientes?q=${encodeURIComponent(buscaCliente)}&empresa_id=${empresaId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setClientesEncontrados(Array.isArray(data) ? data : []);
                    }
                } catch (e) {
                    setClientesEncontrados([]);
                }
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setClientesEncontrados([]);
        }
    }, [buscaCliente, empresaId]);

const toggleServico = (servico) => {
        if (servicosSelecionados.find(s => s.id === servico.id)) {
            setServicosSelecionados(servicosSelecionados.filter(s => s.id !== servico.id));
        } else {
            setServicosSelecionados([...servicosSelecionados, servico]);
        }
    };

    // Mesma definição usada em AdminAgendamentos.js e AdminDashboard.js: "não compareceu" não é
    // um status real no banco, é calculado por tempo decorrido além da tolerância de 10min.
    const ehNaoCompareceu = (ag) => {
        if (!ag || ag.status === 'cancelado' || ag.status === 'concluido') return false;
        if (!ag.data || !ag.hora) return false;
        const dataAg = new Date(`${ag.data}T${ag.hora}`);
        const tolerancia = new Date(dataAg.getTime() + 10 * 60000);
        return new Date() > tolerancia;
    };

    const getStatusVisual = (ag) => {
        if (ag.status === 'cancelado') return { bg: '#fee2e2', cor: '#dc2626', label: 'cancelado' };
        if (ag.status === 'concluido') return { bg: '#d1fae5', cor: '#059669', label: 'Concluído' };
        if (ehNaoCompareceu(ag)) return { bg: '#f3f4f6', cor: '#4b5563', label: 'não compareceu' };
        return { bg: '#fef3c7', cor: '#d97706', label: ag.status };
    };

    const handleConfirmar = async () => {
        if (!horaAtiva) return toast.error("Selecione um horário.");
        if (servicosSelecionados.length === 0) return toast.error("Selecione ao menos um serviço.");
        if (!clienteSelecionado && !novoCliente.nome) return toast.error("Selecione ou crie um cliente.");

        if (!clienteSelecionado && (!novoCliente.nome || !novoCliente.tel || !novoCliente.senha || !novoCliente.email || !novoCliente.nasc)) {
            return toast.error("Preencha todos os campos para registrar o novo cliente.");
        }
        if (!clienteSelecionado && !emailValido(novoCliente.email)) {
            return toast.error("Insira um e-mail válido para o novo cliente.");
        }

        setConfirmando(true);
        let clienteIdFinal = clienteSelecionado?.id;

        if (!clienteSelecionado) {
            try {
                const resCriar = await fetch(`${API_URL}/admin/clientes/rapido`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: novoCliente.nome,
                        email: novoCliente.email,
                        senha: novoCliente.senha,
                        tel: novoCliente.tel,
                        nasc: novoCliente.nasc,
                        empresa_id: empresaId
                    })
                });
                const dataCriar = await resCriar.json();
                if (resCriar.ok && dataCriar.id) {
                    clienteIdFinal = dataCriar.id;
                } else {
                    setConfirmando(false);
                    return toast.error('Erro ao cadastrar cliente: ' + (dataCriar.error || 'Verifique os dados.'));
                }
            } catch (e) {
                console.error('Erro criar cliente:', e);
                setConfirmando(false);
                return toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
            }
        }

        try {
            const resAgendar = await fetch(`${API_URL}/admin/agendar-encaixe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empresa_id: empresaId,
                    barbeiro_id: barbeiro.id,
                    usuario_id: clienteIdFinal,
                    cliente_nome: clienteSelecionado
                        ? (clienteSelecionado.nome || clienteSelecionado.nome_completo)
                        : novoCliente.nome,
                    data_hora: `${dataSelecionada} ${horaAtiva}:00`,
                    servicos: servicosSelecionados
                })
            });
            const dataAgendar = await resAgendar.json();
            if (resAgendar.ok && dataAgendar.success) {
                toast.success('Encaixe concluído com sucesso!');
                setModo('lista');
                setHoraAtiva(null);
                setServicosSelecionados([]);
                setClienteSelecionado(null);
                setNovoCliente({ nome: '', email: '', senha: '', tel: '', nasc: '' });
                onClose();
            } else {
                toast.error('Erro ao agendar: ' + (dataAgendar.error || 'Tente novamente.'));
            }
        } catch (errAg) {
            console.error('Erro agendar:', errAg);
            toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
        } finally {
            setConfirmando(false);
        }
    };

    const handleAtualizarStatus = async (id, novoStatus) => {
        const bodyData = { status: novoStatus };
        if (novoStatus === 'cancelado') {
            bodyData.justificativa = justificativaCanc;
            if (!justificativaCanc) return toast.error("Digite o motivo do cancelamento.");
        }

        setAtualizandoStatus(true);
        try {
            const res = await fetch(`${API_URL}/admin/agendamentos/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (res.ok) {
                setModalCancelamento(null);
                setJustificativaCanc('');
                carregarDados();
                toast.success('Agendamento cancelado.');
                onClose();
            } else {
                toast.error('Não foi possível cancelar o agendamento. Tente novamente.');
            }
        } catch (err) {
            toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
        } finally {
            setAtualizandoStatus(false);
        }
    };

    const subModalStyles = {
        overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, borderRadius: '15px' },
        card: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '360px' },
        cardCheckout: { background: 'white', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflowY: 'auto' },
        clientBadge: { background: '#f8f9fa', padding: '15px', borderRadius: '10px', borderLeft: '5px solid #28a745', marginBottom: '15px' },
        label: { fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '4px', display: 'block', textTransform: 'uppercase' },
        btnConfirm: { flex: 1, padding: '15px', borderRadius: '8px', border: 'none', background: '#333', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
        btnCancel: { flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', color: '#666', cursor: 'pointer' },
        btnQtd: { width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', transition: '0.2s', padding: 0, lineHeight: 0 },
    };

    const handleFinalizarAtendimento = async () => {
        setFinalizando(true);
        try {
            const produtosVendidos = extrasSelecionados.filter(e => e.tipo === 'produto');
            const servicosAdd = extrasSelecionados.filter(e => e.tipo === 'servico');

            const res = await fetch(`${API_URL}/admin/finalizar-servico-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agendamento_id: modalFinalizar.id,
                    produtos_vendidos: produtosVendidos,
                    servicos_adicionais: servicosAdd
                })
            });

            if (res.ok) {
                toast.success("Atendimento finalizado com sucesso!");
                setModalFinalizar(null);
                setExtrasSelecionados([]);
                carregarDados();
                onClose();
            } else {
                toast.error("Não foi possível finalizar o atendimento. Tente novamente.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
        } finally {
            setFinalizando(false);
        }
    };

    // VALOR BASE AGORA LÊ CORRETAMENTE
    useEffect(() => {
        if (!modalFinalizar?.id) { setAssinaturaCheckout({ assinante: false, servicos_ids: [], servicos_agendados_ids: [] }); return; }
        fetch(`${API_URL}/admin/agendamento-usuario/${modalFinalizar.id}`)
            .then(r => r.json())
            .then(d => {
                console.log('DIAGNOSTICO >>> agendamento_id:', modalFinalizar.id, '| empresaId (modal):', empresaId, '| resposta:', d);
                setAssinaturaCheckout({ assinante: !!d.assinante, servicos_ids: d.servicos_ids || [], servicos_agendados_ids: d.servicos_agendados_ids || [] });
            })
            .catch(() => setAssinaturaCheckout({ assinante: false, servicos_ids: [], servicos_agendados_ids: [] }));
    }, [modalFinalizar]);

    const getValorBaseSeguro = () => {
        if (!modalFinalizar) return 0;
        const valorTotal = parseFloat(String(modalFinalizar.valor_total || '0').replace(',', '.')) || 0;
        if (!assinaturaCheckout.assinante || assinaturaCheckout.servicos_ids.length === 0) return valorTotal;
        // Desconta servicos que estao no plano E foram agendados
        const idsDescontar = assinaturaCheckout.servicos_agendados_ids.filter(id => assinaturaCheckout.servicos_ids.includes(id));
        if (idsDescontar.length === 0) return valorTotal;
        // Forcar Number em ambos para evitar mismatch string vs number
        const idsDescontarNum = idsDescontar.map(Number);
        const descontoPlano = servicos
            .filter(s => idsDescontarNum.includes(Number(s.id)))
            .reduce((acc, s) => acc + (parseFloat(String(s.valor || s.preco || '0').replace(',', '.')) || 0), 0);
        console.log('Desconto final:', descontoPlano, 'idsDescontar:', idsDescontarNum, 'servicos ids:', servicos.map(s=>Number(s.id)));
        return Math.max(0, valorTotal - descontoPlano);
    };

    const getValorAdicionais = () => {
        return extrasSelecionados.reduce((acc, curr) => {
            const valor = parseFloat(String(curr.valor || curr.preco || '0').replace(',', '.')) || 0;
            const qtd = curr.quantidade || 1;
            return acc + (valor * qtd);
        }, 0);
    };

    return (
        <div style={styles.overlay} onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
            <div style={styles.modal}>
                
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {barbeiro.foto_url ? (
                            <img src={barbeiro.foto_url} alt="Profissional" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {barbeiro.nome.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>{barbeiro.nome}</h3>
                            <span style={{ fontSize: '13px', color: '#666' }}>{dataFormatadaBr}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                <div style={styles.tabs}>
                    <button style={modo === 'lista' ? styles.tabAtiva : styles.tab} onClick={() => { setModo('lista'); setHoraAtiva(null); }}>
                        Ver Agenda
                    </button>
                    <button style={modo === 'adicionar' ? styles.tabAtiva : styles.tab} onClick={() => setModo('adicionar')}>
                        {horaPreSelecionada || horaAtiva ? `Encaixe às ${horaPreSelecionada || horaAtiva}` : '+ Novo Agendamento'}
                    </button>
                </div>

                <div style={styles.content}>
                    
                    {modo === 'lista' && (
                        <div style={styles.horariosGrid}>
                            {todosHorarios.map(hora => {
                                const ag = agendamentos.find(a => a.hora === hora);
                                if (ag) {
                                    const st = getStatusVisual(ag);
                                    return (
                                        <div key={hora} style={{...styles.slotOcupado, borderLeft: `5px solid ${st.cor}`}}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <strong style={{ fontSize: '16px' }}>{hora}</strong>
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '10px', background: st.bg, color: st.cor, textTransform: 'uppercase' }}>
                                                    {st.label}
                                                </span>
                                            </div>
                                            <strong style={{ display: 'block', fontSize: '14px', color: '#333' }}>{ag.cliente_nome}</strong>
                                            <p style={{ margin: '2px 0 10px 0', fontSize: '12px', color: '#666' }}>{ag.servicos || ag.servico_nome}</p>
                                            
                                            <div style={{ display: 'flex', gap: '5px', marginTop: 'auto' }}>
                                                {ag.status === 'pendente' || ag.status === 'confirmado' ? (
                                                    <>
                                                        <button 
                                                            style={{...styles.btnAcao, background: '#10b981', color: '#fff', flex: 1}} 
                                                            onClick={() => {
                                                                const agSeguro = { ...ag, servicos: ag.servicos || ag.servico_nome || '' };
                                                                setModalFinalizar(agSeguro);
                                                            }}
                                                        >
                                                            Finalizar / PDV
                                                        </button>
                                                        <button style={{...styles.btnAcao, background: '#fef2f2', color: '#dc2626'}} onClick={() => setModalCancelamento(ag)}>X</button>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>Ações bloqueadas para este status.</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div key={hora} style={styles.slotLivre} onClick={() => { setHoraAtiva(hora); setModo('adicionar'); }}>
                                            <strong style={{ fontSize: '16px', color: '#999' }}>{hora}</strong>
                                            <span style={{ fontSize: '12px', color: '#ccc' }}>Livre (Clique para encaixar)</span>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    )}

                    {modo === 'adicionar' && (
                        <div style={styles.formAdicionar}>
                            
                            {horaPreSelecionada || horaAtiva ? (
                                <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', marginBottom: '15px' }}>
                                    <strong style={{ color: '#92400e', fontSize: '14px' }}>Horário do Encaixe: {horaPreSelecionada || horaAtiva}</strong>
                                </div>
                            ) : (
                                <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '15px', background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
                                    Nenhum horário selecionado. Volte para a aba "Ver Agenda" e clique em um horário livre.
                                </div>
                            )}

                            <label style={styles.label}>1. Busque o Cliente</label>
                            
                            {clienteSelecionado ? (
                                <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <strong style={{ display: 'block', color: '#065f46' }}>{clienteSelecionado.nome || clienteSelecionado.nome_completo}</strong>
                                        <span style={{ fontSize: '12px', color: '#047857' }}>{clienteSelecionado.telefone || clienteSelecionado.tel}</span>
                                    </div>
                                    <button onClick={() => setClienteSelecionado(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>Trocar</button>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '20px', position: 'relative' }}>
                                    <input 
                                        style={styles.input} 
                                        placeholder="Buscar por nome..." 
                                        value={buscaCliente}
                                        onChange={e => setBuscaCliente(e.target.value)}
                                    />
                                    
                                    {clientesEncontrados.length > 0 && (
                                        <div style={{ position: 'absolute', top: '45px', left: 0, right: 0, background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999 }}>
                                            {clientesEncontrados.map(c => (
                                                <div key={c.id} style={{ padding: '12px 15px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: '#fff' }} onClick={() => { setClienteSelecionado(c); setBuscaCliente(''); setClientesEncontrados([]); }}>
                                                    <strong style={{ display: 'block', fontSize: '14px', color: '#111827' }}>
                                                        {c.nome || c.nome_completo || 'Cliente'} | {c.telefone || c.tel || 'Sem número'}
                                                    </strong>
                                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{c.email}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ textAlign: 'center', margin: '15px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' }}>OU CADASTRAR NOVO CLIENTE</div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <input style={{...styles.input, gridColumn: 'span 2', marginBottom: 0}} placeholder="Nome Completo *" value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} />
                                        <input style={{...styles.input, marginBottom: 0}} placeholder="WhatsApp *" value={novoCliente.tel} onChange={e => setNovoCliente({...novoCliente, tel: formatarTelefone(e.target.value)})} maxLength="15" />
                                        <input
                                            style={{...styles.input, marginBottom: 0, ...(novoCliente.email && !emailValido(novoCliente.email) ? { borderColor: '#dc2626' } : {})}}
                                            placeholder="E-mail *"
                                            type="email"
                                            value={novoCliente.email}
                                            onChange={e => setNovoCliente({...novoCliente, email: e.target.value})}
                                        />
                                        <input style={{...styles.input, marginBottom: 0}} placeholder="Senha (Para o app) *" type="password" value={novoCliente.senha} onChange={e => setNovoCliente({...novoCliente, senha: e.target.value})} />
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>Data de Nasc. *</span>
                                            <input style={{...styles.input, marginBottom: 0, width: '100%'}} type="date" value={novoCliente.nasc} onChange={e => setNovoCliente({...novoCliente, nasc: e.target.value})} />
                                        </div>
                                    </div>
                                    <small style={{display: 'block', color: '#9ca3af', fontSize: '11px', marginTop: '8px'}}>* Todos os campos são obrigatórios.</small>
                                </div>
                            )}

                            <label style={styles.label}>2. Escolha os Serviços</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                {servicos.map(s => {
                                    const isSel = servicosSelecionados.find(sel => sel.id === s.id);
                                    return (
                                        <div key={s.id} onClick={() => toggleServico(s)} style={{ padding: '10px', border: `1px solid ${isSel ? '#111827' : '#e5e7eb'}`, background: isSel ? '#111827' : '#f9fafb', color: isSel ? '#fff' : '#333', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontSize: '13px', transition: '0.2s' }}>
                                            <strong style={{ display: 'block' }}>{s.nome}</strong>
                                            <span>R$ {s.preco || s.valor}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <LoadingButton onClick={handleConfirmar} loading={confirmando} style={{...styles.btnSalvar, width: '100%', padding: '15px', fontSize: '16px' }} disabled={!horaAtiva}>
                                Concluir Agendamento
                            </LoadingButton>
                        </div>
                    )}

                </div>
            </div>

            {/* CHECKOUT / PDV */}
            {modalFinalizar && (
                <div style={subModalStyles.overlay}>
                    <div style={subModalStyles.cardCheckout}>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#111827' }}>Finalizar Atendimento (PDV)</h3>
                        
                        <div style={subModalStyles.clientBadge}>
                            <strong style={{ display: 'block', fontSize: '16px', color: '#111827' }}>{modalFinalizar.cliente_nome}</strong>
                            <span style={{ fontSize: '13px', color: '#059669', fontWeight: 'bold' }}>{modalFinalizar.servicos}</span>
                        </div>

                        <label style={subModalStyles.label}>Adicionar Mais Serviços:</label>
                        <div style={{ maxHeight: '130px', overflowY: 'auto', marginBottom: '15px', border: '1px solid #f0f0f0', padding: '5px', borderRadius: '8px', background: '#f9fafb' }}>
                            {servicos.map(s => {
                                // Comparação exata contra a lista já dividida, não substring da
                                // string toda: "Corte" dentro de "Corte Infantil" não pode
                                // contar como "já incluso" e bloquear o profissional de
                                // adicioná-lo de verdade no checkout.
                                const nomesJaAgendados = modalFinalizar.servicos.split(' + ').map(n => n.trim());
                                const jaAgendado = nomesJaAgendados.includes(s.nome);
                                const selecionado = extrasSelecionados.some(item => item.id === s.id && item.tipo === 'servico');
                                
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => {
                                            if (jaAgendado) return;
                                            setExtrasSelecionados(prev => 
                                                selecionado 
                                                ? prev.filter(item => !(item.id === s.id && item.tipo === 'servico')) 
                                                : [...prev, { id: s.id, nome: s.nome, valor: s.valor || s.preco, tipo: 'servico' }]
                                            );
                                        }}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                            padding: '8px 12px', borderBottom: '1px solid #eee',
                                            backgroundColor: selecionado ? '#ecfdf5' : '#fff',
                                            cursor: jaAgendado ? 'default' : 'pointer',
                                            opacity: jaAgendado ? 0.4 : 1,
                                            borderRadius: '6px', transition: '0.2s',
                                            marginBottom: '4px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: selecionado ? '#065f46' : '#333' }}>
                                                {s.nome} {jaAgendado && <small style={{ fontWeight: 'normal', color: '#999' }}>(Já incluso)</small>}
                                            </span>
                                            <span style={{ fontSize: '11px', color: selecionado ? '#059669' : '#6b7280' }}>+ R$ {parseFloat(String(s.valor || s.preco || '0').replace(',', '.')).toFixed(2)}</span>
                                        </div>
                                        
                                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: selecionado ? 'none' : '1px solid #d1d5db', backgroundColor: selecionado ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selecionado && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <label style={subModalStyles.label}>Vender Produtos de Estoque:</label>
                        <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #f0f0f0', padding: '5px', borderRadius: '8px', background: '#f9fafb' }}>
                            {estoque.length > 0 ? estoque.filter(p => p.ativo !== 0).map(p => {
                                const itemNoCarrinho = extrasSelecionados.find(item => item.id === p.id && item.tipo === 'produto');
                                const qtd = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;

                                return (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #eee', backgroundColor: qtd > 0 ? '#eff6ff' : '#fff', borderRadius: '6px', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>{p.nome}</span>
                                            <span style={{ fontSize: '11px', color: '#666' }}>R$ {parseFloat(String(p.valor || '0').replace(',', '.')).toFixed(2)} | <small>{p.quantidade} un</small></span>
                                        </div>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button onClick={() => {
                                                if (qtd <= 0) return;
                                                setExtrasSelecionados(prev => {
                                                    const outros = prev.filter(i => !(i.id === p.id && i.tipo === 'produto'));
                                                    if (qtd === 1) return outros; 
                                                    return [...outros, { ...itemNoCarrinho, quantidade: qtd - 1 }];
                                                });
                                            }} style={subModalStyles.btnQtd}>−</button>
                                            
                                            <span style={{ fontSize: '14px', fontWeight: 'bold', width: '16px', textAlign: 'center' }}>{qtd}</span>

                                            <button onClick={() => {
                                                if (qtd < p.quantidade) {
                                                    setExtrasSelecionados(prev => {
                                                        const outros = prev.filter(i => !(i.id === p.id && i.tipo === 'produto'));
                                                        return [...outros, { id: p.id, nome: p.nome, valor: p.valor, tipo: 'produto', quantidade: qtd + 1 }];
                                                    });
                                                } else {
                                                    toast.error(`Estoque insuficiente! Você só tem ${p.quantidade} unidades de ${p.nome}.`);
                                                }
                                            }} style={{...subModalStyles.btnQtd, backgroundColor: qtd >= p.quantidade ? '#e5e7eb' : '#111827', color: qtd >= p.quantidade ? '#999' : '#fff', cursor: qtd >= p.quantidade ? 'not-allowed' : 'pointer' }} disabled={qtd >= p.quantidade}>+</button>
                                        </div>
                                    </div>
                                );
                            }) : <p style={{textAlign:'center', color:'#999', fontSize:'12px', margin: '15px 0'}}>Estoque vazio.</p>}
                        </div>

                        <div style={{ marginBottom: '15px', borderTop: '2px solid #e5e7eb', paddingTop: '15px' }}>
                            {assinaturaCheckout.assinante && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 10px', background: '#faf5ff', borderRadius: '6px', border: '1px solid #c4b5fd' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#6d28d9' }}>Assinante: serviços do plano descontados</span>
                                </div>
                            )}
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>Base: R$ {getValorBaseSeguro().toFixed(2)}</span><br/>
                                <strong style={{ fontSize: '22px', color: '#111827' }}>Total: R$ {(getValorBaseSeguro() + getValorAdicionais()).toFixed(2)}</strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={subModalStyles.btnCancel} onClick={() => { setModalFinalizar(null); onClose && onClose(); }}>Voltar</button>
                            
                            {modalFinalizar.status !== 'concluido' ? (
                                <>
                                    <button style={{...subModalStyles.btnConfirm, background: '#ef4444'}} onClick={() => { setModalCancelamento(modalFinalizar); setModalFinalizar(null); }}>Cancelar Horário</button>
                                    <LoadingButton loading={finalizando} style={{...subModalStyles.btnConfirm, background: '#10b981'}} onClick={handleFinalizarAtendimento}>Cobrar & Finalizar</LoadingButton>
                                </>
                            ) : (
                                <button style={{...subModalStyles.btnConfirm, background: '#9ca3af', cursor: 'not-allowed'}} disabled>Atendimento Fechado</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CANCELAMENTO */}
            {modalCancelamento && (
                <div style={subModalStyles.overlay}>
                    <div style={subModalStyles.card}>
                        <h3 style={{ marginTop: 0, color: '#111827' }}>Cancelar Agendamento</h3>
                        <p style={{ fontSize: '14px', color: '#6b7280' }}>Deseja cancelar o horário de <b>{modalCancelamento.cliente_nome}</b>?</p>
                        
                        <label style={subModalStyles.label}>Motivo do Cancelamento</label>
                        <textarea 
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', height: '80px', marginBottom: '15px', boxSizing: 'border-box', outline: 'none' }}
                            placeholder="Obrigatório registrar a justificativa..."
                            value={justificativaCanc}
                            onChange={e => setJustificativaCanc(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button style={subModalStyles.btnCancel} onClick={() => setModalCancelamento(null)}>Voltar</button>
                            <LoadingButton loading={atualizandoStatus} style={{...subModalStyles.btnConfirm, background: '#dc2626'}} onClick={() => handleAtualizarStatus(modalCancelamento.id, 'cancelado')}>Deletar Horário</LoadingButton>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 },
    modal: { width: '450px', maxWidth: '100%', height: '100vh', backgroundColor: '#fff', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' },
    header: { padding: '25px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' },
    closeBtn: { background: 'none', border: 'none', fontSize: '20px', color: '#999', cursor: 'pointer' },
    tabs: { display: 'flex', borderBottom: '1px solid #e5e7eb' },
    tab: { flex: 1, padding: '15px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#9ca3af' },
    tabAtiva: { flex: 1, padding: '15px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#111827', borderBottom: '3px solid #111827' },
    content: { padding: '25px', overflowY: 'auto', flex: 1 },
    
    horariosGrid: { display: 'grid', gap: '15px' },
    slotLivre: { padding: '15px', border: '1px dashed #cbd5e1', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: '0.2s', background: '#f8fafc' },
    slotOcupado: { padding: '15px', border: '1px solid #f0f0f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' },
    btnAcao: { padding: '10px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
    
    formAdicionar: { display: 'flex', flexDirection: 'column' },
    label: { fontSize: '13px', fontWeight: '800', color: '#4b5563', marginBottom: '10px', display: 'block', textTransform: 'uppercase' },
    input: { width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '10px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' },
    btnSalvar: { background: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }
};

export default AgendaModal;