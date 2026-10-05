import React, { useCallback, useEffect, useState } from 'react';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';
import { lerPlanilha } from '../../utils/lerPlanilha';

// Prospecção de clientes por WhatsApp (ver backend/src/services/prospeccao.js): conexão de um
// número próprio pra prospecção, importação da planilha de prospects, configuração do ritmo
// diário e das mensagens, e acompanhamento de cada contato. Os estilos (`s`) vêm do
// SuperAdminDashboard pra manter o mesmo visual das outras abas.

const STATUS_PROSPECT = {
  na_fila: { label: 'Na fila', bg: 'var(--fx-surface-2)', fg: 'var(--fx-text)' },
  abertura_enviada: { label: '1ª mensagem enviada', bg: 'var(--fx-blue-bg)', fg: 'var(--fx-blue)' },
  followup_enviado: { label: 'Follow-up enviado', bg: 'var(--fx-blue-bg)', fg: 'var(--fx-blue)' },
  respondeu: { label: 'Respondeu', bg: 'var(--fx-green-bg)', fg: 'var(--fx-green)' },
  sem_resposta: { label: 'Sem resposta', bg: 'var(--fx-surface-2)', fg: 'var(--fx-muted)' },
  optout: { label: 'Pediu pra sair', bg: 'var(--fx-red-bg)', fg: 'var(--fx-red)' },
  pausado: { label: 'Pausado', bg: 'var(--fx-amber-bg)', fg: 'var(--fx-amber)' },
  erro: { label: 'Erro', bg: 'var(--fx-red-bg)', fg: 'var(--fx-red)' }
};
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const VARIANTES = ['A', 'B', 'C'];

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
const formatarHora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
function formatarTelefone(t) {
  const d = String(t || '');
  return d.length === 13 ? `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}` : d;
}

// --- Mapeamento das colunas da planilha -----------------------------------------------------
const normalizar = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const REGRAS_COLUNA = {
  empresa: (h) => ['empresa', 'nome', 'nome da empresa', 'negocio', 'estabelecimento', 'razao social', 'nome fantasia'].includes(h),
  telefone: (h) => /telefone|whatsapp|celular|fone/.test(h),
  categoria: (h) => h === 'categoria' || h === 'segmento' || h === 'tipo',
  cidade: (h) => h === 'cidade' || h === 'municipio',
  bairro: (h) => h === 'bairro',
  instagram: (h) => h.startsWith('instagram'),
  prioridade: (h) => h === 'prioridade',
  ponto_abordagem: (h) => h.startsWith('ponto de abordagem'),
  variante: (h) => h.startsWith('variante'),
  mensagem_abertura: (h) => h.startsWith('mensagem 1'),
  mensagem_followup: (h) => h.startsWith('mensagem 2'),
  status_planilha: (h) => h === 'status'
};

// Acha, em cada aba, a linha de cabeçalho com pelo menos "empresa" e "telefone" (nas primeiras
// 10 linhas) e mapeia as colunas conhecidas. Prefere a aba chamada "Prospects".
function extrairProspects(abas) {
  const ordenadas = [...abas].sort((a, b) => (normalizar(b.nome) === 'prospects') - (normalizar(a.nome) === 'prospects'));
  for (const aba of ordenadas) {
    for (let i = 0; i < Math.min(10, aba.linhas.length); i += 1) {
      const cabecalho = (aba.linhas[i] || []).map(normalizar);
      const colunas = {};
      Object.entries(REGRAS_COLUNA).forEach(([campo, regra]) => {
        const indice = cabecalho.findIndex((h) => h && regra(h));
        if (indice >= 0) colunas[campo] = indice;
      });
      if (colunas.empresa === undefined || colunas.telefone === undefined) continue;
      const linhas = aba.linhas.slice(i + 1)
        .map((linha) => Object.fromEntries(Object.entries(colunas).map(([campo, idx]) => [campo, String(linha?.[idx] ?? '').trim()])))
        .filter((l) => l.empresa || l.telefone);
      return { aba: aba.nome, colunas: Object.keys(colunas), linhas };
    }
  }
  return null;
}

export default function AbaProspeccao({ toast, confirmar, s }) {
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState('');
  const [alternando, setAlternando] = useState(false);
  const [versaoLista, setVersaoLista] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/super-admin/prospeccao/resumo`);
      const data = await res.json();
      if (res.ok) { setResumo(data); setErro(''); } else setErro(data.error || 'Não foi possível carregar a prospecção.');
    } catch (err) {
      setErro('Erro de conexão.');
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  const alternarDisparos = async () => {
    const ligar = !resumo.config.ativo;
    if (ligar) {
      const ok = await confirmar('Ligar os disparos de prospecção?', {
        detail: `Até ${resumo.config.limite_diario} mensagens por dia, nos dias e horários configurados, com intervalo de ${resumo.config.intervalo_min_minutos} a ${resumo.config.intervalo_max_minutos} minutos entre elas.`,
        confirmText: 'Ligar'
      });
      if (!ok) return;
    }
    setAlternando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/prospeccao/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: ligar })
      });
      const data = await res.json();
      if (res.ok) { toast.success(ligar ? 'Disparos ligados.' : 'Disparos pausados.'); carregar(); } else toast.error(data.error || 'Não foi possível alterar.');
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setAlternando(false);
    }
  };

  if (erro && !resumo) return <div style={s.card}><p style={s.subTexto}>{erro}</p></div>;
  if (!resumo) return <p style={s.textoCarregando}>Carregando...</p>;

  const { config, contagens, situacao, enviadasHoje } = resumo;
  const aguardando = (contagens.abertura_enviada || 0) + (contagens.followup_enviado || 0);
  const cards = [
    ['Na fila', contagens.na_fila, 'var(--fx-text)'],
    ['Enviadas hoje', `${enviadasHoje}/${config.limite_diario}`, 'var(--fx-blue)'],
    ['Aguardando resposta', aguardando, 'var(--fx-amber)'],
    ['Responderam', contagens.respondeu, 'var(--fx-green)'],
    ['Sem resposta', contagens.sem_resposta, 'var(--fx-muted)'],
    ['Pediram pra sair / erro', `${contagens.optout || 0} / ${contagens.erro || 0}`, 'var(--fx-red)']
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ ...s.cardTitulo, marginBottom: '6px' }}>Disparos automáticos</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--fx-text)' }}>
            {situacao.enviando
              ? <>Enviando. {situacao.proximoEnvioEm && new Date(situacao.proximoEnvioEm) > new Date() ? `Próxima mensagem por volta das ${formatarHora(situacao.proximoEnvioEm)}.` : 'Próxima mensagem no próximo minuto.'}</>
              : (situacao.motivo || 'Parado.')}
          </p>
        </div>
        <LoadingButton loading={alternando} onClick={alternarDisparos} style={config.ativo ? { ...s.btnOutline, ...s.btnOutlineVermelho } : s.btnPrimario}>
          {config.ativo ? 'Pausar disparos' : 'Ligar disparos'}
        </LoadingButton>
      </div>

      <div style={{ ...s.statsGrid, marginBottom: 0 }}>
        {cards.map(([rotulo, valor, cor]) => (
          <div key={rotulo} style={s.statCard}>
            <div style={s.statLabel}>{rotulo}</div>
            <div style={{ ...s.statNumero, color: cor, marginTop: '8px' }}>{valor ?? 0}</div>
          </div>
        ))}
      </div>

      <div style={s.gridDuasColunas}>
        <ConexaoWhatsapp whatsapp={resumo.whatsapp} onAlterou={carregar} toast={toast} confirmar={confirmar} s={s} />
        <ImportarPlanilha onImportou={() => { carregar(); setVersaoLista((v) => v + 1); }} toast={toast} s={s} />
      </div>

      <ConfiguracaoProspeccao config={config} conectado={resumo.whatsapp.conectado} onSalvou={carregar} toast={toast} s={s} />

      <ListaProspects versao={versaoLista} onAlterou={carregar} toast={toast} confirmar={confirmar} s={s} />
    </div>
  );
}

// --- Conexão do WhatsApp de prospecção (QR Code ou código, igual ao admin da empresa) --------
function ConexaoWhatsapp({ whatsapp, onAlterou, toast, confirmar, s }) {
  const [modo, setModo] = useState(null); // 'qr' | 'codigo'
  const [qrcode, setQrcode] = useState('');
  const [codigo, setCodigo] = useState('');
  const [numero, setNumero] = useState('');
  const [processando, setProcessando] = useState(false);

  // Enquanto o QR/código está na tela, confere a conexão a cada 5s.
  useEffect(() => {
    if ((!qrcode && !codigo) || whatsapp.conectado) return undefined;
    const t = setInterval(onAlterou, 5000);
    return () => clearInterval(t);
  }, [qrcode, codigo, whatsapp.conectado, onAlterou]);

  useEffect(() => {
    if (whatsapp.conectado) { setQrcode(''); setCodigo(''); setModo(null); }
  }, [whatsapp.conectado]);

  const pedir = async (rota, corpo) => {
    setProcessando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/prospeccao/whatsapp/${rota}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {})
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Não foi possível conectar.'); return null; }
      return data;
    } catch (err) {
      toast.error('Erro de conexão.');
      return null;
    } finally {
      setProcessando(false);
    }
  };

  const gerarQr = async () => { const d = await pedir('qrcode'); if (d) { setQrcode(d.qrcode); setModo('qr'); } };
  const gerarCodigo = async () => { const d = await pedir('codigo', { telefone: numero }); if (d) setCodigo(d.codigo); };
  const desconectar = async () => {
    const ok = await confirmar('Desconectar o WhatsApp de prospecção?', { detail: 'Os disparos param até você conectar um número de novo.', confirmText: 'Desconectar' });
    if (!ok) return;
    const d = await pedir('desconectar');
    if (d) { toast.success(d.message); setQrcode(''); setCodigo(''); setModo(null); onAlterou(); }
  };

  return (
    <div style={s.card}>
      <h3 style={s.cardTitulo}>WhatsApp de prospecção</h3>
      <p style={{ ...s.subTexto, marginBottom: '12px' }}>
        Use um chip só pra prospecção, separado do WhatsApp da SchedNext que manda cobrança. Se este número for bloqueado, a cobrança continua funcionando.
      </p>
      {!whatsapp.disponivel ? (
        <p style={s.subTexto}>A integração de WhatsApp (Evolution) não está configurada no servidor.</p>
      ) : whatsapp.conectado ? (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...s.badge, background: 'var(--fx-green-bg)', color: 'var(--fx-green)' }}>Conectado</span>
          <LoadingButton loading={processando} onClick={desconectar} style={s.btnOutline}>Desconectar</LoadingButton>
        </div>
      ) : modo === 'qr' && qrcode ? (
        <div>
          <p style={{ ...s.subTexto, marginBottom: '8px' }}>No celular do chip de prospecção: WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho, e escaneie:</p>
          <img src={qrcode} alt="QR Code de conexão do WhatsApp" style={{ width: '220px', maxWidth: '100%', background: '#fff', borderRadius: '12px', padding: '8px' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <LoadingButton loading={processando} onClick={gerarQr} style={s.btnOutline}>Gerar novo QR Code</LoadingButton>
            <button type="button" onClick={() => { setModo(null); setQrcode(''); }} style={s.btnLink}>Voltar</button>
          </div>
        </div>
      ) : modo === 'codigo' ? (
        codigo ? (
          <div>
            <p style={{ ...s.subTexto, marginBottom: '8px' }}>No celular desse número: WhatsApp &gt; Aparelhos conectados &gt; Conectar com número de telefone, e digite:</p>
            <div style={{ fontFamily: 'var(--oc-mono)', fontSize: '26px', letterSpacing: '0.2em', color: 'var(--fx-text)', marginBottom: '8px' }}>
              {codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo}
            </div>
            <p style={s.subTexto}>Esta tela confirma sozinha quando conectar.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...s.input, maxWidth: '220px' }} placeholder="(41) 91234-5678" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <LoadingButton loading={processando} onClick={gerarCodigo} style={s.btnPrimario}>Gerar código</LoadingButton>
            <button type="button" onClick={() => setModo(null)} style={s.btnLink}>Voltar</button>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <LoadingButton loading={processando} onClick={gerarQr} style={s.btnPrimario}>Conectar com QR Code</LoadingButton>
          <button type="button" onClick={() => setModo('codigo')} style={s.btnOutline}>Conectar com código</button>
        </div>
      )}
    </div>
  );
}

// --- Importação da planilha ---------------------------------------------------------------
function ImportarPlanilha({ onImportou, toast, s }) {
  const [arquivo, setArquivo] = useState(null);
  const [lido, setLido] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const escolher = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setResultado(null);
    try {
      const extraido = extrairProspects(await lerPlanilha(f));
      if (!extraido) { toast.error('Não achei as colunas de empresa e telefone na planilha.'); return; }
      setArquivo(f.name);
      setLido(extraido);
    } catch (err) {
      toast.error(err.message || 'Não foi possível ler a planilha.');
    }
  };

  const importar = async () => {
    setImportando(true);
    const soma = {};
    try {
      for (let i = 0; i < lido.linhas.length; i += 500) {
        const res = await fetch(`${API_URL}/super-admin/prospeccao/importar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origem: arquivo, linhas: lido.linhas.slice(i, i + 500) })
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || 'Erro ao importar.'); break; }
        Object.entries(data).forEach(([k, v]) => { soma[k] = (soma[k] || 0) + v; });
      }
      if (Object.keys(soma).length) { setResultado(soma); setLido(null); onImportou(); toast.success(`${soma.importados || 0} prospects adicionados à fila.`); }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div style={s.card}>
      <h3 style={s.cardTitulo}>Importar planilha</h3>
      <p style={{ ...s.subTexto, marginBottom: '12px' }}>
        .xlsx ou .csv com pelo menos as colunas Empresa e Telefone. Também aproveita Categoria, Cidade, Bairro, Prioridade, Variante e as colunas "Mensagem 1" e "Mensagem 2". Só celulares entram; fixos, repetidos, quem já é cliente e quem a planilha marca como já contatado ficam de fora.
      </p>
      <label style={{ ...s.btnOutline, display: 'inline-block' }}>
        Escolher arquivo
        <input type="file" accept=".xlsx,.csv" onChange={escolher} style={{ display: 'none' }} />
      </label>
      {lido && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--fx-text)', margin: '0 0 6px' }}>
            <strong>{arquivo}</strong>, aba "{lido.aba}": {lido.linhas.length} linhas.
          </p>
          <p style={{ ...s.subTexto, marginBottom: '10px' }}>Colunas reconhecidas: {lido.colunas.join(', ')}.</p>
          <LoadingButton loading={importando} onClick={importar} style={s.btnPrimario}>Importar {lido.linhas.length} linhas</LoadingButton>
        </div>
      )}
      {resultado && (
        <ul style={{ fontSize: '13px', color: 'var(--fx-text)', margin: '12px 0 0', paddingLeft: '18px', lineHeight: 1.7 }}>
          <li><strong>{resultado.importados || 0}</strong> adicionados à fila</li>
          {!!resultado.fixos_ou_invalidos && <li>{resultado.fixos_ou_invalidos} fixos ou números inválidos (sem WhatsApp)</li>}
          {!!resultado.duplicados && <li>{resultado.duplicados} repetidos ou já importados antes</li>}
          {!!resultado.ja_contatados && <li>{resultado.ja_contatados} já contatados segundo a planilha</li>}
          {!!resultado.ja_clientes && <li>{resultado.ja_clientes} já são clientes da SchedNext</li>}
          {!!resultado.sem_nome && <li>{resultado.sem_nome} sem nome da empresa</li>}
        </ul>
      )}
    </div>
  );
}

// --- Configuração do fluxo -----------------------------------------------------------------
function ConfiguracaoProspeccao({ config, conectado, onSalvou, toast, s }) {
  const [form, setForm] = useState(config);
  const [salvando, setSalvando] = useState(false);
  const [teste, setTeste] = useState({ telefone: '', mensagem: '0' });
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  // Recarrega o form quando a config salva muda (ex: depois de salvar), sem atropelar o que está
  // sendo digitado a cada atualização periódica do resumo.
  const configJson = JSON.stringify(config);
  useEffect(() => { setForm(JSON.parse(configJson)); }, [configJson]);

  const campo = (nome) => (e) => setForm((f) => ({ ...f, [nome]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const alternarDia = (dia) => setForm((f) => ({
    ...f, dias_semana: f.dias_semana.includes(dia) ? f.dias_semana.filter((d) => d !== dia) : [...f.dias_semana, dia].sort()
  }));
  const mudarAbertura = (i) => (e) => setForm((f) => {
    const lista = [...(f.mensagens_abertura || [])];
    lista[i] = e.target.value;
    return { ...f, mensagens_abertura: lista };
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      const { ativo, ...resto } = form;
      const res = await fetch(`${API_URL}/super-admin/prospeccao/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...resto,
          limite_diario: Number(resto.limite_diario),
          intervalo_min_minutos: Number(resto.intervalo_min_minutos),
          intervalo_max_minutos: Number(resto.intervalo_max_minutos),
          dias_followup: Number(resto.dias_followup),
          mensagens_abertura: VARIANTES.map((_, i) => (resto.mensagens_abertura || [])[i] || '')
        })
      });
      const data = await res.json();
      if (res.ok) { toast.success('Configuração salva.'); onSalvou(); }
      else toast.error(data.detalhes?.[0]?.mensagem || data.error || 'Não foi possível salvar.');
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  const enviarTeste = async () => {
    setEnviandoTeste(true);
    try {
      const followup = teste.mensagem === 'followup';
      const res = await fetch(`${API_URL}/super-admin/prospeccao/teste`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: teste.telefone, followup, variante: followup ? 0 : Number(teste.mensagem) })
      });
      const data = await res.json();
      if (res.ok) toast.success(data.message); else toast.error(data.error || 'Não foi possível enviar.');
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setEnviandoTeste(false);
    }
  };

  const linha = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' };
  const area = { ...s.input, minHeight: '96px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 };

  return (
    <div style={s.card}>
      <h3 style={s.cardTitulo}>Configuração do fluxo</h3>
      <p style={s.subTexto}>
        Comece devagar: número novo mandando muita mensagem pra quem não conhece é o que mais leva a bloqueio. 10 a 20 por dia, com alguns minutos entre elas, é um ritmo seguro pra começar.
      </p>

      <div style={linha}>
        <div>
          <label style={s.label}>Limite por dia</label>
          <input type="number" min="1" max="200" style={s.input} value={form.limite_diario} onChange={campo('limite_diario')} />
        </div>
        <div>
          <label style={s.label}>Intervalo mínimo (min)</label>
          <input type="number" min="1" max="240" style={s.input} value={form.intervalo_min_minutos} onChange={campo('intervalo_min_minutos')} />
        </div>
        <div>
          <label style={s.label}>Intervalo máximo (min)</label>
          <input type="number" min="1" max="240" style={s.input} value={form.intervalo_max_minutos} onChange={campo('intervalo_max_minutos')} />
        </div>
        <div>
          <label style={s.label}>Horários (Brasília)</label>
          <input style={s.input} value={form.janelas} onChange={campo('janelas')} placeholder="09:00-11:00, 14:00-16:30" />
        </div>
      </div>

      <label style={s.label}>Dias de envio</label>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {DIAS_SEMANA.map((rotulo, dia) => {
          const ativo = (form.dias_semana || []).includes(dia);
          return (
            <button key={rotulo} type="button" onClick={() => alternarDia(dia)}
              style={{ ...s.btnOutline, ...(ativo ? { background: 'var(--oc-texto)', color: 'var(--oc-fundo)', borderColor: 'transparent' } : {}) }}>
              {rotulo}
            </button>
          );
        })}
      </div>

      <label style={s.label}>Mensagens de abertura</label>
      <p style={{ ...s.subTexto, marginTop: 0, marginBottom: '8px' }}>
        Variáveis: {'{saudacao}'} (bom dia/boa tarde conforme a hora), {'{empresa}'}, {'{cidade}'}, {'{bairro}'}, {'{categoria}'}. Cada prospect recebe a variante da coluna "Variante" da planilha; sem ela, as variantes se revezam.
      </p>
      <div style={{ display: 'grid', gap: '10px' }}>
        {VARIANTES.map((v, i) => (
          <div key={v}>
            <span style={{ ...s.subTexto, display: 'block', marginBottom: '4px' }}>Variante {v}</span>
            <textarea style={area} value={(form.mensagens_abertura || [])[i] || ''} onChange={mudarAbertura(i)} />
          </div>
        ))}
      </div>

      <label style={s.checkboxLinha}>
        <input type="checkbox" checked={!!form.usar_mensagens_planilha} onChange={campo('usar_mensagens_planilha')} />
        Quando a planilha tiver mensagem personalizada ("Mensagem 1" e "Mensagem 2"), usar a da planilha
      </label>
      <label style={{ ...s.checkboxLinha, marginTop: '8px' }}>
        <input type="checkbox" checked={!!form.ajustar_saudacao} onChange={campo('ajustar_saudacao')} />
        Trocar "bom dia/boa tarde" escrito na mensagem pela saudação certa da hora do envio
      </label>

      <div style={{ ...linha, marginTop: '6px' }}>
        <div>
          <label style={s.label}>Follow-up</label>
          <label style={s.checkboxLinha}>
            <input type="checkbox" checked={!!form.enviar_followup} onChange={campo('enviar_followup')} />
            Mandar 1 follow-up se não responder
          </label>
        </div>
        <div>
          <label style={s.label}>Dias até o follow-up / encerrar</label>
          <input type="number" min="1" max="30" style={s.input} value={form.dias_followup} onChange={campo('dias_followup')} />
        </div>
      </div>
      <textarea style={{ ...area, marginTop: '10px' }} value={form.mensagem_followup || ''} onChange={campo('mensagem_followup')} disabled={!form.enviar_followup} />

      <div style={linha}>
        <div>
          <label style={s.label}>Avisar respostas no WhatsApp</label>
          <input style={s.input} placeholder="Seu celular pessoal" value={form.numero_aviso || ''} onChange={campo('numero_aviso')} />
        </div>
        <div>
          <label style={s.label}>Palavras de saída</label>
          <input style={s.input} value={form.palavras_optout || ''} onChange={campo('palavras_optout')} />
        </div>
      </div>
      <label style={s.label}>Resposta automática a quem pedir pra sair</label>
      <input style={s.input} placeholder="Vazio = não responde nada" value={form.resposta_optout || ''} onChange={campo('resposta_optout')} />

      <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <LoadingButton loading={salvando} onClick={salvar} style={s.btnPrimario}>Salvar configuração</LoadingButton>
      </div>

      <div style={{ borderTop: '1px solid var(--fx-line)', marginTop: '18px', paddingTop: '14px' }}>
        <label style={{ ...s.label, marginTop: 0 }}>Enviar teste pro seu celular</label>
        <p style={{ ...s.subTexto, marginTop: 0, marginBottom: '8px' }}>Usa a configuração salva, com uma empresa de exemplo.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...s.input, maxWidth: '200px' }} placeholder="(41) 91234-5678" value={teste.telefone} onChange={(e) => setTeste((t) => ({ ...t, telefone: e.target.value }))} />
          <select style={s.selectFiltro} value={teste.mensagem} onChange={(e) => setTeste((t) => ({ ...t, mensagem: e.target.value }))}>
            {VARIANTES.map((v, i) => <option key={v} value={String(i)}>Abertura {v}</option>)}
            <option value="followup">Follow-up</option>
          </select>
          <LoadingButton loading={enviandoTeste} onClick={enviarTeste} disabled={!conectado} style={s.btnOutline}>Enviar teste</LoadingButton>
        </div>
      </div>
    </div>
  );
}

// --- Lista de prospects --------------------------------------------------------------------
function ListaProspects({ versao, onAlterou, toast, confirmar, s }) {
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState({ prospects: [], total: 0, porPagina: 50 });
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async () => {
    const params = new URLSearchParams({ pagina: String(pagina) });
    if (filtro) params.set('status', filtro);
    if (buscaAplicada) params.set('busca', buscaAplicada);
    try {
      const res = await fetch(`${API_URL}/super-admin/prospeccao/prospects?${params}`);
      const data = await res.json();
      if (res.ok) setDados(data);
    } catch (err) { /* o resumo já mostra o erro de conexão */ }
  }, [pagina, filtro, buscaAplicada]);

  useEffect(() => { carregar(); }, [carregar, versao]);
  useEffect(() => {
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  const atualizar = async (prospect, mudancas, mensagem) => {
    try {
      const res = await fetch(`${API_URL}/super-admin/prospeccao/prospects/${prospect.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mudancas)
      });
      const data = await res.json();
      if (res.ok) { if (mensagem) toast.success(mensagem); carregar(); onAlterou(); return data; }
      toast.error(data.error || 'Não foi possível atualizar.');
    } catch (err) { toast.error('Erro de conexão.'); }
    return null;
  };

  const excluir = async (prospect) => {
    const ok = await confirmar(`Excluir "${prospect.empresa}" da prospecção?`, { detail: 'Apaga o contato e o histórico de mensagens dele.', confirmText: 'Excluir' });
    if (!ok) return;
    const res = await fetch(`${API_URL}/super-admin/prospeccao/prospects/${prospect.id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) { toast.success('Prospect excluído.'); carregar(); onAlterou(); } else toast.error('Não foi possível excluir.');
  };

  const totalPaginas = Math.max(1, Math.ceil(dados.total / dados.porPagina));

  return (
    <div>
      <div style={s.barraTop}>
        <form onSubmit={(e) => { e.preventDefault(); setPagina(1); setBuscaAplicada(busca.trim()); }} style={{ flex: 1, minWidth: '220px' }}>
          <input style={s.inputBusca} placeholder="Buscar empresa, cidade ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </form>
        <select style={s.selectFiltro} value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1); }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_PROSPECT).map(([valor, info]) => <option key={valor} value={valor}>{info.label}</option>)}
        </select>
      </div>

      <div style={s.cardTabela}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sa-tabela" style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Empresa</th>
                <th style={s.th}>Telefone</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Último envio</th>
                <th style={s.th}>Resposta</th>
                <th style={s.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.prospects.length === 0 && (
                <tr><td style={s.td} colSpan={6}><span style={s.textoVazio}>Nenhum prospect aqui. Importe uma planilha pra começar.</span></td></tr>
              )}
              {dados.prospects.map((p) => {
                const info = STATUS_PROSPECT[p.status] || { label: p.status, bg: 'var(--fx-surface-2)', fg: 'var(--fx-muted)' };
                const emAndamento = ['na_fila', 'abertura_enviada', 'followup_enviado'].includes(p.status);
                return (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}>
                      <strong>{p.empresa}</strong>
                      <div style={s.subTexto}>{[p.categoria, p.cidade, p.prioridade && `prioridade ${p.prioridade.toLowerCase()}`].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td style={s.td}>
                      <a href={`https://wa.me/${p.telefone}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fx-blue)' }}>{formatarTelefone(p.telefone)}</a>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: info.bg, color: info.fg }} title={p.erro || ''}>{info.label}</span>
                      {p.erro && <div style={{ ...s.subTexto, color: 'var(--fx-red)' }}>{p.erro}</div>}
                    </td>
                    <td style={s.td}>{formatarDataHora(p.ultimo_envio_em)}{p.mensagens_enviadas ? <div style={s.subTexto}>{p.mensagens_enviadas} enviada(s)</div> : null}</td>
                    <td style={{ ...s.td, maxWidth: '260px' }}>
                      {p.ultima_resposta ? <span title={p.ultima_resposta}>{p.ultima_resposta.length > 90 ? `${p.ultima_resposta.slice(0, 90)}…` : p.ultima_resposta}</span> : <span style={s.textoVazio}>-</span>}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="button" style={s.btnLink} onClick={() => setAberto(p)}>Detalhes</button>
                        {emAndamento && <button type="button" style={s.btnLink} onClick={() => atualizar(p, { status: 'pausado' }, 'Prospect pausado.')}>Pausar</button>}
                        {['pausado', 'erro', 'sem_resposta'].includes(p.status) && <button type="button" style={s.btnLink} onClick={() => atualizar(p, { status: 'na_fila' }, 'Voltou pra fila.')}>Voltar pra fila</button>}
                        {['abertura_enviada', 'followup_enviado', 'sem_resposta'].includes(p.status) && <button type="button" style={s.btnLink} onClick={() => atualizar(p, { status: 'respondeu' }, 'Marcado como respondeu.')}>Respondeu</button>}
                        <button type="button" style={{ ...s.btnLink, color: 'var(--fx-red)' }} onClick={() => excluir(p)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', marginTop: '12px' }}>
          <button type="button" style={s.btnOutline} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span style={s.subTexto}>Página {pagina} de {totalPaginas} · {dados.total} prospects</span>
          <button type="button" style={s.btnOutline} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
        </div>
      )}

      {aberto && <DetalheProspect prospect={aberto} onFechar={() => setAberto(null)} onSalvar={(obs) => atualizar(aberto, { observacoes: obs }, 'Anotação salva.')} s={s} />}
    </div>
  );
}

function DetalheProspect({ prospect, onFechar, onSalvar, s }) {
  const [envios, setEnvios] = useState(null);
  const [observacoes, setObservacoes] = useState(prospect.observacoes || '');

  useEffect(() => {
    fetch(`${API_URL}/super-admin/prospeccao/prospects/${prospect.id}/envios`)
      .then((r) => r.json())
      .then((d) => setEnvios(Array.isArray(d) ? d : []))
      .catch(() => setEnvios([]));
  }, [prospect.id]);

  const rotuloEtapa = { 0: 'Resposta automática', 1: 'Abertura', 2: 'Follow-up' };

  return (
    <div style={s.overlay} onClick={onFechar}>
      <div style={{ ...s.modal, maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <strong style={{ fontSize: '16px' }}>{prospect.empresa}</strong>
            <div style={s.subTexto}>{[prospect.categoria, prospect.bairro, prospect.cidade].filter(Boolean).join(' · ')} · {formatarTelefone(prospect.telefone)}</div>
          </div>
          <button type="button" onClick={onFechar} style={{ ...s.btnFechar, color: 'var(--fx-muted)', fontSize: '22px' }} aria-label="Fechar">×</button>
        </div>

        {prospect.ponto_abordagem && (
          <>
            <label style={{ ...s.label, marginTop: 0 }}>Ponto de abordagem</label>
            <p style={{ fontSize: '13px', margin: 0 }}>{prospect.ponto_abordagem}</p>
          </>
        )}

        <label style={s.label}>Mensagens enviadas</label>
        {envios === null ? <p style={s.subTexto}>Carregando...</p> : envios.length === 0 ? <p style={s.subTexto}>Nenhuma ainda.</p> : envios.map((e) => (
          <div key={e.id} style={{ background: 'var(--fx-surface-2)', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={s.subTexto}>{rotuloEtapa[e.etapa] || 'Mensagem'} · {formatarDataHora(e.enviado_em)}{!e.ok && <span style={{ color: 'var(--fx-red)' }}> · falhou: {e.erro}</span>}</div>
            <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', marginTop: '4px' }}>{e.texto}</div>
          </div>
        ))}

        {prospect.ultima_resposta && (
          <>
            <label style={s.label}>Última resposta ({formatarDataHora(prospect.respondeu_em)})</label>
            <div style={{ background: 'var(--fx-green-bg)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{prospect.ultima_resposta}</div>
          </>
        )}

        <label style={s.label}>Anotações</label>
        <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex: pediu pra chamar na quinta; já usa outro sistema" />
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button type="button" style={s.btnPrimario} onClick={async () => { if (await onSalvar(observacoes)) onFechar(); }}>Salvar anotação</button>
          <a href={`https://wa.me/${prospect.telefone}`} target="_blank" rel="noopener noreferrer" style={{ ...s.btnOutline, textDecoration: 'none' }}>Abrir conversa no WhatsApp</a>
        </div>
      </div>
    </div>
  );
}
