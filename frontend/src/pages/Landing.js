import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import { API_URL } from '../services/api';
import { observarSecoes } from '../utils/analytics';

// Landing "ofício": capítulos em tela cheia (um por tipo de negócio) controlados pela rolagem,
// com foto/vídeo do ofício ao fundo e partículas (oficio/particulasOficio.js) que viram o símbolo
// de cada um.

const CAPITULOS = [
  {
    id: 'abertura', tom: '#22d3ee', midia: 'video', rotulo: 'Abertura',
    kicker: 'Agenda online pra barbearias, salões, unhas e estética',
    titulo: ['O CLIENTE MARCA.', 'VOCÊ ATENDE.'],
    texto: 'Profissional, serviço e horário escolhidos pelo próprio cliente, a qualquer hora. Sem ligação, sem caderninho.'
  },
  {
    id: 'barbearia', tom: '#4c7dff', midia: '/images/casos/barbearia.jpg', rotulo: 'Barbearias',
    kicker: '01 · Barbearias', titulo: ['NA', 'RÉGUA.'],
    texto: 'Agenda por barbeiro, fila organizada e cliente fiel com plano de assinatura. Do degradê à barba, cada horário no lugar.',
    tags: ['Agenda por barbeiro', 'Assinatura mensal', 'Fidelidade']
  },
  {
    id: 'salao', tom: '#22d3ee', midia: '/images/casos/salao.jpg', rotulo: 'Salões',
    kicker: '02 · Salões de beleza', titulo: ['FIO', 'A FIO.'],
    texto: 'Vários profissionais, serviços combinados e a duração certa pra cada um: corte, escova, coloração. Sem encavalar horário.',
    tags: ['Serviços combinados', 'Duração por serviço', 'Equipe inteira']
  },
  {
    id: 'unhas', tom: '#38bdf8', midia: '/images/casos/estudio.jpg', rotulo: 'Unhas',
    kicker: '03 · Estúdios de unhas', titulo: ['UNHA', 'FEITA.'],
    texto: 'Horários enxutos, confirmação automática e lembrete no WhatsApp pra cliente nunca esquecer da manutenção.',
    tags: ['Lembrete no WhatsApp', 'Confirmação automática', 'Horários curtos']
  },
  {
    id: 'estetica', tom: '#2ee6d0', midia: 'estetica', rotulo: 'Estética',
    kicker: '04 · Estética', titulo: ['PELE', 'EM DIA.'],
    texto: 'Planos de assinatura pra sessões recorrentes, histórico de cada cliente e lembrete antes de cada retorno.',
    tags: ['Sessões recorrentes', 'Histórico do cliente', 'Retorno lembrado']
  },
  {
    id: 'como-funciona', tom: '#5b8cff', midia: 'poste', rotulo: 'Como funciona',
    kicker: '05 · Como funciona', titulo: ['PRIMEIRO,', 'UMA BASE', 'SÓLIDA.'],
    passos: [
      { n: '01', t: 'Crie sua conta', d: 'Nome do negócio e tipo de serviço.' },
      { n: '02', t: 'Monte sua agenda', d: 'Profissionais, serviços e horários em menos de 5 minutos.' },
      { n: '03', t: 'Compartilhe seu link', d: 'O cliente marca sozinho, sem ligação.' }
    ]
  },
  {
    id: 'agenda', tom: '#22d3ee', midia: 'grade', rotulo: 'Na prática',
    kicker: '06 · Na prática', titulo: ['HORÁRIO', 'A HORÁRIO.'],
    texto: 'Pelo seu link, pelo site ou pelo WhatsApp: a agenda de cada profissional se preenche sozinha, sem conflito de horário.',
    tags: ['Tempo real', 'Sem overbooking', 'Bot de WhatsApp']
  }
];

const RECURSOS = [
  { t: 'Agenda em tempo real', d: 'Cada profissional só aparece disponível quando realmente está.' },
  { t: 'Lembretes automáticos', d: 'E-mail e WhatsApp antes do horário, pra reduzir falta.' },
  { t: 'Fidelidade e assinatura', d: 'Campanhas e planos mensais pra quem volta sempre.' },
  { t: 'Sua marca, suas cores', d: 'Paleta personalizada na tela dos seus clientes.' },
  { t: 'Bot de WhatsApp', d: 'O cliente agenda direto na conversa.' },
  { t: 'Relatórios e estoque', d: 'Faturamento e produtos num só painel.' },
  { t: 'Recursos com IA', d: 'Resumo do dia e mensagens sugeridas.' },
  { t: 'Várias unidades', d: 'Todas as filiais num painel só.' }
];

const FAQ = [
  { p: 'Preciso de cartão de crédito para começar?', r: 'Não. O plano Grátis não pede pagamento, cadastre e comece a usar na hora.' },
  { p: 'Posso trocar de plano depois?', r: 'Sim, a qualquer momento direto pelo painel administrativo.' },
  { p: 'Meus clientes precisam instalar algo?', r: 'Não, o agendamento é feito direto pelo navegador, sem instalação.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim, sem multa e sem burocracia.' }
];

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*';

// Título que "decodifica": letras embaralhadas que vão assentando, contorno virando sólido.
function TituloDecodificado({ linhas, ativo, className = '' }) {
  const alvo = linhas.join('\n');
  const [texto, setTexto] = useState(alvo);
  const [assentado, setAssentado] = useState(false);
  useEffect(() => {
    if (!ativo) { setAssentado(false); return undefined; }
    let quadro = 0;
    const total = 22;
    const t = setInterval(() => {
      quadro++;
      const revelados = Math.floor((quadro / total) * alvo.length);
      setTexto(alvo.split('').map((ch, i) => {
        if (ch === '\n' || ch === ' ' || i < revelados) return ch;
        return ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }).join(''));
      if (quadro >= total) {
        clearInterval(t);
        setTexto(alvo);
        setAssentado(true);
      }
    }, 34);
    return () => clearInterval(t);
  }, [ativo, alvo]);
  return (
    <h2 className={`of-titulo ${assentado ? 'of-titulo-cheio' : ''} ${className}`} aria-label={linhas.join(' ')}>
      {texto.split('\n').map((l, i) => <span key={i} aria-hidden="true">{l}</span>)}
    </h2>
  );
}

function Intro({ aoTerminar }) {
  const [valor, setValor] = useState(0);
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    const inicio = performance.now();
    let raf;
    const passo = (t) => {
      const k = Math.min(1, (t - inicio) / 1400);
      setValor(Math.round((1 - Math.pow(1 - k, 3)) * 100));
      if (k < 1) raf = requestAnimationFrame(passo);
      else { setSaindo(true); setTimeout(aoTerminar, 800); }
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [aoTerminar]);
  return (
    <div className={`of-intro ${saindo ? 'of-intro-saindo' : ''}`} aria-hidden="true">
      <div className="of-intro-marca">SCHEDNEXT</div>
      <div className="of-intro-linha"><span style={{ transform: `scaleX(${valor / 100})` }} /></div>
      <div className="of-intro-rodape"><span>Barbearia · Salão · Unhas · Estética</span><span>{String(valor).padStart(3, '0')}</span></div>
    </div>
  );
}

function Menu({ aberto, fechar }) {
  const itens = [
    { rotulo: 'Recursos', href: '#recursos', track: 'menu_recursos' },
    { rotulo: 'Planos', href: '#planos', track: 'menu_planos' },
    { rotulo: 'Dúvidas', href: '#faq', track: 'menu_faq' },
    { rotulo: 'Docs', to: '/docs', track: 'menu_docs' },
    { rotulo: 'Entrar', to: '/admin/login', track: 'menu_entrar' },
    { rotulo: 'Criar conta grátis', to: '/cadastrar', track: 'menu_criar_conta', destaque: true }
  ];
  return (
    <div className={`of-menu ${aberto ? 'aberto' : ''}`} aria-hidden={!aberto}>
      <div className="of-menu-foto" style={{ backgroundImage: "linear-gradient(90deg, #060b18 35%, rgba(6, 11, 24, 0.4)), url(/videos/hero-barbearia-poster.jpg)" }} />
      <nav className="of-menu-lista">
        {itens.map((it, i) => {
          const props = { className: `of-menu-item ${it.destaque ? 'destaque' : ''}`, style: { transitionDelay: aberto ? `${0.15 + i * 0.06}s` : '0s' }, 'data-track': it.track, onClick: fechar, tabIndex: aberto ? 0 : -1 };
          const conteudo = (<><span className="of-menu-num">{String(i + 1).padStart(2, '0')}</span>{it.rotulo}</>);
          return it.to ? <Link key={it.rotulo} to={it.to} {...props}>{conteudo}</Link> : <a key={it.rotulo} href={it.href} {...props}>{conteudo}</a>;
        })}
      </nav>
      <div className="of-menu-rodape">
        <a href="/legal/termos-de-uso.pdf" target="_blank" rel="noopener noreferrer" tabIndex={aberto ? 0 : -1}>Termos de uso</a>
        <a href="/legal/politica-de-privacidade.pdf" target="_blank" rel="noopener noreferrer" tabIndex={aberto ? 0 : -1}>Privacidade</a>
      </div>
    </div>
  );
}

function Revelar({ children, className = '', ...resto }) {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisivel(true); return undefined; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`of-revelar ${visivel ? 'visivel' : ''} ${className}`} {...resto}>{children}</div>;
}

function Seta({ tamanho = 18 }) {
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>;
}

function Landing() {
  const [planos, setPlanos] = useState([]);
  const [introFeita, setIntroFeita] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [capAtivo, setCapAtivo] = useState(0);
  const [faqAberto, setFaqAberto] = useState(0);
  const [reduzirMovimento] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const refCanvas = useRef(null);
  const refExp = useRef(null);
  const refFundos = useRef([]);
  const refTextos = useRef([]);
  const refAnel = useRef(null);
  const refVideo = useRef(null);
  const capRef = useRef(0);

  const diasTesteGratis = planos.find((pl) => pl.nome === 'Grátis')?.dias_teste || 0;

  useEffect(() => observarSecoes(), []);
  useEffect(() => { if (reduzirMovimento) setIntroFeita(true); }, [reduzirMovimento]);
  useEffect(() => {
    fetch(`${API_URL}/planos-plataforma`)
      .then((r) => r.json())
      .then((d) => setPlanos(Array.isArray(d) ? d : []))
      .catch(() => setPlanos([]));
  }, []);

  useEffect(() => {
    // Autoplay declarativo (autoPlay+muted+playsInline) às vezes não "pega" no Safari iOS: com o
    // vídeo ainda bufferizando em dados móveis, ou com o Modo de Baixo Consumo ligado (aí o Safari
    // só libera depois de um gesto real na página). Tenta de novo quando o navegador já tem dados
    // (canplay) e no primeiro toque/rolagem/clique (once, pra não ficar escutando pra sempre).
    const v = refVideo.current;
    if (!v) return undefined;
    const tentarTocar = () => {
      // React nem sempre reflete a prop `muted` no elemento a tempo do Safari avaliar o autoplay.
      v.muted = true;
      v.defaultMuted = true;
      // Encadeamento opcional: no JSDOM (testes) play() devolve undefined em vez de Promise.
      v.play()?.catch(() => {});
    };
    tentarTocar();
    v.addEventListener('canplay', tentarTocar);
    const eventosGesto = ['touchstart', 'touchend', 'scroll', 'click'];
    eventosGesto.forEach((ev) => window.addEventListener(ev, tentarTocar, { once: true, passive: true }));
    return () => {
      v.removeEventListener('canplay', tentarTocar);
      eventosGesto.forEach((ev) => window.removeEventListener(ev, tentarTocar));
    };
  }, [reduzirMovimento]);

  useEffect(() => {
    document.body.style.overflow = menuAberto ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuAberto]);

  useEffect(() => {
    const canvas = refCanvas.current;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    let part = null;
    let desmontado = false;
    // three.js (~140 KB gzip) vem num chunk separado, carregado só aqui: o resto da página
    // aparece sem esperar por ele. Sem WebGL, a landing segue funcionando sem as partículas.
    import('../oficio/particulasOficio')
      .then(({ criarParticulas }) => {
        if (desmontado) return;
        part = criarParticulas(canvas, { mobile, reduzirMovimento });
      })
      .catch((err) => console.warn('Partículas indisponíveis:', err));

    const n = CAPITULOS.length;
    let raf = null;
    let suave = 0;
    const loop = () => {
      const el = refExp.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / (total || 1)));
        suave += (p - suave) * 0.14;
        const g = Math.min(n - 0.0001, suave * n);
        const i = Math.floor(g);
        const local = g - i; // 0..1 dentro do capítulo

        // partículas: transforma nos primeiros 40% do capítulo e segura a forma
        const morph = Math.min(1, local / 0.4);
        if (part) part.setForma(i === 0 ? 0 : i - 1 + morph);

        // fundos: o capítulo que entra "corta" na diagonal por cima do anterior
        CAPITULOS.forEach((c, k) => {
          const f = refFundos.current[k];
          if (!f) return;
          let rev;
          if (k < i) rev = 1;
          else if (k === i) rev = k === 0 ? 1 : Math.min(1, local / 0.3);
          else rev = 0;
          const e = 1 - Math.pow(1 - rev, 3);
          const topo = 100 - e * 150;
          f.style.clipPath = `polygon(0% ${topo + 50}%, 100% ${topo}%, 100% 100%, 0% 100%)`;
          f.style.visibility = rev > 0 && k >= i - 1 ? 'visible' : 'hidden';
          const midia = f.firstChild;
          if (midia) midia.style.transform = `scale(${1.18 - (k === i ? local : k < i ? 1 : 0) * 0.12})`;
        });

        // textos
        CAPITULOS.forEach((c, k) => {
          const t = refTextos.current[k];
          if (!t) return;
          let v = 0;
          if (k === i) {
            const entra = k === 0 ? 1 : Math.min(1, Math.max(0, (local - 0.22) / 0.12));
            const sai = k === n - 1 ? 1 : Math.min(1, Math.max(0, (0.97 - local) / 0.1));
            v = Math.min(entra, sai);
          }
          t.style.opacity = v;
          t.style.transform = `translate3d(0, ${(1 - v) * 30}px, 0)`;
          t.style.visibility = v < 0.01 ? 'hidden' : 'visible';
          t.style.pointerEvents = v > 0.5 ? 'auto' : 'none';
        });

        const ativo = local > 0.28 || i === 0 ? i : Math.max(0, i - 1);
        if (ativo !== capRef.current) { capRef.current = ativo; setCapAtivo(ativo); }
        if (refAnel.current) refAnel.current.style.strokeDashoffset = String(125.6 * (1 - suave));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const aoMover = (e) => { if (part) part.setMouse((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1); };
    window.addEventListener('mousemove', aoMover, { passive: true });
    return () => {
      desmontado = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', aoMover);
      if (part) part.destruir();
    };
  }, [reduzirMovimento]);

  const irPara = (k) => {
    const el = refExp.current;
    const total = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + total * ((k + (k === 0 ? 0 : 0.5)) / CAPITULOS.length), behavior: 'smooth' });
  };

  const cap = CAPITULOS[capAtivo];

  return (
    <div className={`of-landing ${introFeita ? 'pronta' : ''}`} style={{ '--tom': cap.tom }}>
      {!introFeita && <Intro aoTerminar={() => setIntroFeita(true)} />}
      <Menu aberto={menuAberto} fechar={() => setMenuAberto(false)} />

      <header className="of-topo">
        <button type="button" className={`of-hamburguer ${menuAberto ? 'aberto' : ''}`} onClick={() => setMenuAberto((v) => !v)} aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}>
          <span /><span />
        </button>
        <Link to="/" className="of-logo"><img src="/logo-schednext.png" alt="SchedNext" /></Link>
        <div className="of-topo-dir">
          <span className="of-letreiro"><i className="of-ponto" /> Agenda aberta 24h</span>
          <Link to="/admin/login" data-track="menu_entrar" className="of-topo-link">Entrar</Link>
          <Link to="/cadastrar" data-track="menu_criar_conta" className="of-btn of-btn-claro of-btn-p">Criar conta grátis</Link>
        </div>
      </header>

      {/* ============ CAPÍTULOS (rolagem controla fundos, textos e partículas) ============ */}
      <div ref={refExp} className="of-exp" style={{ height: `${CAPITULOS.length * 115}vh` }}>
        <div className="of-marco" data-track-secao="1_topo" style={{ top: 0 }} />
        <div className="of-marco" data-track-secao="4_casos_de_uso" style={{ top: `${(1 / CAPITULOS.length) * 100}%` }} />
        <div className="of-marco" data-track-secao="2_como_funciona" style={{ top: `${(5 / CAPITULOS.length) * 100}%` }} />

        <div className="of-palco">
          {CAPITULOS.map((c, k) => (
            <div key={c.id} ref={(el) => { refFundos.current[k] = el; }} className={`of-fundo of-fundo-${c.id}`} style={{ '--tom-cap': c.tom }}>
              {c.midia === 'video' ? (
                reduzirMovimento ? <img className="of-midia" src="/videos/hero-barbearia-poster.jpg" alt="" /> : (
                  <video ref={refVideo} className="of-midia" src="/videos/hero-barbearia.mp4" poster="/videos/hero-barbearia-poster.jpg" autoPlay loop muted playsInline preload="auto" aria-hidden="true" />
                )
              ) : c.midia.startsWith('/') ? (
                <div className="of-midia of-foto" style={{ backgroundImage: `url(${c.midia})` }} />
              ) : (
                <div className={`of-midia of-abstrato of-abstrato-${c.midia}`} />
              )}
              <div className="of-tinta" />
              <div className="of-sombra" />
            </div>
          ))}

          <canvas ref={refCanvas} className="of-particulas" aria-hidden="true" />
          <div className="of-grao" aria-hidden="true" />

          {CAPITULOS.map((c, k) => (
            <section key={c.id} ref={(el) => { refTextos.current[k] = el; }} className={`of-texto of-texto-${c.id}`}>
              <span className="of-kicker">{c.kicker}</span>
              <TituloDecodificado linhas={c.titulo} ativo={introFeita && capAtivo === k} className={k === 0 ? 'of-titulo-hero' : ''} />
              {c.texto && <p className="of-paragrafo">{c.texto}</p>}
              {k === 0 && (
                <>
                  <div className="of-ctas">
                    <Link to="/cadastrar" data-track="hero_criar_conta" className="of-btn of-btn-claro">Criar conta grátis <Seta /></Link>
                    <button type="button" data-track="hero_ver_como_funciona" className="of-btn of-btn-contorno" onClick={() => irPara(1)}>Ver os ofícios</button>
                  </div>
                  <p className="of-mini">{diasTesteGratis > 0 ? `Teste grátis por ${diasTesteGratis} dias · sem cartão` : 'Grátis pra começar · sem cartão'}</p>
                </>
              )}
              {c.tags && (
                <ul className="of-tags">{c.tags.map((t) => <li key={t}>{t}</li>)}</ul>
              )}
              {c.passos && (
                <ol className="of-passos">
                  {c.passos.map((p) => (
                    <li key={p.n}><span>{p.n}</span><div><strong>{p.t}</strong><p>{p.d}</p></div></li>
                  ))}
                </ol>
              )}
            </section>
          ))}

          {/* HUD */}
          <div className="of-hud-cap">
            <span className="of-hud-num">{String(capAtivo + 1).padStart(2, '0')}</span>
            <span className="of-hud-barra" />
            <span className="of-hud-nome">{cap.rotulo}</span>
          </div>
          <nav className="of-indice" aria-label="Capítulos">
            {CAPITULOS.map((c, k) => (
              <button key={c.id} type="button" className={capAtivo === k ? 'ativo' : ''} onClick={() => irPara(k)} aria-label={c.rotulo}>
                <span>{c.rotulo}</span>
              </button>
            ))}
          </nav>
          <div className="of-rolar" aria-hidden="true">
            <svg width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" className="of-rolar-trilho" /><circle ref={refAnel} cx="23" cy="23" r="20" className="of-rolar-anel" /></svg>
            <span>role</span>
          </div>
        </div>
      </div>

      {/* ============ SEÇÕES ============ */}
      <main className="of-conteudo">
        <section id="recursos" data-track-secao="3_recursos" className="of-secao">
          <Revelar className="of-cabeca">
            <span className="of-kicker">Recursos</span>
            <h2 className="of-titulo-secao">TUDO QUE A SUA<br />CADEIRA PRECISA.</h2>
          </Revelar>
          <div className="of-lista-recursos">
            {RECURSOS.map((r, i) => (
              <Revelar key={r.t} className="of-recurso" style={{ transitionDelay: `${(i % 4) * 0.05}s` }}>
                <span className="of-recurso-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{r.t}</h3>
                <p>{r.d}</p>
                <span className="of-recurso-seta"><Seta /></span>
              </Revelar>
            ))}
          </div>
        </section>

        <section id="planos" data-track-secao="5_planos" className="of-secao">
          <Revelar className="of-cabeca">
            <span className="of-kicker">Planos</span>
            <h2 className="of-titulo-secao">DO PRIMEIRO CLIENTE<br />À REDE DE UNIDADES.</h2>
          </Revelar>
          <div className="of-planos">
            {planos.map((p, i) => {
              const destaque = p.nome === 'Profissional';
              return (
                <Revelar key={p.id} className={`of-plano ${destaque ? 'destaque' : ''}`} style={{ transitionDelay: `${i * 0.08}s` }}>
                  {destaque && <span className="of-plano-selo">Mais escolhido</span>}
                  <span className="of-plano-nome">{p.nome}</span>
                  <div className="of-plano-preco">
                    {p.preco_mensal == null ? <span className="of-plano-consulta">SOB CONSULTA</span> : (
                      <><small>R$</small>{p.preco_mensal === 0 ? '0' : Number(p.preco_mensal).toFixed(2).replace('.', ',')}{p.preco_mensal > 0 && <small>/mês</small>}</>
                    )}
                  </div>
                  <ul>
                    {p.dias_teste > 0 && <li>{p.dias_teste} dias de teste grátis</li>}
                    <li>{p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`}</li>
                    <li>{p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados/mês' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}</li>
                    {p.permite_paleta_customizada && <li>Paleta de cores personalizada</li>}
                    {p.permite_whatsapp_bot && <li>Bot de agendamento no WhatsApp</li>}
                    {p.permite_remover_marca && <li>Sem marca "feito com SchedNext"</li>}
                    {p.permite_relatorios_avancados && <li>Relatórios avançados</li>}
                    {p.permite_ia && <li>Recursos com IA</li>}
                    {p.permite_multi_unidade && <li>Múltiplas unidades</li>}
                    {p.permite_api_publica && <li>API pública</li>}
                    {p.permite_dominio_customizado && <li>Subdomínio personalizado</li>}
                  </ul>
                  <Link to="/cadastrar" data-track={`plano_comecar_${p.nome}`} className={`of-btn of-btn-bloco ${destaque ? 'of-btn-claro' : 'of-btn-contorno'}`}>Começar</Link>
                </Revelar>
              );
            })}
          </div>
        </section>

        <section data-track-secao="6_confianca" className="of-secao of-confianca">
          <Revelar className="of-confianca-grade">
            <div><span className="of-kicker">Seus dados, isolados</span><p>Cada negócio tem seus próprios dados, com senhas em hash e nunca em texto puro.</p></div>
            <div><span className="of-kicker">Conexão criptografada</span><p>Todo tráfego entre seus clientes e o SchedNext usa HTTPS de ponta a ponta.</p></div>
            <div><span className="of-kicker">Backups automáticos</span><p>Agenda e histórico de clientes seguros mesmo se algo der errado.</p></div>
          </Revelar>
        </section>

        <section id="faq" data-track-secao="7_faq" className="of-secao of-secao-estreita">
          <Revelar className="of-cabeca">
            <span className="of-kicker">Dúvidas</span>
            <h2 className="of-titulo-secao">PERGUNTAS<br />FREQUENTES.</h2>
          </Revelar>
          <div className="of-faq">
            {FAQ.map((f, i) => (
              <div key={f.p} className={`of-faq-item ${faqAberto === i ? 'aberto' : ''}`}>
                <button type="button" onClick={() => setFaqAberto(faqAberto === i ? -1 : i)} aria-expanded={faqAberto === i}>
                  {f.p}<span className="of-faq-mais" />
                </button>
                <div className="of-faq-resp"><p>{f.r}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section data-track-secao="8_chamada_final" className="of-cta">
          <div className="of-cta-foto" style={{ backgroundImage: "linear-gradient(90deg, rgba(6, 11, 24, 0.95) 20%, rgba(6, 11, 24, 0.35)), url(/images/casos/barbearia.jpg)" }} />
          <Revelar className="of-cta-conteudo">
            <span className="of-kicker">Comece hoje</span>
            <h2 className="of-titulo-cta">SUA AGENDA,<br />NO SEU RITMO.</h2>
            <p>Leva menos de 5 minutos, e o plano grátis não pede cartão.</p>
            <Link to="/cadastrar" data-track="cta_final_criar_conta" className="of-btn of-btn-claro of-btn-g">Criar conta grátis <Seta tamanho={20} /></Link>
          </Revelar>
        </section>

        <footer className="of-rodape">
          <div className="of-rodape-grade">
            <div>
              <img src="/logo-schednext.png" alt="SchedNext" className="of-rodape-logo" />
              <p>Agenda online para barbearias, salões, estúdios de unhas e estética.</p>
            </div>
            <div>
              <h4>Produto</h4>
              <a href="#recursos" data-track="rodape_recursos">Recursos</a>
              <a href="#planos" data-track="rodape_planos">Planos</a>
              <Link to="/cadastrar" data-track="rodape_criar_conta">Criar conta</Link>
            </div>
            <div>
              <h4>Empresa</h4>
              <a href="#faq" data-track="rodape_faq">FAQ</a>
              <Link to="/docs" data-track="rodape_docs">Docs</Link>
              <Link to="/admin/login" data-track="rodape_entrar">Entrar</Link>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="/legal/termos-de-uso.pdf" data-track="rodape_termos" target="_blank" rel="noopener noreferrer">Termos de uso</a>
              <a href="/legal/politica-de-privacidade.pdf" data-track="rodape_privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a>
            </div>
          </div>
          <p className="of-rodape-copy">© {new Date().getFullYear()} SchedNext. Todos os direitos reservados.</p>
          <p className="of-rodape-credito">
            Fotos: <a href="https://commons.wikimedia.org/wiki/File:Caleb%27s_Chop_Shop.jpg" target="_blank" rel="noopener noreferrer">Tamanoeconomico</a> ·{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Hair_salon_(51212326557).jpg" target="_blank" rel="noopener noreferrer">Hair Spies</a> ·{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Acrylic_nails,_Salon_Sagesse.jpg" target="_blank" rel="noopener noreferrer">Naica Dumeny</a>, via Wikimedia Commons (CC BY / CC BY-SA)
          </p>
        </footer>
      </main>
    </div>
  );
}

export default Landing;
