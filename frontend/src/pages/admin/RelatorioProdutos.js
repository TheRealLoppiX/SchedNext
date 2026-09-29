import { useEffect, useState } from 'react';
import { API_URL } from '../../services/api';

// Seção "Produtos" da página de Relatórios (ver routes/estoque.js, GET /admin/estoque/financeiro).
// Gastos com compras de estoque (uso e venda) aparecem pra todo plano; a receita líquida por
// produto vendido é recurso de plano (Profissional pra cima), com aviso de upgrade nos demais.
function RelatorioProdutos({ empresaId, dataInicio, dataFim, styles, formatarMoeda }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    setCarregando(true);
    fetch(`${API_URL}/admin/estoque/financeiro/${empresaId}?inicio=${dataInicio}&fim=${dataFim}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelado) setDados(d); })
      .catch(() => { if (!cancelado) setDados(null); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [empresaId, dataInicio, dataFim]);

  const cartao = (rotulo, valor, cor) => (
    <div style={styles.card}>
      <span style={styles.cardLabel}>{rotulo}</span>
      <span style={{ ...styles.cardValor, ...(cor ? { color: cor } : {}) }}>{valor}</span>
    </div>
  );

  const grade = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' };
  const rolagem = { overflowX: 'auto' };

  if (carregando) {
    return (
      <div style={styles.secao}>
        <h3 style={styles.secaoTitulo}>Produtos: gastos e receita líquida</h3>
        <p style={styles.vazio}>Carregando...</p>
      </div>
    );
  }
  if (!dados) return null;

  const { gastos, vendas } = dados;
  const semCusto = vendas?.por_produto.reduce((acc, l) => acc + l.unidades_sem_custo, 0) || 0;

  return (
    <>
      <div style={styles.secao}>
        <h3 style={styles.secaoTitulo}>Gastos com estoque</h3>
        <div style={grade}>
          {cartao('Total gasto', formatarMoeda(gastos.total))}
          {cartao('Produtos de venda', formatarMoeda(gastos.venda))}
          {cartao('Uso do estabelecimento', formatarMoeda(gastos.uso))}
        </div>
        {gastos.por_produto.length === 0 ? (
          <p style={styles.vazio}>Nenhuma compra com custo informado nesse período. Informe o custo ao cadastrar o produto ou dar entrada no estoque.</p>
        ) : (
          <div style={rolagem}>
            <table style={styles.tabela}>
              <thead>
                <tr>
                  <th style={styles.th}>Produto</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Unidades compradas</th>
                  <th style={styles.th}>Total gasto</th>
                </tr>
              </thead>
              <tbody>
                {gastos.por_produto.map((l) => (
                  <tr key={l.produto_id}>
                    <td style={styles.td}>{l.nome}</td>
                    <td style={styles.td}>{l.tipo === 'uso' ? 'Uso' : 'Venda'}</td>
                    <td style={styles.td}>{l.quantidade}</td>
                    <td style={styles.td}>{formatarMoeda(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={styles.secao}>
        <h3 style={styles.secaoTitulo}>Receita líquida por produto vendido</h3>
        {!vendas ? (
          <div style={styles.upsell}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--fx-muted)' }}>
              O relatório de receita líquida por produto (quanto cada produto vendido deu de lucro, descontado o custo de compra) está disponível a partir do <strong>plano Profissional</strong>.
            </p>
          </div>
        ) : (
          <>
            <div style={grade}>
              {cartao('Receita com produtos', formatarMoeda(vendas.receita))}
              {cartao('Custo dos vendidos', formatarMoeda(vendas.custo))}
              {cartao('Receita líquida', formatarMoeda(vendas.receita_liquida), vendas.receita_liquida < 0 ? 'var(--fx-red)' : 'var(--fx-green)')}
            </div>
            {vendas.por_produto.length === 0 ? (
              <p style={styles.vazio}>Nenhum produto vendido no caixa nesse período.</p>
            ) : (
              <div style={rolagem}>
                <table style={styles.tabela}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Produto</th>
                      <th style={styles.th}>Vendidos</th>
                      <th style={styles.th}>Receita</th>
                      <th style={styles.th}>Custo</th>
                      <th style={styles.th}>Receita líquida</th>
                      <th style={styles.th}>Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.por_produto.map((l) => (
                      <tr key={l.produto_id}>
                        <td style={styles.td}>{l.nome}</td>
                        <td style={styles.td}>{l.quantidade}</td>
                        <td style={styles.td}>{formatarMoeda(l.receita)}</td>
                        <td style={styles.td}>{formatarMoeda(l.custo)}{l.unidades_sem_custo > 0 ? ' *' : ''}</td>
                        <td style={{ ...styles.td, fontWeight: 700, color: l.receita_liquida < 0 ? 'var(--fx-red)' : 'var(--fx-text)' }}>{formatarMoeda(l.receita_liquida)}</td>
                        <td style={styles.td}>{l.margem_percentual == null ? '-' : `${l.margem_percentual.toFixed(1).replace('.', ',')}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {semCusto > 0 && (
              <p style={{ ...styles.vazio, marginTop: '10px' }}>
                * {semCusto} {semCusto === 1 ? 'unidade vendida não tinha' : 'unidades vendidas não tinham'} custo cadastrado e {semCusto === 1 ? 'entrou' : 'entraram'} com custo zero. Informe o custo na entrada de estoque pra deixar a conta certa.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default RelatorioProdutos;
