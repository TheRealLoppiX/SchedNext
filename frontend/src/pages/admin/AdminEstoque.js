import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import useEscToClose from '../../hooks/useEscToClose';
import LoadingButton from '../../components/LoadingButton';
import EmptyState from '../../components/EmptyState';
import { obterTerminologia } from '../../utils/terminologia';
import { API_URL } from '../../services/api';

function AdminEstoque({ empresaId }) {
  const toast = useToast();
  const confirmar = useConfirm();

  // --- ESTADOS DE SEGURANÇA ---
  const [autorizado, setAutorizado] = useState(null);
  const [credenciais, setCredenciais] = useState({ usuario: 'admin', senha: '' });
  const [listaUsuarios, setListaUsuarios] = useState([]); // Lista para o Dropdown
  const [entrando, setEntrando] = useState(false);

  // --- ESTADOS DOS MODAIS ---
  const [modalAjuste, setModalAjuste] = useState(null);
  const [modalSublogin, setModalSublogin] = useState(false);
  const [modalRelatorio, setModalRelatorio] = useState(false);
  const [formSublogin, setFormSublogin] = useState({ senha_admin: '', novo_nome: '', nova_senha: '' });
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [criandoSublogin, setCriandoSublogin] = useState(false);
  const [movimentando, setMovimentando] = useState(false);

  useEscToClose(!!(modalAjuste || modalSublogin || modalRelatorio), () => {
    setModalAjuste(null);
    setModalSublogin(false);
    setModalRelatorio(false);
  });

  // --- ESTADOS DO ESTOQUE E RELATÓRIO ---
  const [produtos, setProdutos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState({ nome: '', valor: '', quantidade: '0' });

  const [filtroRelatorio, setFiltroRelatorio] = useState({ 
      inicio: new Date().toISOString().split('T')[0], 
      fim: new Date().toISOString().split('T')[0] 
  });
  const [dadosRelatorio, setDadosRelatorio] = useState([]);

  const idEfetivo = empresaId || localStorage.getItem('empresaId');
  const [vertical, setVertical] = useState('barbearia');
  const termos = obterTerminologia(vertical);

  // --- BUSCA USUÁRIOS PARA O DROPDOWN ---
  useEffect(() => {
    if (!autorizado && idEfetivo) {
        fetch(`${API_URL}/admin/estoque/usuarios/${idEfetivo}`)
            .then(r => r.json())
            .then(data => setListaUsuarios(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));
    }
  }, [autorizado, idEfetivo]);

  useEffect(() => {
    if (!idEfetivo) return;
    fetch(`${API_URL}/admin/empresa/${idEfetivo}`)
      .then(r => r.json())
      .then(d => d?.vertical && setVertical(d.vertical))
      .catch(() => {});
  }, [idEfetivo]);

  // --- FUNÇÕES DE LOGIN E ACESSO ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credenciais.usuario) return toast.error("Selecione um operador.");

    setEntrando(true);
    try {
      const res = await fetch(`${API_URL}/admin/estoque/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: idEfetivo, ...credenciais })
      });
      if (res.ok) {
        setAutorizado(await res.json());
        setCredenciais({ usuario: 'admin', senha: '' });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Não foi possível desbloquear o acesso.');
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setEntrando(false);
    }
  };

  const criarSublogin = async (e) => {
    e.preventDefault();
    setCriandoSublogin(true);
    try {
      const res = await fetch(`${API_URL}/admin/estoque/criar-sublogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: idEfetivo, ...formSublogin })
      });
      if (res.ok) {
        toast.success("Sublogin criado com sucesso!");
        setModalSublogin(false);
        setFormSublogin({ senha_admin: '', novo_nome: '', nova_senha: '' });
        // Atualiza a lista de usuários no background
        fetch(`${API_URL}/admin/estoque/usuarios/${idEfetivo}`).then(r => r.json()).then(setListaUsuarios);
      } else {
        toast.error("Senha do Admin incorreta.");
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setCriandoSublogin(false);
    }
  };

  // --- FUNÇÕES DE ESTOQUE ---
  const carregarProdutos = useCallback(async () => {
    if (!idEfetivo) return;
    try {
      const res = await fetch(`${API_URL}/admin/estoque/${idEfetivo}`);
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (err) { console.error("Erro ao carregar estoque:", err); }
  }, [idEfetivo]);

  useEffect(() => { if (autorizado) carregarProdutos(); }, [autorizado, carregarProdutos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editandoId ? `${API_URL}/admin/estoque/${editandoId}` : `${API_URL}/admin/estoque`;
    setSalvandoProduto(true);
    try {
      const res = await fetch(url, {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: idEfetivo, nome: formData.nome, valor: formData.valor, quantidade: formData.quantidade })
      });
      if (res.ok) {
        toast.success(editandoId ? "Produto atualizado." : "Produto cadastrado.");
        setFormData({ nome: '', valor: '', quantidade: '0' });
        setEditandoId(null);
        carregarProdutos();
      } else { toast.error("Não foi possível processar a requisição."); }
    } catch (err) { toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes."); }
    finally { setSalvandoProduto(false); }
  };

  const prepararEdicao = (produto) => {
    setEditandoId(produto.id);
    setFormData({ nome: produto.nome, valor: produto.preco || produto.valor, quantidade: produto.quantidade });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const alternarStatus = async (id, statusAtual, nome) => {
    const ativoSeguro = statusAtual === undefined ? 1 : statusAtual;
    const ok = await confirmar(`Deseja ${ativoSeguro ? 'ocultar' : 'reativar'} ${nome}?`, {
      detail: ativoSeguro ? 'O produto para de aparecer para venda imediatamente.' : 'O produto volta a ficar disponível para venda.',
      confirmText: ativoSeguro ? 'Ocultar' : 'Reativar',
      danger: !!ativoSeguro
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/estoque/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !ativoSeguro })
      });
      if (res.ok) {
        toast.success("Status atualizado!");
        carregarProdutos();
      } else {
        toast.error("Não foi possível atualizar o status.");
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    }
  };

  const deletar = async (id, nome) => {
    const ok = await confirmar(`Excluir ${nome} definitivamente?`, { confirmText: 'Excluir', danger: true });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/admin/estoque/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Produto excluído.");
        carregarProdutos();
      } else {
        const data = await res.json();
        toast.error(data.error || "Não foi possível excluir. Recomendamos inativar.");
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    }
  };

  const realizarMovimentacao = async (e) => {
    e.preventDefault();
    if (!modalAjuste.quantidade || !modalAjuste.justificativa) return toast.error("Preencha a quantidade e a justificativa.");

    setMovimentando(true);
    try {
      const res = await fetch(`${API_URL}/admin/estoque/movimentar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_id: modalAjuste.id, usuario_nome: autorizado.nome,
          quantidade: modalAjuste.quantidade, tipo: modalAjuste.tipo, justificativa: modalAjuste.justificativa
        })
      });
      if (res.ok) {
        toast.success("Estoque atualizado com sucesso!");
        setModalAjuste(null);
        carregarProdutos();
      } else {
        toast.error("Não foi possível atualizar o estoque.");
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setMovimentando(false);
    }
  };

  const buscarRelatorio = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/estoque/relatorio/${idEfetivo}?inicio=${filtroRelatorio.inicio}&fim=${filtroRelatorio.fim}`);
        const data = await res.json();
        setDadosRelatorio(Array.isArray(data) ? data : []);
      } catch (err) { toast.error("Não foi possível buscar o relatório."); }
  };

  // Busca automaticamente ao abrir o modal (com o periodo atual)
  useEffect(() => {
      if (modalRelatorio) buscarRelatorio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalRelatorio]);

  // --- FUNÇÃO DE EXPORTAR PARA EXCEL ---
  const exportarParaExcel = () => {
      if (dadosRelatorio.length === 0) return toast.error("Não há dados para exportar neste período.");
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF força o Excel a entender acentuação (UTF-8)
      csvContent += "Data/Hora;Operador;Produto;Movimentacao;Quantidade;Justificativa\n";

      dadosRelatorio.forEach(r => {
          const dataFormatada = new Date(r.data_movimentacao).toLocaleString('pt-BR');
          const tipo = r.tipo === 'ADICIONAR' ? 'Entrada' : 'Saida';
          // Trata a justificativa para evitar quebra de linha ou ponto e vírgula no CSV
          const justificativa = r.justificativa.replace(/;/g, ',').replace(/\n/g, ' '); 
          
          csvContent += `${dataFormatada};${r.usuario_nome};${r.produto_nome};${tipo};${r.quantidade};${justificativa}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `relatorio_estoque_${filtroRelatorio.inicio}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Sem isso, um valor de justificativa (texto livre digitado por qualquer operador do
  // estoque) contendo "<script>" ou tags HTML executava dentro da janela de impressão, já
  // que o relatório é montado com `document.write` de uma string interpolada.
  const escaparHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const exportarParaPDF = () => {
      if (dadosRelatorio.length === 0) return toast.error('Não há dados para exportar neste período.');
      const janela = window.open('', '_blank');
      if (!janela) {
        return toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');
      }
      const periodo = `${new Date(filtroRelatorio.inicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(filtroRelatorio.fim + 'T00:00:00').toLocaleDateString('pt-BR')}`;
      const linhas = dadosRelatorio.map(r => {
          const data = new Date(r.data_movimentacao).toLocaleString('pt-BR');
          const tipo = r.tipo === 'ADICIONAR' ? 'Entrada' : 'Saída';
          const corTipo = r.tipo === 'ADICIONAR' ? '#059669' : '#dc2626';
          return `<tr style='border-bottom:1px solid #f0f0f0'><td style='padding:9px 12px;font-size:12px;color:#374151'>${data}</td><td style='padding:9px 12px;font-size:12px'>${escaparHtml(r.usuario_nome)}</td><td style='padding:9px 12px;font-size:12px;font-weight:600;color:#111827'>${escaparHtml(r.produto_nome)}</td><td style='padding:9px 12px;font-size:12px;font-weight:700;color:${corTipo}'>${tipo}</td><td style='padding:9px 12px;font-size:12px;text-align:center;font-weight:700'>${r.quantidade}</td><td style='padding:9px 12px;font-size:12px;color:#6b7280'>${escaparHtml(r.justificativa) || '-'}</td></tr>`;
      }).join('');
      janela.document.write(`<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Relatório de Estoque</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#111827}h1{font-size:22px;font-weight:800;margin-bottom:4px}.sub{font-size:13px;color:#6b7280;margin-bottom:20px}.periodo{display:inline-block;background:#f3f4f6;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;color:#374151;margin-bottom:20px}table{width:100%;border-collapse:collapse}thead tr{background:#111827}th{padding:11px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.5px}tr:nth-child(even){background:#f9fafb}.footer{margin-top:20px;font-size:11px;color:#9ca3af;text-align:right}@media print{.no-print{display:none}}</style></head><body><h1>Relatório de Auditoria de Estoque</h1><p class='sub'>Movimentações no período</p><span class='periodo'>Período: ${periodo}</span><table><thead><tr><th>Data/Hora</th><th>Operador</th><th>Produto</th><th>Movimentação</th><th>Qtd</th><th>Justificativa</th></tr></thead><tbody>${linhas}</tbody></table><div class='footer'>Gerado em ${new Date().toLocaleString('pt-BR')} &bull; ${dadosRelatorio.length} registro(s)</div></body></html>`);
      janela.document.close();
      setTimeout(() => { janela.print(); }, 400);
  };

  // ==========================================
  // TELA DE BLOQUEIO
  // ==========================================
  if (!autorizado) {
    return (
      <div style={{...styles.container, minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{...styles.cardPadrao, width: '100%', maxWidth: '400px', textAlign: 'center', padding: '40px'}}>
          <div style={{ background: '#f3f4f6', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
             <Icons.Lock color="#111827" />
          </div>
          <h2 style={{margin: '0 0 5px 0', color: '#111827'}}>Acesso ao Estoque</h2>
          <p style={{color: '#6b7280', fontSize: '14px', marginBottom: '25px'}}>Insira suas credenciais para gerenciar os produtos.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>Operador</label>
              <select
                style={styles.select}
                value={credenciais.usuario}
                onChange={e => setCredenciais({...credenciais, usuario: e.target.value})}
              >
                  <option value="admin">Administrador</option>
                  {listaUsuarios.map(u => (
                      <option key={u.id} value={u.nome}>{u.nome}</option>
                  ))}
              </select>
              <small style={{ color: '#9ca3af', fontSize: '11.5px' }}>
                {listaUsuarios.length > 0
                  ? `Quem tem acesso: Administrador, ${listaUsuarios.map(u => u.nome).join(', ')}.`
                  : 'Ainda não há colaboradores cadastrados, só o Administrador tem acesso.'}
              </small>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Senha de Acesso</label>
              <input 
                type="password" style={styles.input} placeholder="••••••••" required
                value={credenciais.senha} onChange={e => setCredenciais({...credenciais, senha: e.target.value})}
              />
            </div>
            
            <LoadingButton type="submit" loading={entrando} style={{...styles.btnPrincipal, marginTop: '10px', padding: '14px'}}>Desbloquear</LoadingButton>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA PRINCIPAL (ESTOQUE)
  // ==========================================
  return (
    <div style={styles.container}>
      
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}><Icons.Package color="#111827" /> Gestão de Estoque</h2>
          <p style={styles.subtitle}>Gerencie entradas, saídas e cadastro de produtos.</p>
        </div>
        
        <div style={styles.headerAcoes}>
          <div style={styles.badgeOperador}>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>Operador:</span>
              <strong>{autorizado.nome}</strong>
          </div>
          
          {autorizado.nivel === 'admin' && (
            <>
                <button onClick={() => setModalRelatorio(true)} style={styles.btnAcaoClaro}>
                    <Icons.FileText color="#4b5563" /> Relatório
                </button>
                <button onClick={() => setModalSublogin(true)} style={styles.btnAcaoClaro}>
                    <Icons.UserPlus color="#4b5563" /> Criar Acesso
                </button>
            </>
          )}
          <button onClick={() => setAutorizado(null)} style={styles.btnSair}>Sair</button>
        </div>
      </header>

      <div style={styles.cardPadrao}>
        <div style={styles.cardHeader}>
            <h4 style={styles.cardTitle}>
            {editandoId ? <><Icons.Edit color="#4b5563" /> Editando: {formData.nome}</> : <><Icons.Plus color="#4b5563" /> Cadastrar Novo Produto</>}
            </h4>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.formGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nome do Produto</label>
            <input placeholder="Ex: Pomada Modeladora" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required style={styles.input} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Preço de Venda (R$)</label>
            <input placeholder="0,00" type="number" step="0.01" min="0" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} required style={styles.input} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Estoque Atual</label>
            <input 
              type="number" min="0" value={formData.quantidade} disabled={!!editandoId}
              onChange={e => setFormData({...formData, quantidade: e.target.value})} required 
              style={{...styles.input, backgroundColor: editandoId ? '#f3f4f6' : '#fff', cursor: editandoId ? 'not-allowed' : 'text'}}
            />
          </div>

          <div style={{ ...styles.inputGroup, justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
                <LoadingButton type="submit" loading={salvandoProduto} style={styles.btnPrincipal}>{editandoId ? 'Salvar Edição' : 'Cadastrar Produto'}</LoadingButton>
                {editandoId && (
                <button type="button" onClick={() => {setEditandoId(null); setFormData({nome:'', valor:'', quantidade:'0'})}} style={styles.btnAcaoClaro}>Cancelar</button>
                )}
            </div>
          </div>
        </form>
      </div>

      <div style={{...styles.cardPadrao, padding: 0, overflow: 'hidden'}}>
        <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
            <thead>
                <tr>
                <th style={{...styles.th, paddingLeft: '25px'}}>PRODUTO</th>
                <th style={{...styles.th, textAlign: 'center'}}>QTD</th>
                <th style={{...styles.th, textAlign: 'center'}}>PREÇO</th>
                <th style={{...styles.th, textAlign: 'center'}}>STATUS</th>
                <th style={{...styles.th, textAlign: 'right', paddingRight: '25px'}}>AÇÕES</th>
                </tr>
            </thead>
            <tbody>
                {produtos.length > 0 ? produtos.map(p => {
                const isAtivo = p.ativo !== 0; 
                const estoqueBaixo = p.quantidade <= 3;
                return (
                    <tr key={p.id} style={{...styles.tr, opacity: isAtivo ? 1 : 0.6}}>
                    <td style={{...styles.td, paddingLeft: '25px'}}><strong style={{color: '#111827', textDecoration: isAtivo ? 'none' : 'line-through'}}>{p.nome}</strong></td>
                    <td style={{...styles.td, textAlign: 'center'}}>
                        <span style={{...styles.badgeQuantidade, backgroundColor: estoqueBaixo ? '#fef2f2' : '#f3f4f6', color: estoqueBaixo ? '#dc2626' : '#374151', border: `1px solid ${estoqueBaixo ? '#fecaca' : '#d1d5db'}`}}>
                            {p.quantidade} un
                        </span>
                    </td>
                    <td style={{...styles.td, textAlign: 'center'}}><span style={styles.textoPreco}>R$ {parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}</span></td>
                    <td style={{...styles.td, textAlign: 'center'}}>
                        <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: isAtivo ? '#ecfdf5' : '#fef2f2', color: isAtivo ? '#059669' : '#dc2626' }}>{isAtivo ? 'Venda Ativa' : 'Oculto'}</span>
                    </td>
                    <td style={{...styles.td, textAlign: 'right', paddingRight: '25px'}}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button onClick={() => setModalAjuste({ ...p, tipo: 'ADICIONAR', quantidade: '', justificativa: '' })} style={{...styles.btnIcon, backgroundColor: '#eef2ff', color: '#4f46e5'}} title="Ajustar Estoque"><Icons.Trending color="#4f46e5" /></button>
                            <button onClick={() => alternarStatus(p.id, p.ativo, p.nome)} style={styles.btnIcon} title={isAtivo ? "Inativar" : "Ativar"}><Icons.Power color={isAtivo ? "#10b981" : "#9ca3af"} /></button>
                            <button onClick={() => prepararEdicao(p)} style={styles.btnIcon} title="Editar Cadastro"><Icons.Edit color="#4b5563" /></button>
                            <button onClick={() => deletar(p.id, p.nome)} style={{...styles.btnIcon, backgroundColor: '#fef2f2'}} title="Excluir"><Icons.Trash color="#ef4444" /></button>
                        </div>
                    </td>
                    </tr>
                )
                }) : (
                    <tr><td colSpan="5">
                        <EmptyState icon="📦" title="Nenhum produto cadastrado no estoque." hint="Use o formulário acima para cadastrar o primeiro produto." />
                    </td></tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAIS FLUTUANTES                           */}
      {/* ========================================== */}

      {modalAjuste && (
        <div style={styles.overlay}>
          <div style={styles.modalCard}>
            <h3 style={{marginTop: 0, color: '#111827', fontSize: '18px'}}>Ajuste: {modalAjuste.nome}</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button onClick={() => setModalAjuste({...modalAjuste, tipo: 'ADICIONAR'})} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: modalAjuste.tipo === 'ADICIONAR' ? '#10b981' : '#f3f4f6', color: modalAjuste.tipo === 'ADICIONAR' ? '#fff' : '#6b7280' }}>Adicionar (+)</button>
              <button onClick={() => setModalAjuste({...modalAjuste, tipo: 'RETIRAR'})} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: modalAjuste.tipo === 'RETIRAR' ? '#ef4444' : '#f3f4f6', color: modalAjuste.tipo === 'RETIRAR' ? '#fff' : '#6b7280' }}>Retirar (-)</button>
            </div>
            <form onSubmit={realizarMovimentacao}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Quantidade a {modalAjuste.tipo === 'ADICIONAR' ? 'Entrar' : 'Sair'}</label>
                <input type="number" min="1" required style={styles.input} value={modalAjuste.quantidade} onChange={e => setModalAjuste({...modalAjuste, quantidade: e.target.value})} placeholder="Ex: 5" />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Justificativa da Alteração</label>
                <textarea required style={{...styles.input, height: '80px', resize: 'none'}} value={modalAjuste.justificativa} onChange={e => setModalAjuste({...modalAjuste, justificativa: e.target.value})} placeholder={modalAjuste.tipo === 'ADICIONAR' ? "Ex: Compra de novo lote..." : "Ex: Produto avariado, Brinde..."} />
              </div>
              <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                <LoadingButton type="submit" loading={movimentando} style={{...styles.btnPrincipal, background: modalAjuste.tipo === 'ADICIONAR' ? '#10b981' : '#ef4444', color: '#fff'}}>{modalAjuste.tipo === 'ADICIONAR' ? 'Registrar Entrada' : 'Registrar Saída'}</LoadingButton>
                <button type="button" onClick={() => setModalAjuste(null)} style={styles.btnAcaoClaro}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalSublogin && (
        <div style={styles.overlay}>
          <div style={styles.modalCard}>
            <h3 style={{marginTop: 0, color: '#111827', fontSize: '18px'}}>Acesso para {termos.profissionalPlural}</h3>
            <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '20px', lineHeight: '1.4'}}>Crie uma senha para o seu colaborador. As movimentações que ele fizer ficarão registradas no relatório.</p>
            <form onSubmit={criarSublogin}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Sua Senha de Administrador (Autorização)</label>
                <input style={styles.input} type="password" required value={formSublogin.senha_admin} onChange={e => setFormSublogin({...formSublogin, senha_admin: e.target.value})} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Nome do {termos.profissional}/Operador</label>
                <input style={styles.input} placeholder="Ex: Carlos" required value={formSublogin.novo_nome} onChange={e => setFormSublogin({...formSublogin, novo_nome: e.target.value})} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>PIN de 4 dígitos para este Operador</label>
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="0000"
                  required
                  value={formSublogin.nova_senha}
                  onChange={e => setFormSublogin({...formSublogin, nova_senha: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                />
              </div>
              <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                <LoadingButton type="submit" loading={criandoSublogin} style={styles.btnPrincipal}>Concluir Cadastro</LoadingButton>
                <button type="button" onClick={() => setModalSublogin(false)} style={styles.btnAcaoClaro}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalRelatorio && (
        <div style={styles.overlay}>
          <div style={{...styles.modalCard, maxWidth: '850px', width: '95%'}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{margin: 0, color: '#111827', fontSize: '20px'}}>📄 Relatório de Auditoria</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button onClick={exportarParaExcel} style={{...styles.btnPrincipal, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', height: 'auto'}}>
                        <Icons.Download color="#fff" /> Exportar Excel
                    </button>
                    <button onClick={exportarParaPDF} style={{...styles.btnPrincipal, background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', height: 'auto'}}>
                        <Icons.FileText color="#fff" /> Exportar PDF
                    </button>
                    <button onClick={() => setModalRelatorio(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999', marginLeft: '10px' }}>✕</button>
                </div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>Data Inicial:</label>
                    <input type="date" style={styles.input} value={filtroRelatorio.inicio} onChange={e => setFiltroRelatorio({...filtroRelatorio, inicio: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>Data Final:</label>
                    <input type="date" style={styles.input} value={filtroRelatorio.fim} onChange={e => setFiltroRelatorio({...filtroRelatorio, fim: e.target.value})} />
                </div>
                <button
                    onClick={buscarRelatorio}
                    style={{...styles.btnPrincipal, padding: '10px 22px', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0}}
                >
                    <Icons.Search color='#fff' /> Buscar
                </button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
                <table style={styles.table}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <tr>
                            <th style={styles.th}>Data/Hora</th>
                            <th style={styles.th}>Operador</th>
                            <th style={styles.th}>Produto</th>
                            <th style={styles.th}>Tipo</th>
                            <th style={styles.th}>Justificativa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dadosRelatorio.length > 0 ? dadosRelatorio.map(r => (
                            <tr key={r.id} style={styles.tr}>
                                <td style={styles.td}>{new Date(r.data_movimentacao).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'})}</td>
                                <td style={styles.td}><b>{r.usuario_nome}</b></td>
                                <td style={styles.td}>{r.produto_nome}</td>
                                <td style={styles.td}>
                                    <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', background: r.tipo === 'ADICIONAR' ? '#ecfdf5' : '#fef2f2', color: r.tipo === 'ADICIONAR' ? '#059669' : '#dc2626' }}>
                                        {r.tipo === 'ADICIONAR' ? '+' : '-'}{r.quantidade}
                                    </span>
                                </td>
                                <td style={{...styles.td, fontSize: '12px', color: '#6b7280'}}>{r.justificativa}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Nenhuma movimentação encontrada neste período.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// ÍCONES E ESTILOS ENQUADRADOS
// ==========================================
const Icons = {
  Lock: ({color}) => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Trending: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>,
  Package: ({color}) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'bottom'}}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Edit: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Plus: ({color}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Trash: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  CheckCircle: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Alert: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  Power: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>,
  FileText: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'text-bottom'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  UserPlus: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'text-bottom'}}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>,
  Search: ({color}) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Download: ({color}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
};

const styles = {
  container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
  headerAcoes: { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
  subtitle: { color: '#6b7280', fontSize: '15px', margin: 0 },
  
  badgeOperador: { background: '#111827', color: '#fff', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' },
  btnAcaoClaro: { background: '#fff', color: '#374151', border: '1px solid #d1d5db', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', transition: '0.2s' },
  btnSair: { background: '#fef2f2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  
  alerta: { padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' },
  
  cardPadrao: { background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: '30px', border: '1px solid #f3f4f6' },
  cardHeader: { borderBottom: '1px solid #f3f4f6', paddingBottom: '15px', marginBottom: '20px' },
  cardTitle: { margin: 0, color: '#111827', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' },
  
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '12px 15px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: '#fff', color: '#111827', outline: 'none', transition: '0.2s' },
  select: { padding: '12px 15px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: '#fff', color: '#111827', outline: 'none', cursor: 'pointer', appearance: 'menulist' },
  
  btnPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', transition: '0.2s', flex: 1 },
  
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: { padding: '18px 15px', background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f3f4f6', transition: '0.2s' },
  td: { padding: '18px 15px', fontSize: '14px', verticalAlign: 'middle', color: '#4b5563' },
  badgeQuantidade: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  textoPreco: { fontWeight: '700', color: '#059669' },
  
  btnIcon: { background: '#f9fafb', border: '1px solid #e5e7eb', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: '0.2s' },
  
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(4px)' },
  modalCard: { background: '#fff', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }
};

export default AdminEstoque;