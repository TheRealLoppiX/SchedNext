import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

function formatarDataLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function inicioDoMes() {
  const d = new Date();
  return formatarDataLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// data_hora vem do banco "ingênuo": os números representam o horário de parede pretendido (ex:
// 08:00), só que salvos com rótulo UTC (+00), sem conversão real de fuso — mesma pegadinha
// documentada em Dashboard.js. toLocaleString faria uma conversão de fuso de verdade e mostraria
// 3h a menos; usamos os getters UTC pra pegar exatamente os números gravados.
function formatarDataHora(iso) {
  const d = new Date(iso);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hora = String(d.getUTCHours()).padStart(2, '0');
  const minuto = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dia}/${mes} ${hora}:${minuto}`;
}

const LABEL_AGRUPAMENTO = { dia: 'dia', mes: 'mês', ano: 'ano' };

// Pagamento dividido (formas_pagamento, ver sql/2026_split_pagamento.sql) mostra cada perna com
// seu valor; senão cai na forma única de sempre.
function formatarFormaPagamentoRelatorio(item) {
  if (item.formas_pagamento && item.formas_pagamento.length > 0) {
    return item.formas_pagamento.map((p) => `${p.forma_pagamento} ${formatarMoeda(p.valor)}`).join(' + ');
  }
  return item.forma_pagamento || '-';
}

// Cada item de serie_diaria vem com `data` no formato do agrupamento escolhido: 'YYYY-MM-DD'
// (dia), 'YYYY-MM' (mês) ou 'YYYY' (ano) — ver chaveAgrupamento em routes/relatorios.js.
function formatarRotuloPeriodo(data, agrupamento) {
  if (agrupamento === 'ano') return data;
  if (agrupamento === 'mes') return `${data.slice(5, 7)}/${data.slice(0, 4)}`;
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

function AdminRelatorios({ empresaId }) {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState('');
  const [dataInicio, setDataInicio] = useState(inicioDoMes());
  const [dataFim, setDataFim] = useState(formatarDataLocal(new Date()));
  const [ia, setIa] = useState({ disponivel: false, gerando: false, texto: '' });

  // Filtros opcionais estilo BI (Power BI/Tableau): granularidade do gráfico de faturamento e
  // seções que podem ser ligadas/desligadas tanto na tela quanto na exportação.
  const [agrupamento, setAgrupamento] = useState('dia');
  const [mostrarComissionamento, setMostrarComissionamento] = useState(true);
  // Controla TANTO o detalhamento por atendimento dentro do comissionamento (itens por
  // profissional) QUANTO a tabela geral "Detalhamento por atendimento" mais abaixo — são
  // independentes um do outro (dá pra ver o detalhamento geral sem abrir comissionamento).
  const [mostrarDetalhamento, setMostrarDetalhamento] = useState(true);
  // Filtro por serviço(s) feito(s) — vazio = todos. Mantém o agendamento inteiro (valor_total
  // completo) sempre que ele incluiu pelo menos um dos serviços marcados (ver
  // filtrarPorServicos em routes/relatorios.js); não recorta só a fatia do serviço escolhido.
  const [servicosDisponiveis, setServicosDisponiveis] = useState([]);
  const [servicosSelecionados, setServicosSelecionados] = useState([]);
  // Filtro por tipo de cliente — 'todos' (padrão), 'assinante' ou 'avulso' (ver tipoClienteFiltro
  // em routes/relatorios.js, mesma heurística usada no rateio de comissão).
  const [tipoCliente, setTipoCliente] = useState('todos');

  // Snapshot dos filtros que REALMENTE valem pro relatório atual — só muda quando "Aplicar" é
  // clicado (ver aplicarFiltros). Os estados acima (dataInicio, agrupamento, etc.) só controlam o
  // que aparece digitado/marcado nos campos; mudar um deles sozinho não busca nada de novo. Sem
  // essa separação, o relatório atualizava sozinho a cada campo mudado, e o botão "Aplicar" virava
  // decoração confusa.
  const [filtrosAplicados, setFiltrosAplicados] = useState(() => ({
    dataInicio, dataFim, agrupamento, servicosSelecionados, tipoCliente, mostrarComissionamento, mostrarDetalhamento
  }));

  // Taxas de maquineta e comissionamento não são exclusivos do plano Enterprise — são
  // necessidade operacional básica de qualquer negócio com equipe (ver PENDENCIAS.md).
  const [taxas, setTaxas] = useState({ dinheiro: 0, credito: 0, debito: 0, pix: 0 });
  const [salvandoTaxas, setSalvandoTaxas] = useState(false);
  const [comissionamento, setComissionamento] = useState(null);
  const [carregandoComissao, setCarregandoComissao] = useState(true);
  const [profissionalExpandido, setProfissionalExpandido] = useState(null);

  const idEfetivo = empresaId || localStorage.getItem('empresaId');

  const carregarPermissao = useCallback(async () => {
    if (!idEfetivo) return setCarregando(false);
    try {
      const res = await fetch(`${API_URL}/admin/empresa/${idEfetivo}`);
      const dados = await res.json();
      setIa((prev) => ({ ...prev, disponivel: !!dados?.plano_plataforma?.permite_ia }));
    } catch (err) {
      console.error('Erro ao verificar plano da empresa:', err);
    } finally {
      setCarregando(false);
    }
  }, [idEfetivo]);

  useEffect(() => { carregarPermissao(); }, [carregarPermissao]);

  useEffect(() => {
    if (!idEfetivo) return;
    fetch(`${API_URL}/admin/servicos`)
      .then((r) => r.json())
      .then((dados) => setServicosDisponiveis(Array.isArray(dados) ? dados : []))
      .catch((err) => console.error('Erro ao carregar serviços para o filtro:', err));
  }, [idEfetivo]);

  // Resumo executivo em texto do período filtrado — reaproveita o mesmo endpoint/padrão de
  // resumo-dashboard (ver routes/ia.js e AdminDashboard.js), só trocando os dados enviados.
  const gerarResumoIA = async () => {
    if (!relatorio) return;
    setIa((prev) => ({ ...prev, gerando: true }));
    try {
      const res = await fetch(`${API_URL}/admin/ia/resumo-relatorio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats: { periodo: relatorio.periodo, ...relatorio.resumo, top_servicos: relatorio.top_servicos, top_profissionais: relatorio.top_profissionais } })
      });
      const dados = await res.json();
      if (res.ok) setIa((prev) => ({ ...prev, texto: dados.resumo }));
      else toast.error(dados.error || 'Não foi possível gerar o resumo agora.');
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setIa((prev) => ({ ...prev, gerando: false }));
    }
  };

  const carregarTaxas = useCallback(async () => {
    if (!idEfetivo) return;
    try {
      const res = await fetch(`${API_URL}/admin/taxas-pagamento/${idEfetivo}`);
      const dados = await res.json();
      if (res.ok) setTaxas(dados.taxas_pagamento);
    } catch (err) {
      console.error('Erro ao carregar taxas de pagamento:', err);
    }
  }, [idEfetivo]);

  useEffect(() => { carregarTaxas(); }, [carregarTaxas]);

  const salvarTaxas = async () => {
    setSalvandoTaxas(true);
    try {
      const res = await fetch(`${API_URL}/admin/taxas-pagamento`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxas_pagamento: taxas })
      });
      if (res.ok) {
        toast.success('Taxas salvas!');
        carregarComissionamento();
        gerarRelatorio();
      } else {
        toast.error('Não foi possível salvar as taxas.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setSalvandoTaxas(false);
    }
  };

  const carregarComissionamento = useCallback(async () => {
    if (!idEfetivo) return;
    const f = filtrosAplicados;
    // Seção desligada no filtro: nem chama o endpoint (é o cálculo mais pesado do relatório,
    // com o rateio de assinatura por ciclo — ver routes/relatorios.js).
    if (!f.mostrarComissionamento) { setComissionamento(null); setCarregandoComissao(false); return; }
    setCarregandoComissao(true);
    try {
      const res = await fetch(`${API_URL}/admin/relatorios/comissionamento/${idEfetivo}?dataInicio=${f.dataInicio}&dataFim=${f.dataFim}&incluirItens=${f.mostrarDetalhamento}&servicos=${f.servicosSelecionados.join(',')}`);
      const dados = await res.json();
      if (res.ok) setComissionamento(dados);
    } catch (err) {
      console.error('Erro ao carregar comissionamento:', err);
    } finally {
      setCarregandoComissao(false);
    }
  }, [idEfetivo, filtrosAplicados]);

  useEffect(() => { carregarComissionamento(); }, [carregarComissionamento]);

  // O endpoint agora devolve um resumo pra todo plano pago (com filtro de data), não só
  // Enterprise — a resposta traz `avancado` pra decidir se as seções extras
  // (rankings/recorrência/comparação) aparecem ou ficam atrás do upsell abaixo.
  const gerarRelatorio = useCallback(async () => {
    if (!idEfetivo) return;
    const f = filtrosAplicados;
    setGerando(true);
    setErro('');
    try {
      const res = await fetch(`${API_URL}/admin/relatorios/${idEfetivo}?dataInicio=${f.dataInicio}&dataFim=${f.dataFim}&agrupamento=${f.agrupamento}&servicos=${f.servicosSelecionados.join(',')}&tipoCliente=${f.tipoCliente}&incluirDetalhamento=${f.mostrarDetalhamento}`);
      const data = await res.json();
      if (res.ok) {
        setRelatorio(data);
      } else {
        setErro(data.error || 'Não foi possível gerar o relatório.');
      }
    } catch (err) {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setGerando(false);
    }
  }, [idEfetivo, filtrosAplicados]);

  useEffect(() => { gerarRelatorio(); }, [gerarRelatorio]);

  // Único gatilho que efetivamente busca dados de novo — clicar em campos/checkboxes do filtro só
  // muda o que está digitado/marcado, sem disparar nada sozinho (ver filtrosAplicados acima).
  const aplicarFiltros = () => {
    setFiltrosAplicados({ dataInicio, dataFim, agrupamento, servicosSelecionados, tipoCliente, mostrarComissionamento, mostrarDetalhamento });
  };

  const exportarCsv = () => {
    if (!relatorio) return;
    const linhas = [];
    linhas.push('Relatório avançado');
    linhas.push(`Período,${relatorio.periodo.inicio} a ${relatorio.periodo.fim}`);
    linhas.push(`Serviços,${nomesServicosFiltrados || 'Todos'}`);
    linhas.push('');
    linhas.push('Resumo');
    linhas.push(`Faturamento total,${relatorio.resumo.faturamento_total}`);
    linhas.push(`Receita líquida,${relatorio.resumo.receita_liquida}`);
    linhas.push(`Ticket médio,${relatorio.resumo.ticket_medio}`);
    linhas.push(`Atendimentos concluídos,${relatorio.resumo.quantidade_concluidos}`);
    linhas.push(`Taxa de descontos de maquineta (%),${relatorio.resumo.descontos_pct}`);
    linhas.push(`Descontos de maquineta (R$),${relatorio.resumo.descontos_valor}`);
    linhas.push(`Variação vs período anterior (%),${relatorio.resumo.variacao_faturamento_pct}`);
    linhas.push(`Taxa de clientes recorrentes (%),${relatorio.recorrencia ? relatorio.recorrencia.taxa_recorrencia_pct : ''}`);
    linhas.push('');
    linhas.push(tituloFaturamentoPorPeriodo);
    linhas.push('Período,Serviço,Tipo,Faturamento,Quantidade');
    relatorio.detalhe_periodo.forEach((d) => linhas.push(`${formatarRotuloPeriodo(d.periodo, agrupamentoAplicado)},${d.servico},${d.tipo === 'assinante' ? 'Assinante' : 'Avulso'},${d.faturamento},${d.quantidade}`));
    linhas.push('');
    linhas.push('Detalhamento por atendimento');
    linhas.push('Data,Cliente,Serviço,Tipo,Forma de pagamento,Valor');
    relatorio.detalhamento_atendimentos.forEach((item) => linhas.push(`${formatarDataHora(item.data_hora)},${item.cliente},${item.servico},${item.tipo === 'assinante' ? 'Assinante' : 'Avulso'},${formatarFormaPagamentoRelatorio(item)},${item.valor}`));
    linhas.push('');
    linhas.push('Top serviços');
    linhas.push('Serviço,Quantidade,Faturamento');
    relatorio.top_servicos.forEach((s) => linhas.push(`${s.nome},${s.quantidade},${s.faturamento}`));
    linhas.push('');
    linhas.push('Top profissionais');
    linhas.push('Profissional,Quantidade,Faturamento');
    relatorio.top_profissionais.forEach((p) => linhas.push(`${p.nome},${p.quantidade},${p.faturamento}`));
    if (comissionamento) {
      linhas.push('');
      linhas.push('Comissionamento por profissional');
      linhas.push('Profissional,% comissão,Atendimentos,Receita bruta,Receita líquida,Comissão');
      comissionamento.profissionais.forEach((p) => linhas.push(`${p.nome},${p.percentual_comissao},${p.quantidade},${p.receita_bruta},${p.receita_liquida},${p.comissao}`));
      linhas.push('');
      linhas.push('Detalhamento por atendimento');
      linhas.push('Profissional,Data,Cliente,Serviço(s),Origem,Receita líquida,Comissão');
      comissionamento.profissionais.forEach((p) => {
        (p.itens || []).forEach((item) => {
          const origem = item.tipo === 'assinante' ? `Assinante (rateio ${item.visitas_no_mes}x)` : 'Avulso';
          const servicos = item.servicos.length ? item.servicos.join(' | ') : '-';
          linhas.push(`${p.nome},${item.data},${item.cliente},${servicos},${origem},${item.receita_liquida},${item.comissao}`);
        });
      });
    }

    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${relatorio.periodo.inicio}-a-${relatorio.periodo.fim}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Nomes de serviço/profissional vêm de cadastro livre — sem escapar, um nome com
  // "<script>" executaria dentro da janela de impressão (mesmo cuidado do relatório de estoque).
  const escaparHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const exportarPdf = () => {
    if (!relatorio) return;
    const janela = window.open('', '_blank');
    if (!janela) {
      return toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');
    }

    const periodo = `${new Date(relatorio.periodo.inicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(relatorio.periodo.fim + 'T00:00:00').toLocaleDateString('pt-BR')}`;

    const cards = [
      ['Faturamento no período', formatarMoeda(relatorio.resumo.faturamento_total)],
      ['Receita líquida', formatarMoeda(relatorio.resumo.receita_liquida)],
      ['Ticket médio', formatarMoeda(relatorio.resumo.ticket_medio)],
      ['Atendimentos concluídos', relatorio.resumo.quantidade_concluidos],
      ['Descontos de maquineta', `${relatorio.resumo.descontos_pct}% (${formatarMoeda(relatorio.resumo.descontos_valor)})`]
    ];
    if (relatorio.avancado) {
      cards.push(['Variação vs período anterior', `${variacao >= 0 ? '+' : ''}${variacao}%`]);
      if (relatorio.recorrencia) cards.push(['Clientes recorrentes', `${relatorio.recorrencia.taxa_recorrencia_pct}%`]);
    }
    const cardsHtml = cards.map(([label, valor]) => (
      `<div class='card'><span class='card-label'>${escaparHtml(label)}</span><span class='card-valor'>${escaparHtml(valor)}</span></div>`
    )).join('');

    const tabela = (titulo, cabecalhos, linhas) => {
      if (!linhas.length) return '';
      const thead = cabecalhos.map((c) => `<th>${escaparHtml(c)}</th>`).join('');
      const tbody = linhas.map((l) => `<tr>${l.map((v) => `<td>${escaparHtml(v)}</td>`).join('')}</tr>`).join('');
      return `<h2>${escaparHtml(titulo)}</h2><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    };

    const faturamentoDiarioHtml = tabela(
      tituloFaturamentoPorPeriodo,
      ['Período', 'Serviço', 'Tipo', 'Faturamento', 'Qtd'],
      relatorio.detalhe_periodo.map((d) => [
        formatarRotuloPeriodo(d.periodo, agrupamentoAplicado),
        d.servico,
        d.tipo === 'assinante' ? 'Assinante' : 'Avulso',
        formatarMoeda(d.faturamento),
        d.quantidade
      ])
    );

    const detalhamentoAtendimentosHtml = tabela(
      'Detalhamento por atendimento',
      ['Data', 'Cliente', 'Serviço', 'Tipo', 'Forma de pagamento', 'Valor'],
      relatorio.detalhamento_atendimentos.map((item) => [
        formatarDataHora(item.data_hora),
        item.cliente,
        item.servico,
        item.tipo === 'assinante' ? 'Assinante' : 'Avulso',
        formatarFormaPagamentoRelatorio(item),
        formatarMoeda(item.valor)
      ])
    );

    const topServicosHtml = relatorio.avancado ? tabela(
      'Top serviços',
      ['Serviço', 'Quantidade', 'Faturamento'],
      relatorio.top_servicos.map((s) => [s.nome, s.quantidade, formatarMoeda(s.faturamento)])
    ) : '';

    const topProfissionaisHtml = relatorio.avancado ? tabela(
      'Top profissionais',
      ['Profissional', 'Quantidade', 'Faturamento'],
      relatorio.top_profissionais.map((p) => [p.nome, p.quantidade, formatarMoeda(p.faturamento)])
    ) : '';

    const comissionamentoHtml = comissionamento && comissionamento.profissionais.length ? tabela(
      'Comissionamento por profissional',
      ['Profissional', '% comissão', 'Atendimentos', 'Receita bruta', 'Receita líquida', 'A pagar'],
      comissionamento.profissionais.map((p) => [p.nome, `${p.percentual_comissao}%`, p.quantidade, formatarMoeda(p.receita_bruta), formatarMoeda(p.receita_liquida), formatarMoeda(p.comissao)])
    ) : '';

    const detalhamentoLinhas = comissionamento
      ? comissionamento.profissionais.flatMap((p) => (p.itens || []).map((item) => [
        p.nome,
        formatarDataHora(item.data),
        item.cliente,
        item.servicos.length ? item.servicos.join(', ') : '-',
        item.tipo === 'assinante' ? `Assinante (${item.visitas_no_mes}x/mês)` : 'Avulso',
        formatarMoeda(item.receita_liquida),
        formatarMoeda(item.comissao)
      ]))
      : [];
    const detalhamentoHtml = tabela(
      'Detalhamento por atendimento',
      ['Profissional', 'Data', 'Cliente', 'Serviço(s)', 'Origem', 'Receita líquida', 'Comissão'],
      detalhamentoLinhas
    );

    janela.document.write(`<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Relatório - ${escaparHtml(periodo)}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;padding:32px;color:#111827}
      h1{font-size:22px;font-weight:800;margin-bottom:4px}
      .sub{font-size:13px;color:#6b7280;margin-bottom:14px}
      .periodo{display:inline-block;background:#f3f4f6;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;color:#374151;margin-bottom:22px}
      .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:26px}
      .card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
      .card-label{display:block;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
      .card-valor{display:block;font-size:16px;font-weight:800;color:#111827}
      h2{font-size:14px;margin:22px 0 10px;color:#111827}
      table{width:100%;border-collapse:collapse;margin-bottom:6px}
      thead tr{background:#111827}
      th{padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.4px}
      td{padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6}
      tr:nth-child(even) td{background:#f9fafb}
      .footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:right}
      @media print{@page{margin:16mm}}
    </style></head><body>
      <h1>Relatório avançado</h1>
      <p class='sub'>Faturamento, taxas de maquineta, comissionamento e desempenho da equipe.</p>
      <span class='periodo'>Período: ${escaparHtml(periodo)}</span>
      <span class='periodo'>Serviços: ${escaparHtml(nomesServicosFiltrados || 'Todos')}</span>
      <div class='cards'>${cardsHtml}</div>
      ${faturamentoDiarioHtml}
      ${detalhamentoAtendimentosHtml}
      ${topServicosHtml}
      ${topProfissionaisHtml}
      ${comissionamentoHtml}
      ${detalhamentoHtml}
      <div class='footer'>Gerado em ${new Date().toLocaleString('pt-BR')}</div>
    </body></html>`);
    janela.document.close();
    setTimeout(() => { janela.print(); }, 400);
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  const maiorFaturamentoDiario = relatorio ? Math.max(1, ...relatorio.serie_diaria.map((d) => d.faturamento)) : 1;
  const maiorFaturamentoServico = relatorio ? Math.max(1, ...relatorio.top_servicos.map((s) => s.faturamento)) : 1;
  const maiorFaturamentoProfissional = relatorio ? Math.max(1, ...relatorio.top_profissionais.map((p) => p.faturamento)) : 1;
  const variacao = relatorio?.resumo?.variacao_faturamento_pct ?? 0;
  // Usa filtrosAplicados (não os estados dos campos) pra descrever o que está de fato carregado
  // em `relatorio` — se o admin mexeu num filtro sem clicar "Aplicar", o rótulo/formatação não
  // pode mudar antes dos dados mudarem, senão ficaria descrevendo algo diferente do que é exibido.
  const agrupamentoAplicado = filtrosAplicados.agrupamento;
  const mostrarComissionamentoAplicado = filtrosAplicados.mostrarComissionamento;
  const mostrarDetalhamentoAplicado = filtrosAplicados.mostrarDetalhamento;
  // Compara o que está nos campos com o que foi de fato aplicado — só pra mostrar um aviso "há
  // filtro pendente" perto do botão, deixando claro quando um clique em Aplicar é necessário.
  const filtrosPendentes = dataInicio !== filtrosAplicados.dataInicio
    || dataFim !== filtrosAplicados.dataFim
    || agrupamento !== filtrosAplicados.agrupamento
    || tipoCliente !== filtrosAplicados.tipoCliente
    || mostrarComissionamento !== filtrosAplicados.mostrarComissionamento
    || mostrarDetalhamento !== filtrosAplicados.mostrarDetalhamento
    || servicosSelecionados.length !== filtrosAplicados.servicosSelecionados.length
    || servicosSelecionados.some((id) => !filtrosAplicados.servicosSelecionados.includes(id));
  const nomesServicosFiltrados = servicosDisponiveis.filter((sv) => filtrosAplicados.servicosSelecionados.includes(sv.id)).map((sv) => sv.nome).join(', ');
  // Título da série de faturamento (tela, CSV e PDF). Sem o nome do serviço aqui de propósito —
  // já aparece na linha de período lá em cima do relatório/exportação, repetir no título ficaria
  // redundante. Qual serviço/tipo é cada linha aparece dentro da própria tabela de detalhamento
  // (detalhe_periodo), logo abaixo.
  const tituloFaturamentoPorPeriodo = `Faturamento por ${LABEL_AGRUPAMENTO[agrupamentoAplicado]}`;

  return (
    <div className="admin-page-container" style={styles.container}>
      <h2 style={styles.title}><Icons.BarChart color="#111827" /> Relatórios e financeiro</h2>
      <p style={styles.subtitle}>Faturamento, taxas de maquineta, comissionamento e desempenho da equipe.</p>

      <div style={styles.filtros}>
        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
          <label style={styles.label}>De</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} />
        </div>
        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
          <label style={styles.label}>Até</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={styles.input} />
        </div>
        <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
          <label style={styles.label}>Faturamento por</label>
          <select value={agrupamento} onChange={(e) => setAgrupamento(e.target.value)} style={{ ...styles.input, cursor: 'pointer' }}>
            <option value="dia">Dia</option>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
          </select>
        </div>
        <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
          <label style={styles.label}>Serviços (todos se vazio)</label>
          <select
            multiple
            value={servicosSelecionados.map(String)}
            onChange={(e) => setServicosSelecionados(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
            style={{ ...styles.input, height: '74px', cursor: 'pointer' }}
          >
            {servicosDisponiveis.map((sv) => <option key={sv.id} value={sv.id}>{sv.nome}</option>)}
          </select>
          {servicosSelecionados.length > 0 && (
            <button
              type="button"
              onClick={() => setServicosSelecionados([])}
              style={{ marginTop: '4px', background: 'none', border: 'none', color: '#2554eb', fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
            >
              Limpar seleção
            </button>
          )}
        </div>
        <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
          <label style={styles.label}>Tipo de cliente</label>
          <select value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value)} style={{ ...styles.input, cursor: 'pointer' }}>
            <option value="todos">Todos</option>
            <option value="assinante">Só assinantes</option>
            <option value="avulso">Só avulso</option>
          </select>
        </div>
        {/* flex '0 1 ...' (sem grow) de propósito — com mais campos de filtro a fileira não
            cabe mais tudo numa linha só, e quando o botão sobra sozinho numa linha, um flex-grow
            fazia ele esticar pra ocupar a largura toda (ficava gigante). */}
        <div style={{ flex: '0 1 160px', minWidth: '140px' }}>
          {/* Rótulo fantasma — alinha o topo do botão com o topo dos inputs dos campos ao lado
              (que têm um rótulo visível ocupando essa mesma faixa antes do próprio input). */}
          <label style={{ ...styles.label, visibility: 'hidden' }}>Aplicar</label>
          <button
            onClick={aplicarFiltros}
            disabled={gerando}
            style={{ ...styles.btnGerar, width: '100%', boxSizing: 'border-box', position: 'relative', ...(filtrosPendentes ? { boxShadow: '0 0 0 2px #f59e0b' } : {}) }}
            title={filtrosPendentes ? 'Você mudou um filtro — clique aqui pra atualizar o relatório' : ''}
          >
            {gerando ? 'Gerando...' : 'Aplicar'}
            {filtrosPendentes && !gerando && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', border: '2px solid #fff' }} />
            )}
          </button>
        </div>
        {/* Linha própria (flex-basis 100%) de propósito — dividir espaço com os campos de data/
            select acima cortava o texto dos checkboxes em telas menores (nowrap + item flex
            encolhendo abaixo do conteúdo). Aqui cada checkbox tem a largura toda da barra pra
            sobrar espaço sempre, independente do que mais está no filtro. */}
        <div style={{ flex: '1 1 100%', display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={mostrarComissionamento} onChange={(e) => setMostrarComissionamento(e.target.checked)} />
            Comissionamento por profissional
          </label>
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={mostrarDetalhamento} onChange={(e) => setMostrarDetalhamento(e.target.checked)} />
            Detalhamento por atendimento
          </label>
        </div>
        {relatorio && (
          <div style={styles.grupoExportar}>
            <button
              onClick={exportarCsv}
              style={styles.btnExportarCsv}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.92)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              <Icons.Download color="#fff" /> Exportar CSV
            </button>
            <button
              onClick={exportarPdf}
              style={styles.btnExportarPdf}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.92)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              <Icons.FileText color="#fff" /> Exportar PDF
            </button>
          </div>
        )}
      </div>

      <div style={styles.secao}>
        <h3 style={styles.secaoTitulo}>Taxas de maquineta</h3>
        <p style={{ ...styles.vazio, marginBottom: '14px' }}>Percentual descontado por forma de pagamento, usado só para calcular a receita líquida abaixo. Não muda o que o cliente paga.</p>
        <div style={styles.gridTaxas}>
          {[
            { chave: 'dinheiro', rotulo: 'Dinheiro' },
            { chave: 'credito', rotulo: 'Crédito' },
            { chave: 'debito', rotulo: 'Débito' },
            { chave: 'pix', rotulo: 'Pix' }
          ].map((f) => (
            <div key={f.chave}>
              <label style={styles.label}>{f.rotulo} (%)</label>
              <input
                type="number" min="0" max="100" step="0.1"
                style={styles.input}
                value={taxas[f.chave] ?? 0}
                onChange={(e) => setTaxas({ ...taxas, [f.chave]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <LoadingButton loading={salvandoTaxas} onClick={salvarTaxas} style={{ ...styles.btnGerar, marginTop: '14px' }}>Salvar taxas</LoadingButton>
      </div>

      {mostrarComissionamentoAplicado && (
      <div style={styles.secao}>
        <h3 style={styles.secaoTitulo}>Comissionamento por profissional</h3>
        {carregandoComissao ? (
          <p style={styles.vazio}>Carregando...</p>
        ) : !comissionamento || comissionamento.profissionais.length === 0 ? (
          <p style={styles.vazio}>Sem atendimentos concluídos nesse período, ou nenhum profissional com % de comissão cadastrado (defina em Gestão de Profissionais).</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.tabela}>
              <thead>
                <tr>
                  <th style={styles.th}></th>
                  <th style={styles.th}>Profissional</th>
                  <th style={styles.th}>Comissão</th>
                  <th style={styles.th}>Atendimentos</th>
                  <th style={styles.th}>Receita bruta</th>
                  <th style={styles.th}>Receita líquida</th>
                  <th style={styles.th}>A pagar</th>
                </tr>
              </thead>
              <tbody>
                {comissionamento.profissionais.map((p) => {
                  const chave = p.id ?? p.nome;
                  const expandido = mostrarDetalhamentoAplicado && profissionalExpandido === chave;
                  return (
                    <React.Fragment key={chave}>
                      <tr
                        onClick={() => mostrarDetalhamentoAplicado && setProfissionalExpandido(expandido ? null : chave)}
                        style={{ cursor: mostrarDetalhamentoAplicado ? 'pointer' : 'default' }}
                      >
                        <td style={{ ...styles.td, color: '#9ca3af', width: '20px' }}>{mostrarDetalhamentoAplicado ? (expandido ? '▾' : '▸') : ''}</td>
                        <td style={styles.td}>{p.nome}</td>
                        <td style={styles.td}>{p.percentual_comissao}%</td>
                        <td style={styles.td}>{p.quantidade}</td>
                        <td style={styles.td}>{formatarMoeda(p.receita_bruta)}</td>
                        <td style={styles.td}>{formatarMoeda(p.receita_liquida)}</td>
                        <td style={{ ...styles.td, fontWeight: '700', color: '#059669' }}>{formatarMoeda(p.comissao)}</td>
                      </tr>
                      {expandido && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 8px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ ...styles.tabela, minWidth: '520px' }}>
                                <thead>
                                  <tr>
                                    <th style={styles.thDetalhe}>Data</th>
                                    <th style={styles.thDetalhe}>Cliente</th>
                                    <th style={styles.thDetalhe}>Serviço(s)</th>
                                    <th style={styles.thDetalhe}>Origem</th>
                                    <th style={styles.thDetalhe}>Receita líquida</th>
                                    <th style={styles.thDetalhe}>Comissão</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(p.itens || []).map((item, idx) => (
                                    <tr key={idx}>
                                      <td style={styles.tdDetalhe}>{formatarDataHora(item.data)}</td>
                                      <td style={styles.tdDetalhe}>{item.cliente}</td>
                                      <td style={styles.tdDetalhe}>{item.servicos.length ? item.servicos.join(', ') : '—'}</td>
                                      <td style={styles.tdDetalhe}>
                                        {item.tipo === 'assinante' ? (
                                          <span style={styles.tagAssinante} title={`Mensalidade rateada por ${item.visitas_no_mes} visita(s) no mês`}>
                                            Assinante · rateio {item.visitas_no_mes}x
                                          </span>
                                        ) : (
                                          <span style={styles.tagAvulso}>Avulso</span>
                                        )}
                                        {item.formas_pagamento && item.formas_pagamento.length > 0 && (
                                          <div style={{ marginTop: '3px', fontSize: '11px', color: '#9ca3af' }}>
                                            {item.formas_pagamento.map((f) => `${f.forma_pagamento} ${formatarMoeda(f.valor)}`).join(' + ')}
                                          </div>
                                        )}
                                      </td>
                                      <td style={styles.tdDetalhe}>{formatarMoeda(item.receita_liquida)}</td>
                                      <td style={{ ...styles.tdDetalhe, fontWeight: '700', color: '#059669' }}>{formatarMoeda(item.comissao)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ ...styles.vazio, marginTop: '12px' }}>
          {mostrarDetalhamentoAplicado
            ? 'Clique num profissional pra ver o detalhamento por atendimento. '
            : 'Ligue "Detalhamento por atendimento" no filtro acima e clique em Aplicar pra poder abrir cada atendimento. '}
          Atendimentos de clientes assinantes entram pela fatia proporcional da mensalidade (valor do plano ÷ visitas no mês), já que o serviço em si sai de graça pro cliente.
        </p>
      </div>
      )}

      {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}

      {relatorio && (
        <>
          <div style={styles.grid}>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Faturamento no período</span>
              <span style={styles.cardValor}>{formatarMoeda(relatorio.resumo.faturamento_total)}</span>
              {relatorio.avancado && (
                <span style={{ ...styles.cardVariacao, color: variacao >= 0 ? '#059669' : '#dc2626' }}>
                  {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao)}% vs período anterior
                </span>
              )}
            </div>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Receita líquida</span>
              <span style={styles.cardValor}>{formatarMoeda(relatorio.resumo.receita_liquida)}</span>
              <span style={styles.cardVariacao}>Já descontando taxa de maquineta</span>
            </div>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Ticket médio</span>
              <span style={styles.cardValor}>{formatarMoeda(relatorio.resumo.ticket_medio)}</span>
            </div>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Atendimentos concluídos</span>
              <span style={styles.cardValor}>{relatorio.resumo.quantidade_concluidos}</span>
            </div>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Taxa de descontos (maquineta)</span>
              <span style={styles.cardValor}>{relatorio.resumo.descontos_pct}%</span>
              <span style={styles.cardVariacao}>{formatarMoeda(relatorio.resumo.descontos_valor)} descontados</span>
            </div>
            {relatorio.avancado && relatorio.recorrencia && (
              <div style={styles.card}>
                <span style={styles.cardLabel}>Clientes recorrentes</span>
                <span style={styles.cardValor}>{relatorio.recorrencia.taxa_recorrencia_pct}%</span>
                <span style={styles.cardVariacao}>{relatorio.recorrencia.clientes_recorrentes} de {relatorio.recorrencia.total_clientes_periodo} clientes</span>
              </div>
            )}
          </div>

          <div style={styles.secao}>
            <h3 style={styles.secaoTitulo}>{tituloFaturamentoPorPeriodo}</h3>
            {relatorio.serie_diaria.length === 0 ? (
              <p style={styles.vazio}>Nenhum atendimento concluído nesse período.</p>
            ) : (
              <div style={styles.grafico}>
                {relatorio.serie_diaria.map((d) => (
                  <div key={d.data} style={styles.barraColuna} title={`${formatarRotuloPeriodo(d.data, agrupamentoAplicado)}: ${formatarMoeda(d.faturamento)}`}>
                    <div style={{ ...styles.barra, height: `${Math.max(4, (d.faturamento / maiorFaturamentoDiario) * 120)}px` }} />
                    <span style={styles.barraLabel}>{formatarRotuloPeriodo(d.data, agrupamentoAplicado)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mesma série do gráfico acima, só que aberta por período + serviço + tipo de
                cliente — pra saber do que se trata cada linha sem precisar abrir o
                comissionamento. Atendimento com mais de um serviço junto divide o valor em
                partes iguais entre eles (ver detalhePeriodo em routes/relatorios.js). */}
            {relatorio.detalhe_periodo.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: '18px' }}>
                <table style={styles.tabela}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Período</th>
                      <th style={styles.th}>Serviço</th>
                      <th style={styles.th}>Tipo</th>
                      <th style={styles.th}>Faturamento</th>
                      <th style={styles.th}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.detalhe_periodo.map((d, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>{formatarRotuloPeriodo(d.periodo, agrupamentoAplicado)}</td>
                        <td style={styles.td}>{d.servico}</td>
                        <td style={styles.td}>
                          {d.tipo === 'assinante' ? <span style={styles.tagAssinante}>Assinante</span> : <span style={styles.tagAvulso}>Avulso</span>}
                        </td>
                        <td style={styles.td}>{formatarMoeda(d.faturamento)}</td>
                        <td style={styles.td}>{d.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Uma linha por serviço de cada atendimento (não agregado por período) — pra saber
              quem foi o cliente e como pagou. Independente do comissionamento, controlado pelo
              mesmo checkbox "Detalhamento por atendimento" (ver mostrarDetalhamento). */}
          {mostrarDetalhamentoAplicado && (
            <div style={styles.secao}>
              <h3 style={styles.secaoTitulo}>Detalhamento por atendimento</h3>
              {relatorio.detalhamento_atendimentos.length === 0 ? (
                <p style={styles.vazio}>Nenhum atendimento concluído nesse período.</p>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                  <table style={styles.tabela}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Cliente</th>
                        <th style={styles.th}>Serviço</th>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Forma de pagamento</th>
                        <th style={styles.th}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.detalhamento_atendimentos.map((item, idx) => (
                        <tr key={idx}>
                          <td style={styles.td}>{formatarDataHora(item.data_hora)}</td>
                          <td style={styles.td}>{item.cliente}</td>
                          <td style={styles.td}>{item.servico}</td>
                          <td style={styles.td}>
                            {item.tipo === 'assinante' ? <span style={styles.tagAssinante}>Assinante</span> : <span style={styles.tagAvulso}>Avulso</span>}
                          </td>
                          <td style={styles.td}>{formatarFormaPagamentoRelatorio(item)}</td>
                          <td style={styles.td}>{formatarMoeda(item.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {ia.disponivel && (
            <div style={styles.secao}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ ...styles.secaoTitulo, margin: 0 }}>Resumo com IA</h3>
                <LoadingButton loading={ia.gerando} onClick={gerarResumoIA} style={styles.btnExportar}>
                  {ia.texto ? 'Gerar de novo' : 'Gerar resumo'}
                </LoadingButton>
              </div>
              {ia.texto && <p style={{ margin: '14px 0 0', fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>{ia.texto}</p>}
            </div>
          )}

          {!relatorio.avancado ? (
            <div style={styles.upsell}>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                Comparação com o período anterior, top serviços, top profissionais e recorrência de clientes são recursos exclusivos do <strong>plano Enterprise</strong>.
                Fale com o suporte para fazer upgrade.
              </p>
            </div>
          ) : (
            <div style={styles.duasColunas}>
              <div style={styles.secao}>
                <h3 style={styles.secaoTitulo}>Top serviços</h3>
                {relatorio.top_servicos.length === 0 ? (
                  <p style={styles.vazio}>Sem dados nesse período.</p>
                ) : (
                  relatorio.top_servicos.map((s) => (
                    <div key={s.nome} style={styles.linhaRanking}>
                      <div style={styles.linhaRankingTopo}>
                        <span>{s.nome}</span>
                        <span>{formatarMoeda(s.faturamento)} · {s.quantidade}x</span>
                      </div>
                      <div style={styles.barraFundo}>
                        <div style={{ ...styles.barraPreenchida, width: `${(s.faturamento / maiorFaturamentoServico) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.secao}>
                <h3 style={styles.secaoTitulo}>Top profissionais</h3>
                {relatorio.top_profissionais.length === 0 ? (
                  <p style={styles.vazio}>Sem dados nesse período.</p>
                ) : (
                  relatorio.top_profissionais.map((p) => (
                    <div key={p.nome} style={styles.linhaRanking}>
                      <div style={styles.linhaRankingTopo}>
                        <span>{p.nome}</span>
                        <span>{formatarMoeda(p.faturamento)} · {p.quantidade}x</span>
                      </div>
                      <div style={styles.barraFundo}>
                        <div style={{ ...styles.barraPreenchida, width: `${(p.faturamento / maiorFaturamentoProfissional) * 100}%`, background: 'linear-gradient(90deg, #6d28d9, #9333ea)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Icons = {
  BarChart: ({ color }) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'bottom' }}><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>,
  Download: ({ color }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  FileText: ({ color }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
};

const styles = {
  container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0' },
  subtitle: { color: '#6b7280', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px dashed #d1d5db' },
  // alignItems 'flex-start' de propósito — com 'flex-end' o campo "Serviços" (mais alto que os
  // outros por causa do select multiple + "Limpar seleção") empurrava só o próprio rótulo pra
  // cima, desalinhando com os rótulos dos campos vizinhos. Com 'flex-start' todo mundo alinha
  // pelo topo (rótulo), que é o que os olhos comparam primeiro numa barra de filtros.
  filtros: { display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6', overflow: 'hidden' },
  label: { display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' },
  input: { padding: '8px 8px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: 'calc(100% - 6px)', maxWidth: '100%', boxSizing: 'border-box' },
  gridTaxas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', maxWidth: '520px' },
  btnGerar: { padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  btnExportar: { padding: '9px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', fontWeight: '600', cursor: 'pointer' },
  // flex '0 1 ...' (sem grow) de propósito — sozinho numa linha (depois que os checkboxes acima
  // ocupam a linha toda), um flex-grow esticava esse grupo pra largura inteira da barra e os
  // botões (flex:1 aqui dentro) ficavam gigantes.
  grupoExportar: { display: 'flex', gap: '8px', flex: '0 1 320px', minWidth: '260px' },
  btnExportarCsv: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(5,150,105,0.25)', transition: 'filter 0.15s' },
  btnExportarPdf: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 16px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.25)', transition: 'filter 0.15s' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' },
  card: { backgroundColor: '#fff', padding: '18px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '6px' },
  cardLabel: { fontSize: '12px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' },
  cardValor: { fontSize: '22px', color: '#111827', fontWeight: '800' },
  cardVariacao: { fontSize: '12px', color: '#6b7280', fontWeight: '600' },
  secao: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', marginBottom: '20px' },
  secaoTitulo: { margin: '0 0 16px', fontSize: '16px', color: '#111827' },
  vazio: { color: '#9ca3af', fontSize: '13px', margin: 0 },
  grafico: { display: 'flex', alignItems: 'flex-end', gap: '6px', height: '150px', overflowX: 'auto', paddingTop: '10px' },
  barraColuna: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: '26px' },
  barra: { width: '18px', borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #4c74f0, #2554eb)' },
  barraLabel: { fontSize: '10px', color: '#9ca3af', marginTop: '4px', whiteSpace: 'nowrap' },
  duasColunas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' },
  linhaRanking: { marginBottom: '14px' },
  linhaRankingTopo: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', marginBottom: '4px' },
  barraFundo: { height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #4c74f0, #2554eb)' },
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' },
  th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: '600' },
  td: { padding: '8px', borderBottom: '1px solid #f3f4f6', color: '#111827' },
  thDetalhe: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#9ca3af', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px' },
  tdDetalhe: { padding: '7px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '12px' },
  tagAssinante: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', background: '#ede9fe', color: '#6d28d9', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
  tagAvulso: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', background: '#f3f4f6', color: '#6b7280', fontSize: '11px', fontWeight: '600' }
};

export default AdminRelatorios;
