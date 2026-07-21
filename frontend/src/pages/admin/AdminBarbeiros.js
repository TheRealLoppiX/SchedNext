import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import useEscToClose from '../../hooks/useEscToClose';
import LoadingButton from '../../components/LoadingButton';
import EmptyState from '../../components/EmptyState';
import { obterTerminologia } from '../../utils/terminologia';

function AdminBarbeiros({ empresaId }) {
    const toast = useToast();
    const confirmar = useConfirm();

    const [barbeiros, setBarbeiros] = useState([]);
    const [carregando, setCarregando] = useState(true);

    const [novoNome, setNovoNome] = useState('');
    const [novaFoto, setNovaFoto] = useState('');
    const [cadastrando, setCadastrando] = useState(false);
    const [salvando, setSalvando] = useState(false);

    const [editando, setEditando] = useState(null);
    const [bloqueando, setBloqueando] = useState(null);
    const [dadosBloqueio, setDadosBloqueio] = useState({ data: '', dataFim: '', inicio: '', fim: '', motivo: 'Intervalo/Folga' });

    const [modalServicos, setModalServicos] = useState(false);
    const [barbeiroSelecionado, setBarbeiroSelecionado] = useState(null);
    const [listaServicos, setListaServicos] = useState([]);
    const [servicosMarcados, setServicosMarcados] = useState([]);
    const [vertical, setVertical] = useState('barbearia');

    useEscToClose(!!(editando || bloqueando || modalServicos), () => {
        setEditando(null);
        setBloqueando(null);
        setModalServicos(false);
    });

    // 1. TRAVA CONTRA F5: Busca o ID da empresa de todas as formas possíveis para não perder a referência
    const getEmpresaId = () => {
        if (empresaId) return empresaId;
        const token = localStorage.getItem('adminToken');
        if (token) {
            try { return JSON.parse(token).empresa_id; } catch (e) {}
        }
        return localStorage.getItem('empresaId');
    };

    const idEfetivo = getEmpresaId();

    const carregarEquipe = useCallback(async () => {
        if (!idEfetivo) {
            setCarregando(false);
            return;
        }

        try {
            const res = await fetch(`http://localhost:4000/admin/equipe/${idEfetivo}`);
            const data = await res.json();
            
            // Se o banco retornar algo que não é array, assume lista vazia e libera a tela
            if (!Array.isArray(data)) {
                setBarbeiros([]);
                setCarregando(false);
                return;
            }

            const equipeComBloqueios = await Promise.all(data.map(async (b) => {
                try {
                    const resB = await fetch(`http://localhost:4000/admin/bloqueios/${b.id}`);
                    const bloqs = await resB.json();
                    return { ...b, bloqueios: Array.isArray(bloqs) ? bloqs : [] };
                } catch (err) {
                    return { ...b, bloqueios: [] };
                }
            }));

            setBarbeiros(equipeComBloqueios);
            setCarregando(false);
        } catch (err) {
            console.error("Erro ao carregar equipe:", err);
            setBarbeiros([]);
            setCarregando(false);
        }
    }, [idEfetivo]);

    useEffect(() => { carregarEquipe(); }, [carregarEquipe]);

    useEffect(() => {
        if (!idEfetivo) return;
        fetch(`http://localhost:4000/admin/empresa/${idEfetivo}`)
            .then(r => r.json())
            .then(d => d?.vertical && setVertical(d.vertical))
            .catch(() => {});
    }, [idEfetivo]);

    const termos = obterTerminologia(vertical);

    const aoMudarFoto = (e, tipo = 'cadastro') => {
        const arquivo = e.target.files[0];
        if (arquivo) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.src = reader.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 400; 
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const fotoRedimensionada = canvas.toDataURL('image/jpeg', 0.8);

                    if (tipo === 'cadastro') setNovaFoto(fotoRedimensionada);
                    else setEditando({ ...editando, foto_url: fotoRedimensionada });
                };
            };
            reader.readAsDataURL(arquivo);
        }
    };

    const handleCadastrar = async (e) => {
        e.preventDefault();
        if (!novoNome) return toast.error("Digite o nome do barbeiro.");

        setCadastrando(true);
        try {
            const res = await fetch(`http://localhost:4000/admin/barbeiro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: novoNome, empresa_id: idEfetivo, foto_url: novaFoto })
            });

            if (res.ok) {
                setNovoNome(''); setNovaFoto('');
                carregarEquipe();
                toast.success("Profissional cadastrado com sucesso!");
            } else {
                toast.error("Não foi possível cadastrar o profissional. Tente novamente.");
            }
        } catch (err) {
            toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
        } finally {
            setCadastrando(false);
        }
    };

    const alternarStatus = async (id, statusAtual, nome) => {
        const acao = statusAtual ? 'desativar' : 'reativar';
        const ok = await confirmar(`Deseja ${acao} ${nome}?`, {
            detail: statusAtual
                ? `${termos.profissionalPlural} desativados somem imediatamente da tela de agendamento dos clientes.`
                : `O ${termos.profissional.toLowerCase()} volta a aparecer para os clientes agendarem.`,
            confirmText: acao === 'desativar' ? 'Desativar' : 'Reativar',
            danger: statusAtual
        });
        if (!ok) return;

        try {
            const res = await fetch(`http://localhost:4000/admin/barbeiro/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ativo: !statusAtual })
            });
            if (res.ok) {
                carregarEquipe();
                toast.success(statusAtual ? `${termos.profissional} desativado.` : `${termos.profissional} reativado.`);
            } else {
                toast.error('Não foi possível atualizar o status. Tente novamente.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        }
    };

    const salvarEdicao = async () => {
        setSalvando(true);
        try {
            const res = await fetch(`http://localhost:4000/admin/barbeiro/editar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editando)
            });
            if (res.ok) {
                setEditando(null);
                carregarEquipe();
                toast.success(`Dados do ${termos.profissional.toLowerCase()} atualizados!`);
            } else {
                toast.error('Não foi possível salvar as alterações. Tente novamente.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    const deletarBarbeiro = async (id, nome) => {
        const ok = await confirmar(`Excluir ${termos.profissional.toLowerCase()} ${nome} definitivamente?`, {
            detail: 'Essa ação não pode ser desfeita.',
            confirmText: 'Excluir',
            danger: true
        });
        if (!ok) return;

        try {
            const res = await fetch(`http://localhost:4000/admin/barbeiro/${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (res.ok) {
                carregarEquipe();
                toast.success(data.message || `${termos.profissional} excluído.`);
            } else {
                toast.error(data.error || 'Não foi possível excluir o barbeiro.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        }
    };

    const salvarBloqueio = async () => {
        if (!dadosBloqueio.data || !dadosBloqueio.inicio || !dadosBloqueio.fim) {
            return toast.error("Preencha Data de Início, Hora de Início e Hora de Fim.");
        }

        const dadosParaEnviar = {
            barbeiro_id: Number(bloqueando.id),
            data_bloqueio: dadosBloqueio.data,
            data_fim: dadosBloqueio.dataFim || dadosBloqueio.data,
            hora_inicio: dadosBloqueio.inicio,
            hora_fim: dadosBloqueio.fim,
            motivo: dadosBloqueio.motivo || 'Intervalo/Folga'
        };

        setSalvando(true);
        try {
            const res = await fetch('http://localhost:4000/admin/bloqueio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaEnviar)
            });

            if (res.ok) {
                setBloqueando(null);
                setDadosBloqueio({ data: '', dataFim: '', inicio: '', fim: '', motivo: 'Intervalo/Folga' });
                carregarEquipe();
                toast.success('Bloqueio adicionado à agenda!');
            } else {
                toast.error('Não foi possível salvar o bloqueio. Tente novamente.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    const excluirBloqueio = async (id) => {
        const ok = await confirmar('Remover este bloqueio da agenda?', { confirmText: 'Remover' });
        if (!ok) return;

        try {
            const res = await fetch(`http://localhost:4000/admin/bloqueio/${id}`, { method: 'DELETE' });
            if (res.ok) {
                carregarEquipe();
                toast.success('Bloqueio removido.');
            } else {
                toast.error('Não foi possível remover o bloqueio.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        }
    };

    const abrirModalServicos = async (barbeiro) => {
        setBarbeiroSelecionado(barbeiro);
        const storage = localStorage.getItem('adminToken');
        let empresaSlug = storage ? JSON.parse(storage).empresa_id : idEfetivo;

        try {
            const [resServicos, resVinculos] = await Promise.all([
                fetch(`http://localhost:4000/admin/servicos?empresa=${empresaSlug}`),
                fetch(`http://localhost:4000/barbeiro-servicos/${barbeiro.id}`)
            ]);
            
            setListaServicos(await resServicos.json() || []);
            setServicosMarcados(await resVinculos.json() || []);
            setModalServicos(true);
        } catch (err) {
            console.error("Erro ao carregar serviços:", err);
        }
    };

    const toggleServico = (id) => {
        setServicosMarcados(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    };

    const salvarVinculo = async () => {
        setSalvando(true);
        try {
            const res = await fetch('http://localhost:4000/barbeiro-servicos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barbeiro_id: barbeiroSelecionado.id, servicosIds: servicosMarcados })
            });
            if (res.ok) {
                setModalServicos(false);
                toast.success('Serviços vinculados com sucesso!');
            } else {
                toast.error('Não foi possível salvar os vínculos. Tente novamente.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '16px' }}>Carregando equipe...</p>;

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h2 style={styles.title}><Icons.Users color="#111827" /> Gestão de {termos.profissionalPlural}</h2>
                    <p style={styles.subtitle}>Gerencie sua equipe, horários e vínculos de serviços.</p>
                </div>
            </header>

            <div style={styles.cardForm}>
                <h4 style={styles.cardTitle}><Icons.UserPlus color="#4b5563" /> Cadastrar Novo Profissional</h4>
                <form onSubmit={handleCadastrar} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Nome do {termos.profissional}</label>
                        <input 
                            placeholder="Ex: Carlos Silva" 
                            value={novoNome} 
                            onChange={e => setNovoNome(e.target.value)} 
                            style={styles.input} 
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Foto do Profissional</label>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => aoMudarFoto(e, 'cadastro')} 
                            style={{ ...styles.input, padding: '9px 12px' }}
                        />
                    </div>
                    <div style={{...styles.inputGroup, justifyContent: 'flex-end'}}>
                        <LoadingButton type="submit" loading={cadastrando} style={styles.btnPrincipal}>Cadastrar Profissional</LoadingButton>
                    </div>
                </form>
            </div>

            {/* 2. PROTEÇÃO DE TELA VAZIA: Se não houver ninguém, avisa claramente */}
            <div style={styles.grid}>
                {barbeiros.length > 0 ? barbeiros.map(b => (
                    <div key={b.id} style={{...styles.card, borderTop: b.ativo ? '4px solid #059669' : '4px solid #dc2626'}}>
                        <button onClick={() => deletarBarbeiro(b.id, b.nome)} style={styles.btnXCard} title={`Excluir ${termos.profissional}`}>✕</button>
                        
                        <div style={styles.info}>
                            <div style={styles.avatar}>
                                {b.foto_url ? <img src={b.foto_url} style={styles.img} alt={b.nome} /> : <Icons.User color="#9ca3af" />}
                            </div>
                            <div>
                                <h3 style={styles.nomeCard}>{b.nome}</h3>
                                <span style={{ ...styles.badgeStatus, backgroundColor: b.ativo ? '#d1fae5' : '#fee2e2', color: b.ativo ? '#065f46' : '#991b1b' }}>
                                    {b.ativo ? 'Ativo na Plataforma' : 'Inativo / Oculto'}
                                </span>
                            </div>
                        </div>

                        <div style={styles.areaBloqueios}>
                            <strong style={styles.tituloBloqueio}><Icons.Lock color="#6b7280" /> Bloqueios de Agenda:</strong>
                            {b.bloqueios && b.bloqueios.length > 0 ? b.bloqueios.map(bloq => {
                                const dataParaUsar = bloq.data_bloqueio || bloq.data_inicio;
                                if (!dataParaUsar) return null;
                                const dataIniObj = new Date(dataParaUsar + 'T00:00:00');
                                const dataIniFormatada = dataIniObj.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
                                
                                return (
                                    <div key={bloq.id} style={styles.itemBloqueio}>
                                        <span>{dataIniFormatada} | {bloq.hora_inicio?.substring(0,5)} - {bloq.hora_fim?.substring(0,5)}</span>
                                        <button onClick={() => excluirBloqueio(bloq.id)} style={styles.btnX} title="Remover Bloqueio">
                                            <Icons.Trash color="#ef4444" />
                                        </button>
                                    </div>
                                );
                            }) : <small style={{color: '#9ca3af', fontSize: '12px'}}>Agenda totalmente livre.</small>}
                        </div>

                        <div style={styles.containerBotoes}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setEditando(b)} style={styles.btnSecundario}><Icons.Edit color="#4b5563" /> Editar</button>
                                <button onClick={() => setBloqueando(b)} style={styles.btnSecundario}><Icons.Lock color="#4b5563" /> Bloquear</button>
                            </div>
                            
                            <button onClick={() => abrirModalServicos(b)} style={styles.btnVincular}>
                                <Icons.Link color="#4f46e5" /> Vincular Serviços
                            </button>
                            
                            <button onClick={() => alternarStatus(b.id, b.ativo, b.nome)} style={{...styles.btnStatus, backgroundColor: b.ativo ? '#fef2f2' : '#ecfdf5', color: b.ativo ? '#dc2626' : '#059669', border: `1px solid ${b.ativo ? '#fecaca' : '#a7f3d0'}`}}>
                                <Icons.Power color={b.ativo ? "#dc2626" : "#059669"} /> 
                                {b.ativo ? `Desativar ${termos.profissional}` : `Reativar ${termos.profissional}`}
                            </button>
                        </div>
                    </div>
                )) : (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#fff', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
                        <EmptyState
                            icon={termos.emoji}
                            title={`Nenhum ${termos.profissional.toLowerCase()} cadastrado nesta unidade ainda.`}
                            hint="Use o formulário acima para cadastrar o primeiro profissional da equipe."
                        />
                    </div>
                )}
            </div>

            {(editando || bloqueando || modalServicos) && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        
                        {editando && (
                            <>
                                <h3 style={styles.modalTitle}>Editar Perfil</h3>
                                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                                    <div style={{...styles.avatar, margin: '0 auto 15px', width: '80px', height: '80px'}}>
                                        {editando.foto_url ? <img src={editando.foto_url} style={styles.img} alt="Preview" /> : <Icons.User color="#9ca3af" />}
                                    </div>
                                    <label style={styles.btnUpload}>
                                        Escolher Nova Foto
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => aoMudarFoto(e, 'edicao')} />
                                    </label>
                                </div>
                                <label style={styles.label}>Nome do {termos.profissional}:</label>
                                <input style={styles.inputModal} value={editando.nome} onChange={e => setEditando({...editando, nome: e.target.value})} />
                                <div style={styles.modalAcoes}>
                                    <button onClick={() => setEditando(null)} style={styles.btnCancelarModal}>Cancelar</button>
                                    <LoadingButton onClick={salvarEdicao} loading={salvando} style={styles.btnSalvarModal}>Salvar</LoadingButton>
                                </div>
                            </>
                        )}

                        {bloqueando && (
                            <>
                                <h3 style={styles.modalTitle}>Bloquear Horário: {bloqueando.nome}</h3>
                                <label style={styles.label}>Data do Bloqueio:</label>
                                <input type="date" style={styles.inputModal} value={dadosBloqueio.data} onChange={e => setDadosBloqueio({...dadosBloqueio, data: e.target.value})} />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <div style={{flex: 1}}>
                                        <label style={styles.label}>Hora Início:</label>
                                        <input type="time" style={styles.inputModal} value={dadosBloqueio.inicio} onChange={e => setDadosBloqueio({...dadosBloqueio, inicio: e.target.value})} />
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={styles.label}>Hora Fim:</label>
                                        <input type="time" style={styles.inputModal} value={dadosBloqueio.fim} onChange={e => setDadosBloqueio({...dadosBloqueio, fim: e.target.value})} />
                                    </div>
                                </div>
                                <div style={styles.modalAcoes}>
                                    <button onClick={() => setBloqueando(null)} style={styles.btnCancelarModal}>Cancelar</button>
                                    <LoadingButton onClick={salvarBloqueio} loading={salvando} style={styles.btnSalvarModal}>Confirmar Bloqueio</LoadingButton>
                                </div>
                            </>
                        )}

                        {modalServicos && (
                            <>
                                <h3 style={styles.modalTitle}>Serviços: {barbeiroSelecionado?.nome}</h3>
                                <div style={styles.listaServicosModal}>
                                    {Array.isArray(listaServicos) && listaServicos.length > 0 ? (
                                        listaServicos.map(s => (
                                            <label key={s.id} style={styles.itemServico}>
                                                <input type="checkbox" checked={servicosMarcados.includes(s.id)} onChange={() => toggleServico(s.id)} style={{accentColor: '#111827', width: '16px', height: '16px'}} />
                                                <div>
                                                    <strong style={{color: '#111827', fontSize: '14px'}}>{s.nome}</strong>
                                                    <div style={{fontSize: '12px', color: '#6b7280'}}>R$ {s.valor || s.preco} • {s.duracao} min</div>
                                                </div>
                                            </label>
                                        ))
                                    ) : (
                                        <p style={{fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px'}}>Nenhum serviço cadastrado.</p>
                                    )}
                                </div>
                                <div style={styles.modalAcoes}>
                                    <button onClick={() => setModalServicos(false)} style={styles.btnCancelarModal}>Cancelar</button>
                                    <LoadingButton onClick={salvarVinculo} loading={salvando} style={styles.btnSalvarModal}>Salvar Vínculos</LoadingButton>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const Icons = {
  Users: ({color}) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'bottom'}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  UserPlus: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'bottom'}}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>,
  User: ({color}) => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Lock: ({color}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Edit: ({color}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Link: ({color}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
  Power: ({color}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>,
  Trash: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
};

const styles = {
    container: { padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
    header: { marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
    title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
    subtitle: { color: '#6b7280', fontSize: '15px', margin: 0 },
    
    cardForm: { background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #f3f4f6' },
    cardTitle: { margin: '0 0 20px 0', color: '#111827', fontSize: '16px', fontWeight: '700' },
    form: { display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' },
    label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: '#fff', color: '#111827' },
    btnPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', transition: '0.2s', height: '43px' },
    
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
    card: { position: 'relative', backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6' },
    btnXCard: { position: 'absolute', top: '15px', right: '15px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    info: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' },
    
    avatar: { width: '65px', height: '65px', borderRadius: '50%', backgroundColor: '#f3f4f6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e5e7eb' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    
    nomeCard: { margin: '0 0 4px 0', fontSize: '18px', color: '#111827', fontWeight: '700' },
    badgeStatus: { padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' },
    
    areaBloqueios: { backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' },
    tituloBloqueio: { fontSize: '11px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    itemBloqueio: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #e5e7eb', color: '#374151' },
    btnX: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' },
    
    containerBotoes: { display: 'flex', flexDirection: 'column', gap: '10px' },
    btnSecundario: { flex: 1, padding: '10px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' },
    btnVincular: { padding: '10px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' },
    btnStatus: { padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' },
    
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 },
    modal: { backgroundColor: '#fff', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
    modalTitle: { margin: '0 0 10px 0', fontSize: '20px', color: '#111827', fontWeight: '800' },
    inputModal: { padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '14px', outline: 'none' },
    btnUpload: { display: 'inline-block', padding: '8px 16px', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid #d1d5db' },
    listaServicosModal: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px' },
    itemServico: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', borderRadius: '6px' },
    modalAcoes: { display: 'flex', gap: '10px', marginTop: '15px' },
    btnSalvarModal: { flex: 1, padding: '12px', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
    btnCancelarModal: { flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }
};

export default AdminBarbeiros;