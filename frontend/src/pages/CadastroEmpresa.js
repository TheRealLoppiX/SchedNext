import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import LoadingButton from '../components/LoadingButton';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { obterTerminologia } from '../utils/terminologia';
import { emailValido, formatarDocumento, documentoTemTamanhoValido } from '../utils/validacao';
import { formatarTelefone } from '../utils/telefone';
import { API_URL } from '../services/api';
import { rastrearEvento } from '../utils/analytics';

function gerarSlug(nome) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const VERTICAIS = ['barbearia', 'salao', 'estudio_unhas', 'generico'];

function CadastroEmpresa({ setEmpresaLogada }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [etapa, setEtapa] = useState(1);
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [vertical, setVertical] = useState('barbearia');
  const [planos, setPlanos] = useState([]);
  const [planoId, setPlanoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [mostrarFormEnterprise, setMostrarFormEnterprise] = useState(false);
  const [enterpriseEnviado, setEnterpriseEnviado] = useState(false);
  const [formEnterprise, setFormEnterprise] = useState({ cnpj: '', localizacao: '', clientes_esperados: '', observacoes: '', email_contato: '', telefone_contato: '' });
  const [enviandoEnterprise, setEnviandoEnterprise] = useState(false);

  // Funil de conversão (ver utils/analytics.js): cada etapa vista e cada campo tocado (só o
  // NOME do campo, nunca o valor), pra saber em que ponto quem começou a preencher desistiu.
  useEffect(() => {
    rastrearEvento('cadastro_etapa', { etapa });
  }, [etapa]);

  const ultimoCampoTocado = useRef(null);
  const propsCampo = (campo) => ({
    name: campo,
    onFocus: () => {
      if (ultimoCampoTocado.current === campo) return;
      ultimoCampoTocado.current = campo;
      rastrearEvento('cadastro_campo', { campo });
    },
    // Validação nativa (required/type=email) barra o envio sem chamar o onSubmit.
    onInvalid: () => rastrearEvento('cadastro_campo_invalido', { campo })
  });

  const slugDebounced = useDebouncedValue(slug, 400);
  const [statusSlug, setStatusSlug] = useState({ checando: false, disponivel: null, motivo: '' });

  useEffect(() => {
    if (!slugEditadoManualmente) setSlug(gerarSlug(nome));
  }, [nome, slugEditadoManualmente]);

  useEffect(() => {
    if (!slugDebounced || slugDebounced.length < 3) {
      setStatusSlug({ checando: false, disponivel: null, motivo: '' });
      return;
    }
    setStatusSlug((s) => ({ ...s, checando: true }));
    fetch(`${API_URL}/empresas/slug-disponivel/${slugDebounced}`)
      .then((r) => r.json())
      .then((d) => setStatusSlug({ checando: false, disponivel: d.disponivel, motivo: d.motivo || '' }))
      .catch(() => setStatusSlug({ checando: false, disponivel: null, motivo: '' }));
  }, [slugDebounced]);

  useEffect(() => {
    fetch(`${API_URL}/planos-plataforma`)
      .then((r) => r.json())
      .then((data) => {
        setPlanos(data);
        const gratis = data.find((p) => p.nome === 'Grátis');
        if (gratis) setPlanoId(gratis.id);
      })
      .catch(() => toast.error('Não foi possível carregar os planos. Tente recarregar a página.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avancarDe1 = () => {
    const recusar = (campo, mensagem) => {
      rastrearEvento('cadastro_continuar', { ok: false, campo });
      toast.error(mensagem);
    };
    if (!nome.trim()) return recusar('nome', 'Informe o nome do seu negócio.');
    if (!emailValido(email)) return recusar('email', 'Informe um e-mail válido.');
    if (senha.length < 6) return recusar('senha', 'A senha precisa ter ao menos 6 caracteres.');
    if (telefone.replace(/\D/g, '').length < 10) return recusar('telefone', 'Informe um telefone com DDD.');
    if (!documentoTemTamanhoValido(documento)) return recusar('documento', 'Informe um CPF ou CNPJ válido.');
    if (statusSlug.disponivel === false) return recusar('slug', statusSlug.motivo || 'Esse endereço já está em uso.');
    rastrearEvento('cadastro_continuar', { ok: true });
    setEtapa(2);
  };

  const enviarContatoEnterprise = async () => {
    setEnviandoEnterprise(true);
    try {
      const res = await fetch(`${API_URL}/empresas/contato-enterprise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_empresa: nome || 'Não informado', ...formEnterprise })
      });
      const data = await res.json();
      if (res.ok) {
        rastrearEvento('cadastro_enterprise', { ok: true });
        toast.success(data.message || 'Recebemos seu contato!');
        setEnterpriseEnviado(true);
      } else {
        toast.error(data.error || 'Não foi possível enviar seu contato.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setEnviandoEnterprise(false);
    }
  };

  const finalizarCadastro = async () => {
    setEnviando(true);
    try {
      const resCadastro = await fetch(`${API_URL}/empresas/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, slug, email, senha, vertical, plano_plataforma_id: planoId, telefone, documento })
      });
      const dataCadastro = await resCadastro.json();

      if (!resCadastro.ok) {
        rastrearEvento('cadastro_enviado', { ok: false, erro: String(dataCadastro.error || 'Erro ' + resCadastro.status).slice(0, 80) });
        toast.error(dataCadastro.error || 'Não foi possível criar sua conta.');
        return;
      }

      rastrearEvento('cadastro_enviado', { ok: true, plano: planos.find((p) => p.id === planoId)?.nome || null, vertical });
      toast.success(dataCadastro.message || 'Enviamos um código de confirmação pro seu e-mail.');
      setEtapa(4);
    } catch (err) {
      rastrearEvento('cadastro_enviado', { ok: false, erro: 'Sem conexão com o servidor' });
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarCodigo = async () => {
    setConfirmando(true);
    try {
      const res = await fetch(`${API_URL}/empresas/confirmar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo })
      });
      const data = await res.json();

      if (!res.ok) {
        rastrearEvento('cadastro_codigo', { ok: false });
        toast.error(data.error || 'Código inválido ou expirado.');
        return;
      }

      rastrearEvento('cadastro_concluido', { plano: planos.find((p) => p.id === planoId)?.nome || null, vertical });
      localStorage.setItem('adminToken', JSON.stringify({ ...data.admin, token: data.token }));
      setEmpresaLogada(data.admin.empresa_id);
      toast.success(data.message || `Conta criada! Bem-vindo(a), ${nome}.`);
      navigate(data.planoPendente ? '/admin/conta' : '/admin/dashboard');
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="bb-page">
      <div className="bb-card" style={{ maxWidth: '480px' }}>
        <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        <h2 className="bb-title">{etapa === 4 ? 'Verifique seu e-mail' : 'Criar sua conta'}</h2>
        {etapa === 4 ? (
          <p className="bb-subtitle">Enviamos um código para <b>{email}</b></p>
        ) : (
          <p className="bb-subtitle">Etapa {etapa} de 3</p>
        )}

        {etapa === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); avancarDe1(); }}>
            <input
              className="bb-input"
              placeholder="Nome do seu negócio"
              {...propsCampo('nome')}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 12px', fontSize: '13px', color: 'var(--bb-text-muted)' }}>
              <span>Seu endereço: {slug || 'sua-empresa'}.schednext.com.br</span>
            </div>
            <input
              className="bb-input"
              placeholder="Endereço personalizado (slug)"
              {...propsCampo('slug')}
              value={slug}
              onChange={(e) => { setSlug(gerarSlug(e.target.value)); setSlugEditadoManualmente(true); }}
              required
            />
            {statusSlug.checando && <p style={{ fontSize: '12px', color: 'var(--bb-text-muted)' }}>Checando disponibilidade...</p>}
            {!statusSlug.checando && statusSlug.disponivel === true && (
              <p style={{ fontSize: '12px', color: 'var(--bb-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Disponível
              </p>
            )}
            {!statusSlug.checando && statusSlug.disponivel === false && <p style={{ fontSize: '12px', color: 'var(--bb-danger)' }}>{statusSlug.motivo || 'Indisponível'}</p>}

            <input
              type="email"
              className="bb-input"
              placeholder="Seu e-mail"
              {...propsCampo('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="tel"
              className="bb-input"
              placeholder="Telefone / WhatsApp com DDD"
              {...propsCampo('telefone')}
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              required
            />
            <input
              type="text"
              inputMode="numeric"
              className="bb-input"
              placeholder="CPF ou CNPJ"
              {...propsCampo('documento')}
              value={documento}
              onChange={(e) => setDocumento(formatarDocumento(e.target.value))}
              required
            />
            <input
              type="password"
              className="bb-input"
              placeholder="Crie uma senha"
              {...propsCampo('senha')}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <button type="submit" data-track="cadastro_continuar" className="bb-btn">Continuar</button>
          </form>
        )}

        {etapa === 2 && (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--bb-text-muted)', marginBottom: '14px' }}>Qual o seu tipo de negócio? Isso ajusta os termos usados no sistema.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {VERTICAIS.map((v) => {
                const t = obterTerminologia(v);
                const selecionado = vertical === v;
                return (
                  <button
                    key={v}
                    type="button"
                    data-track={`cadastro_tipo_${v}`}
                    onClick={() => setVertical(v)}
                    style={{
                      padding: '14px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                      border: selecionado ? '2px solid var(--bb-gold)' : '1px solid var(--bb-border)',
                      background: selecionado ? 'rgba(37,84,235,0.08)' : 'var(--fx-surface)',
                      fontWeight: selecionado ? 700 : 500
                    }}
                  >
                    {t.local}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" data-track="cadastro_etapa2_voltar" className="bb-btn-secondary" onClick={() => setEtapa(1)}>Voltar</button>
              <button type="button" data-track="cadastro_etapa2_continuar" className="bb-btn" onClick={() => setEtapa(3)}>Continuar</button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--bb-text-muted)', marginBottom: '14px' }}>Escolha um plano, pode trocar depois.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {planos.map((p) => {
                const ehEnterprise = p.preco_mensal == null;
                const selecionado = !ehEnterprise && planoId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-track={`cadastro_plano_${p.nome}`}
                    onClick={() => ehEnterprise ? setMostrarFormEnterprise(true) : setPlanoId(p.id)}
                    style={{
                      padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      border: selecionado ? '2px solid var(--bb-gold)' : '1px solid var(--bb-border)',
                      background: selecionado ? 'rgba(37,84,235,0.08)' : 'var(--fx-surface)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{p.nome}</span>
                      <span>{ehEnterprise ? 'Sob consulta' : p.preco_mensal === 0 ? 'Grátis' : `R$ ${Number(p.preco_mensal).toFixed(2)}/mês`}</span>
                    </div>
                    {p.dias_teste > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--bb-success)', fontWeight: 700, marginTop: '4px' }}>
                        {p.dias_teste} dias de teste grátis
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--bb-text-muted)', marginTop: '4px' }}>
                      {ehEnterprise
                        ? 'Fale com nosso time pra combinar os detalhes'
                        : <>
                            {p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`}
                            {' · '}
                            {p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados/mês' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}
                          </>
                      }
                    </div>
                  </button>
                );
              })}
            </div>

            {mostrarFormEnterprise && (
              enterpriseEnviado ? (
                <p style={{ fontSize: '13px', color: 'var(--bb-success)', marginBottom: '16px' }}>
                  Contato enviado! Enquanto isso, crie sua conta num plano normal (dá pra trocar depois) e nosso time fala com você sobre o Enterprise.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', padding: '14px', border: '1px solid var(--bb-border)', borderRadius: '10px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--bb-text-muted)' }}>Conte um pouco sobre seu negócio pra gente entrar em contato:</p>
                  <input className="bb-input" placeholder="CNPJ (só números)" value={formEnterprise.cnpj} onChange={(e) => setFormEnterprise({ ...formEnterprise, cnpj: e.target.value })} />
                  <input className="bb-input" placeholder="Localização (cidade/UF)" value={formEnterprise.localizacao} onChange={(e) => setFormEnterprise({ ...formEnterprise, localizacao: e.target.value })} />
                  <input className="bb-input" placeholder="Quantidade de clientes esperados" value={formEnterprise.clientes_esperados} onChange={(e) => setFormEnterprise({ ...formEnterprise, clientes_esperados: e.target.value })} />
                  <input className="bb-input" type="email" placeholder="E-mail de contato" value={formEnterprise.email_contato} onChange={(e) => setFormEnterprise({ ...formEnterprise, email_contato: e.target.value })} />
                  <input className="bb-input" placeholder="Telefone (opcional)" value={formEnterprise.telefone_contato} onChange={(e) => setFormEnterprise({ ...formEnterprise, telefone_contato: e.target.value })} />
                  <textarea className="bb-input" placeholder="Outras informações relevantes (opcional)" value={formEnterprise.observacoes} onChange={(e) => setFormEnterprise({ ...formEnterprise, observacoes: e.target.value })} style={{ minHeight: '60px', fontFamily: 'inherit' }} />
                  <LoadingButton
                    type="button"
                    loading={enviandoEnterprise}
                    className="bb-btn"
                    onClick={enviarContatoEnterprise}
                    disabled={!formEnterprise.cnpj || !formEnterprise.localizacao || !formEnterprise.clientes_esperados || !formEnterprise.email_contato}
                  >
                    Enviar contato
                  </LoadingButton>
                </div>
              )
            )}
            <p style={{ fontSize: '12px', color: 'var(--bb-text-muted)', marginBottom: '12px' }}>
              Ao criar sua conta, você concorda com os{' '}
              <a href="/legal/termos-de-uso.pdf" target="_blank" rel="noopener noreferrer" className="bb-link">Termos de Uso</a>
              {' '}e a{' '}
              <a href="/legal/politica-de-privacidade.pdf" target="_blank" rel="noopener noreferrer" className="bb-link">Política de Privacidade</a>
              {' '}da SchedNext.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" data-track="cadastro_etapa3_voltar" className="bb-btn-secondary" onClick={() => setEtapa(2)} disabled={enviando}>Voltar</button>
              <LoadingButton type="button" data-track="cadastro_criar_conta" loading={enviando} className="bb-btn" onClick={finalizarCadastro}>Criar conta</LoadingButton>
            </div>
          </div>
        )}

        {etapa === 4 && (
          <form onSubmit={(e) => { e.preventDefault(); confirmarCodigo(); }}>
            <input
              className="bb-input"
              style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '5px' }}
              placeholder="000000"
              {...propsCampo('codigo')}
              maxLength="6"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoFocus
            />
            <LoadingButton type="submit" data-track="cadastro_confirmar_codigo" loading={confirmando} className="bb-btn">Confirmar e criar conta</LoadingButton>
            <button type="button" data-track="cadastro_codigo_voltar" className="bb-btn-secondary" onClick={() => setEtapa(3)} disabled={confirmando}>Voltar</button>
          </form>
        )}

        <p style={{ marginTop: '20px', fontSize: '13px' }}>
          Já tem conta? <Link to="/admin/login" data-track="cadastro_ja_tenho_conta_entrar" className="bb-link">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

export default CadastroEmpresa;
