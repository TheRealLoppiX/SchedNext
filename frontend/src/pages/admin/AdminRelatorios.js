import React, { useState, useEffect, useCallback } from 'react';
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

function AdminRelatorios({ empresaId }) {
  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState('');
  const [dataInicio, setDataInicio] = useState(inicioDoMes());
  const [dataFim, setDataFim] = useState(formatarDataLocal(new Date()));

  const idEfetivo = empresaId || localStorage.getItem('empresaId');

  const carregarPermissao = useCallback(async () => {
    if (!idEfetivo) return setCarregando(false);
    try {
      const res = await fetch(`${API_URL}/admin/empresa/${idEfetivo}`);
      const dados = await res.json();
      setPermitido(!!dados?.plano_plataforma?.permite_relatorios_avancados);
    } catch (err) {
      console.error('Erro ao verificar permissão de relatórios:', err);
    } finally {
      setCarregando(false);
    }
  }, [idEfetivo]);

  useEffect(() => { carregarPermissao(); }, [carregarPermissao]);

  const gerarRelatorio = useCallback(async () => {
    if (!idEfetivo || !permitido) return;
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
  }, [idEfetivo, permitido, dataInicio, dataFim]);

  useEffect(() => { if (permitido) gerarRelatorio(); }, [permitido, gerarRelatorio]);

  const exportarCsv = () => {
    if (!relatorio) return;
    const linhas = [];
    linhas.push('Relatório avançado');
    linhas.push(`Período,${relatorio.periodo.inicio} a ${relatorio.periodo.fim}`);
    linhas.push('');
    linhas.push('Resumo');
    linhas.push(`Faturamento total,${relatorio.resumo.faturamento_total}`);
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

    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${relatorio.periodo.inicio}-a-${relatorio.periodo.fim}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Carregando...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>📊 Relatórios avançados</h2>
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Relatórios avançados (faturamento, top serviços/profissionais, recorrência de clientes) são um recurso exclusivo do <strong>plano Enterprise</strong>.
            Fale com o suporte para fazer upgrade.
          </p>
        </div>
      </div>
    );
  }

  const maiorFaturamentoDiario = relatorio ? Math.max(1, ...relatorio.serie_diaria.map((d) => d.faturamento)) : 1;
  const maiorFaturamentoServico = relatorio ? Math.max(1, ...relatorio.top_servicos.map((s) => s.faturamento)) : 1;
  const maiorFaturamentoProfissional = relatorio ? Math.max(1, ...relatorio.top_profissionais.map((p) => p.faturamento)) : 1;
  const variacao = relatorio?.resumo?.variacao_faturamento_pct ?? 0;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📊 Relatórios avançados</h2>
      <p style={styles.subtitle}>Analise faturamento, desempenho da equipe e recorrência de clientes.</p>

      <div style={styles.filtros}>
        <div>
          <label style={styles.label}>De</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={styles.input} />
        </div>
        <div>
          <label style={styles.label}>Até</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={styles.input} />
        </div>
        <button onClick={gerarRelatorio} disabled={gerando} style={styles.btnGerar}>
          {gerando ? 'Gerando...' : 'Aplicar'}
        </button>
        {relatorio && (
          <button onClick={exportarCsv} style={styles.btnExportar}>⬇ Exportar CSV</button>
        )}
      </div>

      {erro && <p style={{ color: '#dc2626', fontSize: '14px' }}>{erro}</p>}

      {relatorio && (
        <>
          <div style={styles.grid}>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Faturamento no período</span>
              <span style={styles.cardValor}>{formatarMoeda(relatorio.resumo.faturamento_total)}</span>
              <span style={{ ...styles.cardVariacao, color: variacao >= 0 ? '#059669' : '#dc2626' }}>
                {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao)}% vs período anterior
              </span>
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
            <div style={styles.card}>
              <span style={styles.cardLabel}>Clientes recorrentes</span>
              <span style={styles.cardValor}>{relatorio.recorrencia.taxa_recorrencia_pct}%</span>
              <span style={styles.cardVariacao}>{relatorio.recorrencia.clientes_recorrentes} de {relatorio.recorrencia.total_clientes_periodo} clientes</span>
            </div>
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
        </>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0' },
  subtitle: { color: '#6b7280', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px dashed #d1d5db' },
  filtros: { display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' },
  label: { display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' },
  input: { padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
  btnGerar: { padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  btnExportar: { padding: '9px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', fontWeight: '600', cursor: 'pointer' },
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
  duasColunas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' },
  linhaRanking: { marginBottom: '14px' },
  linhaRankingTopo: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', marginBottom: '4px' },
  barraFundo: { height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #4c74f0, #2554eb)' }
};

export default AdminRelatorios;
