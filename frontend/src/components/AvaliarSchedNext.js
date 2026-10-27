import React, { useEffect, useState } from 'react';
import LoadingButton from './LoadingButton';
import { useToast } from './Toast';
import { API_URL } from '../services/api';

// Cartão "Avalie a SchedNext" no painel da empresa (AdminConta.js): a empresa dá nota e escreve
// um comentário, que vai pra moderação do admin absoluto e, aprovado, aparece na landing na
// seção "Quem usa, recomenda" (backend routes/depoimentos.js). Uma avaliação por empresa.

const STATUS = {
  pendente: { texto: 'Em análise: aparece no site depois de revisada.', cor: 'var(--fx-amber)', bg: 'var(--fx-amber-bg)' },
  aprovado: { texto: 'Publicada na página inicial da SchedNext. Obrigado!', cor: 'var(--fx-green)', bg: 'var(--fx-green-bg)' },
  recusado: { texto: 'Não foi publicada. Você pode editar e enviar de novo.', cor: 'var(--fx-red)', bg: 'var(--fx-red-bg)' }
};

function AvaliarSchedNext({ estiloCard, estiloTitulo }) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: '', cidade: '', texto: '', nota: 0 });
  const [status, setStatus] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/admin/depoimento`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setForm({ nome: d.nome || '', cidade: d.cidade || '', texto: d.texto || '', nota: d.nota || 0 });
        setStatus(d.status);
      })
      .catch(() => {});
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.nota) return toast.error('Escolha de 1 a 5 estrelas.');
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/admin/depoimento`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); setStatus(data.status); }
      else toast.error(data.detalhes?.[0]?.mensagem || data.error || 'Não foi possível enviar.');
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setEnviando(false);
    }
  };

  const campo = (nome) => (e) => setForm((f) => ({ ...f, [nome]: e.target.value }));
  const input = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', fontSize: '14px', fontFamily: 'inherit' };
  const rotulo = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fx-muted)', margin: '14px 0 6px' };
  const info = status && STATUS[status];

  return (
    <div style={{ ...estiloCard, marginTop: '20px' }}>
      <h3 style={estiloTitulo}>Avalie a SchedNext</h3>
      <p style={{ fontSize: '13px', color: 'var(--fx-muted)', margin: '6px 0 0' }}>
        Conte como o sistema ajuda o seu negócio. Seu comentário pode aparecer na página inicial da SchedNext, com seu nome e o nome do seu negócio.
      </p>
      {info && <p style={{ fontSize: '13px', fontWeight: 600, color: info.cor, background: info.bg, padding: '8px 12px', borderRadius: '8px', margin: '12px 0 0' }}>{info.texto}</p>}
      <form onSubmit={enviar}>
        <span style={rotulo}>Sua nota</span>
        <div style={{ display: 'flex', gap: '4px' }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} estrela${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setForm((f) => ({ ...f, nota: n }))}
              style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: '28px', lineHeight: 1, color: n <= (hover || form.nota) ? '#f59e0b' : 'var(--fx-line-2)' }}>
              ★
            </button>
          ))}
        </div>
        <label style={rotulo}>Seu comentário</label>
        <textarea style={{ ...input, minHeight: '90px', resize: 'vertical' }} maxLength={600} required value={form.texto} onChange={campo('texto')}
          placeholder="Ex: Meus clientes passaram a marcar sozinhos pelo WhatsApp e quase não tenho mais falta." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div><label style={rotulo}>Seu nome</label><input style={input} required value={form.nome} onChange={campo('nome')} placeholder="Ex: Marcos Silva" /></div>
          <div><label style={rotulo}>Cidade (opcional)</label><input style={input} value={form.cidade} onChange={campo('cidade')} placeholder="Ex: Recife, PE" /></div>
        </div>
        <LoadingButton type="submit" loading={enviando}
          style={{ marginTop: '16px', padding: '11px 20px', borderRadius: '8px', border: 'none', background: '#2554eb', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          {status ? 'Atualizar avaliação' : 'Enviar avaliação'}
        </LoadingButton>
      </form>
    </div>
  );
}

export default AvaliarSchedNext;
