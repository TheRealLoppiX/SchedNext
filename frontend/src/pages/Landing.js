import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import useRevelarAoRolar from '../hooks/useRevelarAoRolar';
import { API_URL } from '../services/api';

const PASSOS = [
  { numero: '01', titulo: 'Crie sua conta', desc: 'Escolha o nome do seu negócio e o tipo de serviço: barbearia, salão, estúdio de unhas ou outro.' },
  { numero: '02', titulo: 'Configure sua agenda', desc: 'Cadastre profissionais, serviços e horário de funcionamento. Leva menos de 5 minutos.' },
  { numero: '03', titulo: 'Comece a receber agendamentos', desc: 'Compartilhe seu link e seus clientes já marcam horário sozinhos, sem ligação.' }
];

const RECURSOS = [
  { icone: 'calendario', titulo: 'Agenda em tempo real', desc: 'Sem overbooking: cada profissional só aparece disponível quando realmente está.' },
  { icone: 'sino', titulo: 'Lembretes automáticos', desc: 'E-mail e Whatsapp avisando o cliente antes do horário, pra reduzir falta.' },
  { icone: 'estrela', titulo: 'Fidelidade de clientes', desc: 'Campanhas e planos de assinatura pra quem volta sempre, direto no painel.' },
  { icone: 'paleta', titulo: 'Paleta personalizada', desc: 'Sua marca, suas cores, na tela dos seus clientes.' },
  { icone: 'mensagem', titulo: 'Bot de WhatsApp', desc: 'Cliente agenda direto pelo WhatsApp, sem precisar abrir o site.' },
  { icone: 'grafico', titulo: 'Relatórios e estoque', desc: 'Faturamento, produtos e movimentações num só painel, sem planilha paralela.' },
  { icone: 'ia', titulo: 'Recursos com IA', desc: 'Resumo do dia, sugestão de mensagem pro cliente e descrição de serviço geradas automaticamente.' },
  { icone: 'unidade', titulo: 'Múltiplas unidades', desc: 'Gerencie todas as filiais do seu negócio num único painel, com agenda e equipe por unidade.' }
];

const CONFIANCA = [
  { titulo: 'Seus dados, isolados', desc: 'Cada negócio tem seus próprios dados, com senhas em hash e nunca em texto puro.' },
  { titulo: 'Conexão sempre criptografada', desc: 'Todo tráfego entre seus clientes e o SchedNext usa HTTPS de ponta a ponta.' },
  { titulo: 'Backups automáticos', desc: 'Sua agenda e seu histórico de clientes ficam seguros mesmo se algo der errado.' }
];

const CASOS_DE_USO = [
  { icone: 'tesoura', imagem: '/images/casos/barbearia.jpg', nome: 'Barbearias', desc: 'Agenda por barbeiro, fila de espera e fidelidade.' },
  { icone: 'pente', imagem: '/images/casos/salao.jpg', nome: 'Salões de beleza', desc: 'Múltiplos profissionais e serviços combinados.' },
  { icone: 'esmalte', imagem: '/images/casos/estudio.jpg', nome: 'Estúdios de unhas', desc: 'Horários enxutos e confirmação automática por e-mail.' }
];

const FAQ = [
  { p: 'Preciso de cartão de crédito para começar?', r: 'Não. O plano Grátis não pede pagamento, cadastre e comece a usar na hora.' },
  { p: 'Posso trocar de plano depois?', r: 'Sim, a qualquer momento direto pelo painel administrativo.' },
  { p: 'Meus clientes precisam instalar algo?', r: 'Não, o agendamento é feito direto pelo navegador, sem instalação.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim, sem multa e sem burocracia.' }
];

const Icone = ({ nome }) => {
  const props = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (nome) {
    case 'calendario': return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'sino': return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case 'estrela': return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case 'paleta': return <svg {...props}><circle cx="13.5" cy="6.5" r="0.5" /><circle cx="17.5" cy="10.5" r="0.5" /><circle cx="8.5" cy="7.5" r="0.5" /><circle cx="6.5" cy="12.5" r="0.5" /><path d="M12 22a10 10 0 1 1 0-20 6 6 0 0 1 0 12c-2 0-3-1-3-3a2 2 0 0 1 2-2" /></svg>;
    case 'mensagem': return <svg {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>;
    case 'grafico': return <svg {...props}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case 'ia': return <svg {...props}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 15l0.9 2.1L22 18l-2.1 0.9L19 21l-0.9-2.1L16 18l2.1-0.9L19 15z" /></svg>;
    case 'unidade': return <svg {...props}><path d="M4 9l1-5h14l1 5" /><rect x="4" y="9" width="16" height="12" rx="1" /><line x1="12" y1="9" x2="12" y2="21" /></svg>;
    case 'tesoura': return <svg {...props}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>;
    case 'pente': return <svg {...props}><path d="M5 4h14v4H5z" /><line x1="7" y1="8" x2="7" y2="20" /><line x1="10.3" y1="8" x2="10.3" y2="20" /><line x1="13.7" y1="8" x2="13.7" y2="20" /><line x1="17" y1="8" x2="17" y2="20" /></svg>;
    case 'esmalte': return <svg {...props}><line x1="9" y1="2" x2="15" y2="2" /><line x1="10" y1="2" x2="10" y2="6" /><line x1="14" y1="2" x2="14" y2="6" /><path d="M9 6h6l2 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l2-4z" /></svg>;
    case 'cadeado': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case 'escudo': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'nuvem': return <svg {...props}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>;
    default: return null;
  }
};

const IconeConfianca = (i) => ['cadeado', 'escudo', 'nuvem'][i];

const PALAVRAS_ROTATIVAS = ['barbearias', 'salões de beleza', 'estúdios de unhas', 'qualquer negócio de hora marcada'];

const RAIL_POR_PLANO = {
  'Grátis': 'rgba(255,255,255,0.18)',
  'Essencial': 'linear-gradient(90deg, #4c74f0, #2554eb)',
  'Profissional': 'linear-gradient(90deg, #7c9dfb, #4c74f0, #173fb0)',
  'Enterprise': 'linear-gradient(90deg, #e0293e, #4c74f0)',
  default: 'rgba(255,255,255,0.18)'
};

function IconeCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '5px' }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ItemPlano({ texto }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '3px' }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{texto}</span>
    </li>
  );
}

function TextoRotativo({ palavras, intervalo = 2600 }) {
  const [indice, setIndice] = useState(0);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const troca = setInterval(() => {
      setVisivel(false);
      setTimeout(() => {
        setIndice((i) => (i + 1) % palavras.length);
        setVisivel(true);
      }, 280);
    }, intervalo);
    return () => clearInterval(troca);
  }, [palavras, intervalo]);

  return (
    <span className="ln-rotativo-wrap">
      <span className={`ln-rotativo ${visivel ? 'ln-rotativo-visivel' : ''}`}>{palavras[indice]}</span>
    </span>
  );
}

function MockupAgenda() {
  const slots = [
    { hora: '09:00', nome: 'Ana Souza', servico: 'Corte + Barba', cor: '#4c74f0' },
    { hora: '10:30', nome: 'Carlos Lima', servico: 'Coloração', cor: '#e0293e' },
    { hora: '11:00', nome: 'Livre', servico: '', cor: null },
    { hora: '14:00', nome: 'Marina Alves', servico: 'Manicure', cor: '#7c9dfb' }
  ];
  return (
    <div className="ln-mockup" style={s.mockup}>
      <div style={s.mockupHeader}>
        <span style={{ fontWeight: 700 }}>Hoje, 22 de julho</span>
        <span style={s.mockupBadge}>
          <svg className="ln-mockup-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Confirmado
        </span>
      </div>
      {slots.map((slot) => (
        <div key={slot.hora} style={{ ...s.mockupSlot, borderLeftColor: slot.cor || 'rgba(255,255,255,0.12)' }}>
          <span style={s.mockupHora}>{slot.hora}</span>
          {slot.nome === 'Livre' ? (
            <span style={s.mockupLivre}>Horário livre</span>
          ) : (
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{slot.nome}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{slot.servico}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniSparkline() {
  return (
    <svg width="72" height="24" viewBox="0 0 72 24" fill="none">
      <polyline
        points="0,18 10,14 20,16 30,8 40,11 50,4 60,7 72,2"
        stroke="#4c74f0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Landing() {
  const [planos, setPlanos] = useState([]);
  const [reduzirMovimento] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const [refComoFunciona, visivelComoFunciona] = useRevelarAoRolar();
  const [refRecursos, visivelRecursos] = useRevelarAoRolar();
  const [refCasos, visivelCasos] = useRevelarAoRolar();
  const [refPlanos, visivelPlanos] = useRevelarAoRolar();
  const [refConfianca, visivelConfianca] = useRevelarAoRolar();
  const [refFaq, visivelFaq] = useRevelarAoRolar();
  const [refCtaFinal, visivelCtaFinal] = useRevelarAoRolar();

  useEffect(() => {
    fetch(`${API_URL}/planos-plataforma`)
      .then((r) => r.json())
      .then(setPlanos)
      .catch(() => setPlanos([]));
  }, []);

  return (
    <div style={s.pagina}>
      <header style={s.header}>
        <img src="/logo-schednext.png" alt="SchedNext" style={s.logoHeader} />
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="#recursos" className="ln-nav-link ln-nav-scroll" style={s.linkHeader}>Recursos</a>
          <a href="#planos" className="ln-nav-link ln-nav-scroll" style={s.linkHeader}>Planos</a>
          <a href="#faq" className="ln-nav-link ln-nav-scroll" style={s.linkHeader}>FAQ</a>
          <Link to="/admin/login" className="ln-nav-link" style={s.linkHeader}>Entrar</Link>
          <Link to="/cadastrar" className="ln-cta-primary" style={s.btnHeader}>Criar conta grátis</Link>
        </nav>
      </header>

      <section style={s.hero}>
        {reduzirMovimento ? (
          <img src="/videos/hero-barbearia-poster.jpg" alt="" aria-hidden="true" style={s.heroVideo} />
        ) : (
          <video
            className="ln-hero-video"
            style={s.heroVideo}
            src="/videos/hero-barbearia.mp4"
            poster="/videos/hero-barbearia-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        )}
        <div style={s.heroOverlay} />
        <div className="ln-hero-glow" style={s.heroGlow} />
        <div className="ln-hero-colunas" style={s.heroConteudo}>
          <div style={s.heroTexto}>
            <span className="ln-hero-eyebrow" style={s.eyebrow}>
              Agenda online pra <TextoRotativo palavras={PALAVRAS_ROTATIVAS} />
            </span>
            <h1 className="ln-hero-title" style={s.heroTitulo}>
              Marque. Clique. <span className="ln-gradient-text">Pronto.</span>
            </h1>
            <p className="ln-hero-sub" style={s.heroSubtitulo}>
              Sua equipe organizada, sua agenda sempre em dia, seus clientes marcando sozinhos.
              Grátis pra sempre, sem cartão, sem complicação.
            </p>
            <div className="ln-hero-cta" style={s.heroCtaRow}>
              <Link to="/cadastrar" className="ln-cta-primary" style={s.ctaPrincipal}>
                Criar conta grátis
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
              </Link>
              <a href="#recursos" className="ln-cta-secondary" style={s.ctaSecundarioHero}>Ver como funciona</a>
            </div>
          </div>

          <div className="ln-hero-visual" style={s.heroVisual}>
            <div className="ln-hero-visual-grid" />
            <div className="ln-hero-badge" style={s.heroBadge}>
              <span style={s.heroBadgeDot} />
              Novo agendamento recebido pelo WhatsApp
            </div>
            <div style={s.heroConnector} />
            <MockupAgenda />
            <div className="ln-hero-stat" style={s.heroStat}>
              <span style={s.heroStatLabel}>Ocupação hoje</span>
              <strong style={s.heroStatValor}>92%</strong>
              <MiniSparkline />
            </div>
          </div>
        </div>
      </section>

      <section ref={refComoFunciona} className={`ln-reveal ${visivelComoFunciona ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Como funciona</span>
        <h2 style={s.secaoTitulo}>Do zero à primeira agenda em minutos</h2>
        <div style={s.gridPassos}>
          {PASSOS.map((p) => (
            <div key={p.numero} className="ln-step" style={s.cardPasso}>
              <span className="ln-step-numero" style={s.numeroPasso}>{p.numero}</span>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px', color: '#fff' }}>{p.titulo}</h3>
              <p style={{ color: s.CORES.textoFraco, fontSize: '14px', margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="recursos"
        ref={refRecursos}
        className={`ln-reveal ${visivelRecursos ? 'ln-visible' : ''}`}
        style={{ ...s.secao, ...s.secaoAlt, scrollMarginTop: '90px' }}
      >
        <span style={s.eyebrowCentro}>Recursos</span>
        <h2 style={s.secaoTitulo}>Tudo que sua agenda precisa, num só lugar</h2>
        <div style={s.gridRecursos}>
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="ln-card" style={s.cardRecurso}>
              <div className="ln-icone-wrapper" style={s.iconeWrapper}><Icone nome={r.icone} /></div>
              <h3 style={{ margin: '14px 0 6px', fontSize: '16px', color: '#fff' }}>{r.titulo}</h3>
              <p style={{ color: s.CORES.textoFraco, fontSize: '13px', margin: 0 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={refCasos} className={`ln-reveal ${visivelCasos ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Feito para diferentes negócios</span>
        <h2 style={s.secaoTitulo}>Um só sistema, vários tipos de negócio</h2>
        <div style={s.gridCasos}>
          {CASOS_DE_USO.map((c) => (
            <div key={c.nome} className="ln-card ln-card-caso" style={{ ...s.cardCaso, backgroundImage: `url(${c.imagem})` }}>
              <div style={s.casoOverlay} />
              <div style={s.casoConteudo}>
                <div className="ln-icone-wrapper" style={s.iconeWrapperCaso}><Icone nome={c.icone} /></div>
                <h3 style={{ margin: '10px 0 6px', color: '#fff' }}>{c.nome}</h3>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="planos" ref={refPlanos} className={`ln-reveal ${visivelPlanos ? 'ln-visible' : ''}`} style={{ ...s.secao, scrollMarginTop: '90px' }}>
        <span style={s.eyebrowCentro}>Planos</span>
        <h2 style={s.secaoTitulo}>Um plano para cada fase do seu negócio</h2>
        <div style={s.gridPlanos}>
          {planos.map((p) => {
            const destaque = p.nome === 'Profissional';
            return (
              <div
                key={p.id}
                className={`ln-card-plano ${destaque ? 'ln-card-plano-destaque' : ''}`}
                style={{ ...s.cardPlano, ...(destaque ? s.cardPlanoDestaque : {}) }}
              >
                <div className="ln-plano-rail" style={{ ...s.planoRail, background: RAIL_POR_PLANO[p.nome] || RAIL_POR_PLANO.default }} />
                {destaque && <span style={s.badgePopular}>Mais popular</span>}
                <h3 style={{ margin: 0, color: '#fff' }}>{p.nome}</h3>
                <p style={s.preco}>
                  {p.preco_mensal == null ? 'Sob consulta' : p.preco_mensal === 0 ? 'R$ 0' : `R$ ${Number(p.preco_mensal).toFixed(2)}`}
                  {p.preco_mensal > 0 && <span style={{ fontSize: '13px', fontWeight: 400 }}>/mês</span>}
                </p>
                <div style={s.planoDivisor} />
                <ul style={s.listaPlano}>
                  <ItemPlano texto={p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`} />
                  <ItemPlano texto={p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados/mês' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`} />
                  {p.permite_paleta_customizada && <ItemPlano texto="Paleta de cores personalizada" />}
                  {p.permite_whatsapp_bot && <ItemPlano texto="Bot de agendamento no WhatsApp" />}
                  {p.permite_remover_marca && <ItemPlano texto='Sem marca "feito com SchedNext"' />}
                  {p.permite_relatorios_avancados && <ItemPlano texto="Relatórios avançados" />}
                  {p.permite_ia && <ItemPlano texto="Recursos com IA" />}
                  {p.permite_multi_unidade && <ItemPlano texto="Múltiplas unidades" />}
                  {p.permite_api_publica && <ItemPlano texto="API pública" />}
                  {p.permite_dominio_customizado && <ItemPlano texto="Subdomínio personalizado" />}
                </ul>
                <Link to="/cadastrar" className="ln-cta-plano" style={destaque ? s.ctaPlanoDestaque : s.ctaPlano}>Começar</Link>
              </div>
            );
          })}
        </div>
      </section>

      <section ref={refConfianca} className={`ln-reveal ${visivelConfianca ? 'ln-visible' : ''}`} style={{ ...s.secao, ...s.secaoAlt }}>
        <span style={s.eyebrowCentro}>Confiança</span>
        <h2 style={s.secaoTitulo}>Seguro por padrão</h2>
        <div style={s.gridConfianca}>
          {CONFIANCA.map((c, i) => (
            <div key={c.titulo} className="ln-card" style={s.cardConfianca}>
              <div className="ln-icone-wrapper" style={s.iconeWrapper}><Icone nome={IconeConfianca(i)} /></div>
              <h3 style={{ margin: '14px 0 6px', fontSize: '16px', color: '#fff' }}>{c.titulo}</h3>
              <p style={{ color: s.CORES.textoFraco, fontSize: '13px', margin: 0 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" ref={refFaq} className={`ln-reveal ${visivelFaq ? 'ln-visible' : ''}`} style={{ ...s.secao, scrollMarginTop: '90px' }}>
        <span style={s.eyebrowCentro}>Dúvidas</span>
        <h2 style={s.secaoTitulo}>Perguntas frequentes</h2>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {FAQ.map((f) => (
            <div key={f.p} className="ln-faq-item" style={s.itemFaq}>
              <strong style={{ color: '#fff' }}>{f.p}</strong>
              <p style={{ color: s.CORES.textoFraco, margin: '6px 0 0' }}>{f.r}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={refCtaFinal} className={`ln-reveal ${visivelCtaFinal ? 'ln-visible' : ''}`} style={s.ctaFinal}>
        <div className="ln-hero-visual-grid" style={s.ctaFinalGrid} />
        <div style={s.ctaFinalGlow} />
        <div style={s.ctaFinalConteudo}>
          <h2 style={{ ...s.secaoTitulo, color: '#fff' }}>Pronto para organizar sua agenda?</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '24px' }}>Leva menos de 5 minutos, e o plano grátis não pede cartão.</p>
          <div style={s.ctaFinalTrust}>
            <span style={s.ctaFinalTrustItem}><IconeCheck /> Sem cartão de crédito</span>
            <span style={s.ctaFinalTrustItem}><IconeCheck /> Cancele quando quiser</span>
            <span style={s.ctaFinalTrustItem}><IconeCheck /> Pronto em 5 minutos</span>
          </div>
          <Link to="/cadastrar" className="ln-cta-final" style={s.ctaFinalBotao}>Criar conta grátis</Link>
        </div>
      </section>

      <footer style={s.footer}>
        <div style={s.footerGrid}>
          <div>
            <img src="/logo-schednext.png" alt="SchedNext" style={s.logoFooter} />
            <p style={{ color: s.CORES.textoFraco, fontSize: '13px', marginTop: '10px', maxWidth: '260px' }}>
              Agenda online para negócios de hora marcada: barbearias, salões, estúdios e mais.
            </p>
          </div>
          <div>
            <h4 style={s.footerTitulo}>Produto</h4>
            <a href="#recursos" style={s.footerLink}>Recursos</a>
            <a href="#planos" style={s.footerLink}>Planos</a>
            <Link to="/cadastrar" style={s.footerLink}>Criar conta</Link>
          </div>
          <div>
            <h4 style={s.footerTitulo}>Empresa</h4>
            <a href="#faq" style={s.footerLink}>FAQ</a>
            <Link to="/admin/login" style={s.footerLink}>Entrar</Link>
          </div>
          <div>
            <h4 style={s.footerTitulo}>Legal</h4>
            <span style={s.footerLink}>Termos de uso</span>
            <span style={s.footerLink}>Privacidade</span>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: s.CORES.textoFraco, fontSize: '13px', marginTop: '30px' }}>
          © {new Date().getFullYear()} SchedNext. Todos os direitos reservados.
        </p>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '10px' }}>
          Fotos: <a href="https://commons.wikimedia.org/wiki/File:Caleb%27s_Chop_Shop.jpg" target="_blank" rel="noopener noreferrer" style={s.creditoLink}>Tamanoeconomico</a> ·{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Hair_salon_(51212326557).jpg" target="_blank" rel="noopener noreferrer" style={s.creditoLink}>Hair Spies</a> ·{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Acrylic_nails,_Salon_Sagesse.jpg" target="_blank" rel="noopener noreferrer" style={s.creditoLink}>Naica Dumeny</a>, via Wikimedia Commons (CC BY / CC BY-SA)
        </p>
      </footer>
    </div>
  );
}

const CORES = {
  fundo: '#05060d',
  fundoAlt: '#0a0c18',
  borda: 'rgba(255,255,255,0.12)',
  cardBg: 'rgba(255,255,255,0.04)',
  textoFraco: 'rgba(255,255,255,0.62)',
  acento: '#4c74f0'
};

const s = {
  CORES,
  pagina: { minHeight: '100vh', background: CORES.fundo, color: '#fff', fontFamily: "'Poppins', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 40px', borderBottom: `1px solid ${CORES.borda}`, position: 'sticky', top: 0, background: 'rgba(5,6,13,0.85)', backdropFilter: 'blur(6px)', zIndex: 10 },
  logoHeader: { height: '32px', width: 'auto' },
  logoFooter: { height: '28px', width: 'auto' },
  linkHeader: { color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '14px' },
  btnHeader: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' },

  hero: { position: 'relative', padding: '110px 20px 90px', overflow: 'hidden', background: CORES.fundo },
  heroVideo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
  heroOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,6,13,0.86) 0%, rgba(5,6,13,0.75) 45%, rgba(5,6,13,0.96) 100%)', zIndex: 1 },
  heroGlow: { position: 'absolute', top: 0, left: 0, width: '70%', height: '70%', background: 'radial-gradient(circle at 20% 15%, rgba(37,84,235,0.35), transparent 60%), radial-gradient(circle at 35% 5%, rgba(224,41,62,0.14), transparent 55%)', zIndex: 1, pointerEvents: 'none' },
  heroConteudo: { position: 'relative', zIndex: 2 },
  heroTexto: { textAlign: 'left' },
  eyebrow: { display: 'inline-block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '18px' },
  heroTitulo: { fontSize: 'clamp(34px, 4.6vw, 54px)', margin: '0 0 18px', lineHeight: 1.12, fontWeight: 700, textWrap: 'balance', color: '#fff' },
  heroSubtitulo: { fontSize: '17px', color: 'rgba(255,255,255,0.68)', maxWidth: '480px', margin: '0 0 34px' },
  heroCtaRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  ctaPrincipal: { background: '#fff', color: '#0b1020', padding: '14px 22px', borderRadius: '9px', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' },
  ctaSecundarioHero: { border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '14px 22px', borderRadius: '9px', textDecoration: 'none', fontWeight: 600, display: 'inline-block' },

  heroVisual: { position: 'relative', minHeight: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 },
  heroBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 600, padding: '8px 14px', borderRadius: '20px', position: 'relative', zIndex: 2 },
  heroBadgeDot: { width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' },
  heroConnector: { width: '1px', height: '32px', background: 'linear-gradient(180deg, rgba(76,116,240,0.7), rgba(76,116,240,0.05))', zIndex: 2 },
  heroStat: { position: 'absolute', right: '4%', bottom: '2%', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(17,20,36,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 3, backdropFilter: 'blur(6px)' },
  heroStatLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  heroStatValor: { fontSize: '20px', color: '#fff', fontWeight: 700 },

  mockup: { maxWidth: '400px', width: '100%', boxSizing: 'border-box', margin: '18px auto 0', background: 'rgba(17,20,36,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', boxShadow: '0 30px 60px rgba(0,0,0,0.45)', padding: '18px', textAlign: 'left', position: 'relative', zIndex: 2, backdropFilter: 'blur(6px)' },
  mockupHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff' },
  mockupBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', padding: '3px 8px', borderRadius: '20px' },
  mockupSlot: { display: 'flex', gap: '14px', alignItems: 'center', padding: '10px 8px', borderLeft: '3px solid', marginBottom: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' },
  mockupHora: { fontWeight: 700, fontSize: '13px', width: '48px', color: 'rgba(255,255,255,0.55)' },
  mockupLivre: { fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' },

  secao: { padding: '70px 20px', maxWidth: '1100px', margin: '0 auto' },
  secaoAlt: { background: CORES.fundoAlt, borderRadius: '24px' },
  eyebrowCentro: { display: 'block', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: CORES.acento, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' },
  secaoTitulo: { textAlign: 'center', fontSize: '30px', marginBottom: '40px', fontWeight: 700, textWrap: 'balance', color: '#fff' },

  gridPassos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' },
  cardPasso: { padding: '10px' },
  numeroPasso: { fontSize: '28px', fontWeight: 800, color: CORES.borda },

  gridRecursos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' },
  cardRecurso: { background: CORES.cardBg, border: `1px solid ${CORES.borda}`, borderRadius: '14px', padding: '22px' },
  iconeWrapper: { width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(76,116,240,0.15)', color: CORES.acento, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  gridCasos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
  cardCaso: { position: 'relative', overflow: 'hidden', border: `1px solid ${CORES.borda}`, borderRadius: '14px', padding: '24px', textAlign: 'center', minHeight: '220px', display: 'flex', alignItems: 'flex-end', backgroundSize: 'cover', backgroundPosition: 'center' },
  casoOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,6,13,0.35) 0%, rgba(5,6,13,0.92) 78%)', zIndex: 0 },
  casoConteudo: { position: 'relative', zIndex: 1, width: '100%' },
  iconeWrapperCaso: { width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', backdropFilter: 'blur(4px)' },

  gridPlanos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '24px', alignItems: 'stretch' },
  cardPlano: { position: 'relative', overflow: 'hidden', border: `1px solid ${CORES.borda}`, borderRadius: '14px', padding: '28px 24px 24px', display: 'flex', flexDirection: 'column', background: CORES.cardBg },
  cardPlanoDestaque: { border: '1px solid rgba(76,116,240,0.55)', background: 'rgba(76,116,240,0.08)', boxShadow: '0 25px 60px rgba(37,84,235,0.25)' },
  planoRail: { position: 'absolute', top: 0, left: 0, right: 0, height: '4px' },
  badgePopular: { position: 'absolute', top: '14px', right: '14px', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.3px' },
  preco: { fontSize: '28px', fontWeight: 800, margin: '10px 0', color: '#fff' },
  planoDivisor: { height: '1px', background: CORES.borda, margin: '4px 0 16px' },
  listaPlano: { fontSize: '13px', color: CORES.textoFraco, paddingLeft: 0, listStyle: 'none', flex: 1, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  ctaPlano: { textAlign: 'center', background: 'rgba(76,116,240,0.15)', color: '#fff', padding: '10px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 },
  ctaPlanoDestaque: { textAlign: 'center', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '10px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, boxShadow: '0 10px 24px rgba(37,84,235,0.4)' },

  gridConfianca: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' },
  cardConfianca: { padding: '10px' },

  itemFaq: { padding: '16px 0', borderBottom: `1px solid ${CORES.borda}`, borderLeft: '2px solid transparent' },

  ctaFinal: { position: 'relative', overflow: 'hidden', textAlign: 'center', padding: '70px 20px', background: 'linear-gradient(135deg, #173fb0, #2554eb)', margin: '0 20px', borderRadius: '24px' },
  ctaFinalGrid: { position: 'absolute', inset: '-40px', opacity: 0.5 },
  ctaFinalGlow: { position: 'absolute', top: 0, left: 0, width: '60%', height: '100%', background: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18), transparent 60%)', pointerEvents: 'none' },
  ctaFinalConteudo: { position: 'relative', zIndex: 1 },
  ctaFinalTrust: { display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' },
  ctaFinalTrustItem: { fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 },
  ctaFinalBotao: { display: 'inline-block', background: '#fff', color: CORES.acento, padding: '14px 30px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700 },

  footer: { padding: '50px 40px 30px', borderTop: `1px solid ${CORES.borda}`, marginTop: '40px' },
  footerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '30px', maxWidth: '1100px', margin: '0 auto' },
  footerTitulo: { fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: CORES.textoFraco, marginBottom: '12px' },
  footerLink: { display: 'block', color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '14px', marginBottom: '8px' },
  creditoLink: { color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }
};

export default Landing;
