import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import LoadingButton from '../components/LoadingButton';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { obterTerminologia } from '../utils/terminologia';
import { API_URL } from '../services/api';

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
  const [vertical, setVertical] = useState('barbearia');
  const [planos, setPlanos] = useState([]);
  const [planoId, setPlanoId] = useState(null);
  const [enviando, setEnviando] = useState(false);

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
    if (!nome.trim()) return toast.error('Informe o nome do seu negócio.');
    if (!email.trim()) return toast.error('Informe um e-mail.');
    if (senha.length < 6) return toast.error('A senha precisa ter ao menos 6 caracteres.');
    if (statusSlug.disponivel === false) return toast.error(statusSlug.motivo || 'Esse endereço já está em uso.');
    setEtapa(2);
  };

  const finalizarCadastro = async () => {
    setEnviando(true);
    try {
      const resCadastro = await fetch(`${API_URL}/empresas/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, slug, email, senha, vertical, plano_plataforma_id: planoId })
      });
      const dataCadastro = await resCadastro.json();

      if (!resCadastro.ok) {
        toast.error(dataCadastro.error || 'Não foi possível criar sua conta.');
        setEnviando(false);
        return;
      }

      const resLogin = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const dataLogin = await resLogin.json();

      if (dataLogin.success) {
        localStorage.setItem('adminToken', JSON.stringify({ ...dataLogin.admin, token: dataLogin.token }));
        setEmpresaLogada(dataLogin.admin.empresa_id);
        toast.success(`Conta criada! Bem-vindo(a), ${nome}.`);
        navigate('/admin/dashboard');
      } else {
        toast.success('Conta criada! Faça login para continuar.');
        navigate('/admin/login');
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bb-page">
      <div className="bb-card" style={{ maxWidth: '480px' }}>
        <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        <h2 className="bb-title">Criar sua conta</h2>
        <p className="bb-subtitle">Etapa {etapa} de 3</p>

        {etapa === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); avancarDe1(); }}>
            <input
              className="bb-input"
              placeholder="Nome do seu negócio"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 12px', fontSize: '13px', color: 'var(--bb-text-muted)' }}>
              <span>Seu endereço: /{slug || 'sua-empresa'}</span>
            </div>
            <input
              className="bb-input"
              placeholder="Endereço personalizado (slug)"
              value={slug}
              onChange={(e) => { setSlug(gerarSlug(e.target.value)); setSlugEditadoManualmente(true); }}
              required
            />
            {statusSlug.checando && <p style={{ fontSize: '12px', color: 'var(--bb-text-muted)' }}>Checando disponibilidade...</p>}
            {!statusSlug.checando && statusSlug.disponivel === true && <p style={{ fontSize: '12px', color: 'var(--bb-success)' }}>✓ Disponível</p>}
            {!statusSlug.checando && statusSlug.disponivel === false && <p style={{ fontSize: '12px', color: 'var(--bb-danger)' }}>{statusSlug.motivo || 'Indisponível'}</p>}

            <input
              type="email"
              className="bb-input"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="bb-input"
              placeholder="Crie uma senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <button type="submit" className="bb-btn">Continuar</button>
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
                    onClick={() => setVertical(v)}
                    style={{
                      padding: '14px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                      border: selecionado ? '2px solid var(--bb-gold)' : '1px solid var(--bb-border)',
                      background: selecionado ? 'rgba(37,84,235,0.08)' : '#fff',
                      fontWeight: selecionado ? 700 : 500
                    }}
                  >
                    {t.local}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="bb-btn-secondary" onClick={() => setEtapa(1)}>Voltar</button>
              <button type="button" className="bb-btn" onClick={() => setEtapa(3)}>Continuar</button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--bb-text-muted)', marginBottom: '14px' }}>Escolha um plano — pode trocar depois.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {planos.map((p) => {
                const selecionado = planoId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanoId(p.id)}
                    style={{
                      padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      border: selecionado ? '2px solid var(--bb-gold)' : '1px solid var(--bb-border)',
                      background: selecionado ? 'rgba(37,84,235,0.08)' : '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{p.nome}</span>
                      <span>{p.preco_mensal == null ? 'Sob consulta' : p.preco_mensal === 0 ? 'Grátis' : `R$ ${Number(p.preco_mensal).toFixed(2)}/mês`}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--bb-text-muted)', marginTop: '4px' }}>
                      {p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`}
                      {' · '}
                      {p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados/mês' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="bb-btn-secondary" onClick={() => setEtapa(2)} disabled={enviando}>Voltar</button>
              <LoadingButton type="button" loading={enviando} className="bb-btn" onClick={finalizarCadastro}>Criar conta</LoadingButton>
            </div>
          </div>
        )}

        <p style={{ marginTop: '20px', fontSize: '13px' }}>
          Já tem conta? <Link to="/admin/login" className="bb-link">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

export default CadastroEmpresa;
