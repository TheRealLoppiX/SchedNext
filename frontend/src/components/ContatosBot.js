import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoadingButton from './LoadingButton';
import { API_URL } from '../services/api';
import { formatarTelefone } from '../utils/telefone';

// Seleção de contatos do bot de WhatsApp (ver backend/src/services/whatsapp/contatosBot.js). A
// lista vem dos contatos do número conectado, via Evolution; cada clique já salva (sem botão
// "Salvar" no fim), pra uma lista de milhares de contatos não depender de lembrar de salvar.

const MODOS = [
  { valor: 'todos', rotulo: 'Responder todo mundo', ajuda: 'O bot responde qualquer pessoa que mandar mensagem.' },
  { valor: 'todos_exceto', rotulo: 'Responder todos, exceto os marcados', ajuda: 'Marque família, amigos e quem o bot não deve atender. Clientes novos continuam sendo atendidos.' },
  { valor: 'somente_marcados', rotulo: 'Responder só os contatos marcados', ajuda: 'Só quem estiver marcado recebe resposta. Clientes novos, fora da lista, ficam sem resposta.' }
];

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'com_nome', rotulo: 'Com nome' },
  { valor: 'com_numero', rotulo: 'Com número' },
  { valor: 'marcados', rotulo: 'Só marcados' }
];

const formatarNumero = (telefone) => {
  const d = String(telefone || '').replace(/\D/g, '');
  return formatarTelefone(d.length > 11 && d.startsWith('55') ? d.slice(2) : d);
};

const iniciais = (nome) => (nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

function Avatar({ foto, nome }) {
  const [erro, setErro] = useState(false);
  if (foto && !erro) return <img src={foto} alt="" style={st.avatar} onError={() => setErro(true)} />;
  return <span style={{ ...st.avatar, ...st.avatarIniciais }}>{iniciais(nome)}</span>;
}

export default function ContatosBot({ toast, confirmar, estiloBotao, conectado }) {
  const [modo, setModo] = useState('todos');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [emLote, setEmLote] = useState(false);
  const [manual, setManual] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const requisicao = useRef(0);

  const carregar = useCallback(async ({ atualizar = false } = {}) => {
    const minha = ++requisicao.current;
    setCarregando(true);
    try {
      const params = new URLSearchParams({ busca: buscaAplicada, filtro, pagina: String(pagina) });
      if (atualizar) params.set('atualizar', '1');
      const res = await fetch(`${API_URL}/admin/whatsapp/contatos?${params}`);
      const data = await res.json();
      if (minha !== requisicao.current) return; // resposta de uma busca antiga
      if (!res.ok) return setErro(data.error || 'Não foi possível carregar os contatos.');
      setErro('');
      setDados(data);
      setModo(data.modo);
    } catch (err) {
      if (minha === requisicao.current) setErro('Erro de conexão ao carregar os contatos.');
    } finally {
      if (minha === requisicao.current) setCarregando(false);
    }
  }, [buscaAplicada, filtro, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  // Busca só depois de uma pausa na digitação.
  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(busca); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const enviar = async (caminho, metodo, corpo) => {
    const res = await fetch(`${API_URL}${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.');
    return data;
  };

  const trocarModo = async (novo) => {
    if (novo === modo) return;
    if (novo === 'somente_marcados') {
      const ok = await confirmar('Responder só os contatos marcados?', {
        detail: (dados?.totalMarcados || 0) === 0
          ? 'Nenhum contato está marcado ainda: o bot vai parar de responder todo mundo até você marcar alguém. Clientes novos, fora da lista, nunca recebem resposta.'
          : `O bot vai responder só os ${dados.totalMarcados} contatos marcados. Clientes novos, fora da lista, ficam sem resposta.`,
        confirmText: 'Usar este modo'
      });
      if (!ok) return;
    }
    const anterior = modo;
    setModo(novo);
    try {
      await enviar('/admin/whatsapp/contatos/modo', 'PUT', { modo: novo });
      toast.success('Modo do bot atualizado.');
    } catch (err) {
      setModo(anterior);
      toast.error(err.message);
    }
  };

  const alternar = async (contato) => {
    const marcado = !contato.marcado;
    const aplicar = (valor) => setDados((d) => ({
      ...d,
      totalMarcados: d.totalMarcados + (valor === contato.marcado ? 0 : valor ? 1 : -1),
      contatos: d.contatos.map((c) => (c.jid === contato.jid ? { ...c, marcado: valor } : c))
    }));
    aplicar(marcado);
    try {
      await enviar('/admin/whatsapp/contatos/marcar', 'POST', { marcado, contatos: [{ jid: contato.jid, nome: contato.nome, telefone: contato.telefone }] });
      if (!marcado && filtro === 'marcados') carregar();
    } catch (err) {
      aplicar(contato.marcado);
      toast.error(err.message);
    }
  };

  const marcarFiltro = async (marcado) => {
    const total = dados?.totalFiltro || 0;
    if (!total) return;
    const ok = await confirmar(marcado ? `Marcar ${total} contatos?` : `Desmarcar ${total} contatos?`, {
      detail: buscaAplicada || filtro !== 'todos' ? 'Vale para todos os contatos que aparecem com a busca e o filtro atuais, em todas as páginas.' : 'Vale para todos os contatos da lista, em todas as páginas.',
      confirmText: marcado ? 'Marcar todos' : 'Desmarcar todos'
    });
    if (!ok) return;
    setEmLote(true);
    try {
      const r = await enviar('/admin/whatsapp/contatos/marcar-filtro', 'POST', { marcado, busca: buscaAplicada, filtro });
      toast.success(`${r.alterados} contatos ${marcado ? 'marcados' : 'desmarcados'}.`);
      await carregar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEmLote(false);
    }
  };

  const adicionarManual = async () => {
    if (!manual.trim()) return;
    setAdicionando(true);
    try {
      await enviar('/admin/whatsapp/contatos/manual', 'POST', { telefone: manual });
      toast.success('Número marcado.');
      setManual('');
      await carregar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdicionando(false);
    }
  };

  const atualizar = async () => {
    setAtualizando(true);
    await carregar({ atualizar: true });
    setAtualizando(false);
  };

  const modoAtual = MODOS.find((m) => m.valor === modo) || MODOS[0];
  const listaRelevante = modo !== 'todos';

  return (
    <div>
      <div style={st.modos} role="radiogroup" aria-label="Quem o bot responde">
        {MODOS.map((m) => (
          <label key={m.valor} style={{ ...st.modo, ...(modo === m.valor ? st.modoAtivo : {}) }}>
            <input type="radio" name="modo-contatos" checked={modo === m.valor} onChange={() => trocarModo(m.valor)} style={{ margin: 0 }} />
            {m.rotulo}
          </label>
        ))}
      </div>
      <p style={{ ...st.ajuda, margin: '8px 0 0' }}>{modoAtual.ajuda}</p>

      {modo === 'somente_marcados' && dados && dados.totalMarcados === 0 && (
        <div style={st.alerta}>Nenhum contato marcado: no momento o bot não está respondendo ninguém.</div>
      )}

      <div style={{ ...st.lista, ...(listaRelevante ? {} : { opacity: 0.6 }) }}>
        {!listaRelevante && (
          <p style={{ ...st.ajuda, margin: '0 0 10px' }}>A lista abaixo só vale nos outros dois modos. Dá para ir marcando antes de trocar.</p>
        )}

        <div style={st.barra}>
          <input
            type="search"
            placeholder="Buscar por nome ou número"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={st.busca}
            aria-label="Buscar contatos"
          />
          <LoadingButton loading={atualizando} onClick={atualizar} style={st.btnSec} disabled={!conectado}>Atualizar contatos</LoadingButton>
        </div>

        <div style={st.filtros}>
          {FILTROS.map((f) => (
            <button key={f.valor} type="button" onClick={() => { setFiltro(f.valor); setPagina(1); }} style={filtro === f.valor ? st.chipAtivo : st.chip}>
              {f.rotulo}
            </button>
          ))}
        </div>

        {dados?.evolutionIndisponivel && (
          <div style={st.alerta}>
            {conectado
              ? 'Não foi possível buscar os contatos do WhatsApp agora. Os contatos já marcados continuam valendo; tente "Atualizar contatos" em instantes.'
              : 'Conecte o WhatsApp para ver os contatos do número. Os contatos já marcados continuam valendo.'}
          </div>
        )}

        {erro && <p style={{ ...st.ajuda, color: 'var(--fx-red)' }}>{erro}</p>}

        {dados && (
          <>
            <div style={st.resumo}>
              <span>{dados.totalMarcados} marcados de {dados.totalGeral}</span>
              <span style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" style={st.linkBtn} disabled={emLote || !dados.totalFiltro} onClick={() => marcarFiltro(true)}>
                  Marcar {buscaAplicada || filtro !== 'todos' ? `os ${dados.totalFiltro} do filtro` : 'todos'}
                </button>
                <button type="button" style={st.linkBtn} disabled={emLote || !dados.totalFiltro} onClick={() => marcarFiltro(false)}>Desmarcar</button>
              </span>
            </div>

            <ul style={{ ...st.ul, ...(carregando ? { opacity: 0.6 } : {}) }}>
              {dados.contatos.length === 0 && (
                <li style={{ ...st.ajuda, padding: '18px 4px' }}>{carregando ? 'Carregando...' : 'Nenhum contato encontrado.'}</li>
              )}
              {dados.contatos.map((c) => (
                <li key={c.jid} style={st.item}>
                  <label style={st.itemLabel}>
                    <input type="checkbox" checked={!!c.marcado} onChange={() => alternar(c)} style={st.check} />
                    <Avatar foto={c.foto} nome={c.nome} />
                    <span style={{ minWidth: 0 }}>
                      <span style={st.nome}>{c.nome || (c.telefone ? formatarNumero(c.telefone) : 'Sem nome')}</span>
                      <span style={st.numero}>
                        {c.telefone
                          ? (c.nome ? formatarNumero(c.telefone) : 'sem nome no perfil')
                          : <span title="O WhatsApp esconde o número de alguns contatos por privacidade. A seleção funciona do mesmo jeito.">número oculto pelo WhatsApp ⓘ</span>}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {dados.paginas > 1 && (
              <div style={st.paginacao}>
                <button type="button" style={st.btnSec} disabled={dados.pagina <= 1 || carregando} onClick={() => setPagina(dados.pagina - 1)}>‹ Anterior</button>
                <span style={st.ajuda}>Página {dados.pagina} de {dados.paginas}</span>
                <button type="button" style={st.btnSec} disabled={dados.pagina >= dados.paginas || carregando} onClick={() => setPagina(dados.pagina + 1)}>Próxima ›</button>
              </div>
            )}
          </>
        )}

        <label style={{ ...st.ajuda, display: 'block', margin: '18px 0 6px', fontWeight: 600, color: 'var(--fx-text)' }}>Marcar um número que não está na lista</label>
        <div style={st.barra}>
          <input
            type="tel"
            placeholder="(11) 91234-5678"
            value={manual}
            onChange={(e) => setManual(formatarTelefone(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') adicionarManual(); }}
            style={st.busca}
          />
          <LoadingButton loading={adicionando} onClick={adicionarManual} style={estiloBotao}>Marcar</LoadingButton>
        </div>
      </div>

      <p style={{ ...st.ajuda, marginTop: '12px' }}>
        O nome mostrado é o que cada pessoa colocou no próprio perfil do WhatsApp, não o salvo na sua agenda: o WhatsApp não compartilha a agenda do celular com aparelhos conectados.
      </p>
    </div>
  );
}

const st = {
  modos: { display: 'flex', flexDirection: 'column', gap: '6px' },
  modo: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--fx-text)' },
  modoAtivo: { borderColor: 'var(--fx-blue)', background: 'var(--fx-violet-bg)', color: 'var(--fx-blue)' },
  ajuda: { fontSize: '12px', color: 'var(--fx-muted)', lineHeight: 1.5 },
  alerta: { marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--fx-amber-bg)', border: '1px solid var(--fx-amber-line)', color: 'var(--fx-text)', fontSize: '12.5px' },
  lista: { marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--fx-line)' },
  barra: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  busca: { flex: '1 1 220px', minWidth: 0, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-surface-2)', color: 'var(--fx-text)', fontSize: '13px', boxSizing: 'border-box' },
  btnSec: { padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-text)', cursor: 'pointer', fontSize: '13px' },
  filtros: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' },
  chip: { padding: '5px 11px', borderRadius: '999px', border: '1px solid var(--fx-line-2)', background: 'transparent', color: 'var(--fx-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  chipAtivo: { padding: '5px 11px', borderRadius: '999px', border: '1px solid var(--fx-blue)', background: 'var(--fx-violet-bg)', color: 'var(--fx-blue)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
  resumo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '14px 0 6px', fontSize: '12.5px', color: 'var(--fx-muted)' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--fx-blue)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', padding: 0 },
  ul: { listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--fx-line)' },
  item: { borderBottom: '1px solid var(--fx-line)' },
  itemLabel: { display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 4px', cursor: 'pointer' },
  check: { width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarIniciais: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fx-surface-2)', color: 'var(--fx-muted)', fontSize: '12px', fontWeight: 700 },
  nome: { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fx-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  numero: { display: 'block', fontSize: '12px', color: 'var(--fx-faint)' },
  paginacao: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }
};
