import React, { useState, useEffect } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { obterTerminologia } from '../../utils/terminologia';
import { API_URL } from '../../services/api';

function GestaoServicos({ empresaId }) {
  const confirmar = useConfirm();
  const [servicos, setServicos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState({ nome: '', valor: '', duracao: '30', descricao: '' });
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
  const [vertical, setVertical] = useState('barbearia');
  const [permiteIA, setPermiteIA] = useState(false);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);
  const termos = obterTerminologia(vertical);

  const carregarServicos = () => {
    fetch(`${API_URL}/servicos-gestao/${empresaId}`)
      .then(res => res.json())
      .then(data => setServicos(data));
  };

  useEffect(() => {
    if (empresaId) carregarServicos();
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    fetch(`${API_URL}/admin/empresa/${empresaId}`)
      .then(r => r.json())
      .then(d => {
        if (d?.vertical) setVertical(d.vertical);
        setPermiteIA(!!d?.plano_plataforma?.permite_ia);
      })
      .catch(() => {});
  }, [empresaId]);

  const gerarDescricaoComIA = async () => {
    if (!formData.nome.trim()) return mostrarFeedback('Digite o nome do serviço antes de gerar a descrição.', 'erro');
    setGerandoDescricao(true);
    try {
      const res = await fetch(`${API_URL}/admin/ia/descricao-servico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formData.nome, vertical: termos.local })
      });
      const data = await res.json();
      if (res.ok) {
        setFormData(prev => ({ ...prev, descricao: data.descricao }));
      } else {
        mostrarFeedback(data.error || 'Não foi possível gerar a descrição.', 'erro');
      }
    } catch (err) {
      mostrarFeedback('Erro de conexão. Tente novamente.', 'erro');
    } finally {
      setGerandoDescricao(false);
    }
  };

  const mostrarFeedback = (texto, tipo = 'sucesso') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem({ texto: '', tipo: '' }), 3000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const url = editandoId 
      ? `${API_URL}/servicos-gestao/${editandoId}` 
      : `${API_URL}/servicos-gestao`;
    
    fetch(url, {
      method: editandoId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, empresa_id: empresaId })
    })
    .then(res => {
      if (res.ok) {
        mostrarFeedback(editandoId ? "Serviço atualizado com sucesso." : "Serviço cadastrado com sucesso.");
        setFormData({ nome: '', valor: '', duracao: '30', descricao: '' });
        setEditandoId(null);
        carregarServicos();
      } else {
        mostrarFeedback("Erro ao processar a requisição.", "erro");
      }
    });
  };

  const prepararEdicao = (servico) => {
    setEditandoId(servico.id);
    setFormData({ nome: servico.nome, valor: servico.valor, duracao: servico.duracao, descricao: servico.descricao || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deletar = async (id) => {
    const ok = await confirmar("Excluir este serviço definitivamente?", { confirmText: 'Excluir', danger: true });
    if (!ok) return;

    fetch(`${API_URL}/servicos-gestao/${id}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          mostrarFeedback("Serviço excluído.", "sucesso");
          carregarServicos();
        } else {
           mostrarFeedback("Erro ao excluir. Verifique se o serviço já não foi utilizado.", "erro");
        }
      });
  };

  // --- NOVA FUNÇÃO DE LIGAR/DESLIGAR SERVIÇO ---
  const alternarStatus = async (id, statusAtual, nome) => {
      // Se for undefined (banco velho), assume que é ativo (1) e vai inativar (0)
      const ativoSeguro = statusAtual === undefined ? 1 : statusAtual;

      const ok = await confirmar(`Deseja ${ativoSeguro ? 'desativar' : 'reativar'} ${nome}?`, {
          detail: ativoSeguro
              ? 'O serviço para de aparecer para os clientes agendarem imediatamente.'
              : 'O serviço volta a ficar disponível para agendamento.',
          confirmText: ativoSeguro ? 'Desativar' : 'Reativar',
          danger: !!ativoSeguro
      });
      if (!ok) return;

      fetch(`${API_URL}/servicos-gestao/${id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo: !ativoSeguro })
      }).then(res => {
          if (res.ok) {
              mostrarFeedback("Status do serviço atualizado!");
              carregarServicos();
          } else {
              mostrarFeedback("Não foi possível atualizar o status.", "erro");
          }
      });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <Icons.Scissors color="#111827" /> Gestão de Serviços
          </h2>
          <p style={styles.subtitle}>Cadastre, ative, inative ou edite os serviços oferecidos {termos.artigoContraido === 'da' ? 'pela sua' : 'pelo seu'} {termos.local.toLowerCase()}.</p>
        </div>
      </header>

      {mensagem.texto && (
        <div style={{
          ...styles.alerta,
          backgroundColor: mensagem.tipo === 'sucesso' ? '#ecfdf5' : '#fef2f2',
          color: mensagem.tipo === 'sucesso' ? '#065f46' : '#991b1b',
          border: `1px solid ${mensagem.tipo === 'sucesso' ? '#a7f3d0' : '#fecaca'}`
        }}>
          {mensagem.tipo === 'sucesso' ? <Icons.CheckCircle color="#059669" /> : <Icons.Alert color="#dc2626" />}
          <span>{mensagem.texto}</span>
        </div>
      )}

      <div style={styles.cardForm}>
        <h4 style={styles.cardTitle}>
          {editandoId ? <><Icons.Edit color="#4b5563" /> Editar Serviço</> : <><Icons.Plus color="#4b5563" /> Novo Serviço</>}
        </h4>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nome do Serviço</label>
            <input 
              placeholder="Ex: Corte Degradê" 
              value={formData.nome} 
              onChange={e => setFormData({...formData, nome: e.target.value})} 
              required style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Preço (R$)</label>
            <input 
              placeholder="0,00" 
              type="number" 
              step="0.01" 
              min="0"
              value={formData.valor} 
              onChange={e => setFormData({...formData, valor: e.target.value})} 
              required 
              style={styles.input}
            />
          </div>
          <div style={{...styles.inputGroup, position: 'relative'}}>
            <label style={styles.label}>Duração (minutos)</label>
            <input 
              type="number"
              step="5" 
              min="5" 
              max="180" 
              value={formData.duracao} 
              onChange={e => setFormData({...formData, duracao: e.target.value})} 
              required 
              style={styles.input}
              placeholder="Ex: 30"
            />
            <small style={styles.helperText}>Máximo 180 min (3h)</small>
          </div>

          {permiteIA && (
            <div style={{...styles.inputGroup, gridColumn: '1 / -1'}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={styles.label}>Descrição (opcional)</label>
                <button
                  type="button"
                  onClick={gerarDescricaoComIA}
                  disabled={gerandoDescricao}
                  style={styles.btnGerarIA}
                >
                  {gerandoDescricao ? 'Gerando...' : '✨ Gerar com IA'}
                </button>
              </div>
              <textarea
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
                placeholder="Uma frase curta pra vitrine do serviço"
                style={styles.textareaDescricao}
                rows={2}
              />
            </div>
          )}

          <div style={styles.areaAcoes}>
            <button type="submit" style={styles.btnPrincipal}>
              {editandoId ? 'Atualizar Serviço' : 'Cadastrar Serviço'}
            </button>
            {editandoId && (
              <button type="button" onClick={() => {setEditandoId(null); setFormData({nome:'', valor:'', duracao:'30'})}} style={styles.btnCancelar}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={styles.cardTabela}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{...styles.th, width: '35%'}}>SERVIÇO</th>
              <th style={{...styles.th, width: '15%', textAlign: 'center'}}>DURAÇÃO</th>
              <th style={{...styles.th, width: '15%', textAlign: 'center'}}>PREÇO</th>
              <th style={{...styles.th, width: '15%', textAlign: 'center'}}>STATUS</th>
              <th style={{...styles.th, width: '20%', textAlign: 'right'}}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {servicos.length > 0 ? servicos.map(s => {
              // Assume ativo se a coluna for nova e vier null/undefined
              const isAtivo = s.ativo !== 0; 
              return (
                <tr key={s.id} style={{...styles.tr, opacity: isAtivo ? 1 : 0.6}}>
                  <td style={{...styles.td, width: '35%'}}>
                    <strong style={{color: '#111827', textDecoration: isAtivo ? 'none' : 'line-through'}}>{s.nome}</strong>
                  </td>
                  <td style={{...styles.td, width: '15%', textAlign: 'center'}}>
                    <span style={styles.badgeDuracao}>{s.duracao} min</span>
                  </td>
                  <td style={{...styles.td, width: '15%', textAlign: 'center'}}>
                    <span style={styles.textoPreco}>R$ {parseFloat(s.valor).toFixed(2).replace('.', ',')}</span>
                  </td>
                  <td style={{...styles.td, width: '15%', textAlign: 'center'}}>
                    <span style={{
                        padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                        backgroundColor: isAtivo ? '#ecfdf5' : '#fef2f2',
                        color: isAtivo ? '#059669' : '#dc2626'
                    }}>
                        {isAtivo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{...styles.td, width: '20%', textAlign: 'right'}}>
                    <button onClick={() => alternarStatus(s.id, s.ativo, s.nome)} style={styles.btnIconPower} title={isAtivo ? "Inativar" : "Ativar"}>
                      <Icons.Power color={isAtivo ? "#10b981" : "#9ca3af"} />
                    </button>
                    <button onClick={() => prepararEdicao(s)} style={styles.btnIconEdit} title="Editar">
                      <Icons.Edit color="#4b5563" />
                    </button>
                    <button onClick={() => deletar(s.id)} style={styles.btnIconDelete} title="Excluir">
                      <Icons.Trash color="#ef4444" />
                    </button>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                  Nenhum serviço cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Icons = {
  Scissors: ({color}) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'bottom'}}><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="10.48" x2="20" y2="16"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>,
  Edit: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Plus: ({color}) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Trash: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  CheckCircle: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Alert: ({color}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  Power: ({color}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
};

const styles = {
  container: { padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
  title: { fontSize: '28px', color: '#111827', fontWeight: '800', margin: '0 0 5px 0', letterSpacing: '-0.5px' },
  subtitle: { color: '#6b7280', fontSize: '15px', margin: 0 },
  alerta: { padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600' },
  cardForm: { background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #f3f4f6' },
  cardTitle: { margin: '0 0 20px 0', color: '#111827', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'flex-start' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: '#fff', color: '#111827' },
  helperText: { fontSize: '11px', color: '#9ca3af', marginTop: '2px' },
  btnGerarIA: { padding: '4px 10px', borderRadius: '6px', border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#6d28d9', cursor: 'pointer', fontSize: '11px', fontWeight: '700' },
  textareaDescricao: { padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', background: '#fff', color: '#111827', fontFamily: 'inherit', resize: 'vertical' },
  areaAcoes: { display: 'flex', gap: '10px', marginTop: '22px' }, 
  btnPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', transition: '0.2s', flex: 1 },
  btnCancelar: { background: '#f3f4f6', color: '#4b5563', padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', transition: '0.2s' },
  cardTabela: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f3f4f6' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: { padding: '15px 20px', background: '#f9fafb', color: '#6b7280', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6', transition: '0.2s' },
  td: { padding: '18px 20px', fontSize: '14px', verticalAlign: 'middle', wordWrap: 'break-word', color: '#4b5563' },
  badgeDuracao: { background: '#eef2ff', color: '#4f46e5', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  textoPreco: { fontWeight: '700', color: '#059669' },
  btnIconEdit: { background: '#f3f4f6', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', display: 'inline-flex', alignItems: 'center', transition: '0.2s' },
  btnIconDelete: { background: '#fef2f2', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: '0.2s' },
  btnIconPower: { background: '#f9fafb', border: '1px solid #e5e7eb', padding: '7px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px', display: 'inline-flex', alignItems: 'center', transition: '0.2s' }
};

export default GestaoServicos;