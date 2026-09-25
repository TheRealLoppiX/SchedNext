import React, { useEffect, useState, useCallback, useRef } from 'react';
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
    const [assinaturaCheckout, setAssinaturaCheckout] = useState({ assinante: false, servicos_ids: [], servicos_agendados_ids: [], restantes: {} });
    // Pagamento dividido: 1 linha = fluxo simples de sempre (escolhe a forma, cobra o total).
    // 2+ linhas = cada uma com sua forma e seu valor, precisam somar o total do atendimento.
    const [pagamentos, setPagamentos] = useState([{ forma_pagamento: null, valor: '' }]);
    const [mpConectado, setMpConectado] = useState(false);
    const [pixInfo, setPixInfo] = useState(null);
    // Cortesia da ação de fidelidade que o cliente já conquistou (vem de /admin/agendamento-usuario)
    const [premio, setPremio] = useState(null);
    const [aplicarPremio, setAplicarPremio] = useState(false);
    const [gerandoPix, setGerandoPix] = useState(false);
    const pixPollRef = useRef(null);

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
        if (ag.status === 'cancelado') return { bg: 'var(--fx-red-bg)', cor: 'var(--fx-red)', label: 'cancelado' };
        if (ag.status === 'concluido') return { bg: 'var(--fx-green-bg)', cor: 'var(--fx-green)', label: 'Concluído' };
        if (ehNaoCompareceu(ag)) return { bg: 'var(--fx-surface-2)', cor: 'var(--fx-muted)', label: 'não compareceu' };
        return { bg: 'var(--fx-amber-bg)', cor: 'var(--fx-amber)', label: ag.status };
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
        if (novoStatus !== 'cancelado') return;
        if (!justificativaCanc) return toast.error("Digite o motivo do cancelamento.");

        setAtualizandoStatus(true);
        try {
            const res = await fetch(`${API_URL}/admin/cancelar-agendamento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agendamento_id: id, justificativa: justificativaCanc, enviadoPor: 'Barbeiro' })
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
        card: { background: 'var(--fx-card)', border: '1px solid var(--fx-line)', color: 'var(--fx-text)', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '360px', boxSizing: 'border-box' },
        cardCheckout: { background: 'var(--fx-card)', border: '1px solid var(--fx-line)', color: 'var(--fx-text)', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' },
        clientBadge: { background: 'var(--fx-surface-2)', padding: '15px', borderRadius: '10px', borderLeft: '5px solid #28a745', marginBottom: '15px' },
        label: { fontSize: '12px', fontWeight: 'bold', color: 'var(--fx-muted)', marginBottom: '4px', display: 'block', textTransform: 'uppercase' },
        btnConfirm: { flex: 1, padding: '15px', borderRadius: '8px', border: 'none', background: 'var(--fx-strong)', color: 'white', fontWeight: 'bold', cursor: 'pointer' },
        btnCancel: { flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid var(--fx-line)', background: 'transparent', color: 'var(--fx-muted)', cursor: 'pointer' },
        btnQtd: { width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', transition: '0.2s', padding: 0, lineHeight: 0 },
    };

    const totalPago = () => pagamentos.reduce((acc, p) => acc + (parseFloat(String(p.valor).replace(',', '.')) || 0), 0);
    const linhaPix = () => pagamentos.find(p => p.forma_pagamento === 'pix');

    const handleFinalizarAtendimento = async () => {
        const total = getTotal();
        // Meio de pagamento só é exigido quando sobra algo pra cobrar (produto/serviço fora do
        // plano) — um atendimento 100% coberto pela assinatura não precisa vincular nada.
        if (total > 0) {
            if (pagamentos.some(p => !p.forma_pagamento)) {
                return toast.error('Selecione a forma de pagamento de cada linha.');
            }
            if (pagamentos.length > 1 && Math.abs(totalPago() - total) > 0.01) {
                return toast.error(`A soma das formas de pagamento (R$ ${totalPago().toFixed(2)}) precisa bater com o total (R$ ${total.toFixed(2)}).`);
            }
            if (linhaPix() && !pixInfo?.pago) {
                return toast.error('Gere o Pix dessa linha e aguarde a confirmação antes de finalizar.');
            }
        }
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
                    servicos_adicionais: servicosAdd,
                    aplicar_premio: aplicarPremio,
                    formas_pagamento: total > 0 ? pagamentos.map(p => ({
                        forma_pagamento: p.forma_pagamento,
                        valor: pagamentos.length > 1 ? (parseFloat(String(p.valor).replace(',', '.')) || 0) : total
                    })) : undefined
                })
            });

            const dados = await res.json().catch(() => ({}));

            if (res.ok) {
                // A cobertura pela assinatura é sempre revalidada no servidor (limite mensal
                // pode ter mudado desde que o modal abriu), então o toast reflete o que
                // realmente foi decidido lá, não o preview local.
                const mensagem = dados.servicos_cobrados?.length > 0
                    ? "Atendimento finalizado! Um dos serviços já tinha estourado o limite da assinatura e foi cobrado."
                    : dados.premio_aplicado
                        ? "Atendimento finalizado com a cortesia da ação aplicada!"
                        : "Atendimento finalizado com sucesso!";
                toast.success(mensagem);
                setModalFinalizar(null);
                setExtrasSelecionados([]);
                carregarDados();
                onClose();
            } else {
                toast.error(dados.error || "Não foi possível finalizar o atendimento. Tente novamente.");
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
        setPagamentos([{ forma_pagamento: null, valor: '' }]);
        setPixInfo(null);
        if (pixPollRef.current) { clearInterval(pixPollRef.current); pixPollRef.current = null; }
        setPremio(null);
        setAplicarPremio(false);
        if (!modalFinalizar?.id) { setAssinaturaCheckout({ assinante: false, servicos_ids: [], servicos_agendados_ids: [], restantes: {} }); return; }
        fetch(`${API_URL}/admin/agendamento-usuario/${modalFinalizar.id}`)
            .then(r => r.json())
            .then(d => {
                setAssinaturaCheckout({ assinante: !!d.assinante, servicos_ids: d.servicos_ids || [], servicos_agendados_ids: d.servicos_agendados_ids || [], restantes: d.restantes || {} });
                setPremio(d.premio_fidelidade || null);
            })
            .catch(() => setAssinaturaCheckout({ assinante: false, servicos_ids: [], servicos_agendados_ids: [], restantes: {} }));
    }, [modalFinalizar]);

    useEffect(() => {
        if (!empresaId) return;
        fetch(`${API_URL}/admin/mercadopago`)
            .then(r => r.json())
            .then(d => setMpConectado(!!d.conectado))
            .catch(() => setMpConectado(false));
    }, [empresaId]);

    // Pra parar o polling se o modal fechar/desmontar com um Pix ainda pendente.
    useEffect(() => () => { if (pixPollRef.current) clearInterval(pixPollRef.current); }, []);

    // Muda a forma ou o valor de qualquer linha invalida o Pix já gerado (se a linha do Pix
    // mudou de valor, o QR antigo cobra o valor errado) — força gerar de novo.
    const limparPixDaLinha = () => {
        setPixInfo(null);
        if (pixPollRef.current) { clearInterval(pixPollRef.current); pixPollRef.current = null; }
    };
    const setFormaLinha = (i, forma) => {
        limparPixDaLinha();
        setPagamentos(pagamentos.map((p, idx) => idx === i ? { ...p, forma_pagamento: forma } : p));
    };
    const setValorLinha = (i, valor) => {
        limparPixDaLinha();
        setPagamentos(pagamentos.map((p, idx) => idx === i ? { ...p, valor } : p));
    };
    const adicionarLinhaPagamento = () => {
        limparPixDaLinha();
        if (pagamentos.length === 1) {
            const total = getTotal();
            setPagamentos([{ ...pagamentos[0], valor: total }, { forma_pagamento: null, valor: '' }]);
        } else if (pagamentos.length < 4) {
            setPagamentos([...pagamentos, { forma_pagamento: null, valor: '' }]);
        }
    };
    const removerLinhaPagamento = (i) => {
        limparPixDaLinha();
        if (pagamentos.length <= 2) {
            setPagamentos([{ forma_pagamento: pagamentos[1 - i]?.forma_pagamento || null, valor: '' }]);
        } else {
            setPagamentos(pagamentos.filter((_, idx) => idx !== i));
        }
    };

    const gerarPix = async () => {
        setGerandoPix(true);
        try {
            const produtosVendidos = extrasSelecionados.filter(e => e.tipo === 'produto');
            const servicosAdd = extrasSelecionados.filter(e => e.tipo === 'servico');
            const linha = linhaPix();
            const valorLinhaPix = pagamentos.length > 1 ? (parseFloat(String(linha?.valor).replace(',', '.')) || 0) : null;

            const res = await fetch(`${API_URL}/admin/mercadopago/pix/${modalFinalizar.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    produtos_vendidos: produtosVendidos,
                    servicos_adicionais: servicosAdd,
                    aplicar_premio: aplicarPremio,
                    ...(valorLinhaPix ? { valor: valorLinhaPix } : {})
                })
            });
            const dados = await res.json();
            if (!res.ok) { toast.error(dados.error || 'Não foi possível gerar o Pix.'); return; }

            setPixInfo({ ...dados, pago: false, falhou: false });

            const agendamentoId = modalFinalizar.id;
            // Mesmo limite de tentativas usado em pages/Agenda.js — sem isso o polling ficava
            // pra sempre a cada 4s mesmo com o Pix já expirado/recusado na Mercado Pago.
            let tentativas = 0;
            const LIMITE_TENTATIVAS = 150;
            pixPollRef.current = setInterval(async () => {
                tentativas += 1;
                try {
                    const resStatus = await fetch(`${API_URL}/admin/mercadopago/pix/${agendamentoId}/status`);
                    const statusDados = await resStatus.json();
                    if (statusDados.pagamento_status === 'pago') {
                        clearInterval(pixPollRef.current);
                        pixPollRef.current = null;
                        setPixInfo((atual) => (atual ? { ...atual, pago: true } : atual));
                    } else if (statusDados.pagamento_status === 'falhou' || tentativas >= LIMITE_TENTATIVAS) {
                        clearInterval(pixPollRef.current);
                        pixPollRef.current = null;
                        setPixInfo((atual) => (atual ? { ...atual, falhou: true } : atual));
                    }
                } catch (err) {
                    console.error('Erro ao consultar status do Pix:', err);
                }
            }, 4000);
        } catch (err) {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setGerandoPix(false);
        }
    };

    const copiarCodigoPix = () => {
        if (!pixInfo?.qr_code) return;
        navigator.clipboard.writeText(pixInfo.qr_code)
            .then(() => toast.success('Código Pix copiado!'))
            .catch(() => toast.error('Não foi possível copiar o código.'));
    };

    // Estimativa pra exibição antes de finalizar. A decisão real (e o desconto de fato
    // aplicado) é sempre recalculada no servidor em /admin/finalizar-servico-checkout.
    const getValorBaseSeguro = () => {
        if (!modalFinalizar) return 0;
        const valorGravado = parseFloat(String(modalFinalizar.valor_total || '0').replace(',', '.')) || 0;
        if (!assinaturaCheckout.assinante || assinaturaCheckout.servicos_ids.length === 0) return valorGravado;

        const idsAgendados = assinaturaCheckout.servicos_agendados_ids;
        // Agendamento sem serviço vinculado (encaixe legado): não dá pra recalcular a partir dos
        // serviços, cai no valor gravado — igual o backend faz (ver calcularValorComLimiteAssinante).
        if (idsAgendados.length === 0) return valorGravado;

        // Recalcula o valor cheio a partir dos serviços de fato vinculados, em vez de partir do
        // valor_total gravado na criação: aquele valor já saía ZERADO pra qualquer serviço do
        // plano (a rota /agendar só checa se o serviço está no plano, não se o limite mensal já
        // estourou — ver comentário em calcularValorComLimiteAssinante). Descontar em cima de um
        // valor que já nasceu 0 nunca conseguia recolocar o preço cheio quando o cliente já tinha
        // batido a cota, mesmo com "restante: 0" sendo mostrado corretamente ao lado.
        const valorTotal = idsAgendados.reduce((acc, id) => {
            const s = servicos.find(sv => Number(sv.id) === Number(id));
            return acc + (s ? (parseFloat(String(s.valor || s.preco || '0').replace(',', '.')) || 0) : 0);
        }, 0);

        // Desconta servicos que estao no plano, foram agendados E ainda tem saldo no ciclo
        const idsDescontar = idsAgendados.filter(id =>
            assinaturaCheckout.servicos_ids.includes(id) &&
            (assinaturaCheckout.restantes[id] == null || assinaturaCheckout.restantes[id] > 0)
        );
        if (idsDescontar.length === 0) return valorTotal;
        // Forcar Number em ambos para evitar mismatch string vs number
        const idsDescontarNum = idsDescontar.map(Number);
        const descontoPlano = servicos
            .filter(s => idsDescontarNum.includes(Number(s.id)))
            .reduce((acc, s) => acc + (parseFloat(String(s.valor || s.preco || '0').replace(',', '.')) || 0), 0);
        return Math.max(0, valorTotal - descontoPlano);
    };

    const getValorAdicionais = () => {
        return extrasSelecionados.reduce((acc, curr) => {
            const valor = parseFloat(String(curr.valor || curr.preco || '0').replace(',', '.')) || 0;
            const qtd = curr.quantidade || 1;
            return acc + (valor * qtd);
        }, 0);
    };

    // Estimativa do desconto da cortesia pra exibir antes de finalizar. Mesma regra de
    // calcularDescontoPremio (backend, services/fidelidade.js), que é quem decide de verdade:
    // serviço/produto grátis só se estiver no atendimento; % ou R$ sobre o atendimento inteiro.
    const valorNum = (v) => parseFloat(String(v || '0').replace(',', '.')) || 0;
    const calcularCortesia = () => {
        if (!premio) return { aplicavel: false, desconto: 0, motivo: null };
        const subtotal = getValorBaseSeguro() + getValorAdicionais();
        let desconto = 0;
        if (premio.tipo === 'servico') {
            const idPremio = Number(premio.servico?.id);
            const agendado = assinaturaCheckout.servicos_agendados_ids.map(Number).includes(idPremio);
            const extra = extrasSelecionados.find(e => e.tipo === 'servico' && Number(e.id) === idPremio);
            if (!agendado && !extra) return { aplicavel: false, desconto: 0, motivo: `A cortesia é ${premio.servico?.nome}. Adicione esse serviço acima pra aplicar.` };
            const coberto = agendado && assinaturaCheckout.assinante && assinaturaCheckout.servicos_ids.map(Number).includes(idPremio)
                && (assinaturaCheckout.restantes[idPremio] == null || assinaturaCheckout.restantes[idPremio] > 0);
            desconto = coberto ? 0 : agendado ? valorNum(servicos.find(sv => Number(sv.id) === idPremio)?.valor) : valorNum(extra.valor);
        } else if (premio.tipo === 'produto') {
            const item = extrasSelecionados.find(e => e.tipo === 'produto' && Number(e.id) === Number(premio.produto?.id));
            if (!item) return { aplicavel: false, desconto: 0, motivo: `A cortesia é ${premio.produto?.nome}. Adicione esse produto acima pra aplicar.` };
            desconto = valorNum(item.valor);
        } else if (premio.tipo === 'desconto_percentual') {
            desconto = subtotal * (Number(premio.valor) / 100);
        } else if (premio.tipo === 'desconto_valor') {
            desconto = Number(premio.valor) || 0;
        }
        return { aplicavel: true, desconto: Math.round(Math.min(Math.max(desconto, 0), subtotal) * 100) / 100, motivo: null };
    };
    const cortesia = calcularCortesia();
    const descontoCortesia = aplicarPremio && cortesia.aplicavel ? cortesia.desconto : 0;
    const getTotal = () => Math.max(0, getValorBaseSeguro() + getValorAdicionais() - descontoCortesia);

    // Se o item da cortesia sair do caixa, a cortesia deixa de valer: desmarca pra não mandar
    // aplicar_premio num atendimento em que o servidor vai recusar.
    useEffect(() => {
        if (aplicarPremio && !cortesia.aplicavel) setAplicarPremio(false);
    }, [aplicarPremio, cortesia.aplicavel]);

    const alternarCortesia = () => {
        limparPixDaLinha();
        setPagamentos([{ forma_pagamento: pagamentos[0]?.forma_pagamento || null, valor: '' }]);
        setAplicarPremio(v => !v);
    };


    return (
        <div style={styles.overlay} onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
            <div style={styles.modal}>
                
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {barbeiro.foto_url ? (
                            <img src={barbeiro.foto_url} alt="Profissional" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'var(--fx-strong)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {barbeiro.nome.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>{barbeiro.nome}</h3>
                            <span style={{ fontSize: '13px', color: 'var(--fx-muted)' }}>{dataFormatadaBr}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
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
                                            <strong style={{ display: 'block', fontSize: '14px', color: 'var(--fx-text)' }}>{ag.cliente_nome}</strong>
                                            <p style={{ margin: '2px 0 10px 0', fontSize: '12px', color: 'var(--fx-muted)' }}>{ag.servicos || ag.servico_nome}</p>
                                            
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
                                                        <button style={{...styles.btnAcao, background: 'var(--fx-red-bg)', color: 'var(--fx-red)'}} onClick={() => setModalCancelamento(ag)}>X</button>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: 'var(--fx-faint)', fontStyle: 'italic' }}>Ações bloqueadas para este status.</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div key={hora} style={styles.slotLivre} onClick={() => { setHoraAtiva(hora); setModo('adicionar'); }}>
                                            <strong style={{ fontSize: '16px', color: 'var(--fx-faint)' }}>{hora}</strong>
                                            <span style={{ fontSize: '12px', color: 'var(--fx-faint)' }}>Livre (Clique para encaixar)</span>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    )}

                    {modo === 'adicionar' && (
                        <div style={styles.formAdicionar}>
                            
                            {horaPreSelecionada || horaAtiva ? (
                                <div style={{ background: 'var(--fx-amber-bg)', padding: '10px', borderRadius: '8px', borderLeft: '4px solid #f59e0b', marginBottom: '15px' }}>
                                    <strong style={{ color: 'var(--fx-amber)', fontSize: '14px' }}>Horário do Encaixe: {horaPreSelecionada || horaAtiva}</strong>
                                </div>
                            ) : (
                                <div style={{ color: 'var(--fx-red)', fontSize: '12px', marginBottom: '15px', background: 'var(--fx-red-bg)', padding: '10px', borderRadius: '8px' }}>
                                    Nenhum horário selecionado. Volte para a aba "Ver Agenda" e clique em um horário livre.
                                </div>
                            )}

                            <label style={styles.label}>1. Busque o Cliente</label>
                            
                            {clienteSelecionado ? (
                                <div style={{ background: 'var(--fx-green-bg)', padding: '12px', borderRadius: '8px', border: '1px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <strong style={{ display: 'block', color: 'var(--fx-green)' }}>{clienteSelecionado.nome || clienteSelecionado.nome_completo}</strong>
                                        <span style={{ fontSize: '12px', color: 'var(--fx-green)' }}>{clienteSelecionado.telefone || clienteSelecionado.tel}</span>
                                    </div>
                                    <button onClick={() => setClienteSelecionado(null)} style={{ background: 'none', border: 'none', color: 'var(--fx-red)', cursor: 'pointer', fontWeight: 'bold' }}>Trocar</button>
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
                                        <div style={{ position: 'absolute', top: '45px', left: 0, right: 0, background: 'var(--fx-card)', border: '1px solid var(--fx-line-2)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999 }}>
                                            {clientesEncontrados.map(c => (
                                                <div key={c.id} style={{ padding: '12px 15px', borderBottom: '1px solid var(--fx-line)', cursor: 'pointer', background: 'var(--fx-card)' }} onClick={() => { setClienteSelecionado(c); setBuscaCliente(''); setClientesEncontrados([]); }}>
                                                    <strong style={{ display: 'block', fontSize: '14px', color: 'var(--fx-text)' }}>
                                                        {c.nome || c.nome_completo || 'Cliente'} | {c.telefone || c.tel || 'Sem número'}
                                                    </strong>
                                                    <span style={{ fontSize: '12px', color: 'var(--fx-muted)' }}>{c.email}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ textAlign: 'center', margin: '15px 0', fontSize: '12px', color: 'var(--fx-faint)', fontWeight: 'bold' }}>OU CADASTRAR NOVO CLIENTE</div>
                                    
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
                                            <span style={{ fontSize: '10px', color: 'var(--fx-muted)', marginBottom: '2px', fontWeight: 'bold', textTransform: 'uppercase' }}>Data de Nasc. *</span>
                                            <input style={{...styles.input, marginBottom: 0, width: '100%'}} type="date" value={novoCliente.nasc} onChange={e => setNovoCliente({...novoCliente, nasc: e.target.value})} />
                                        </div>
                                    </div>
                                    <small style={{display: 'block', color: 'var(--fx-faint)', fontSize: '11px', marginTop: '8px'}}>* Todos os campos são obrigatórios.</small>
                                </div>
                            )}

                            <label style={styles.label}>2. Escolha os Serviços</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                {servicos.map(s => {
                                    const isSel = servicosSelecionados.find(sel => sel.id === s.id);
                                    return (
                                        <div key={s.id} onClick={() => toggleServico(s)} style={{ padding: '10px', border: `1px solid ${isSel ? 'var(--fx-strong)' : 'var(--fx-line)'}`, background: isSel ? 'var(--fx-strong)' : 'var(--fx-surface-2)', color: isSel ? '#fff' : 'var(--fx-text)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontSize: '13px', transition: '0.2s' }}>
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
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--fx-line)', paddingBottom: '10px', color: 'var(--fx-text)' }}>Finalizar Atendimento (PDV)</h3>
                        
                        <div style={subModalStyles.clientBadge}>
                            <strong style={{ display: 'block', fontSize: '16px', color: 'var(--fx-text)' }}>{modalFinalizar.cliente_nome}</strong>
                            <span style={{ fontSize: '13px', color: 'var(--fx-green)', fontWeight: 'bold' }}>{modalFinalizar.servicos}</span>
                        </div>

                        <label style={subModalStyles.label}>Adicionar Mais Serviços:</label>
                        <div style={{ maxHeight: '130px', flexShrink: 0, overflowY: 'auto', marginBottom: '15px', border: '1px solid var(--fx-line)', padding: '5px', borderRadius: '8px', background: 'var(--fx-surface-2)' }}>
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
                                            padding: '8px 12px', borderBottom: '1px solid var(--fx-line)',
                                            backgroundColor: selecionado ? 'var(--fx-green-bg)' : 'var(--fx-card)',
                                            cursor: jaAgendado ? 'default' : 'pointer',
                                            opacity: jaAgendado ? 0.4 : 1,
                                            borderRadius: '6px', transition: '0.2s',
                                            marginBottom: '4px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: selecionado ? 'var(--fx-green)' : 'var(--fx-text)' }}>
                                                {s.nome} {jaAgendado && <small style={{ fontWeight: 'normal', color: 'var(--fx-faint)' }}>(Já incluso)</small>}
                                            </span>
                                            <span style={{ fontSize: '11px', color: selecionado ? 'var(--fx-green)' : 'var(--fx-muted)' }}>+ R$ {parseFloat(String(s.valor || s.preco || '0').replace(',', '.')).toFixed(2)}</span>
                                        </div>
                                        
                                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: selecionado ? 'none' : '1px solid var(--fx-line-2)', backgroundColor: selecionado ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selecionado && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <label style={subModalStyles.label}>Vender Produtos de Estoque:</label>
                        <div style={{ maxHeight: '150px', flexShrink: 0, overflowY: 'auto', marginBottom: '20px', border: '1px solid var(--fx-line)', padding: '5px', borderRadius: '8px', background: 'var(--fx-surface-2)' }}>
                            {estoque.length > 0 ? estoque.filter(p => p.ativo !== 0).map(p => {
                                const itemNoCarrinho = extrasSelecionados.find(item => item.id === p.id && item.tipo === 'produto');
                                const qtd = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;

                                return (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--fx-line)', backgroundColor: qtd > 0 ? 'var(--fx-blue-bg)' : 'var(--fx-card)', borderRadius: '6px', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--fx-text)' }}>{p.nome}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--fx-muted)' }}>R$ {parseFloat(String(p.valor || '0').replace(',', '.')).toFixed(2)} | <small>{p.quantidade} un</small></span>
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
                                            }} style={{...subModalStyles.btnQtd, backgroundColor: qtd >= p.quantidade ? 'var(--fx-surface-2)' : 'var(--fx-strong)', color: qtd >= p.quantidade ? 'var(--fx-faint)' : '#fff', cursor: qtd >= p.quantidade ? 'not-allowed' : 'pointer' }} disabled={qtd >= p.quantidade}>+</button>
                                        </div>
                                    </div>
                                );
                            }) : <p style={{textAlign:'center', color:'var(--fx-faint)', fontSize:'12px', margin: '15px 0'}}>Estoque vazio.</p>}
                        </div>

                        <div style={{ marginBottom: '15px', borderTop: '2px solid var(--fx-line)', paddingTop: '15px' }}>
                            {assinaturaCheckout.assinante && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', padding: '6px 10px', background: 'var(--fx-violet-bg)', borderRadius: '6px', border: '1px solid var(--fx-violet-line)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--fx-violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M11 3L8 9l4 13 4-13-3-6"></path><line x1="2" y1="9" x2="22" y2="9"></line></svg>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--fx-violet)' }}>Assinante: serviços do plano descontados</span>
                                    </div>
                                    {assinaturaCheckout.servicos_agendados_ids
                                        .filter(id => assinaturaCheckout.servicos_ids.includes(id))
                                        .map(id => {
                                            const nome = servicos.find(sv => Number(sv.id) === Number(id))?.nome || 'Serviço';
                                            const restante = assinaturaCheckout.restantes[id];
                                            return (
                                                <span key={id} style={{ fontSize: '11px', color: 'var(--fx-violet)', paddingLeft: '18px' }}>
                                                    {nome}: {restante == null ? 'ilimitado' : `${Math.max(0, restante)} restante(s) neste ciclo`}
                                                </span>
                                            );
                                        })}
                                </div>
                            )}
                            {premio && modalFinalizar.status !== 'concluido' && (
                                <div className={`oa-cortesia${aplicarPremio ? ' aplicada' : ''}`}>
                                    <div className="oa-cortesia-icone" aria-hidden="true">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                                    </div>
                                    <div className="oa-cortesia-texto">
                                        <small>Bateu a meta da ação {premio.campanha_nome}</small>
                                        <strong>{premio.descricao}</strong>
                                        {cortesia.motivo
                                            ? <span className="oa-cortesia-aviso">{cortesia.motivo}</span>
                                            : premio.tipo === 'manual'
                                                ? <span>Prêmio sem valor automático: entregue ao cliente e marque aqui pra registrar.</span>
                                                : <span>{aplicarPremio ? `Cortesia aplicada: menos R$ ${cortesia.desconto.toFixed(2)}.` : `Aplicando, sai R$ ${cortesia.desconto.toFixed(2)} mais barato.`} O que passar do prêmio é cobrado normalmente.</span>}
                                    </div>
                                    <button type="button" className="oa-cortesia-botao" onClick={alternarCortesia} disabled={!cortesia.aplicavel}>
                                        {aplicarPremio ? 'Remover' : 'Aplicar cortesia'}
                                    </button>
                                </div>
                            )}
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '13px', color: 'var(--fx-muted)' }}>Base: R$ {getValorBaseSeguro().toFixed(2)}</span><br/>
                                {descontoCortesia > 0 && <><span style={{ fontSize: '13px', color: 'var(--fx-green)' }}>Cortesia da ação: − R$ {descontoCortesia.toFixed(2)}</span><br/></>}
                                <strong style={{ fontSize: '22px', color: 'var(--fx-text)' }}>Total: R$ {getTotal().toFixed(2)}</strong>
                            </div>
                        </div>

                        {modalFinalizar.status !== 'concluido' && (getTotal() > 0) && (
                            <div style={{ marginBottom: '15px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fx-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Forma de pagamento</span>
                                {pagamentos.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {[
                                                { valor: 'dinheiro', rotulo: 'Dinheiro' },
                                                { valor: 'credito', rotulo: 'Crédito' },
                                                { valor: 'debito', rotulo: 'Débito' },
                                                { valor: 'pix', rotulo: 'Pix' }
                                            ].map((opcao) => (
                                                <button
                                                    key={opcao.valor}
                                                    type="button"
                                                    onClick={() => setFormaLinha(i, p.forma_pagamento === opcao.valor ? null : opcao.valor)}
                                                    style={{
                                                        padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                                        border: p.forma_pagamento === opcao.valor ? '1px solid var(--fx-strong)' : '1px solid var(--fx-line-2)',
                                                        background: p.forma_pagamento === opcao.valor ? 'var(--fx-strong)' : 'var(--fx-card)',
                                                        color: p.forma_pagamento === opcao.valor ? '#fff' : 'var(--fx-text)'
                                                    }}
                                                >
                                                    {opcao.rotulo}
                                                </button>
                                            ))}
                                        </div>
                                        {pagamentos.length > 1 && (
                                            <>
                                                <input
                                                    type="number" min="0" step="0.01" placeholder="0,00"
                                                    value={p.valor}
                                                    onChange={(e) => setValorLinha(i, e.target.value)}
                                                    style={{ width: '80px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', fontSize: '13px' }}
                                                />
                                                <button type="button" onClick={() => removerLinhaPagamento(i)} title="Remover linha" style={{ border: 'none', background: 'none', color: 'var(--fx-red)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {pagamentos.length === 1 ? (
                                    <button type="button" onClick={adicionarLinhaPagamento} style={{ border: 'none', background: 'none', color: 'var(--fx-blue)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: 0, marginTop: '2px' }}>
                                        + Dividir em mais de uma forma de pagamento
                                    </button>
                                ) : (
                                    <>
                                        <p style={{ margin: '4px 0 0', fontSize: '12px', fontWeight: '600', color: Math.abs(totalPago() - getTotal()) > 0.01 ? 'var(--fx-red)' : 'var(--fx-green)' }}>
                                            Somado: R$ {totalPago().toFixed(2)} de R$ {getTotal().toFixed(2)}
                                        </p>
                                        {pagamentos.length < 4 && (
                                            <button type="button" onClick={adicionarLinhaPagamento} style={{ border: 'none', background: 'none', color: 'var(--fx-blue)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: 0, marginTop: '4px' }}>
                                                + Adicionar outra forma
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {modalFinalizar.status !== 'concluido' && linhaPix() && mpConectado && (
                            <div style={{ marginBottom: '15px', padding: '14px', borderRadius: '10px', border: '1px solid var(--fx-line)', background: 'var(--fx-surface-2)' }}>
                                {!pixInfo ? (
                                    <LoadingButton
                                        loading={gerandoPix}
                                        onClick={gerarPix}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--fx-strong)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        {pagamentos.length > 1 ? `Gerar Pix (R$ ${(parseFloat(String(linhaPix()?.valor).replace(',', '.')) || 0).toFixed(2)})` : 'Gerar Pix'}
                                    </LoadingButton>
                                ) : pixInfo.pago ? (
                                    <p style={{ margin: 0, textAlign: 'center', color: 'var(--fx-green)', fontWeight: '700', fontSize: '14px' }}>Pix recebido.</p>
                                ) : pixInfo.falhou ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 10px', color: 'var(--fx-red)', fontWeight: '700', fontSize: '13px' }}>Esse Pix não foi confirmado (recusado ou expirado).</p>
                                        <LoadingButton
                                            loading={gerandoPix}
                                            onClick={gerarPix}
                                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--fx-strong)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                                        >
                                            Gerar novo Pix
                                        </LoadingButton>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        {pixInfo.qr_code_base64 && (
                                            <img
                                                src={`data:image/png;base64,${pixInfo.qr_code_base64}`}
                                                alt="QR Code do Pix"
                                                style={{ width: '160px', maxWidth: '100%', height: 'auto', aspectRatio: '1', border: '1px solid var(--fx-line)', borderRadius: '8px', padding: '6px', background: 'var(--fx-card)' }}
                                            />
                                        )}
                                        <p style={{ margin: '10px 0 6px', fontSize: '12px', color: 'var(--fx-muted)' }}>Peça pro cliente escanear ou copiar o código Pix abaixo.</p>
                                        <button
                                            type="button"
                                            onClick={copiarCodigoPix}
                                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', cursor: 'pointer', fontSize: '12px' }}
                                        >
                                            Copiar código Pix
                                        </button>
                                        <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--fx-faint)' }}>Aguardando confirmação do pagamento...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button style={subModalStyles.btnCancel} onClick={() => { setModalFinalizar(null); onClose && onClose(); }}>Voltar</button>
                            
                            {modalFinalizar.status !== 'concluido' ? (
                                <>
                                    <button style={{...subModalStyles.btnConfirm, background: '#ef4444'}} onClick={() => { setModalCancelamento(modalFinalizar); setModalFinalizar(null); }}>Cancelar Horário</button>
                                    <LoadingButton loading={finalizando} style={{...subModalStyles.btnConfirm, background: '#10b981'}} onClick={handleFinalizarAtendimento}>
                                        {(getTotal() > 0) ? 'Cobrar & Finalizar' : 'Finalizar Serviço'}
                                    </LoadingButton>
                                </>
                            ) : (
                                <button style={{...subModalStyles.btnConfirm, background: 'var(--fx-surface-3)', cursor: 'not-allowed'}} disabled>Atendimento Fechado</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CANCELAMENTO */}
            {modalCancelamento && (
                <div style={subModalStyles.overlay}>
                    <div style={subModalStyles.card}>
                        <h3 style={{ marginTop: 0, color: 'var(--fx-text)' }}>Cancelar Agendamento</h3>
                        <p style={{ fontSize: '14px', color: 'var(--fx-muted)' }}>Deseja cancelar o horário de <b>{modalCancelamento.cliente_nome}</b>?</p>
                        
                        <label style={subModalStyles.label}>Motivo do Cancelamento</label>
                        <textarea 
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', height: '80px', marginBottom: '15px', boxSizing: 'border-box', outline: 'none' }}
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
    modal: { width: '450px', maxWidth: '100%', height: '100vh', backgroundColor: 'var(--fx-card)', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' },
    header: { padding: '25px', borderBottom: '1px solid var(--fx-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--fx-card)' },
    closeBtn: { background: 'none', border: 'none', fontSize: '20px', color: 'var(--fx-faint)', cursor: 'pointer' },
    tabs: { display: 'flex', borderBottom: '1px solid var(--fx-line)' },
    tab: { flex: 1, padding: '15px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: 'var(--fx-faint)' },
    tabAtiva: { flex: 1, padding: '15px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: 'var(--fx-text)', borderBottom: '3px solid var(--fx-acento)' },
    content: { padding: '25px', overflowY: 'auto', flex: 1 },
    
    horariosGrid: { display: 'grid', gap: '15px' },
    slotLivre: { padding: '15px', border: '1px dashed #cbd5e1', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: '0.2s', background: 'var(--fx-card)' },
    slotOcupado: { padding: '15px', border: '1px solid var(--fx-line)', borderRadius: '12px', display: 'flex', flexDirection: 'column', background: 'var(--fx-card)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' },
    btnAcao: { padding: '10px 12px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' },
    
    formAdicionar: { display: 'flex', flexDirection: 'column' },
    label: { fontSize: '13px', fontWeight: '800', color: 'var(--fx-muted)', marginBottom: '10px', display: 'block', textTransform: 'uppercase' },
    input: { width: '100%', padding: '12px', border: '1px solid var(--fx-line-2)', borderRadius: '8px', marginBottom: '10px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' },
    btnSalvar: { background: 'var(--fx-strong)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }
};

export default AgendaModal;