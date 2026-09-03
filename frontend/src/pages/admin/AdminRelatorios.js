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

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    setCarregandoComissao(true);
    try {
      const res = await fetch(`${API_URL}/admin/relatorios/comissionamento/${idEfetivo}?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      const dados = await res.json();
      if (res.ok) setComissionamento(dados);
    } catch (err) {
      console.error('Erro ao carregar comissionamento:', err);
    } finally {
      setCarregandoComissao(false);
    }
  }, [idEfetivo, dataInicio, dataFim]);

  useEffect(() => { carregarComissionamento(); }, [carregarComissionamento]);

  // O endpoint agora devolve um resumo pra todo plano pago (com filtro de data), não só
  // Enterprise — a resposta traz `avancado` pra decidir se as seções extras
  // (rankings/recorrência/comparação) aparecem ou ficam atrás do upsell abaixo.
  const gerarRelatorio = useCallback(async () => {
    if (!idEfetivo) return;
    setGerando(true);
    setErro('');
    try {
      const res = await fetch(`${API_URL}/admin/relatorios/${idEfetivo}?dataInicio=${dataInicio}&dataFim=${dataFim}`);
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
  }, [idEfetivo, dataInicio, dataFim]);

  useEffect(() => { gerarRelatorio(); }, [gerarRelatorio]);

  const exportarCsv = () => {
    if (!relatorio) return;
    const linhas = [];
    linhas.push('Relatório avançado');
    linhas.push(`Período,${relatorio.periodo.inicio} a ${relatorio.periodo.fim}`);
    linhas.push('');
    linhas.push('Resumo');
    linhas.push(`Faturamento total,${relatorio.resumo.faturamento_total}`);
    linhas.push(`Receita líquida,${relatorio.resumo.receita_liquida}`);
    linhas.push(`Ticket médio,${relatorio.resumo.ticket_medio}`);
    linhas.push(`Atendimentos concluídos,${relatorio.resumo.quantidade_concluidos}`);
    linhas.push(`Taxa de cancelamento (%),${relatorio.resumo.taxa_cancelamento}`);
    linhas.push(`Variação vs período anterior (%),${relatorio.resumo.variacao_faturamento_pct}`);
    linhas.push(`Taxa de clientes recorrentes (%),${relatorio.recorrencia.taxa_recorrencia_pct}`);
    linhas.push('');
    linhas.push('Faturamento por dia');
    linhas.push('Data,Faturamento,Quantidade');
    relatorio.serie_diaria.forEach((d) => linhas.push(`${d.data},${d.faturamento},${d.quantidade}`));
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
    link.download = `relatorio-${dataInicio}-a-${dataFim}.csv`;
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

    const periodo = `${new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`;

    const cards = [
      ['Faturamento no período', formatarMoeda(relatorio.resumo.faturamento_total)],
      ['Receita líquida', formatarMoeda(relatorio.resumo.receita_liquida)],
      ['Ticket médio', formatarMoeda(relatorio.resumo.ticket_medio)],
      ['Atendimentos concluídos', relatorio.resumo.quantidade_concluidos],
      ['Taxa de cancelamento', `${relatorio.resumo.taxa_cancelamento}%`]
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
      'Faturamento por dia',
      ['Data', 'Faturamento', 'Qtd'],
      relatorio.serie_diaria.map((d) => [new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR'), formatarMoeda(d.faturamento), d.quantidade])
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
        new Date(item.data).toLocaleDateString('pt-BR'),
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
      <div class='cards'>${cardsHtml}</div>
      ${faturamentoDiarioHtml}
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
        <button onClick={() => { carregarComissionamento(); gerarRelatorio(); }} disabled={gerando} style={{ ...styles.btnGerar, flex: '1 1 200px', minWidth: '200px' }}>
          {gerando ? 'Gerando...' : 'Aplicar'}
        </button>
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
        <p style={{ ...styles.vazio, marginBottom: '14px' }}>Percentual descontado por forma de pagamento, usado só para calcular a receita líquida abaixo — não muda o que o cliente paga.</p>
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
                  const expandido = profissionalExpandido === chave;
                  return (
                    <React.Fragment key={chave}>
                      <tr
                        onClick={() => setProfissionalExpandido(expandido ? null : chave)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ ...styles.td, color: '#9ca3af', width: '20px' }}>{expandido ? '▾' : '▸'}</td>
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
        <p style={{ ...styles.vazio, marginTop: '12px' }}>Clique num profissional pra ver o detalhamento por atendimento. Atendimentos de clientes assinantes entram pela fatia proporcional da mensalidade (valor do plano ÷ visitas no mês), já que o serviço em si sai de graça pro cliente.</p>
      </div>

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
              <span style={styles.cardLabel}>Taxa de cancelamento</span>
              <span style={styles.cardValor}>{relatorio.resumo.taxa_cancelamento}%</span>
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
            <h3 style={styles.secaoTitulo}>Faturamento por dia</h3>
            {relatorio.serie_diaria.length === 0 ? (
              <p style={styles.vazio}>Nenhum atendimento concluído nesse período.</p>
            ) : (
              <div style={styles.grafico}>
                {relatorio.serie_diaria.map((d) => (
                  <div key={d.data} style={styles.barraColuna} title={`${d.data}: ${formatarMoeda(d.faturamento)}`}>
                    <div style={{ ...styles.barra, height: `${Math.max(4, (d.faturamento / maiorFaturamentoDiario) * 120)}px` }} />
                    <span style={styles.barraLabel}>{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {ia.disponivel && (
            <div style={styles.secao}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ ...styles.secaoTitulo, margin: 0 }}>✨ Resumo com IA</h3>
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
  filtros: { display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6', overflow: 'hidden' },
  label: { display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' },
  input: { padding: '8px 8px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: 'calc(100% - 6px)', maxWidth: '100%', boxSizing: 'border-box' },
  gridTaxas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', maxWidth: '520px' },
  btnGerar: { padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  btnExportar: { padding: '9px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', fontWeight: '600', cursor: 'pointer' },
  grupoExportar: { display: 'flex', gap: '8px', flex: '2 1 320px', minWidth: '320px' },
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
