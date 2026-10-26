import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import { API_URL } from '../services/api';
import { recursosDoPlano } from '../utils/recursosPlano';
import { observarSecoes } from '../utils/analytics';
import { formatarReal, precoPromocionalPrimeiroMes, continuacaoCampanha } from '../utils/campanhaPlano';

// Landing comercial: fundo claro, tipografia de produto (Inter) e uma prévia do painel desenhada
// em HTML/CSS no lugar das partículas e do vídeo da versão anterior — carrega rápido em qualquer
// celular. Os data-track e data-track-secao mantêm os mesmos nomes de antes pra o funil de
// conversão (utils/analytics.js) continuar comparável.

const ICONES = {
  calendario: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  sino: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  conversa: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  coracao: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  grafico: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  caixa: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  pincel: <><circle cx="13.5" cy="6.5" r="2.5" /><path d="M17 2l4 4-9.5 9.5L7 17l1.5-4.5z" /><path d="M7 17c-1.5 0-3 1-3 3 0 .5 0 1 .5 1.5" /></>,
  predio: <><path d="M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18" /><path d="M2 22h20" /><path d="M10 7h1M13 7h1M10 11h1M13 11h1M10 15h1M13 15h1" /></>,
  escudo: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  cadeado: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  nuvem: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
  check: <polyline points="20 6 9 17 4 12" />,
  seta: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  fechar: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
};

function Icone({ nome, tamanho = 20 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}

const PASSOS = [
  { t: 'Crie sua conta', d: 'Cadastre seu negócio, seus profissionais e serviços em poucos minutos. Sem cartão de crédito.' },
  { t: 'Compartilhe seu link', d: 'Seu negócio ganha um endereço próprio. Coloque na bio do Instagram, no Google e no WhatsApp.' },
  { t: 'Receba agendamentos', d: 'O cliente escolhe profissional, serviço e horário sozinho, e você acompanha a agenda se preenchendo.' }
];

const RECURSOS = [
  { icone: 'calendario', t: 'Agenda online 24h', d: 'Cada profissional só aparece disponível quando realmente está. Sem conflito de horário.' },
  { icone: 'conversa', t: 'Agendamento pelo WhatsApp', d: 'Um assistente atende no seu WhatsApp e marca o horário direto na conversa.' },
  { icone: 'sino', t: 'Lembretes automáticos', d: 'E-mail e WhatsApp antes do horário, pra reduzir faltas e atrasos.' },
  { icone: 'coracao', t: 'Fidelidade e assinaturas', d: 'Planos mensais e campanhas de fidelidade pra quem volta sempre.' },
  { icone: 'grafico', t: 'Relatórios e financeiro', d: 'Faturamento, serviços mais vendidos e desempenho da equipe num só painel.' },
  { icone: 'caixa', t: 'Caixa e estoque', d: 'Finalize o atendimento, venda produtos e controle o estoque sem planilha.' },
  { icone: 'pincel', t: 'Sua marca, suas cores', d: 'Logo e cores do seu negócio na tela de agendamento dos seus clientes.' },
  { icone: 'predio', t: 'Várias unidades', d: 'Todas as filiais e equipes num painel só, cada uma com sua agenda.' }
];

const SEGMENTOS = [
  { nome: 'Barbearias', foto: '/images/casos/barbearia.jpg', d: 'Agenda por barbeiro, encaixes e plano de assinatura.' },
  { nome: 'Salões de beleza', foto: '/images/casos/salao.jpg', d: 'Vários profissionais e serviços combinados sem encavalar horário.' },
  { nome: 'Unhas, cílios e sobrancelha', foto: '/images/casos/estudio.jpg', d: 'Manutenções e retornos lembrados automaticamente.' },
  { nome: 'Estética e bem-estar', foto: '/images/casos/estetica.jpg', d: 'Histórico do cliente e sessões organizadas.' }
];
const OUTROS_SEGMENTOS = ['Estúdios de tatuagem', 'Clínicas e consultórios', 'Personal e aulas', 'Pet shops', 'Negócios com mais de um serviço'];

const FAQ = [
  { p: 'Preciso de cartão de crédito para começar?', r: 'Não. O plano Grátis não pede pagamento: você cadastra e começa a usar na hora.' },
  { p: 'Meus clientes precisam instalar algum aplicativo?', r: 'Não. O agendamento é feito pelo navegador, pelo seu link, ou direto no WhatsApp.' },
  { p: 'Serve para o meu tipo de negócio?', r: 'Serve para qualquer negócio que atende com hora marcada, inclusive quem oferece mais de um tipo de serviço no mesmo lugar.' },
  { p: 'Posso trocar de plano depois?', r: 'Sim, a qualquer momento, direto pelo painel administrativo.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim, sem multa e sem burocracia.' }
];

const NAV = [['#como-funciona', 'Como funciona'], ['#recursos', 'Recursos'], ['#para-quem', 'Para quem é'], ['#planos', 'Planos'], ['#faq', 'Dúvidas']];

// Prévia do produto: agenda do dia no painel + confirmação que o cliente recebe. Dados fictícios.
function PreviaProduto() {
  const linhas = [
    ['09:00', 'Lucas M.', 'Corte + barba', 'concluido', 'Concluído'],
    ['10:30', 'Ana P.', 'Escova', 'confirmado', 'Confirmado'],
    ['11:15', 'Rafa S.', 'Design de sobrancelha', 'confirmado', 'Confirmado'],
    ['14:00', 'Bruno C.', 'Corte', 'pendente', 'Aguardando'],
    ['15:30', 'Carla T.', 'Manicure', 'confirmado', 'Confirmado']
  ];
  return (
    <div className="lp-previa" aria-hidden="true">
      <div className="lp-janela">
        <div className="lp-janela-topo"><span /><span /><span /></div>
        <div className="lp-janela-corpo">
          <div className="lp-previa-cabeca">
            <div>
              <small>Agenda de hoje</small>
              <strong>Sexta, 14 de março</strong>
            </div>
            <div className="lp-previa-kpis">
              <div><b>12</b><small>agendados</small></div>
              <div><b>R$ 840</b><small>previsto</small></div>
            </div>
          </div>
          <ul className="lp-previa-lista">
            {linhas.map(([hora, nome, servico, status, rotulo]) => (
              <li key={hora}>
                <span className="lp-previa-hora">{hora}</span>
                <span className="lp-previa-cliente"><b>{nome}</b><small>{servico}</small></span>
                <span className={`lp-status lp-status-${status}`}>{rotulo}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="lp-flutuante lp-flutuante-confirma">
        <span className="lp-flutuante-icone"><Icone nome="check" tamanho={16} /></span>
        <div><b>Horário confirmado</b><small>Corte + barba · Sex, 16:30</small></div>
      </div>
      <div className="lp-flutuante lp-flutuante-whats">
        <small>WhatsApp · lembrete automático</small>
        <p>Oi, Ana! Passando pra lembrar do seu horário amanhã às 10h30. Até lá!</p>
      </div>
    </div>
  );
}

function Landing() {
  const [planos, setPlanos] = useState([]);
  const [depoimentos, setDepoimentos] = useState([]);
  const [faqAberto, setFaqAberto] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const [rolou, setRolou] = useState(false);

  const algumaCampanha = planos.some((pl) => continuacaoCampanha(pl));

  useEffect(() => observarSecoes(), []);
  useEffect(() => {
    fetch(`${API_URL}/planos-plataforma`)
      .then((r) => r.json())
      .then((d) => setPlanos(Array.isArray(d) ? d : []))
      .catch(() => setPlanos([]));
    // Relatos reais cadastrados no admin absoluto (backend routes/depoimentos.js). Sem nenhum, a
    // seção nem aparece.
    fetch(`${API_URL}/depoimentos`)
      .then((r) => r.json())
      .then((d) => setDepoimentos(Array.isArray(d) ? d : []))
      .catch(() => setDepoimentos([]));
  }, []);
  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  const fecharMenu = () => setMenuAberto(false);

  return (
    <div className="lp">
      <header className={`lp-topo${rolou ? ' rolou' : ''}`}>
        <div className="lp-container lp-topo-linha">
          <Link to="/" className="lp-logo"><img src="/icon-schednext.png" alt="SchedNext" /><span>Sched<b>Next</b></span></Link>
          <nav className="lp-nav" aria-label="Seções">
            {NAV.map(([href, rotulo]) => <a key={href} href={href}>{rotulo}</a>)}
          </nav>
          <div className="lp-topo-acoes">
            <Link to="/admin/login" data-track="menu_entrar" className="lp-link-entrar">Entrar</Link>
            <Link to="/cadastrar" data-track="menu_criar_conta" className="lp-btn lp-btn-primario lp-btn-p">Teste grátis</Link>
            <button type="button" className="lp-menu-botao" onClick={() => setMenuAberto((v) => !v)} aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuAberto}>
              <Icone nome={menuAberto ? 'fechar' : 'menu'} tamanho={22} />
            </button>
          </div>
        </div>
        {menuAberto && (
          <nav className="lp-menu-celular" aria-label="Menu">
            {NAV.map(([href, rotulo]) => <a key={href} href={href} onClick={fecharMenu}>{rotulo}</a>)}
            <Link to="/admin/login" data-track="menu_entrar" onClick={fecharMenu}>Entrar</Link>
            <Link to="/cadastrar" data-track="menu_criar_conta" className="lp-btn lp-btn-primario" onClick={fecharMenu}>Criar conta grátis</Link>
          </nav>
        )}
      </header>

      <main>
        <section data-track-secao="1_topo" className="lp-hero">
          <div className="lp-container lp-hero-grade">
            <div className="lp-hero-texto">
              <span className="lp-selo">Agenda online + WhatsApp para negócios de hora marcada</span>
              <h1>Sua agenda cheia, sem parar o atendimento.</h1>
              <p className="lp-hero-sub">
                Seus clientes agendam sozinhos pelo seu link ou pelo WhatsApp, recebem lembrete automático e você acompanha tudo num painel só.
              </p>
              <div className="lp-hero-acoes">
                <Link to="/cadastrar" data-track="hero_criar_conta" className="lp-btn lp-btn-primario lp-btn-g">Começar grátis <Icone nome="seta" tamanho={18} /></Link>
                <a href="#como-funciona" data-track="hero_ver_como_funciona" className="lp-btn lp-btn-secundario lp-btn-g">Ver como funciona</a>
              </div>
              <ul className="lp-hero-garantias">
                <li><Icone nome="check" tamanho={16} /> Sem cartão de crédito</li>
                <li><Icone nome="check" tamanho={16} /> Pronto em minutos</li>
                <li><Icone nome="check" tamanho={16} /> Cancele quando quiser</li>
              </ul>
            </div>
            <PreviaProduto />
          </div>
        </section>

        <section className="lp-faixa">
          <div className="lp-container lp-faixa-grade">
            <div><b>24 horas</b><span>sua agenda aberta, inclusive de madrugada</span></div>
            <div><b>Sem app</b><span>o cliente agenda pelo navegador ou WhatsApp</span></div>
            <div><b>Menos faltas</b><span>com lembretes automáticos antes do horário</span></div>
            <div><b>Tudo junto</b><span>agenda, caixa, estoque e relatórios</span></div>
          </div>
        </section>

        <section id="como-funciona" data-track-secao="2_como_funciona" className="lp-secao">
          <div className="lp-container">
            <div className="lp-cabeca">
              <span className="lp-sobretitulo">Como funciona</span>
              <h2>Comece a receber agendamentos hoje</h2>
              <p>Três passos e o seu negócio já está aberto pra agendamento online.</p>
            </div>
            <ol className="lp-passos">
              {PASSOS.map((p, i) => (
                <li key={p.t}>
                  <span className="lp-passo-num">{i + 1}</span>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="recursos" data-track-secao="3_recursos" className="lp-secao lp-secao-cinza">
          <div className="lp-container">
            <div className="lp-cabeca">
              <span className="lp-sobretitulo">Recursos</span>
              <h2>Tudo que o seu negócio precisa num só lugar</h2>
              <p>Da marcação do horário ao fechamento do caixa, sem planilha e sem caderno.</p>
            </div>
            <div className="lp-recursos">
              {RECURSOS.map((r) => (
                <div key={r.t} className="lp-recurso">
                  <span className="lp-recurso-icone"><Icone nome={r.icone} /></span>
                  <h3>{r.t}</h3>
                  <p>{r.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="para-quem" data-track-secao="4_casos_de_uso" className="lp-secao">
          <div className="lp-container">
            <div className="lp-cabeca">
              <span className="lp-sobretitulo">Para quem é</span>
              <h2>Feito para qualquer negócio de hora marcada</h2>
              <p>Inclusive quem oferece mais de um serviço no mesmo lugar, como barbearia e tatuagem.</p>
            </div>
            <div className="lp-segmentos">
              {SEGMENTOS.map((sg) => (
                <article key={sg.nome} className="lp-segmento">
                  <div className="lp-segmento-foto" style={{ backgroundImage: `url(${sg.foto})` }} />
                  <div className="lp-segmento-texto">
                    <h3>{sg.nome}</h3>
                    <p>{sg.d}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="lp-outros">
              <span>Também atende:</span>
              {OUTROS_SEGMENTOS.map((o) => <span key={o} className="lp-chip">{o}</span>)}
            </div>
          </div>
        </section>

        {depoimentos.length > 0 && (
          <section id="depoimentos" className="lp-secao lp-secao-cinza">
            <div className="lp-container">
              <div className="lp-cabeca">
                <span className="lp-sobretitulo">Depoimentos</span>
                <h2>Quem usa, recomenda</h2>
                <p>O que dizem os negócios que já organizam a agenda com o SchedNext.</p>
              </div>
              <div className="lp-depoimentos">
                {depoimentos.map((d) => (
                  <figure key={d.id} className="lp-depoimento">
                    <div className="lp-estrelas" aria-label={`Nota ${d.nota || 5} de 5`}>
                      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= (d.nota || 5) ? 'cheia' : ''}>★</span>)}
                    </div>
                    <blockquote>“{d.texto}”</blockquote>
                    <figcaption>
                      {d.foto_url
                        ? <img src={d.foto_url} alt="" className="lp-depoimento-foto" loading="lazy" />
                        : <span className="lp-depoimento-inicial" aria-hidden="true">{(d.nome || '?').trim().charAt(0).toUpperCase()}</span>}
                      <span>
                        <b>{d.nome}</b>
                        <small>{[d.negocio, d.cidade].filter(Boolean).join(' · ')}</small>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="planos" data-track-secao="5_planos" className={`lp-secao${depoimentos.length > 0 ? '' : ' lp-secao-cinza'}`}>
          <div className="lp-container">
            <div className="lp-cabeca">
              <span className="lp-sobretitulo">Planos</span>
              <h2>Do primeiro cliente à rede de unidades</h2>
              <p>Comece grátis e mude de plano quando precisar, direto pelo painel.</p>
            </div>
            <div className="lp-planos">
              {planos.map((p) => {
                const destaque = p.nome === 'Profissional';
                return (
                  <div key={p.id} className={`lp-plano${destaque ? ' destaque' : ''}`}>
                    {destaque && <span className="lp-plano-selo">Mais escolhido</span>}
                    <h3>{p.nome}</h3>
                    <div className="lp-plano-preco">
                      {p.preco_mensal == null ? <span className="lp-plano-consulta">Sob consulta</span> : precoPromocionalPrimeiroMes(p) != null ? (
                        <><small>R$</small><b>{formatarReal(precoPromocionalPrimeiroMes(p))}</b><small>no 1º mês</small></>
                      ) : (
                        <><small>R$</small><b>{p.preco_mensal === 0 ? '0' : Number(p.preco_mensal).toFixed(2).replace('.', ',')}</b>{p.preco_mensal > 0 && <small>/mês</small>}</>
                      )}
                    </div>
                    {algumaCampanha && <p className="lp-plano-promo">{continuacaoCampanha(p) || ' '}</p>}
                    <Link to="/cadastrar" data-track={`plano_comecar_${p.nome}`} className={`lp-btn lp-btn-bloco ${destaque ? 'lp-btn-primario' : 'lp-btn-secundario'}`}>Começar</Link>
                    <ul>
                      {p.dias_teste > 0 && <li><Icone nome="check" tamanho={16} />{p.dias_teste} dias de teste grátis</li>}
                      <li><Icone nome="check" tamanho={16} />{p.limite_profissionais == null ? 'Profissionais ilimitados' : `Até ${p.limite_profissionais} profissional(is)`}</li>
                      <li><Icone nome="check" tamanho={16} />{p.limite_agendamentos_mes == null ? 'Agendamentos ilimitados/mês' : `Até ${p.limite_agendamentos_mes} agendamentos/mês`}</li>
                      {recursosDoPlano(p).map((r) => <li key={r}><Icone nome="check" tamanho={16} />{r}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section data-track-secao="6_confianca" className="lp-secao">
          <div className="lp-container lp-confianca">
            {[
              ['escudo', 'Dados de cada negócio isolados', 'Cada empresa só enxerga os próprios clientes e agendamentos. Senhas guardadas com criptografia.'],
              ['cadeado', 'Conexão criptografada', 'Todo o tráfego entre seus clientes e o SchedNext usa HTTPS de ponta a ponta.'],
              ['nuvem', 'Backups automáticos', 'Sua agenda e o histórico dos clientes ficam seguros mesmo se algo der errado.']
            ].map(([icone, t, d]) => (
              <div key={t} className="lp-confianca-item">
                <span className="lp-recurso-icone"><Icone nome={icone} /></span>
                <div><h3>{t}</h3><p>{d}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" data-track-secao="7_faq" className="lp-secao lp-secao-cinza">
          <div className="lp-container lp-container-estreito">
            <div className="lp-cabeca">
              <span className="lp-sobretitulo">Dúvidas</span>
              <h2>Perguntas frequentes</h2>
            </div>
            <div className="lp-faq">
              {FAQ.map((f, i) => (
                <div key={f.p} className={`lp-faq-item${faqAberto === i ? ' aberto' : ''}`}>
                  <button type="button" onClick={() => setFaqAberto(faqAberto === i ? -1 : i)} aria-expanded={faqAberto === i}>
                    {f.p}<span className="lp-faq-mais" aria-hidden="true" />
                  </button>
                  {faqAberto === i && <p>{f.r}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-track-secao="8_chamada_final" className="lp-cta">
          <div className="lp-container lp-cta-conteudo">
            <h2>Abra sua agenda online hoje</h2>
            <p>Crie sua conta grátis, cadastre seus serviços e compartilhe o link com seus clientes.</p>
            <Link to="/cadastrar" data-track="cta_final_criar_conta" className="lp-btn lp-btn-branco lp-btn-g">Criar conta grátis <Icone nome="seta" tamanho={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="lp-rodape">
        <div className="lp-container lp-rodape-grade">
          <div>
            <img src="/logo-schednext.png" alt="SchedNext" className="lp-rodape-logo" />
            <p>Agenda online e WhatsApp para negócios de hora marcada.</p>
          </div>
          <div>
            <h4>Produto</h4>
            <a href="#recursos" data-track="rodape_recursos">Recursos</a>
            <a href="#planos" data-track="rodape_planos">Planos</a>
            <Link to="/cadastrar" data-track="rodape_criar_conta">Criar conta</Link>
          </div>
          <div>
            <h4>Ajuda</h4>
            <a href="#faq" data-track="rodape_faq">Dúvidas</a>
            <Link to="/docs" data-track="rodape_docs">Documentação</Link>
            <Link to="/admin/login" data-track="rodape_entrar">Entrar</Link>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="/legal/termos-de-uso.pdf" data-track="rodape_termos" target="_blank" rel="noopener noreferrer">Termos de uso</a>
            <a href="/legal/politica-de-privacidade.pdf" data-track="rodape_privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a>
          </div>
        </div>
        <div className="lp-container lp-rodape-base">
          <span>© {new Date().getFullYear()} SchedNext. Todos os direitos reservados.</span>
          <span className="lp-creditos">
            Fotos: <a href="https://commons.wikimedia.org/wiki/File:Caleb%27s_Chop_Shop.jpg" target="_blank" rel="noopener noreferrer">Tamanoeconomico</a>,{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Hair_salon_(51212326557).jpg" target="_blank" rel="noopener noreferrer">Hair Spies</a>,{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Acrylic_nails,_Salon_Sagesse.jpg" target="_blank" rel="noopener noreferrer">Naica Dumeny</a> via Wikimedia Commons (CC BY / CC BY-SA)
          </span>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
