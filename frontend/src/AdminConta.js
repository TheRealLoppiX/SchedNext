import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from './components/Toast';
import { useConfirm } from './components/ConfirmDialog';
import { obterTerminologia } from './utils/terminologia';
import { API_URL } from './services/api';

const HORARIOS_PADRAO = {
    0: { aberto: false, abre: '08:00', fecha: '18:00', label: 'Domingo' },
    1: { aberto: true, abre: '08:00', fecha: '20:00', label: 'Segunda-feira' },
    2: { aberto: true, abre: '08:00', fecha: '20:00', label: 'Terça-feira' },
    3: { aberto: true, abre: '08:00', fecha: '20:00', label: 'Quarta-feira' },
    4: { aberto: true, abre: '08:00', fecha: '20:00', label: 'Quinta-feira' },
    5: { aberto: true, abre: '08:00', fecha: '20:00', label: 'Sexta-feira' },
    6: { aberto: true, abre: '08:00', fecha: '20:00', label: 'Sábado' },
};

function AdminConta({ empresaId }) {
    const toast = useToast();
    const confirmar = useConfirm();
    const [dados, setDados] = useState({ nome: '', logo_url: '' });
    const [horarios, setHorarios] = useState(HORARIOS_PADRAO);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [corPrincipal, setCorPrincipal] = useState('#2554eb');
    const [corDestaque, setCorDestaque] = useState('#173fb0');
    const [permitePaleta, setPermitePaleta] = useState(false);
    const [vertical, setVertical] = useState('barbearia');
    const termos = obterTerminologia(vertical);
    const [assinatura, setAssinatura] = useState(null);
    const [planosDisponiveis, setPlanosDisponiveis] = useState([]);
    const [planoEscolhidoId, setPlanoEscolhidoId] = useState(null);
    const [processandoAssinatura, setProcessandoAssinatura] = useState(false);
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [temDocumentoSalvo, setTemDocumentoSalvo] = useState(false);

    const idEfetivo = empresaId || localStorage.getItem('empresaId');

    const carregarDados = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/admin/empresa/${idEfetivo}`);
            const data = await res.json();
            
            if (data) {
                setDados({ nome: data.nome || '', logo_url: data.logo_url || '' });
                if (data.horarios_funcionamento) {
                    setHorarios(JSON.parse(data.horarios_funcionamento));
                }
                setPermitePaleta(!!data.plano_plataforma?.permite_paleta_customizada);
                if (data.vertical) setVertical(data.vertical);
                if (data.cor_principal) setCorPrincipal(data.cor_principal);
                if (data.cor_destaque) setCorDestaque(data.cor_destaque);
                setAssinatura({
                    plano: data.plano_plataforma,
                    status_assinatura: data.status_assinatura,
                    proxima_cobranca_em: data.proxima_cobranca_em,
                    cancelamento_agendado: data.cancelamento_agendado
                });
                setPlanoEscolhidoId(data.plano_plataforma?.id || null);
                setTemDocumentoSalvo(!!data.cpf_cnpj);
            }
            setCarregando(false);
        } catch (err) {
            setCarregando(false);
        }
    }, [idEfetivo]);

    useEffect(() => { carregarDados(); }, [carregarDados]);

    useEffect(() => {
        fetch(`${API_URL}/planos-plataforma`)
            .then(r => r.json())
            .then(data => setPlanosDisponiveis(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const planoEscolhidoEhPago = planosDisponiveis.find(p => p.id === planoEscolhidoId)?.preco_mensal > 0;

    const trocarPlano = async () => {
        if (!planoEscolhidoId || planoEscolhidoId === assinatura?.plano?.id) return;
        setProcessandoAssinatura(true);
        try {
            const res = await fetch(`${API_URL}/admin/assinatura-plataforma/iniciar-upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plano_plataforma_id: planoEscolhidoId, ...(cpfCnpj ? { cpf_cnpj: cpfCnpj } : {}) })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.checkoutUrl) {
                    window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
                    toast.success('Finalize o pagamento na aba que abriu. Seu plano ativa automaticamente assim que o pagamento for confirmado.');
                } else {
                    toast.success(data.message || 'Plano atualizado!');
                }
                carregarDados();
            } else if (data.requerDocumento) {
                toast.error('Informe seu CPF ou CNPJ para assinar um plano pago.');
            } else {
                toast.error(data.error || 'Não foi possível trocar de plano.');
            }
        } catch (err) {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setProcessandoAssinatura(false);
        }
    };

    const cancelarCobranca = async () => {
        setProcessandoAssinatura(true);
        try {
            const res = await fetch(`${API_URL}/admin/assinatura-plataforma/cancelar-cobranca`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) { toast.success(data.message); carregarDados(); }
            else toast.error(data.error || 'Não foi possível cancelar a cobrança.');
        } catch (err) {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setProcessandoAssinatura(false);
        }
    };

    const reativarCobranca = async () => {
        setProcessandoAssinatura(true);
        try {
            const res = await fetch(`${API_URL}/admin/assinatura-plataforma/reativar-cobranca`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) { toast.success(data.message); carregarDados(); }
            else toast.error(data.error || 'Não foi possível reativar a cobrança.');
        } catch (err) {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setProcessandoAssinatura(false);
        }
    };

    const cancelarPlanoAgora = async () => {
        const ok = await confirmar('Cancelar o plano agora?', {
            detail: 'Os recursos pagos são encerrados imediatamente, sem reembolso do período restante. Diferente de "cancelar cobrança", que mantém o acesso até a próxima data de cobrança.',
            confirmText: 'Cancelar agora',
            danger: true
        });
        if (!ok) return;
        setProcessandoAssinatura(true);
        try {
            const res = await fetch(`${API_URL}/admin/assinatura-plataforma/cancelar-plano`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) { toast.success(data.message); carregarDados(); }
            else toast.error(data.error || 'Não foi possível cancelar o plano.');
        } catch (err) {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setProcessandoAssinatura(false);
        }
    };

    const aoMudarFoto = (e) => {
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
                    setDados({ ...dados, logo_url: canvas.toDataURL('image/jpeg', 0.8) });
                };
            };
            reader.readAsDataURL(arquivo);
        }
    };

    const atualizarHorarioDia = (diaIndex, campo, valor) => {
        setHorarios(prev => ({
            ...prev,
            [diaIndex]: { ...prev[diaIndex], [campo]: valor }
        }));
    };

    const salvarAlteracoes = async (e) => {
        e.preventDefault();
        setSalvando(true);
        try {
            const res = await fetch(`${API_URL}/admin/empresa/atualizar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: idEfetivo, nome: dados.nome, logo_url: dados.logo_url, horarios,
                    ...(permitePaleta ? { cor_principal: corPrincipal, cor_destaque: corDestaque } : {})
                })
            });
            if (res.ok) {
                toast.success("Configurações atualizadas com sucesso!");
                carregarDados();
            } else {
                toast.error("Não foi possível salvar as configurações. Tente novamente.");
            }
        } catch (err) {
            toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
        } finally {
            setSalvando(false);
        }
    };

    if (carregando) return <p style={{ textAlign: 'center', marginTop: '50px', color: '#6b7280' }}>Carregando configurações...</p>;

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h2 style={styles.title}><Icons.Settings color="#111827" /> Perfil {termos.artigoContraido} {termos.local}</h2>
                    <p style={styles.subtitle}>Gerencie os detalhes visuais e horários do seu estabelecimento.</p>
                </div>
                <button onClick={salvarAlteracoes} disabled={salvando} style={styles.btnSalvarTopo}>
                    {salvando ? 'Salvando...' : <><Icons.Save color="#fff" /> Salvar Tudo</>}
                </button>
            </header>
            
            <div style={styles.grid}>
                
                {/* COLUNA ESQUERDA: IDENTIDADE VISUAL */}
                <div style={styles.coluna}>
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Identidade Visual</h3>
                        </div>
                        
                        <div style={styles.uploadArea}>
                            <div style={styles.previewFoto}>
                                {dados.logo_url ? <img src={dados.logo_url} alt="Logo" style={styles.img} /> : <Icons.Image color="#9ca3af" />}
                            </div>
                            <div style={{flex: 1}}>
                                <h4 style={{margin: '0 0 5px 0', fontSize: '14px', color: '#111827'}}>Logo {termos.artigoContraido} {termos.local}</h4>
                                <p style={{margin: '0 0 15px 0', fontSize: '12px', color: '#6b7280'}}>Sua logo será exibida para os clientes no menu principal do sistema.</p>
                                <label style={styles.btnUpload}>
                                    Escolher Imagem
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={aoMudarFoto} />
                                </label>
                            </div>
                        </div>

                        <div style={{ marginTop: '20px' }}>
                            <label style={styles.label}>Nome do Estabelecimento</label>
                            <div style={styles.inputWrapper}>
                                <Icons.Store color="#9ca3af" />
                                <input 
                                    style={styles.inputLimpo} value={dados.nome} 
                                    onChange={e => setDados({...dados, nome: e.target.value})}
                                    placeholder={`Ex: ${termos.exemploNome}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{...styles.card, marginTop: '20px'}}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Paleta de Cores</h3>
                        </div>

                        {permitePaleta ? (
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                <div>
                                    <label style={styles.label}>Cor Principal</label>
                                    <input type="color" value={corPrincipal} onChange={e => setCorPrincipal(e.target.value)} style={styles.inputCor} />
                                </div>
                                <div>
                                    <label style={styles.label}>Cor de Destaque</label>
                                    <input type="color" value={corDestaque} onChange={e => setCorDestaque(e.target.value)} style={styles.inputCor} />
                                </div>
                            </div>
                        ) : (
                            <div style={styles.upsellPaleta}>
                                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                    Personalize as cores do seu painel e da tela dos seus clientes. Disponível a partir do plano Essencial.
                                </p>
                            </div>
                        )}
                    </div>

                    <div style={{...styles.card, marginTop: '20px'}}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Assinatura</h3>
                        </div>

                        {assinatura && (
                            <>
                                <div style={styles.linhaAssinatura}>
                                    <span style={styles.labelAssinatura}>Plano atual</span>
                                    <strong>{assinatura.plano?.nome || '—'}{assinatura.plano?.preco_mensal > 0 ? ` · R$ ${Number(assinatura.plano.preco_mensal).toFixed(2)}/mês` : assinatura.plano?.preco_mensal === 0 ? ' · Grátis' : ''}</strong>
                                </div>
                                <div style={styles.linhaAssinatura}>
                                    <span style={styles.labelAssinatura}>Status</span>
                                    <span style={{...styles.badgeStatusAssinatura, ...(assinatura.status_assinatura === 'ativa' ? styles.badgeVerde : assinatura.status_assinatura === 'trial' ? styles.badgeAzul : styles.badgeCinza)}}>
                                        {assinatura.status_assinatura === 'ativa' ? 'Ativa' : assinatura.status_assinatura === 'trial' ? 'Teste (sem cobrança real ainda)' : assinatura.status_assinatura}
                                    </span>
                                </div>
                                {assinatura.proxima_cobranca_em && (
                                    <div style={styles.linhaAssinatura}>
                                        <span style={styles.labelAssinatura}>{assinatura.cancelamento_agendado ? 'Encerra em' : 'Próxima cobrança'}</span>
                                        <strong>{new Date(assinatura.proxima_cobranca_em).toLocaleDateString('pt-BR')}</strong>
                                    </div>
                                )}

                                {assinatura.cancelamento_agendado && (
                                    <div style={styles.avisoCancelamento}>
                                        Cobrança cancelada. Seu plano continua ativo até a data acima, depois cai automaticamente pro plano Grátis.
                                        <button onClick={reativarCobranca} disabled={processandoAssinatura} style={styles.btnLinkReativar}>Reativar cobrança</button>
                                    </div>
                                )}

                                <div style={{ marginTop: '16px' }}>
                                    <label style={styles.label}>Trocar de plano</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <select
                                            value={planoEscolhidoId || ''}
                                            onChange={e => setPlanoEscolhidoId(Number(e.target.value))}
                                            style={styles.selectPlano}
                                        >
                                            {planosDisponiveis.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.nome}{p.preco_mensal > 0 ? ` · R$ ${Number(p.preco_mensal).toFixed(2)}/mês` : p.preco_mensal === 0 ? ' · Grátis' : ' · sob consulta'}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={trocarPlano}
                                            disabled={processandoAssinatura || !planoEscolhidoId || planoEscolhidoId === assinatura.plano?.id}
                                            style={styles.btnTrocarPlano}
                                        >
                                            Confirmar troca
                                        </button>
                                    </div>
                                    {planoEscolhidoEhPago && !temDocumentoSalvo && planoEscolhidoId !== assinatura.plano?.id && (
                                        <div style={{ marginTop: '10px' }}>
                                            <label style={styles.label}>CPF ou CNPJ (necessário para ativar cobrança)</label>
                                            <input
                                                type="text"
                                                value={cpfCnpj}
                                                onChange={e => setCpfCnpj(e.target.value)}
                                                placeholder="Só números"
                                                style={styles.selectPlano}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div style={styles.acoesAssinatura}>
                                    {!assinatura.cancelamento_agendado && assinatura.proxima_cobranca_em && (
                                        <button onClick={cancelarCobranca} disabled={processandoAssinatura} style={styles.btnCancelarCobranca}>
                                            Cancelar cobrança
                                        </button>
                                    )}
                                    {assinatura.plano?.preco_mensal > 0 && (
                                        <button onClick={cancelarPlanoAgora} disabled={processandoAssinatura} style={styles.btnCancelarPlano}>
                                            Cancelar plano agora
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* COLUNA DIREITA: HORÁRIOS */}
                <div style={styles.coluna}>
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Horário de Funcionamento</h3>
                        </div>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
                            Defina os dias de folga e o horário de expediente. O sistema esconderá sua agenda nos dias inativos.
                        </p>

                        <div style={styles.listaHorarios}>
                            {Object.keys(horarios).map((key) => {
                                const dia = horarios[key];
                                return (
                                    <div key={key} style={{...styles.linhaDia, backgroundColor: dia.aberto ? '#fff' : '#f9fafb', borderColor: dia.aberto ? '#e5e7eb' : '#f3f4f6'}}>
                                        <div style={styles.diaHeader}>
                                            
                                            {/* BOTÃO LIGA/DESLIGA (TOGGLE) COM ANIMAÇÃO */}
                                            <label style={styles.toggleContainer}>
                                                <input 
                                                    type="checkbox" checked={dia.aberto} 
                                                    onChange={(e) => atualizarHorarioDia(key, 'aberto', e.target.checked)}
                                                    style={styles.checkboxOriginal}
                                                />
                                                <span style={{...styles.toggleVisivo, backgroundColor: dia.aberto ? '#10b981' : '#e5e7eb'}}>
                                                    <span style={{...styles.toggleBolinha, transform: dia.aberto ? 'translateX(20px)' : 'translateX(0)'}}></span>
                                                </span>
                                            </label>
                                            
                                            <span style={{ fontWeight: '600', color: dia.aberto ? '#111827' : '#9ca3af', fontSize: '14px', width: '100px' }}>
                                                {dia.label}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', opacity: dia.aberto ? 1 : 0.4, pointerEvents: dia.aberto ? 'auto' : 'none' }}>
                                            <input 
                                                type="time" value={dia.abre}
                                                onChange={(e) => atualizarHorarioDia(key, 'abre', e.target.value)}
                                                style={styles.inputHora}
                                            />
                                            <span style={{ color: '#9ca3af', fontSize: '12px' }}>às</span>
                                            <input 
                                                type="time" value={dia.fecha}
                                                onChange={(e) => atualizarHorarioDia(key, 'fecha', e.target.value)}
                                                style={styles.inputHora}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ÍCONES SVG MINIMALISTAS
const Icons = {
    Settings: ({color}) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'bottom'}}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33H15a1.65 1.65 0 0 0-1 1.51v.09a2 2 0 0 1-2 2 2 2 0 0 1-2-2"></path></svg>,
    Store: ({color}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
    Save: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
    Image: ({color}) => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
};

const styles = {
    container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', paddingBottom: '20px', flexWrap: 'wrap', gap: '15px' },
    title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
    subtitle: { color: '#6b7280', fontSize: '15px', margin: 0 },
    btnSalvarTopo: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', transition: '0.2s', fontSize: '14px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    
    grid: { display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' },
    coluna: { flex: '1 1 400px', display: 'flex', flexDirection: 'column' },
    
    card: { backgroundColor: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', flex: 1 },
    cardHeader: { borderBottom: '1px solid #f3f4f6', paddingBottom: '15px', marginBottom: '20px' },
    cardTitle: { margin: '0', fontSize: '16px', color: '#111827', fontWeight: '700' },
    
    uploadArea: { display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db' },
    previewFoto: { width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    btnUpload: { display: 'inline-block', padding: '8px 16px', backgroundColor: '#fff', color: '#111827', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid #d1d5db', transition: '0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    
    label: { display: 'block', marginBottom: '8px', fontWeight: '700', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
    inputWrapper: { display: 'flex', alignItems: 'center', padding: '12px 15px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff' },
    inputLimpo: { width: '100%', border: 'none', outline: 'none', fontSize: '15px', color: '#111827', backgroundColor: 'transparent' },
    
    listaHorarios: { display: 'flex', flexDirection: 'column', gap: '10px' },
    linhaDia: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderRadius: '10px', border: '1px solid #e5e7eb', transition: 'all 0.2s', flexWrap: 'wrap', gap: '10px' },
    diaHeader: { display: 'flex', alignItems: 'center', gap: '15px' },
    
    // TOGGLE SWITCH ANIMADO
    toggleContainer: { position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' },
    checkboxOriginal: { opacity: 0, width: 0, height: 0, position: 'absolute' },
    toggleVisivo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '34px', transition: 'background-color 0.3s' },
    toggleBolinha: { position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: 'transform 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
    
    inputHora: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', color: '#111827', backgroundColor: '#fff', width: '100px', fontWeight: '500' },

    inputCor: { width: '60px', height: '40px', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', padding: '2px' },
    upsellPaleta: { padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px dashed #d1d5db' },

    linhaAssinatura: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px' },
    labelAssinatura: { color: '#6b7280' },
    badgeStatusAssinatura: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
    badgeVerde: { backgroundColor: '#d1fae5', color: '#065f46' },
    badgeAzul: { backgroundColor: '#dbeafe', color: '#1e40af' },
    badgeCinza: { backgroundColor: '#f3f4f6', color: '#4b5563' },
    avisoCancelamento: { marginTop: '12px', padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' },
    btnLinkReativar: { background: 'none', border: 'none', color: '#2554eb', fontWeight: '700', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' },
    selectPlano: { flex: '1 1 220px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
    btnTrocarPlano: { padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
    acoesAssinatura: { display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' },
    btnCancelarCobranca: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
    btnCancelarPlano: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }
};

export default AdminConta;