import React, { useEffect, useState } from 'react';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

// Depoimentos de clientes exibidos na landing (backend routes/depoimentos.js). A lista é editada
// aqui e salva inteira de uma vez. Só relatos reais, com autorização de quem deu: a landing só
// mostra a seção quando existe pelo menos um ativo.

const VAZIO = { nome: '', negocio: '', cidade: '', texto: '', nota: 5, foto_url: '', ativo: true };

export default function AbaDepoimentos({ toast, confirmar, s }) {
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState(null); // índice na lista, ou null pra novo
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/super-admin/depoimentos`)
      .then((r) => r.json())
      .then((d) => setLista(Array.isArray(d) ? d : []))
      .catch(() => { setLista([]); toast.error('Não foi possível carregar os depoimentos.'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvarLista = async (nova, mensagem) => {
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/depoimentos`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ depoimentos: nova })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detalhes?.[0]?.mensagem || data.error || 'Não foi possível salvar.'); return false; }
      setLista(data.depoimentos);
      toast.success(mensagem);
      return true;
    } catch (err) {
      toast.error('Erro de conexão.');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const enviarForm = async (e) => {
    e.preventDefault();
    const nova = [...lista];
    if (editando === null) nova.push({ ...form, nota: Number(form.nota) });
    else nova[editando] = { ...nova[editando], ...form, nota: Number(form.nota) };
    if (await salvarLista(nova, editando === null ? 'Depoimento adicionado.' : 'Depoimento atualizado.')) {
      setForm(VAZIO);
      setEditando(null);
    }
  };

  const editar = (i) => { setEditando(i); setForm({ ...VAZIO, ...lista[i] }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const alternar = (i) => salvarLista(lista.map((d, j) => (j === i ? { ...d, ativo: d.ativo === false } : d)), lista[i].ativo === false ? 'Depoimento publicado.' : 'Depoimento ocultado.');
  const mover = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    salvarLista(nova, 'Ordem atualizada.');
  };
  const remover = async (i) => {
    const ok = await confirmar(`Excluir o depoimento de ${lista[i].nome}?`, { confirmText: 'Excluir' });
    if (ok) salvarLista(lista.filter((_, j) => j !== i), 'Depoimento excluído.');
  };

  const campo = (nome) => (e) => setForm((f) => ({ ...f, [nome]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (!lista) return <p style={s.textoCarregando}>Carregando...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={s.card}>
        <h3 style={s.cardTitulo}>{editando === null ? 'Novo depoimento' : 'Editar depoimento'}</h3>
        <p style={{ ...s.subTexto, marginBottom: '6px' }}>
          Aparece na página inicial, na seção "Quem usa, recomenda". Publique só relatos reais, com a autorização de quem deu. Depoimento inventado é propaganda enganosa.
        </p>
        <form onSubmit={enviarForm}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div><label style={s.label}>Nome *</label><input style={s.input} value={form.nome} onChange={campo('nome')} placeholder="Ex: Marcos Silva" required /></div>
            <div><label style={s.label}>Negócio</label><input style={s.input} value={form.negocio} onChange={campo('negocio')} placeholder="Ex: Barbearia do Marcos" /></div>
            <div><label style={s.label}>Cidade</label><input style={s.input} value={form.cidade} onChange={campo('cidade')} placeholder="Ex: Curitiba, PR" /></div>
            <div>
              <label style={s.label}>Nota</label>
              <select style={s.input} value={form.nota} onChange={campo('nota')}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
              </select>
            </div>
          </div>
          <label style={s.label}>Depoimento *</label>
          <textarea style={{ ...s.input, minHeight: '96px', resize: 'vertical', fontFamily: 'inherit' }} value={form.texto} onChange={campo('texto')} maxLength={600} placeholder="O que o cliente disse sobre o SchedNext" required />
          <label style={s.label}>Foto (link https, opcional)</label>
          <input style={s.input} value={form.foto_url} onChange={campo('foto_url')} placeholder="https://..." />
          <label style={{ ...s.checkboxLinha, marginTop: '12px' }}>
            <input type="checkbox" checked={form.ativo !== false} onChange={campo('ativo')} /> Publicar na página inicial
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <LoadingButton type="submit" loading={salvando} style={s.btnPrimario}>{editando === null ? 'Adicionar depoimento' : 'Salvar alterações'}</LoadingButton>
            {editando !== null && <button type="button" style={s.btnOutline} onClick={() => { setEditando(null); setForm(VAZIO); }}>Cancelar</button>}
          </div>
        </form>
      </div>

      {lista.length === 0 ? (
        <p style={s.textoVazio}>Nenhum depoimento ainda. Enquanto a lista estiver vazia, a seção não aparece na página inicial.</p>
      ) : lista.map((d, i) => (
        <div key={d.id || i} style={{ ...s.card, opacity: d.ativo === false ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: '15px' }}>{d.nome}</strong>
              <span style={{ ...s.subTexto, marginLeft: '8px' }}>{[d.negocio, d.cidade].filter(Boolean).join(' · ')}</span>
              <div style={{ color: '#f59e0b', fontSize: '14px', margin: '4px 0' }}>{'★'.repeat(d.nota || 5)}</div>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--fx-text)' }}>“{d.texto}”</p>
            </div>
            <span style={{ ...s.badge, background: d.ativo === false ? 'var(--fx-surface-2)' : 'var(--fx-green-bg)', color: d.ativo === false ? 'var(--fx-muted)' : 'var(--fx-green)' }}>
              {d.ativo === false ? 'Oculto' : 'Publicado'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button type="button" style={s.btnLink} onClick={() => editar(i)}>Editar</button>
            <button type="button" style={s.btnLink} onClick={() => alternar(i)}>{d.ativo === false ? 'Publicar' : 'Ocultar'}</button>
            <button type="button" style={s.btnLink} disabled={i === 0} onClick={() => mover(i, -1)}>Subir</button>
            <button type="button" style={s.btnLink} disabled={i === lista.length - 1} onClick={() => mover(i, 1)}>Descer</button>
            <button type="button" style={{ ...s.btnLink, color: 'var(--fx-red)' }} onClick={() => remover(i)}>Excluir</button>
          </div>
        </div>
      ))}
    </div>
  );
}
