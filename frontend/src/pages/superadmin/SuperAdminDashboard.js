import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import useEscToClose from '../../hooks/useEscToClose';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

const STATUS_LEAD_INFO = {
  novo: { label: 'Novo', bg: '#dbeafe', fg: '#1e40af' },
  contatado: { label: 'Contatado', bg: '#fef3c7', fg: '#92400e' },
  fechado: { label: 'Fechado', bg: '#d1fae5', fg: '#065f46' }
};

// Status da assinatura DA EMPRESA na plataforma (empresas.status_assinatura, ver
// sql/2026_status_assinatura_suspensa.sql pros valores válidos), não confundir com o
// status_assinatura de cliente final da própria barbearia (ver AdminClientes.js).
function infoStatusEmpresa(empresa) {
  if (empresa.status_assinatura === 'ativa' && empresa.cancelamento_agendado && empresa.proxima_cobranca_em) {
    return { label: `Cancelamento agendado p/ ${formatarData(empresa.proxima_cobranca_em)}`, bg: '#fef3c7', fg: '#92400e' };
  }
  const mapa = {
    trial: { label: 'Em teste', bg: '#dbeafe', fg: '#1e40af' },
    ativa: { label: 'Em dia', bg: '#d1fae5', fg: '#065f46' },
    inadimplente: { label: 'Inadimplente', bg: '#fee2e2', fg: '#991b1b' },
    suspensa: { label: 'Suspensa', bg: '#fee2e2', fg: '#991b1b' },
    cancelada: { label: 'Cancelada', bg: '#f3f4f6', fg: '#374151' }
  };
  return mapa[empresa.status_assinatura] || { label: empresa.status_assinatura || 'Sem status', bg: '#f3f4f6', fg: '#6b7280' };
}

function formatarData(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatarPreco(preco) {
  if (preco == null) return 'Sob consulta';
  return Number(preco) === 0 ? 'Grátis' : `R$ ${Number(preco).toFixed(2)}/mês`;
}

const FLAGS_PLANO = [
  ['permite_paleta_customizada', 'Paleta customizada'],
  ['permite_whatsapp_bot', 'Bot de WhatsApp'],
  ['permite_remover_marca', 'Remover marca'],
  ['permite_ia', 'Recursos com IA'],
  ['permite_multi_unidade', 'Múltiplas unidades'],
  ['permite_api_publica', 'API pública'],
  ['permite_relatorios_avancados', 'Relatórios avançados'],
  ['permite_dominio_customizado', 'Domínio próprio']
];

const PLANO_VAZIO = {
  nome: '', preco_mensal: '', limite_profissionais: '', limite_agendamentos_mes: '',
  permite_paleta_customizada: false, permite_whatsapp_bot: false, permite_remover_marca: false,
  permite_ia: false, permite_multi_unidade: false, permite_api_publica: false,
  permite_relatorios_avancados: false, permite_dominio_customizado: false
};

const ABAS = [
  { valor: 'metricas', label: 'Métricas', icon: 'BarChart' },
  { valor: 'empresas', label: 'Empresas', icon: 'Building' },
  { valor: 'planos', label: 'Planos', icon: 'Tag' },
  { valor: 'chaves', label: 'Chaves de Ativação', icon: 'Key' },
  { valor: 'leads', label: 'Leads Enterprise', icon: 'Mail' },
  { valor: 'superadmins', label: 'Super Admins', icon: 'Shield' }
];

// Dashboard do admin absoluto — gerencia leads do plano Enterprise, planos da plataforma,
// empresas cadastradas e métricas gerais. Fora da árvore de rotas de tenant de propósito (não
// usa empresaId nem slug nenhum). Visual segue o mesmo padrão claro/cards do admin de empresa
// (ver pages/admin/AdminClientes.js), só que num painel único sem sidebar por tenant.
function SuperAdminDashboard() {
  const [aba, setAba] = useState('metricas');
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();

  const sair = () => {
    localStorage.removeItem('superAdminToken');
    navigate('/admin-absoluto/login');
  };

  return (
    <div style={s.pagina}>
      <div style={s.container}>
        <header style={s.header}>
          <div>
            <h1 style={s.titulo}><Icons.Building color="#111827" /> Painel da plataforma</h1>
            <p style={s.subtitulo}>Controle de empresas, planos e assinaturas da SchedNext</p>
          </div>
          <button onClick={sair} style={s.btnSair}><Icons.LogOut color="#dc2626" /> Sair</button>
        </header>

        <div style={s.tabsRow}>
          {ABAS.map(({ valor, label, icon }) => {
            const IconeAba = Icons[icon];
            return (
              <button
                key={valor}
                onClick={() => setAba(valor)}
                style={{ ...s.tab, ...(aba === valor ? s.tabAtivo : {}) }}
              >
                <IconeAba color={aba === valor ? '#fff' : '#6b7280'} /> {label}
              </button>
            );
          })}
        </div>

        {aba === 'metricas' && <AbaMetricas toast={toast} />}
        {aba === 'empresas' && <AbaEmpresas toast={toast} confirmar={confirmar} />}
        {aba === 'planos' && <AbaPlanos toast={toast} />}
        {aba === 'chaves' && <AbaChaves toast={toast} confirmar={confirmar} />}
        {aba === 'leads' && <AbaLeads toast={toast} confirmar={confirmar} />}
        {aba === 'superadmins' && <AbaSuperAdmins toast={toast} confirmar={confirmar} />}
      </div>
    </div>
  );
}

function AbaMetricas({ toast }) {
  const [metricas, setMetricas] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/super-admin/metricas`)
      .then((r) => r.json())
      .then(setMetricas)
      .catch(() => toast.error('Erro ao carregar métricas.'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) return <p style={s.textoCarregando}>Carregando...</p>;
  if (!metricas) return <p style={s.textoVazio}>Não foi possível carregar as métricas.</p>;

  return (
    <div>
      <div style={s.statsGrid}>
        <StatCard label="Empresas na plataforma" valor={metricas.total_empresas} cor="#2563eb" icon="Building" />
        <StatCard label="MRR (planos pagos ativos)" valor={metricas.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cor="#059669" icon="TrendingUp" />
      </div>

      <div style={s.gridDuasColunas}>
        <div style={s.card}>
          <h3 style={s.cardTitulo}>Empresas por status</h3>
          {Object.entries(metricas.empresas_por_status).map(([status, qtd]) => (
            <div key={status} style={s.linhaLista}>
              <span>{status}</span><strong>{qtd}</strong>
            </div>
          ))}
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitulo}>Empresas por plano</h3>
          {Object.entries(metricas.empresas_por_plano).map(([plano, qtd]) => (
            <div key={plano} style={s.linhaLista}>
              <span>{plano}</span><strong>{qtd}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, valor, cor, icon }) {
  const Icone = Icons[icon];
  return (
    <div style={{ ...s.statCard, borderTopColor: cor }}>
      <div style={s.statCardTopo}>
        <span style={s.statLabel}>{label}</span>
        <Icone color={cor} />
      </div>
      <div style={{ ...s.statNumero, color: cor }}>{valor}</div>
    </div>
  );
}

function AbaEmpresas({ toast, confirmar }) {
  const [empresas, setEmpresas] = useState([]);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [detalheId, setDetalheId] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (statusFiltro) params.set('status', statusFiltro);
      const res = await fetch(`${API_URL}/super-admin/empresas${params.toString() ? `?${params.toString()}` : ''}`);
      const data = await res.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, statusFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  const alternarSuspensao = async (empresa) => {
    const suspender = empresa.status_assinatura !== 'suspensa';
    const ok = await confirmar(`${suspender ? 'Suspender' : 'Reativar'} a empresa "${empresa.nome}"?`, {
      detail: suspender ? 'O login do admin dessa empresa fica bloqueado imediatamente.' : 'O login volta a funcionar normalmente.',
      confirmText: suspender ? 'Suspender' : 'Reativar',
      danger: suspender
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/super-admin/empresas/${empresa.id}/${suspender ? 'suspender' : 'reativar'}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); carregar(); }
      else toast.error(data.error || 'Não foi possível atualizar a empresa.');
    } catch (err) { toast.error('Erro de conexão. Tente novamente.'); }
  };

  return (
    <div>
      <div style={s.barraTop}>
        <input
          placeholder="Buscar por nome, slug ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={s.inputBusca}
        />
        <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} style={s.selectFiltro}>
          <option value="">Todos os status</option>
          <option value="trial">Em teste</option>
          <option value="ativa">Em dia</option>
          <option value="inadimplente">Inadimplente</option>
          <option value="suspensa">Suspensa</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {carregando ? <p style={s.textoCarregando}>Carregando...</p> : empresas.length === 0 ? (
        <p style={s.textoVazio}>Nenhuma empresa encontrada.</p>
      ) : (
        <div style={s.cardTabela}>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Empresa', 'E-mail', 'Cadastro', 'Plano', 'Status', 'Ações'].map((h) => (
                    <th key={h} style={{ ...s.th, ...(h === 'Ações' ? { textAlign: 'right' } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => {
                  const status = infoStatusEmpresa(e);
                  return (
                    <tr key={e.id} style={s.tr}>
                      <td style={s.td}>
                        <strong style={{ color: '#111827' }}>{e.nome}</strong>
                        <div style={s.subTexto}>{e.slug}</div>
                      </td>
                      <td style={s.td}>{e.email}</td>
                      <td style={s.td}>{formatarData(e.criado_em)}</td>
                      <td style={s.td}>
                        {e.plano_plataforma?.nome || '-'}
                        {e.plano_plataforma_pendente_id && (
                          <div style={{ ...s.subTexto, color: '#92400e' }}>trocando p/ {e.plano_plataforma_pendente?.nome}</div>
                        )}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: status.bg, color: status.fg }}>{status.label}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setDetalheId(e.id)} style={s.btnOutline}>Detalhes</button>
                          <button
                            onClick={() => alternarSuspensao(e)}
                            style={{ ...s.btnOutline, ...(e.status_assinatura === 'suspensa' ? s.btnOutlineVerde : s.btnOutlineVermelho) }}
                          >
                            {e.status_assinatura === 'suspensa' ? 'Reativar' : 'Suspender'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detalheId && <DetalheEmpresaModal id={detalheId} onFechar={() => setDetalheId(null)} toast={toast} />}
    </div>
  );
}

// Barra "X / limite" que mostra o consumo atual de barbeiros/agendamentos do plano — fica
// amarela perto do limite (>=80%) e vermelha no limite ou acima, pra saltar aos olhos do admin
// absoluto antes que o cliente reclame de não conseguir cadastrar mais nada.
function BarraUso({ label, usado, limite }) {
  const ilimitado = limite == null;
  const percentual = ilimitado ? 0 : Math.min(100, Math.round((usado / limite) * 100));
  const cor = ilimitado ? '#d1d5db' : percentual >= 100 ? '#dc2626' : percentual >= 80 ? '#d97706' : '#2554eb';

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '5px', fontWeight: 600 }}>
        <span>{label}</span>
        <span>{ilimitado ? `${usado} (ilimitado)` : `${usado} / ${limite}`}</span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
        {!ilimitado && <div style={{ width: `${percentual}%`, background: cor, height: '100%', borderRadius: '6px' }} />}
      </div>
    </div>
  );
}

function DetalheEmpresaModal({ id, onFechar, toast }) {
  const [empresa, setEmpresa] = useState(null);
  const [carregando, setCarregando] = useState(true);
  useEscToClose(true, onFechar);

  useEffect(() => {
    setCarregando(true);
    fetch(`${API_URL}/super-admin/empresas/${id}`)
      .then((r) => r.json())
      .then(setEmpresa)
      .catch(() => toast.error('Erro ao carregar detalhes da empresa.'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const status = empresa ? infoStatusEmpresa(empresa) : null;

  return (
    <div style={s.overlay} onClick={onFechar}>
      <div style={s.modal} onClick={(ev) => ev.stopPropagation()}>
        {carregando ? <p style={s.textoCarregando}>Carregando...</p> : !empresa ? (
          <p style={s.textoVazio}>Não foi possível carregar os detalhes.</p>
        ) : (
          <>
            <div style={s.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>{empresa.nome}</h3>
                <div style={s.subTexto}>{empresa.slug} · {empresa.email}</div>
              </div>
              <button onClick={onFechar} style={s.btnFechar}><Icons.Close /></button>
            </div>

            <div style={s.infoGrid}>
              <InfoItem label="Cadastrada em" valor={formatarData(empresa.criado_em)} />
              <InfoItem label="Vertical" valor={empresa.vertical || '-'} />
              <InfoItem label="CPF/CNPJ" valor={empresa.cpf_cnpj || '-'} />
              <InfoItem label="Status da assinatura" badge={status} />
              <InfoItem label="Plano atual" valor={`${empresa.plano_plataforma?.nome || '-'} · ${formatarPreco(empresa.plano_plataforma?.preco_mensal)}`} />
              {empresa.plano_plataforma_pendente_id && (
                <InfoItem label="Trocando para" valor={`${empresa.plano_plataforma_pendente?.nome} · ${formatarPreco(empresa.plano_plataforma_pendente?.preco_mensal)} (aguardando confirmação de pagamento)`} cor="#92400e" />
              )}
              {empresa.plano_plataforma?.preco_mensal > 0 && (
                <InfoItem
                  label="Próxima cobrança"
                  valor={empresa.proxima_cobranca_em ? formatarData(empresa.proxima_cobranca_em) : 'sem cobrança recorrente ativa'}
                  cor={empresa.cancelamento_agendado ? '#92400e' : undefined}
                />
              )}
              {empresa.cancelamento_agendado && (
                <InfoItem label="Cancelamento" valor="Agendado, cai pro plano Grátis na próxima cobrança" cor="#92400e" />
              )}
              {empresa.chave_ativacao_expira_em && (
                <InfoItem label="Plano por chave promocional" valor={`expira em ${formatarData(empresa.chave_ativacao_expira_em)}`} cor="#92400e" />
              )}
              {empresa.dominio_customizado && (
                <InfoItem label="Domínio próprio" valor={`${empresa.dominio_customizado} ${empresa.dominio_verificado ? '(verificado)' : '(não verificado)'}`} />
              )}
            </div>

            <div style={s.card}>
              <h4 style={s.cardTitulo}>Consumo do plano</h4>
              <BarraUso label="Barbeiros/profissionais cadastrados" usado={empresa.uso.barbeiros} limite={empresa.plano_plataforma?.limite_profissionais ?? null} />
              <BarraUso label="Agendamentos neste mês" usado={empresa.uso.agendamentos_mes} limite={empresa.plano_plataforma?.limite_agendamentos_mes ?? null} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button onClick={onFechar} style={s.btnOutline}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, valor, badge, cor }) {
  return (
    <div>
      <div style={s.infoLabel}>{label}</div>
      {badge ? (
        <span style={{ ...s.badge, background: badge.bg, color: badge.fg }}>{badge.label}</span>
      ) : (
        <div style={{ color: cor || '#111827', fontWeight: cor ? 700 : 500, fontSize: '14px' }}>{valor}</div>
      )}
    </div>
  );
}

function AbaPlanos({ toast }) {
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  useEscToClose(!!editando, () => { setEditando(null); setCriandoNovo(false); });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/planos`);
      const data = await res.json();
      setPlanos(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar planos.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const url = criandoNovo ? `${API_URL}/super-admin/planos` : `${API_URL}/super-admin/planos/${editando.id}`;
      const res = await fetch(url, {
        method: criandoNovo ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editando,
          preco_mensal: editando.preco_mensal === '' ? null : editando.preco_mensal,
          limite_profissionais: editando.limite_profissionais === '' ? null : editando.limite_profissionais,
          limite_agendamentos_mes: editando.limite_agendamentos_mes === '' ? null : editando.limite_agendamentos_mes
        })
      });
      if (res.ok) {
        toast.success('Plano salvo!');
        setEditando(null);
        setCriandoNovo(false);
        carregar();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Não foi possível salvar o plano.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div style={s.barraTop}>
        <span />
        <button onClick={() => { setCriandoNovo(true); setEditando({ ...PLANO_VAZIO }); }} style={s.btnPrimario}>+ Novo plano</button>
      </div>

      {carregando ? <p style={s.textoCarregando}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {planos.map((p) => (
            <div key={p.id} style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong style={{ fontSize: '15px', color: '#111827' }}>{p.nome}</strong>
                  <div style={s.subTexto}>
                    {formatarPreco(p.preco_mensal)} ·{' '}
                    {p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`} ·{' '}
                    {p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {FLAGS_PLANO.filter(([chave]) => p[chave]).map(([chave, rotulo]) => (
                      <span key={chave} style={s.badgeRoxo}>{rotulo}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => { setCriandoNovo(false); setEditando({ ...p }); }} style={s.btnOutline}>Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div style={s.overlay} onClick={() => { setEditando(null); setCriandoNovo(false); }}>
          <div style={s.modal} onClick={(ev) => ev.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>{criandoNovo ? 'Novo plano' : `Editar: ${editando.nome}`}</h3>
              <button onClick={() => { setEditando(null); setCriandoNovo(false); }} style={s.btnFechar}><Icons.Close /></button>
            </div>

            <label style={s.label}>Nome</label>
            <input style={s.input} value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />

            <label style={s.label}>Preço mensal (vazio = sob consulta)</label>
            <input type="number" style={s.input} value={editando.preco_mensal ?? ''} onChange={(e) => setEditando({ ...editando, preco_mensal: e.target.value })} />

            <label style={s.label}>Limite de profissionais (vazio = ilimitado)</label>
            <input type="number" style={s.input} value={editando.limite_profissionais ?? ''} onChange={(e) => setEditando({ ...editando, limite_profissionais: e.target.value })} />

            <label style={s.label}>Limite de agendamentos/mês (vazio = ilimitado)</label>
            <input type="number" style={s.input} value={editando.limite_agendamentos_mes ?? ''} onChange={(e) => setEditando({ ...editando, limite_agendamentos_mes: e.target.value })} />

            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FLAGS_PLANO.map(([chave, rotulo]) => (
                <label key={chave} style={s.checkboxLinha}>
                  <input type="checkbox" checked={!!editando[chave]} onChange={(e) => setEditando({ ...editando, [chave]: e.target.checked })} />
                  {rotulo}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setEditando(null); setCriandoNovo(false); }} style={{ ...s.btnOutline, flex: 1 }}>Cancelar</button>
              <LoadingButton loading={salvando} onClick={salvar} style={{ ...s.btnPrimario, flex: 2 }}>Salvar</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CHAVE_VAZIA = { plano_plataforma_id: '', duracao_dias: 90, quantidade: 1, observacao: '', prazo_resgate_dias: '' };

// Chaves de ativação: super admin gera uma chave promocional (ex: "3 meses de Profissional")
// e o admin da empresa resgata em Assinatura -> Ativar chave promocional (ver AdminConta.js e
// backend/src/routes/chavesAtivacao.js).
function AbaChaves({ toast, confirmar }) {
  const [chaves, setChaves] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [form, setForm] = useState({ ...CHAVE_VAZIA });
  const [ultimasGeradas, setUltimasGeradas] = useState(null);
  useEscToClose(criando, () => { setCriando(false); setUltimasGeradas(null); });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [resChaves, resPlanos] = await Promise.all([
        fetch(`${API_URL}/super-admin/chaves-ativacao`),
        fetch(`${API_URL}/super-admin/planos`)
      ]);
      const dadosChaves = await resChaves.json();
      const dadosPlanos = await resPlanos.json();
      setChaves(Array.isArray(dadosChaves) ? dadosChaves : []);
      setPlanos(Array.isArray(dadosPlanos) ? dadosPlanos : []);
    } catch (err) {
      toast.error('Erro ao carregar chaves de ativação.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const gerar = async () => {
    if (!form.plano_plataforma_id || !form.duracao_dias) {
      toast.error('Escolha o plano e a duração.');
      return;
    }
    setGerando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/chaves-ativacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano_plataforma_id: form.plano_plataforma_id,
          duracao_dias: form.duracao_dias,
          quantidade: form.quantidade || 1,
          observacao: form.observacao || null,
          prazo_resgate_dias: form.prazo_resgate_dias || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.length > 1 ? `${data.length} chaves geradas!` : 'Chave gerada!');
        setUltimasGeradas(data.map((c) => c.codigo));
        setCriando(false);
        setForm({ ...CHAVE_VAZIA });
        carregar();
      } else {
        toast.error(data.detalhes?.[0]?.mensagem || data.error || 'Não foi possível gerar a chave.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setGerando(false);
    }
  };

  const revogar = async (chave) => {
    const ok = await confirmar(`Revogar a chave ${chave.codigo}?`, {
      detail: 'Ela deixa de poder ser resgatada por qualquer empresa.',
      confirmText: 'Revogar',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/super-admin/chaves-ativacao/${chave.id}/revogar`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success('Chave revogada.'); carregar(); }
      else toast.error(data.error || 'Não foi possível revogar a chave.');
    } catch (err) { toast.error('Erro de conexão. Tente novamente.'); }
  };

  const statusChave = (c) => {
    if (c.revogada_em) return { label: 'Revogada', bg: '#f3f4f6', fg: '#6b7280' };
    if (c.usada_em) return { label: `Usada por ${c.usada_por_empresa?.nome || 'empresa'}`, bg: '#d1fae5', fg: '#065f46' };
    if (c.prazo_resgate_ate && new Date(c.prazo_resgate_ate) < new Date()) return { label: 'Expirada (não resgatada)', bg: '#fee2e2', fg: '#991b1b' };
    return { label: 'Disponível', bg: '#dbeafe', fg: '#1e40af' };
  };

  return (
    <div>
      <div style={s.barraTop}>
        <span />
        <button onClick={() => { setCriando(true); setUltimasGeradas(null); }} style={s.btnPrimario}>+ Gerar chave(s)</button>
      </div>

      {carregando ? <p style={s.textoCarregando}>Carregando...</p> : chaves.length === 0 ? (
        <p style={s.textoVazio}>Nenhuma chave gerada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {chaves.map((c) => {
            const status = statusChave(c);
            return (
              <div key={c.id} style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.5px', color: '#111827' }}>{c.codigo}</strong>
                    <div style={s.subTexto}>
                      {c.plano_plataforma?.nome} · {c.duracao_dias} dias · gerada em {formatarData(c.criado_em)}
                      {c.prazo_resgate_ate && ` · prazo pra resgatar até ${formatarData(c.prazo_resgate_ate)}`}
                    </div>
                    {c.observacao && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{c.observacao}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ ...s.badge, background: status.bg, color: status.fg }}>{status.label}</span>
                    {!c.usada_em && !c.revogada_em && (
                      <button onClick={() => revogar(c)} style={{ ...s.btnOutline, ...s.btnOutlineVermelho }}>Revogar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {criando && (
        <div style={s.overlay} onClick={() => { setCriando(false); setUltimasGeradas(null); }}>
          <div style={{ ...s.modal, maxWidth: '460px' }} onClick={(ev) => ev.stopPropagation()}>
            {ultimasGeradas ? (
              <>
                <div style={s.modalHeader}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Chave(s) gerada(s)</h3>
                  <button onClick={() => { setCriando(false); setUltimasGeradas(null); }} style={s.btnFechar}><Icons.Close /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  {ultimasGeradas.map((codigo) => (
                    <code key={codigo} style={s.codigoChave}>{codigo}</code>
                  ))}
                </div>
                <button onClick={() => { setCriando(false); setUltimasGeradas(null); }} style={{ ...s.btnPrimario, width: '100%' }}>Fechar</button>
              </>
            ) : (
              <>
                <div style={s.modalHeader}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Gerar chave de ativação</h3>
                  <button onClick={() => setCriando(false)} style={s.btnFechar}><Icons.Close /></button>
                </div>

                <label style={s.label}>Plano</label>
                <select style={s.input} value={form.plano_plataforma_id} onChange={(e) => setForm({ ...form, plano_plataforma_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {planos.filter((p) => p.preco_mensal > 0).map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} · R$ {Number(p.preco_mensal).toFixed(2)}/mês</option>
                  ))}
                </select>

                <label style={s.label}>Duração (dias), ex: 90 para 3 meses</label>
                <input type="number" style={s.input} value={form.duracao_dias} onChange={(e) => setForm({ ...form, duracao_dias: e.target.value })} />

                <label style={s.label}>Quantidade de chaves</label>
                <input type="number" min="1" max="50" style={s.input} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />

                <label style={s.label}>Prazo para resgatar, em dias (opcional, vazio = sem prazo)</label>
                <input type="number" style={s.input} value={form.prazo_resgate_dias} onChange={(e) => setForm({ ...form, prazo_resgate_dias: e.target.value })} />

                <label style={s.label}>Observação (opcional, uso interno)</label>
                <input style={s.input} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: parceria com influencer X" />

                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <button onClick={() => { setCriando(false); setForm({ ...CHAVE_VAZIA }); }} style={{ ...s.btnOutline, flex: 1 }}>Cancelar</button>
                  <LoadingButton loading={gerando} onClick={gerar} style={{ ...s.btnPrimario, flex: 2 }}>Gerar</LoadingButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AbaLeads({ toast, confirmar }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarLeads = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/super-admin/leads-enterprise`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar leads.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregarLeads(); }, [carregarLeads]);

  const atualizarStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/super-admin/leads-enterprise/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) { toast.success('Status atualizado.'); carregarLeads(); }
      else toast.error('Não foi possível atualizar o status.');
    } catch (err) { toast.error('Erro de conexão. Tente novamente.'); }
  };

  const ativarEmpresa = async (lead) => {
    const ok = await confirmar(`Ativar o plano Enterprise pra "${lead.nome_empresa}"?`, {
      detail: 'Isso muda o plano da empresa pra Enterprise imediatamente. A cobrança do valor combinado é feita manualmente, fora do sistema, por enquanto.',
      confirmText: 'Ativar'
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/super-admin/leads-enterprise/${lead.id}/ativar-empresa`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); carregarLeads(); }
      else toast.error(data.error || 'Não foi possível ativar o plano.');
    } catch (err) { toast.error('Erro de conexão. Tente novamente.'); }
  };

  if (carregando) return <p style={s.textoCarregando}>Carregando...</p>;
  if (leads.length === 0) return <p style={s.textoVazio}>Nenhum contato recebido ainda.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {leads.map((lead) => {
        const status = STATUS_LEAD_INFO[lead.status] || { label: lead.status, bg: '#f3f4f6', fg: '#6b7280' };
        return (
          <div key={lead.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong style={{ fontSize: '15px', color: '#111827' }}>{lead.nome_empresa}</strong>
                <div style={s.subTexto}>CNPJ {lead.cnpj} · {lead.localizacao} · {formatarData(lead.criado_em)}</div>
              </div>
              <span style={{ ...s.badge, background: status.bg, color: status.fg }}>{status.label}</span>
            </div>

            <div style={{ fontSize: '13px', marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#374151' }}>
              <span><strong>Clientes esperados:</strong> {lead.clientes_esperados}</span>
              <span><strong>E-mail:</strong> {lead.email_contato}</span>
              {lead.telefone_contato && <span><strong>Telefone:</strong> {lead.telefone_contato}</span>}
              {lead.empresa_id && <span><strong>Empresa (id):</strong> {lead.empresa_id}</span>}
            </div>
            {lead.observacoes && <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '10px' }}>{lead.observacoes}</p>}

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              {lead.status !== 'contatado' && (
                <button onClick={() => atualizarStatus(lead.id, 'contatado')} style={s.btnOutline}>Marcar como contatado</button>
              )}
              {lead.status !== 'fechado' && (
                <button onClick={() => atualizarStatus(lead.id, 'fechado')} style={s.btnOutline}>Marcar como fechado</button>
              )}
              {lead.empresa_id && lead.status !== 'fechado' && (
                <button onClick={() => ativarEmpresa(lead)} style={s.btnPrimario}>Ativar plano Enterprise</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Gestão dos donos da plataforma (tabela `super_admins`, ver backend/src/routes/superAdmin.js).
// Só existe quem já é super admin pra criar outro, e só com e-mail @schednext.com.br — o
// backend valida isso de novo (nunca confiar só na validação do front).
function AbaSuperAdmins({ toast, confirmar }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/super-admins`);
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Erro ao carregar super admins.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const criar = async () => {
    setCriando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/super-admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novoEmail, senha: novaSenha })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Super admin criado!');
        setNovoEmail('');
        setNovaSenha('');
        carregar();
      } else {
        toast.error(data.detalhes?.[0]?.mensagem || data.error || 'Não foi possível criar o super admin.');
      }
    } catch (err) {
      toast.error('Erro de conexão.');
    } finally {
      setCriando(false);
    }
  };

  const remover = async (sa) => {
    const ok = await confirmar(`Remover o acesso de "${sa.email}"?`, {
      detail: 'Ele deixa de conseguir entrar no painel da plataforma imediatamente.',
      confirmText: 'Remover',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/super-admin/super-admins/${sa.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { toast.success('Acesso removido.'); carregar(); }
      else toast.error(data.error || 'Não foi possível remover.');
    } catch (err) { toast.error('Erro de conexão. Tente novamente.'); }
  };

  return (
    <div>
      <div style={{ ...s.card, marginBottom: '20px', maxWidth: '420px' }}>
        <h3 style={s.cardTitulo}>Criar novo super admin</h3>
        <label style={s.label}>E-mail (precisa ser @schednext.com.br)</label>
        <input style={s.input} value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} placeholder="nome@schednext.com.br" />
        <label style={s.label}>Senha (mínimo 8 caracteres)</label>
        <input type="password" style={s.input} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
        <LoadingButton loading={criando} onClick={criar} style={{ ...s.btnPrimario, marginTop: '6px' }}>Criar super admin</LoadingButton>
      </div>

      {carregando ? <p style={s.textoCarregando}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {lista.map((sa) => (
            <div key={sa.id} style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong style={{ color: '#111827' }}>{sa.email}</strong>
                <div style={s.subTexto}>{sa.ativo ? 'Ativo' : 'Removido'} · criado em {formatarData(sa.criado_em)}</div>
              </div>
              {sa.ativo && (
                <button onClick={() => remover(sa)} style={{ ...s.btnOutline, ...s.btnOutlineVermelho }}>Remover</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Icons = {
  Building: ({ color = 'currentColor' }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}><path d="M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18"></path><path d="M2 22h20"></path><path d="M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1"></path></svg>,
  BarChart: ({ color = 'currentColor' }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><rect x="7" y="12" width="3" height="6"></rect><rect x="12" y="8" width="3" height="10"></rect><rect x="17" y="5" width="3" height="13"></rect></svg>,
  TrendingUp: ({ color = 'currentColor' }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
  Tag: ({ color = 'currentColor' }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>,
  Key: ({ color = 'currentColor' }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>,
  Mail: ({ color = 'currentColor' }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
  Shield: ({ color = 'currentColor' }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
  LogOut: ({ color = 'currentColor' }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  Close: ({ color = '#9ca3af', size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

const s = {
  pagina: { minHeight: '100vh', background: '#f8f9fa', fontFamily: "'Inter', sans-serif" },
  container: { maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' },
  titulo: { fontSize: '26px', color: '#111827', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center' },
  subtitulo: { color: '#6b7280', fontSize: '14px', margin: 0 },
  btnSair: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' },

  tabsRow: { display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap', background: '#fff', padding: '6px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  tab: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#6b7280', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: '0.2s' },
  tabAtivo: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { background: '#fff', padding: '18px 20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', borderTop: '4px solid #ddd' },
  statCardTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  statLabel: { fontSize: '12px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' },
  statNumero: { fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' },

  gridDuasColunas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
  card: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6', padding: '20px', marginBottom: '0' },
  cardTitulo: { margin: '0 0 12px', fontSize: '14px', color: '#111827', fontWeight: 700 },
  linhaLista: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', padding: '7px 0', borderBottom: '1px solid #f3f4f6' },
  subTexto: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },

  barraTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  inputBusca: { padding: '11px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', width: '100%', maxWidth: '300px', color: '#111827', boxSizing: 'border-box' },
  selectFiltro: { padding: '11px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', color: '#111827', background: '#fff' },

  cardTabela: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f3f4f6' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '820px' },
  th: { padding: '13px 18px', background: '#f9fafb', color: '#6b7280', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '14px 18px', fontSize: '13px', verticalAlign: 'middle', color: '#374151' },

  badge: { padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'inline-block', whiteSpace: 'nowrap' },
  badgeRoxo: { fontSize: '11px', background: '#ede9fe', color: '#6d28d9', padding: '3px 9px', borderRadius: '6px', fontWeight: 700 },

  btnPrimario: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 700 },
  btnOutline: { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 13px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnOutlineVermelho: { color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' },
  btnOutlineVerde: { color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' },

  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(17,24,39,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '20px' },
  modal: { background: '#fff', padding: '28px', borderRadius: '14px', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', boxSizing: 'border-box' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' },
  btnFechar: { background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '2px' },

  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' },
  infoLabel: { fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: '3px' },

  label: { display: 'block', fontSize: '12px', fontWeight: 700, color: '#4b5563', marginBottom: '6px', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '0.3px' },
  input: { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #d1d5db', color: '#111827', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none' },
  checkboxLinha: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' },

  codigoChave: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px', fontSize: '14px', letterSpacing: '0.5px', color: '#111827' },

  textoCarregando: { color: '#6b7280', fontSize: '14px' },
  textoVazio: { color: '#9ca3af', fontSize: '14px' }
};

export default SuperAdminDashboard;
