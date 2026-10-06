import React, { useEffect, useState } from 'react';
import LoadingButton from './LoadingButton';
import { API_URL } from '../services/api';

// Editor das mensagens do bot de WhatsApp agrupadas por estado da conversa (ver
// backend/src/services/whatsapp/mensagensBot.js). Usado em dois lugares com a mesma tela:
//   - painel da empresa (AdminWhatsapp.js): personaliza o bot só dela;
//   - admin absoluto (SuperAdminDashboard.js): define o padrão de todas as empresas.
// Campo vazio = usa o padrão (o da plataforma pra empresa, o de fábrica pro admin absoluto),
// mostrado como placeholder. O catálogo de mensagens vem da API, então mensagem nova no bot
// aparece aqui sem mexer no front.
export default function EditorMensagensBot({ endpoint, toast, rotuloPadrao, estiloBotao }) {
  const [grupos, setGrupos] = useState(null);
  const [padroes, setPadroes] = useState({});
  const [rascunho, setRascunho] = useState({});
  const [estado, setEstado] = useState(0);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}${endpoint}`);
        const data = await res.json();
        if (!ativo) return;
        if (!res.ok) return setErro(data.error || 'Não foi possível carregar as mensagens.');
        const fabrica = Object.fromEntries(data.grupos.flatMap((g) => g.mensagens.map((m) => [m.chave, m.padraoFabrica])));
        setGrupos(data.grupos);
        setPadroes({ ...fabrica, ...(data.padroes || {}) });
        setRascunho(data.valores || {});
      } catch (err) {
        if (ativo) setErro('Erro de conexão ao carregar as mensagens.');
      }
    })();
    return () => { ativo = false; };
  }, [endpoint]);

  const alterar = (chave, texto) => setRascunho((r) => ({ ...r, [chave]: texto }));

  const inserirVariavel = (chave, nome) => setRascunho((r) => {
    const atual = r[chave] || padroes[chave] || '';
    return { ...r, [chave]: `${atual}{${nome}}` };
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: rascunho })
      });
      const data = await res.json();
      if (res.ok) {
        setRascunho(data.valores || {});
        toast.success('Mensagens salvas.');
      } else {
        toast.error(data.error || 'Não foi possível salvar.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (erro) return <p style={st.ajuda}>{erro}</p>;
  if (!grupos) return <p style={st.ajuda}>Carregando mensagens...</p>;

  const grupo = grupos[estado] || grupos[0];
  const personalizadas = (g) => g.mensagens.filter((m) => (rascunho[m.chave] || '').trim()).length;

  return (
    <div>
      <div style={st.abas} role="tablist">
        {grupos.map((g, i) => {
          const n = personalizadas(g);
          return (
            <button
              key={g.estado}
              type="button"
              role="tab"
              aria-selected={i === estado}
              onClick={() => setEstado(i)}
              style={i === estado ? st.abaAtiva : st.aba}
            >
              {g.estado}{n > 0 && <span style={st.contador}>{n}</span>}
            </button>
          );
        })}
      </div>

      <p style={{ ...st.ajuda, margin: '12px 0 4px' }}>
        <strong style={{ color: 'var(--fx-text)' }}>Estado: {grupo.estado}</strong> · {grupo.descricao}
      </p>
      <p style={{ ...st.ajuda, margin: '0 0 8px' }}>
        Deixe em branco para usar {rotuloPadrao}. Palavras entre chaves, como {'{lista}'}, são trocadas pelo valor real na hora do envio.
      </p>

      {grupo.mensagens.map((m) => {
        const valor = rascunho[m.chave] || '';
        const personalizada = !!valor.trim();
        return (
          <div key={m.chave} style={st.item}>
            <div style={st.itemTopo}>
              <label htmlFor={`msg-${m.chave}`} style={st.titulo}>
                {m.titulo}
                {personalizada && <span style={st.selo}>Personalizada</span>}
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {!personalizada && (
                  <button type="button" style={st.linkBtn} onClick={() => alterar(m.chave, padroes[m.chave] || '')}>Editar</button>
                )}
                {personalizada && (
                  <button type="button" style={st.linkBtn} onClick={() => alterar(m.chave, '')}>Voltar ao padrão</button>
                )}
              </div>
            </div>
            <textarea
              id={`msg-${m.chave}`}
              rows={Math.min(8, Math.max(2, (valor || padroes[m.chave] || '').split('\n').length + 1))}
              maxLength={1000}
              placeholder={padroes[m.chave]}
              value={valor}
              onChange={(e) => alterar(m.chave, e.target.value)}
              style={st.textarea}
            />
            {m.variaveis.length > 0 && (
              <div style={st.variaveis}>
                {m.variaveis.map((v) => (
                  <button
                    key={v.nome}
                    type="button"
                    title={`Inserir: ${v.descricao}`}
                    onClick={() => inserirVariavel(m.chave, v.nome)}
                    style={st.chip}
                  >
                    {`{${v.nome}}`}<span style={st.chipDesc}>{v.descricao}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: '18px' }}>
        <LoadingButton loading={salvando} onClick={salvar} style={estiloBotao}>Salvar mensagens</LoadingButton>
      </div>
    </div>
  );
}

const st = {
  abas: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  aba: { padding: '7px 12px', borderRadius: '999px', border: '1px solid var(--fx-line-2)', background: 'transparent', color: 'var(--fx-text)', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' },
  abaAtiva: { padding: '7px 12px', borderRadius: '999px', border: '1px solid var(--fx-blue)', background: 'var(--fx-violet-bg)', color: 'var(--fx-blue)', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' },
  contador: { minWidth: '18px', height: '18px', borderRadius: '999px', background: 'var(--fx-blue)', color: '#fff', fontSize: '10.5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', boxSizing: 'border-box' },
  ajuda: { fontSize: '12px', color: 'var(--fx-muted)', lineHeight: 1.5 },
  item: { padding: '14px 0', borderTop: '1px solid var(--fx-line)' },
  itemTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' },
  titulo: { fontSize: '13px', fontWeight: 600, color: 'var(--fx-text)', display: 'inline-flex', alignItems: 'center', gap: '8px' },
  selo: { fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'var(--fx-green-bg)', color: 'var(--fx-green)' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--fx-blue)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-surface-2)', color: 'var(--fx-text)', fontSize: '13px', fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' },
  variaveis: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', borderRadius: '6px', border: '1px solid var(--fx-line)', background: 'var(--fx-surface-2)', color: 'var(--fx-text)', fontFamily: 'monospace', fontSize: '11.5px', cursor: 'pointer' },
  chipDesc: { fontFamily: 'system-ui, sans-serif', color: 'var(--fx-faint)', fontSize: '11px' }
};
