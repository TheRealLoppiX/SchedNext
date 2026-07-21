import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import useRevelarAoRolar from '../hooks/useRevelarAoRolar';
import { API_URL } from '../services/api';

const PASSOS = [
  { numero: '01', titulo: 'Crie sua conta', desc: 'Escolha o nome do seu negócio e o tipo de serviço — barbearia, salão, estúdio de unhas ou outro.' },
  { numero: '02', titulo: 'Configure sua agenda', desc: 'Cadastre profissionais, serviços e horário de funcionamento. Leva menos de 5 minutos.' },
  { numero: '03', titulo: 'Comece a receber agendamentos', desc: 'Compartilhe seu link e seus clientes já marcam horário sozinhos, sem ligação.' }
];

const RECURSOS = [
  { icone: 'calendario', titulo: 'Agenda em tempo real', desc: 'Sem overbooking: cada profissional só aparece disponível quando realmente está.' },
  { icone: 'sino', titulo: 'Lembretes automáticos', desc: 'E-mail (e WhatsApp, no plano certo) avisando o cliente antes do horário — menos falta.' },
  { icone: 'estrela', titulo: 'Fidelidade de clientes', desc: 'Campanhas e planos de assinatura pra quem volta sempre, direto no painel.' },
  { icone: 'paleta', titulo: 'Paleta personalizada', desc: 'Sua marca, suas cores, na tela dos seus clientes — a partir do plano Essencial.' },
  { icone: 'mensagem', titulo: 'Bot de WhatsApp', desc: 'Cliente agenda direto pelo WhatsApp, sem precisar abrir o site — plano Profissional.' },
  { icone: 'grafico', titulo: 'Relatórios e estoque', desc: 'Faturamento, produtos e movimentações num só painel, sem planilha paralela.' }
];

const CONFIANCA = [
  { titulo: 'Seus dados, isolados', desc: 'Cada negócio tem seus próprios dados, com senhas em hash e nunca em texto puro.' },
  { titulo: 'Conexão sempre criptografada', desc: 'Todo tráfego entre seus clientes e o SchedNext usa HTTPS de ponta a ponta.' },
  { titulo: 'Backups automáticos', desc: 'Sua agenda e seu histórico de clientes ficam seguros mesmo se algo der errado.' }
];

const CASOS_DE_USO = [
  { emoji: '💈', nome: 'Barbearias', desc: 'Agenda por barbeiro, fila de espera e fidelidade.' },
  { emoji: '💇', nome: 'Salões de beleza', desc: 'Múltiplos profissionais e serviços combinados.' },
  { emoji: '💅', nome: 'Estúdios de unhas', desc: 'Horários enxutos e confirmação automática por e-mail.' }
];

const FAQ = [
  { p: 'Preciso de cartão de crédito para começar?', r: 'Não. O plano Grátis não pede pagamento — cadastre e comece a usar na hora.' },
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
    case 'cadeado': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case 'escudo': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'nuvem': return <svg {...props}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>;
    default: return null;
  }
};

const IconeConfianca = (i) => ['cadeado', 'escudo', 'nuvem'][i];

const PALAVRAS_ROTATIVAS = ['barbearias', 'salões de beleza', 'estúdios de unhas', 'qualquer negócio de hora marcada'];

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
    { hora: '09:00', nome: 'Ana Souza', servico: 'Corte + Barba', cor: '#2554eb' },
    { hora: '10:30', nome: 'Carlos Lima', servico: 'Coloração', cor: '#e0293e' },
    { hora: '11:00', nome: 'Livre', servico: '', cor: null },
    { hora: '14:00', nome: 'Marina Alves', servico: 'Manicure', cor: '#173fb0' }
  ];
  return (
    <div className="ln-mockup" style={s.mockup}>
      <div style={s.mockupHeader}>
        <span style={{ fontWeight: 700 }}>Hoje, 20 de julho</span>
        <span style={s.mockupBadge}>
          <svg className="ln-mockup-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Confirmado
        </span>
      </div>
      {slots.map((slot) => (
        <div key={slot.hora} style={{ ...s.mockupSlot, borderLeftColor: slot.cor || '#e2e6f0' }}>
          <span style={s.mockupHora}>{slot.hora}</span>
          {slot.nome === 'Livre' ? (
            <span style={s.mockupLivre}>Horário livre</span>
          ) : (
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{slot.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--bb-text-muted)' }}>{slot.servico}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Landing() {
  const [planos, setPlanos] = useState([]);

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
      <div className="ln-faixa-topo" style={s.faixaTopo}>🎉 Novo: personalize a paleta de cores e ative o bot de agendamento no WhatsApp</div>

      <header style={s.header}>
        <img src="/logo-schednext.png" alt="SchedNext" style={s.logoHeader} />
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="#recursos" className="ln-nav-link" style={s.linkHeader}>Recursos</a>
          <a href="#planos" className="ln-nav-link" style={s.linkHeader}>Planos</a>
          <a href="#faq" className="ln-nav-link" style={s.linkHeader}>FAQ</a>
          <Link to="/admin/login" className="ln-nav-link" style={s.linkHeader}>Entrar</Link>
          <Link to="/cadastrar" className="ln-cta-primary" style={s.btnHeader}>Criar conta grátis</Link>
        </nav>
      </header>

      <section style={s.hero}>
        <span className="ln-hero-eyebrow" style={s.eyebrow}>
          Agenda online para <TextoRotativo palavras={PALAVRAS_ROTATIVAS} />
        </span>
        <h1 className="ln-hero-title" style={s.heroTitulo}>Marque. Clique. Pronto.</h1>
        <p className="ln-hero-sub" style={s.heroSubtitulo}>
          Sua equipe organizada, sua agenda sempre em dia, seus clientes marcando sozinhos.
          Grátis pra sempre — sem cartão, sem complicação.
        </p>
        <div className="ln-hero-cta" style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '50px' }}>
          <Link to="/cadastrar" className="ln-cta-primary" style={s.ctaPrincipal}>Criar conta grátis</Link>
          <a href="#recursos" className="ln-cta-secondary" style={s.ctaSecundario}>Ver como funciona</a>
        </div>
        <MockupAgenda />
      </section>

      <section ref={refComoFunciona} className={`ln-reveal ${visivelComoFunciona ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Como funciona</span>
        <h2 style={s.secaoTitulo}>Do zero à primeira agenda em minutos</h2>
        <div style={s.gridPassos}>
          {PASSOS.map((p) => (
            <div key={p.numero} className="ln-step" style={s.cardPasso}>
              <span className="ln-step-numero" style={s.numeroPasso}>{p.numero}</span>
              <h3 style={{ margin: '14px 0 8px', fontSize: '18px' }}>{p.titulo}</h3>
              <p style={{ color: 'var(--bb-text-muted)', fontSize: '14px', margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="recursos"
        ref={refRecursos}
        className={`ln-reveal ${visivelRecursos ? 'ln-visible' : ''}`}
        style={{ ...s.secao, background: 'var(--bb-black-soft)', borderRadius: '24px' }}
      >
        <span style={s.eyebrowCentro}>Recursos</span>
        <h2 style={s.secaoTitulo}>Tudo que sua agenda precisa, num só lugar</h2>
        <div style={s.gridRecursos}>
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="ln-card" style={s.cardRecurso}>
              <div className="ln-icone-wrapper" style={s.iconeWrapper}><Icone nome={r.icone} /></div>
              <h3 style={{ margin: '14px 0 6px', fontSize: '16px' }}>{r.titulo}</h3>
              <p style={{ color: 'var(--bb-text-muted)', fontSize: '13px', margin: 0 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={refCasos} className={`ln-reveal ${visivelCasos ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Feito para diferentes negócios</span>
        <h2 style={s.secaoTitulo}>Um só sistema, vários tipos de negócio</h2>
        <div style={s.gridCasos}>
          {CASOS_DE_USO.map((c) => (
            <div key={c.nome} className="ln-card" style={s.cardCaso}>
              <div style={{ fontSize: '36px' }}>{c.emoji}</div>
              <h3 style={{ margin: '10px 0 6px' }}>{c.nome}</h3>
              <p style={{ color: 'var(--bb-text-muted)', fontSize: '14px' }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="planos" ref={refPlanos} className={`ln-reveal ${visivelPlanos ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Planos</span>
        <h2 style={s.secaoTitulo}>Um plano para cada fase do seu negócio</h2>
        <div style={s.gridPlanos}>
          {planos.map((p) => (
            <div key={p.id} className="ln-card-plano" style={s.cardPlano}>
              <h3 style={{ margin: 0 }}>{p.nome}</h3>
              <p style={s.preco}>
                {p.preco_mensal == null ? 'Sob consulta' : p.preco_mensal === 0 ? 'R$ 0' : `R$ ${Number(p.preco_mensal).toFixed(2)}`}
                {p.preco_mensal > 0 && <span style={{ fontSize: '13px', fontWeight: 400 }}>/mês</span>}
              </p>
              <ul style={s.listaPlano}>
                <li>{p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`}</li>
                <li>{p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados/mês' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}</li>
                {p.permite_paleta_customizada && <li>Paleta de cores personalizada</li>}
                {p.permite_whatsapp_bot && <li>Bot de agendamento no WhatsApp</li>}
                {p.permite_remover_marca && <li>Sem marca "feito com SchedNext"</li>}
              </ul>
              <Link to="/cadastrar" className="ln-cta-plano" style={s.ctaPlano}>Começar</Link>
            </div>
          ))}
        </div>
      </section>

      <section ref={refConfianca} className={`ln-reveal ${visivelConfianca ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Confiança</span>
        <h2 style={s.secaoTitulo}>Seguro por padrão</h2>
        <div style={s.gridConfianca}>
          {CONFIANCA.map((c, i) => (
            <div key={c.titulo} className="ln-card" style={s.cardConfianca}>
              <div className="ln-icone-wrapper" style={s.iconeWrapper}><Icone nome={IconeConfianca(i)} /></div>
              <h3 style={{ margin: '14px 0 6px', fontSize: '16px' }}>{c.titulo}</h3>
              <p style={{ color: 'var(--bb-text-muted)', fontSize: '13px', margin: 0 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" ref={refFaq} className={`ln-reveal ${visivelFaq ? 'ln-visible' : ''}`} style={s.secao}>
        <span style={s.eyebrowCentro}>Dúvidas</span>
        <h2 style={s.secaoTitulo}>Perguntas frequentes</h2>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {FAQ.map((f) => (
            <div key={f.p} className="ln-faq-item" style={s.itemFaq}>
              <strong>{f.p}</strong>
              <p style={{ color: 'var(--bb-text-muted)', margin: '6px 0 0' }}>{f.r}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={refCtaFinal} className={`ln-reveal ${visivelCtaFinal ? 'ln-visible' : ''}`} style={s.ctaFinal}>
        <h2 style={{ ...s.secaoTitulo, color: '#fff' }}>Pronto para organizar sua agenda?</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '28px' }}>Leva menos de 5 minutos, e o plano grátis não pede cartão.</p>
        <Link to="/cadastrar" className="ln-cta-final" style={s.ctaFinalBotao}>Criar conta grátis</Link>
      </section>

      <footer style={s.footer}>
        <div style={s.footerGrid}>
          <div>
            <img src="/logo-schednext.png" alt="SchedNext" style={s.logoFooter} />
            <p style={{ color: 'var(--bb-text-muted)', fontSize: '13px', marginTop: '10px', maxWidth: '260px' }}>
              Agenda online para negócios de hora marcada — barbearias, salões, estúdios e mais.
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
        <p style={{ textAlign: 'center', color: 'var(--bb-text-muted)', fontSize: '13px', marginTop: '30px' }}>
          © {new Date().getFullYear()} SchedNext. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}

const s = {
  pagina: { minHeight: '100vh', background: '#fff', color: 'var(--bb-text)', fontFamily: "'Poppins', sans-serif" },
  faixaTopo: { color: '#fff', textAlign: 'center', padding: '9px', fontSize: '13px', fontWeight: 500 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 40px', borderBottom: '1px solid var(--bb-border)', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', zIndex: 10 },
  logoHeader: { height: '32px', width: 'auto' },
  logoFooter: { height: '28px', width: 'auto' },
  linkHeader: { color: 'var(--bb-text)', textDecoration: 'none', fontSize: '14px' },
  btnHeader: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' },

  hero: { textAlign: 'center', padding: '80px 20px 0' },
  eyebrow: { display: 'inline-block', fontSize: '13px', fontWeight: 600, color: 'var(--bb-gold)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '18px' },
  heroTitulo: { fontSize: 'clamp(36px, 6vw, 56px)', maxWidth: '760px', margin: '0 auto 18px', lineHeight: 1.1, fontWeight: 700, textWrap: 'balance' },
  heroSubtitulo: { fontSize: '17px', color: 'var(--bb-text-muted)', maxWidth: '580px', margin: '0 auto 30px' },
  ctaPrincipal: { background: 'linear-gradient(135deg, #4c74f0, #173fb0, #2554eb)', color: '#fff', padding: '14px 28px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, display: 'inline-block' },
  ctaSecundario: { border: '1px solid var(--bb-border)', color: 'var(--bb-text)', padding: '14px 28px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, display: 'inline-block' },

  mockup: { maxWidth: '460px', margin: '0 auto', background: '#fff', border: '1px solid var(--bb-border)', borderRadius: '18px', boxShadow: '0 20px 50px rgba(20,24,43,0.12)', padding: '18px', textAlign: 'left' },
  mockupHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--bb-border)' },
  mockupBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: '20px' },
  mockupSlot: { display: 'flex', gap: '14px', alignItems: 'center', padding: '10px 8px', borderLeft: '3px solid', marginBottom: '6px', borderRadius: '6px', background: 'var(--bb-black-soft)' },
  mockupHora: { fontWeight: 700, fontSize: '13px', width: '48px', color: 'var(--bb-text-muted)' },
  mockupLivre: { fontSize: '13px', color: 'var(--bb-text-muted)', fontStyle: 'italic' },

  secao: { padding: '70px 20px', maxWidth: '1100px', margin: '0 auto' },
  eyebrowCentro: { display: 'block', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--bb-gold)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' },
  secaoTitulo: { textAlign: 'center', fontSize: '30px', marginBottom: '40px', fontWeight: 700, textWrap: 'balance' },

  gridPassos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' },
  cardPasso: { padding: '10px' },
  numeroPasso: { fontSize: '28px', fontWeight: 800, color: 'var(--bb-border)' },

  gridRecursos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' },
  cardRecurso: { background: '#fff', border: '1px solid var(--bb-border)', borderRadius: '14px', padding: '22px' },
  iconeWrapper: { width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(37,84,235,0.1)', color: 'var(--bb-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  gridCasos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
  cardCaso: { border: '1px solid var(--bb-border)', borderRadius: '14px', padding: '24px', textAlign: 'center' },

  gridPlanos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' },
  cardPlano: { border: '1px solid var(--bb-border)', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column' },
  preco: { fontSize: '28px', fontWeight: 800, margin: '10px 0' },
  listaPlano: { fontSize: '13px', color: 'var(--bb-text-muted)', paddingLeft: '18px', flex: 1, margin: '0 0 16px' },
  ctaPlano: { textAlign: 'center', background: '#f4f6fb', color: 'var(--bb-gold)', padding: '10px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 },

  gridConfianca: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' },
  cardConfianca: { padding: '10px' },

  itemFaq: { padding: '16px 0', borderBottom: '1px solid var(--bb-border)', borderLeft: '2px solid transparent' },

  ctaFinal: { textAlign: 'center', padding: '70px 20px', background: 'linear-gradient(135deg, #173fb0, #2554eb)', margin: '0 20px', borderRadius: '24px' },
  ctaFinalBotao: { display: 'inline-block', background: '#fff', color: 'var(--bb-gold)', padding: '14px 30px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700 },

  footer: { padding: '50px 40px 30px', borderTop: '1px solid var(--bb-border)', marginTop: '40px' },
  footerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '30px', maxWidth: '1100px', margin: '0 auto' },
  footerTitulo: { fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--bb-text-muted)', marginBottom: '12px' },
  footerLink: { display: 'block', color: 'var(--bb-text)', textDecoration: 'none', fontSize: '14px', marginBottom: '8px' }
};

export default Landing;
