import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import './Docs.css';

// Documentação pública do produto (schednext.com.br/docs). Mesma paleta/fonte da Landing (ver
// CORES ali) — página própria porque o layout é bem diferente (índice + conteúdo em vez de
// seções de marketing), mas reaproveita as classes de hover/transição de Landing.css.

const INDICE = [
  {
    grupo: 'Começando',
    itens: [
      { id: 'visao-geral', titulo: 'Visão geral' },
      { id: 'primeiros-passos', titulo: 'Primeiros passos' }
    ]
  },
  {
    grupo: 'No dia a dia',
    itens: [
      { id: 'agenda', titulo: 'Agenda e atendimentos' },
      { id: 'equipe-servicos', titulo: 'Equipe e serviços' },
      { id: 'clientes', titulo: 'Clientes' },
      { id: 'assinatura-cliente', titulo: 'Assinatura do cliente final' },
      { id: 'estoque-pdv', titulo: 'Estoque e finalização de atendimento' },
      { id: 'pagamentos', titulo: 'Pagamentos e Pix' },
      { id: 'relatorios', titulo: 'Relatórios' },
      { id: 'acoes-fidelidade', titulo: 'Ações e fidelidade' },
      { id: 'ia-painel', titulo: 'IA no painel administrativo' },
      { id: 'suporte', titulo: 'Suporte' }
    ]
  },
  {
    grupo: 'Bot de WhatsApp',
    itens: [
      { id: 'whatsapp-conectar', titulo: 'Conectando o WhatsApp' },
      { id: 'whatsapp-guiado', titulo: 'Modo guiado' },
      { id: 'whatsapp-livre', titulo: 'Modo livre (agente de IA)' },
      { id: 'whatsapp-personalidade', titulo: 'Personalidade do assistente' },
      { id: 'whatsapp-resumo-profissionais', titulo: 'Resumo diário para profissionais' },
      { id: 'whatsapp-pix', titulo: 'Pagamento via bot' }
    ]
  },
  {
    grupo: 'Recursos avançados',
    itens: [
      { id: 'multiplas-unidades', titulo: 'Múltiplas unidades' },
      { id: 'dominio-proprio', titulo: 'Domínio próprio' }
    ]
  },
  {
    grupo: 'API pública',
    itens: [
      { id: 'api-visao-geral', titulo: 'Visão geral e autenticação' },
      { id: 'api-profissionais', titulo: 'GET /profissionais' },
      { id: 'api-servicos', titulo: 'GET /servicos' },
      { id: 'api-disponibilidade', titulo: 'GET /disponibilidade' },
      { id: 'api-agendamentos', titulo: 'POST /agendamentos' },
      { id: 'api-erros', titulo: 'Erros e limites' }
    ]
  },
  {
    grupo: 'Referência',
    itens: [
      { id: 'planos', titulo: 'Planos e recursos' },
      { id: 'seguranca', titulo: 'Segurança e privacidade' },
      { id: 'faq', titulo: 'Perguntas frequentes' }
    ]
  }
];

const TODOS_IDS = INDICE.flatMap((g) => g.itens.map((i) => i.id));

function useSecaoAtiva() {
  const [ativa, setAtiva] = useState(TODOS_IDS[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visiveis.length > 0) setAtiva(visiveis[0].target.id);
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );
    TODOS_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return ativa;
}

function Badge({ tipo }) {
  if (tipo === 'pro') return <span className="doc-badge doc-badge-pro">Profissional+</span>;
  if (tipo === 'ent') return <span className="doc-badge doc-badge-ent">Enterprise</span>;
  return <span className="doc-badge doc-badge-todos">Todos os planos</span>;
}

function Docs() {
  const secaoAtiva = useSecaoAtiva();

  return (
    <div style={s.pagina}>
      <header style={s.header}>
        <Link to="/"><img src="/logo-schednext.png" alt="SchedNext" style={s.logoHeader} /></Link>
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link to="/" className="ln-nav-link" style={s.linkHeader}>Início</Link>
          <Link to="/admin/login" className="ln-nav-link" style={s.linkHeader}>Entrar</Link>
          <Link to="/cadastrar" className="ln-cta-primary" style={s.btnHeader}>Criar conta grátis</Link>
        </nav>
      </header>

      <div className="doc-hero">
        <h1>Documentação do SchedNext</h1>
        <p>Tudo sobre como configurar sua agenda, atender seus clientes e usar o bot de WhatsApp com IA, do primeiro cadastro aos recursos mais avançados.</p>
      </div>

      <div className="doc-layout">
        <aside className="doc-sidebar" aria-label="Índice">
          {INDICE.map((grupo) => (
            <div key={grupo.grupo} className="doc-nav-grupo">
              <p className="doc-nav-grupo-titulo">{grupo.grupo}</p>
              {grupo.itens.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`doc-nav-link ${secaoAtiva === item.id ? 'doc-nav-ativo' : ''}`}
                >
                  {item.titulo}
                </a>
              ))}
            </div>
          ))}
        </aside>

        <main className="doc-conteudo">

          {/* ===================== VISÃO GERAL ===================== */}
          <section id="visao-geral" className="doc-secao">
            <span className="doc-secao-eyebrow">Começando</span>
            <h2>Visão geral</h2>
            <p className="doc-intro">
              O SchedNext é uma plataforma de agendamento online multi-negócio: cada empresa que se cadastra ganha sua própria
              agenda, seu próprio painel administrativo e sua própria página (ou subdomínio) para os clientes marcarem horário,
              tudo isolado dos demais negócios que usam a plataforma.
            </p>
            <p>Funciona bem para negócios que atendem por hora marcada com um ou mais profissionais: barbearias, salões de beleza, estúdios de unhas, e outros formatos parecidos.</p>
            <p>Existem três "papéis" dentro do sistema:</p>
            <ul>
              <li><strong>Cliente final</strong>: quem agenda um horário, pelo site do negócio ou pelo WhatsApp.</li>
              <li><strong>Admin da empresa</strong>: o dono ou gerente do negócio, que configura agenda, equipe, serviços e acompanha tudo pelo painel.</li>
              <li><strong>Admin de unidade</strong> (só em negócios com múltiplas filiais): um login restrito à agenda e equipe de uma unidade específica.</li>
            </ul>
          </section>

          {/* ===================== PRIMEIROS PASSOS ===================== */}
          <section id="primeiros-passos" className="doc-secao">
            <h2>Primeiros passos</h2>
            <p className="doc-intro">Da criação da conta ao primeiro agendamento recebido, em poucos minutos.</p>

            <div className="doc-passo">
              <span className="doc-passo-num">1</span>
              <div>
                <h3 style={{ margin: 0 }}>Crie sua conta</h3>
                <p>Em <Link to="/cadastrar">schednext.com.br/cadastrar</Link>, escolha o nome do seu negócio e o tipo de serviço (barbearia, salão, estúdio de unhas ou genérico). Não pede cartão de crédito, o plano Grátis já é suficiente pra começar.</p>
              </div>
            </div>
            <div className="doc-passo">
              <span className="doc-passo-num">2</span>
              <div>
                <h3 style={{ margin: 0 }}>Configure horário, equipe e serviços</h3>
                <p>Defina o horário de funcionamento por dia da semana, cadastre os profissionais que atendem e os serviços que oferecem (com preço e duração).</p>
              </div>
            </div>
            <div className="doc-passo">
              <span className="doc-passo-num">3</span>
              <div>
                <h3 style={{ margin: 0 }}>Compartilhe seu link</h3>
                <p>Todo negócio ganha uma página própria (subdomínio, ex: <code>seunegocio.schednext.com.br</code>) onde o cliente escolhe profissional, serviço e horário sozinho, sem precisar ligar.</p>
              </div>
            </div>
            <div className="doc-passo">
              <span className="doc-passo-num">4</span>
              <div>
                <h3 style={{ margin: 0 }}>(Opcional) Conecte o WhatsApp</h3>
                <p>Se o seu plano incluir o bot de WhatsApp, conecte um número em <em>Admin → WhatsApp</em> e seus clientes passam a poder agendar também por lá. Ver a seção <a href="#whatsapp-conectar">Bot de WhatsApp</a>.</p>
              </div>
            </div>
          </section>

          {/* ===================== AGENDA ===================== */}
          <section id="agenda" className="doc-secao">
            <h2>Agenda e atendimentos</h2>
            <p className="doc-intro">O painel de agenda mostra os horários do dia por profissional, evitando overbooking: um horário só aparece disponível pra marcação quando realmente está livre.</p>
            <p>Pelo painel de agendamentos, o admin pode:</p>
            <ul>
              <li>Criar, remarcar ou cancelar um agendamento manualmente (ex: cliente que ligou em vez de marcar pelo site).</li>
              <li>Ver o histórico de um cliente e seus agendamentos futuros.</li>
              <li>Registrar o motivo de um cancelamento (útil pra entender faltas e desistências ao longo do tempo).</li>
            </ul>
            <p>A disponibilidade considera três coisas ao mesmo tempo: o horário de funcionamento configurado pro dia da semana, o tamanho do bloco de cada serviço (dois serviços de durações diferentes não "colidem" só porque começam em horários próximos, é checada a sobreposição real dos intervalos) e o instante atual — um horário mais cedo do que agora, no dia de hoje, nunca aparece como disponível, mesmo que ainda esteja livre no papel.</p>
            <p>O mesmo motor de disponibilidade (checar horário livre, respeitar o horário de funcionamento, evitar dois agendamentos que se sobrepõem pro mesmo profissional) é usado no site, no bot de WhatsApp e na <a href="#api-visao-geral">API pública</a>. Não existem lógicas de agenda diferentes rodando em paralelo entre esses canais.</p>
          </section>

          {/* ===================== EQUIPE E SERVIÇOS ===================== */}
          <section id="equipe-servicos" className="doc-secao">
            <h2>Equipe e serviços</h2>
            <p className="doc-intro">Cada profissional cadastrado tem sua própria agenda dentro do negócio, e cada serviço tem preço e duração próprios. A duração é o que define o tamanho do "bloco" reservado na agenda.</p>
            <p>É possível ativar ou desativar um profissional ou serviço a qualquer momento — enquanto inativo, ele só deixa de aparecer como opção pra novos agendamentos (site, bot e API pública), sem apagar nada do que já foi feito com ele.</p>
            <p>Excluir de verdade (não apenas desativar) é bloqueado automaticamente pelo sistema quando o profissional ou serviço já tem algum agendamento no histórico — nesse caso o painel avisa e sugere desativar em vez de excluir, exatamente pra garantir que o histórico de atendimentos antigos (e os relatórios que dependem dele) nunca fique com uma referência quebrada.</p>
          </section>

          {/* ===================== CLIENTES ===================== */}
          <section id="clientes" className="doc-secao">
            <h2>Clientes</h2>
            <p className="doc-intro">Toda pessoa que agenda um horário (pelo site ou pelo WhatsApp) fica registrada como cliente do negócio, com histórico de atendimentos.</p>
            <p>No cadastro de um cliente, o admin pode:</p>
            <ul>
              <li>Editar nome, telefone, e-mail, data de nascimento e anotações internas.</li>
              <li>Ver o extrato completo do cliente: todos os atendimentos e cobranças de assinatura, exportável.</li>
              <li>Marcar manualmente como assinante de um plano, sem depender de o cliente contratar sozinho pelo site (ver <a href="#assinatura-cliente">Assinatura do cliente final</a>).</li>
              <li>Excluir o cadastro por completo, se necessário.</li>
            </ul>
            <h3>Risco de falta <Badge tipo="none" /></h3>
            <p>Cada cliente com pelo menos 3 atendimentos no histórico ganha uma classificação automática de risco de não comparecer (baixo, médio ou alto), calculada pela proporção de atendimentos passados que foram cancelados ou nunca confirmados como concluídos. Sem histórico suficiente, a classificação fica como "indefinido" em vez de arriscar um chute. Não usa IA, é uma regra fixa sobre o histórico real.</p>
            <h3>Reengajamento de clientes sumidos <Badge tipo="pro" /></h3>
            <p>Pra negócios com IA liberada no plano, o painel de clientes ajuda a montar uma mensagem de "sentimos sua falta" personalizada pra um cliente que não aparece há um tempo, sugerida por IA a partir do histórico dele — o envio em si é sempre uma ação manual do admin, a IA só ajuda a escrever o texto.</p>
          </section>

          {/* ===================== ASSINATURA DO CLIENTE FINAL ===================== */}
          <section id="assinatura-cliente" className="doc-secao">
            <h2>Assinatura do cliente final</h2>
            <p className="doc-intro">Além do agendamento avulso, o admin pode criar planos de assinatura mensal pros próprios clientes (ex: "plano ilimitado de cortes"), com nome, preço e uma lista de serviços cobertos — cada serviço pode ter um limite de usos por mês, ou ficar ilimitado dentro do plano.</p>
            <p>Vincular um plano a um cliente (pelo próprio cliente no site, ou manualmente pelo admin) sempre começa com a assinatura no status <strong>pendente</strong> — ela nunca nasce "em dia" sozinha. Só vira <strong>em dia</strong> (o único status que libera o preço de assinante no checkout) depois de uma cobrança confirmada ou de uma baixa manual do admin. Não existe período de teste ou carência: o primeiro mês pode perfeitamente ser cobrado pessoalmente, sem nenhuma cobrança automática configurada.</p>
            <h3>Cobrança automática</h3>
            <ul>
              <li><strong>No cartão</strong>: o cliente autoriza uma vez (preapproval do Mercado Pago) e a cobrança se repete sozinha todo ciclo, confirmada automaticamente.</li>
              <li><strong>No Pix</strong>: gerado a cada ciclo (o Mercado Pago não tem Pix recorrente de verdade), pelo admin ou pelo próprio cliente no site.</li>
            </ul>
            <p>O ciclo de cobrança é ancorado na data em que o cliente assinou, não no calendário (o vencimento de quem assinou dia 8 continua caindo por volta do dia 8 todo mês). O admin pode reancorar manualmente o vencimento; se a cobrança for no cartão, isso exige cancelar a autorização antiga e mandar um novo link de autorização pro cliente, e a assinatura volta pra "pendente" até ele autorizar de novo.</p>
            <h3>Inadimplência</h3>
            <p>Se uma cobrança Pix vence sem pagamento, ou uma cobrança no cartão falha, a assinatura vira <strong>inadimplente</strong> automaticamente. O cadastro do cliente e o plano continuam intactos, mas o preço/benefício de assinante fica suspenso no checkout até regularizar (nova cobrança confirmada ou baixa manual) — o atendimento volta a ser cobrado no valor cheio nesse meio-tempo.</p>
          </section>

          {/* ===================== ESTOQUE E PDV ===================== */}
          <section id="estoque-pdv" className="doc-secao">
            <h2>Estoque e finalização de atendimento</h2>
            <p className="doc-intro">Na hora de fechar um atendimento, o admin abre o painel "Vender produtos de estoque" e não fica limitado ao valor do serviço agendado.</p>
            <ul>
              <li><strong>Produtos vendidos</strong>: o negócio mantém um estoque simples (nome, preço e quantidade — ex: pomada, shampoo) e pode adicionar itens vendidos junto do atendimento. Entram automaticamente no valor final e dão baixa na quantidade em estoque.</li>
              <li><strong>Serviços adicionais</strong>: serviços extras feitos na hora (não pré-agendados) também entram no fechamento.</li>
              <li><strong>Pagamento dividido</strong>: o valor final pode ser cobrado em até duas formas de pagamento na mesma finalização (ex: metade no dinheiro, metade no Pix). A soma das duas precisa bater exatamente com o total, e no máximo uma das duas pode ser Pix, que precisa já estar confirmado como aprovado antes de fechar o atendimento.</li>
            </ul>
            <p>O valor final é sempre recalculado no servidor no momento de fechar (nunca confia no valor que a tela envia), e qualquer Pix envolvido é reconfirmado direto com o Mercado Pago antes de aceitar. Evita a situação de cobrar um valor e fechar o caixa com outro.</p>
            <h3>Movimentação de estoque</h3>
            <p>Toda entrada ou saída de produto (venda, reposição, perda, ajuste) passa por um registro de movimentação com justificativa, processado de forma atômica no banco — duas vendas do mesmo produto ao mesmo tempo não causam contagem errada, e o sistema nunca deixa a quantidade em estoque ficar negativa: se não tem saldo suficiente, a saída é recusada. Existe um relatório de auditoria com todas as movimentações de um período, pra rastrear exatamente quando e por que o estoque de um item mudou.</p>
            <h3>Login de balcão <Badge tipo="none" /></h3>
            <p>Além do login de admin, é possível criar um acesso restrito só ao PDV (autenticado com senha própria, criado pelo admin) pra um colaborador de balcão fechar atendimentos e vender produtos sem enxergar o resto do painel administrativo — configurações, relatórios financeiros e as demais telas continuam fora do alcance desse login.</p>
          </section>

          {/* ===================== PAGAMENTOS ===================== */}
          <section id="pagamentos" className="doc-secao">
            <h2>Pagamentos e Pix</h2>
            <p className="doc-intro">O SchedNext usa o Mercado Pago como gateway de pagamento. Cada negócio conecta sua própria conta (Admin → Mercado Pago), e o dinheiro cai direto lá, nunca passando pela SchedNext.</p>
            <h3>Onde o Pix aparece</h3>
            <ul>
              <li>Na finalização de um atendimento (PDV), avulso ou dividido com outra forma de pagamento.</li>
              <li>Na assinatura mensal de um cliente final, quando ele opta por pagar por Pix em vez de cartão.</li>
              <li>No bot de WhatsApp, como pagamento antecipado opcional logo após confirmar um agendamento. Ver <a href="#whatsapp-pix">Pagamento via bot</a>.</li>
            </ul>
            <h3>Taxa da plataforma</h3>
            <p>Uma pequena porcentagem de cada Pix cobrado fica retida automaticamente como taxa da SchedNext (a própria API do Mercado Pago desconta na hora, sem o negócio precisar repassar nada manualmente). O percentual varia por plano, planos superiores têm taxa menor ou zero.</p>
            <h3>Taxa por forma de pagamento (maquininha)</h3>
            <p>Em separado da taxa da plataforma, o admin pode configurar em <em>Admin → Taxas de pagamento</em> o percentual que a operadora de cartão (ou outra taxa qualquer) cobra em cima de cada forma de pagamento — dinheiro, crédito, débito e Pix. Isso não muda o que é cobrado do cliente: serve só pra calcular corretamente o <strong>faturamento líquido</strong> nos <a href="#relatorios">relatórios</a>.</p>
          </section>

          {/* ===================== RELATÓRIOS ===================== */}
          <section id="relatorios" className="doc-secao">
            <h2>Relatórios</h2>
            <p className="doc-intro">O painel de relatórios dá visão financeira do negócio sem precisar de planilha paralela, com filtro por período, por serviço e por tipo de cliente (assinante ou avulso), e agrupamento por dia, mês ou ano.</p>
            <h3>Resumo do período</h3>
            <ul>
              <li><strong>Faturamento total</strong>: soma de atendimentos concluídos e mensalidades de assinatura pagas no período.</li>
              <li><strong>Faturamento líquido</strong>: o mesmo total já descontando a taxa da maquininha configurada por forma de pagamento (ver <a href="#pagamentos">Pagamentos e Pix</a>). Um Pix cobrado pelo QR Code do SchedNext usa a taxa real registrada na confirmação do pagamento; um Pix marcado manualmente como "pago por fora" entra com taxa zero.</li>
              <li><strong>Ticket médio</strong>, calculado só sobre atendimentos avulsos (mensalidades de assinatura não entram nessa média).</li>
              <li><strong>Atendimentos concluídos</strong> e <strong>taxa de cancelamento</strong> do período.</li>
              <li><strong>Descontos por taxa</strong>, o valor e o percentual que a maquininha reteve, como métrica separada.</li>
              <li>Comparação com o período anterior de mesma duração, e um gráfico de faturamento por dia.</li>
            </ul>
            <h3>Comissionamento por profissional</h3>
            <p>Disponível em qualquer plano pago, sem precisar de nenhum recurso avançado. Um atendimento avulso gera comissão sobre o valor efetivamente pago. Já um atendimento de cliente assinante, usando um serviço coberto pelo plano dele, gera comissão sobre uma <strong>fração proporcional da mensalidade</strong> — o preço do plano dividido pela quantidade de visitas cobertas naquele ciclo de cobrança do cliente — em vez de contar como "atendimento de graça" pro profissional.</p>
            <h3>Camada avançada <Badge tipo="pro" /></h3>
            <p>Serviços mais vendidos e profissionais com melhor desempenho (top 10 por faturamento no período), além da taxa de recorrência: o percentual de clientes atendidos no período que já tinham pelo menos um atendimento concluído antes dele começar.</p>
            <p>Tudo pode ser exportado em CSV ou num PDF completo (as tabelas da camada avançada só entram no PDF pra quem tem esse recurso liberado no plano).</p>
          </section>

          {/* ===================== AÇÕES E FIDELIDADE ===================== */}
          <section id="acoes-fidelidade" className="doc-secao">
            <h2>Ações e fidelidade</h2>
            <p className="doc-intro">Em <em>Admin → Ações</em>, o negócio cria campanhas de fidelidade com prazo definido: um nome, data de início e fim, uma meta de atendimentos concluídos no período (ex: "5 cortes"), um gasto mínimo opcional por atendimento pra ele contar pra meta, e uma recompensa (serviço grátis, produto grátis ou desconto — descrita em texto livre pelo admin, ex: "10% de desconto no próximo corte").</p>
            <p><strong>Só uma campanha fica ativa por vez</strong>: criar ou reativar uma campanha desativa automaticamente qualquer outra que estivesse ativa. O progresso de cada cliente é contado a partir dos atendimentos concluídos dele dentro da janela da campanha que batem o gasto mínimo.</p>
            <p>Quando um cliente bate a meta, a recompensa é liberada <strong>automaticamente</strong>, logo depois que o atendimento é fechado no caixa — o cliente é avisado por e-mail (e por WhatsApp, se o plano incluir o bot), sem o admin precisar acompanhar manualmente. Cada cliente só é avisado uma vez por campanha, mesmo que continue batendo a meta depois.</p>
            <p>Campanhas podem ser pausadas, reativadas ou excluídas a qualquer momento. Negócios com IA liberada no plano <Badge tipo="pro" /> ainda contam com uma sugestão de campanha (nome, meta e recompensa) gerada a partir do faturamento e da frequência de atendimentos dos últimos 30 dias — a IA só preenche a sugestão, quem cria a campanha de fato é o admin.</p>
          </section>

          {/* ===================== IA NO PAINEL ===================== */}
          <section id="ia-painel" className="doc-secao">
            <h2>IA no painel administrativo <Badge tipo="pro" /></h2>
            <p className="doc-intro">Além do bot de WhatsApp, negócios com IA liberada no plano (Profissional e Enterprise) contam com alguns atalhos de IA espalhados pelo painel, todos no mesmo espírito: economizar tempo de redação, nunca decidir algo no lugar do admin.</p>
            <ul>
              <li><strong>Resumo do dashboard</strong>: um parágrafo em texto corrido explicando como o negócio está indo, gerado a partir dos números reais do painel.</li>
              <li><strong>Resumo de relatório</strong>: a mesma ideia aplicada a um período específico de relatório.</li>
              <li><strong>Descrição de serviço</strong>: gera um texto de descrição a partir só do nome do serviço, na hora de cadastrar um novo.</li>
              <li><strong>Sugestão de campanha de fidelidade</strong>, ver <a href="#acoes-fidelidade">Ações e fidelidade</a>.</li>
              <li><strong>Mensagem de reengajamento</strong> pra um cliente sumido, ver <a href="#clientes">Clientes</a>.</li>
            </ul>
            <p>Em todos os casos, a IA só gera um rascunho de texto a partir de dados reais já existentes no sistema — o admin sempre revisa (e pode editar) antes de qualquer coisa ser usada ou enviada.</p>
          </section>

          {/* ===================== SUPORTE ===================== */}
          <section id="suporte" className="doc-secao">
            <h2>Suporte <Badge tipo="pro" /></h2>
            <p className="doc-intro">O botão de interrogação flutuante, disponível em qualquer tela do painel, abre um chat com IA treinada no próprio SchedNext pra negócios nos planos Profissional e Enterprise. Se a resposta automática não resolver, um clique em "Falar com o time" encaminha a conversa direto pro time da SchedNext, que responde ali mesmo, sem precisar abrir outro canal.</p>
            <p>O mesmo botão guarda o histórico completo de conversas anteriores, mesmo já resolvidas. Nos demais planos (Grátis e Essencial), o suporte continua disponível por e-mail, mostrado no mesmo lugar.</p>
          </section>

          {/* ===================== WHATSAPP: CONECTAR ===================== */}
          <section id="whatsapp-conectar" className="doc-secao">
            <span className="doc-secao-eyebrow">Bot de WhatsApp</span>
            <h2>Conectando o WhatsApp <Badge tipo="pro" /></h2>
            <p className="doc-intro">O bot de agendamento por WhatsApp funciona com um número de WhatsApp de verdade conectado ao negócio (não é o WhatsApp Business API oficial da Meta, funciona com qualquer número, sem precisar de CNPJ ou aprovação da Meta).</p>
            <div className="doc-passo">
              <span className="doc-passo-num">1</span>
              <div>Em <em>Admin → WhatsApp</em>, clique em <strong>Conectar WhatsApp</strong>.</div>
            </div>
            <div className="doc-passo">
              <span className="doc-passo-num">2</span>
              <div>Escaneie o QR Code que aparece com o celular que vai atender os clientes (Configurações → Aparelhos conectados → Conectar um aparelho, dentro do WhatsApp).</div>
            </div>
            <div className="doc-passo">
              <span className="doc-passo-num">3</span>
              <div>Pronto: o número já está ligado ao bot. A tela confirma sozinha quando a conexão for feita, sem precisar recarregar a página.</div>
            </div>
            <p>Se o celular for desparelhado do lado do WhatsApp (ex: trocou de aparelho), o painel avisa que a conexão caiu e permite escanear um QR Code novo. Ao clicar em "Desconectar", a conexão é encerrada por completo. Pra reconectar depois (mesmo número ou outro) é preciso escanear o QR Code de novo.</p>
          </section>

          {/* ===================== WHATSAPP: MODO GUIADO ===================== */}
          <section id="whatsapp-guiado" className="doc-secao">
            <h2>Modo guiado</h2>
            <p className="doc-intro">O modo padrão do bot, disponível em qualquer plano com WhatsApp. Funciona por menu numerado, rápido, previsível, e não depende de IA pra funcionar.</p>
            <p>Um atendimento típico:</p>
            <ol>
              <li>O cliente manda qualquer mensagem e recebe o menu: <em>1. Agendar um horário</em> / <em>2. Ver ou cancelar meus agendamentos</em>.</li>
              <li>Escolhe o profissional, depois a data, depois o horário (só os horários realmente livres aparecem), depois o serviço.</li>
              <li>Se o número já tem cadastro no negócio, o agendamento é confirmado na hora.</li>
              <li>Se não tem, o bot conduz um <strong>cadastro completo</strong>: nome, e-mail e senha, com confirmação por um código de 6 dígitos enviado por e-mail. A mesma conta pode depois ser usada pra entrar no site do negócio.</li>
            </ol>
            <p>Mesmo no modo guiado, o cliente não precisa ficar preso ao número do menu: escrever algo como "quero cortar amanhã de tarde" ou "quero ver meus agendamentos" já direciona pro fluxo certo, usando um classificador de intenção leve por IA (quando o plano libera IA). O menu continua existindo como alternativa sempre disponível (digitando <em>MENU</em>).</p>
            <p>Toda vez que o menu aparece (e na confirmação de um agendamento), o bot também manda o link da página do negócio pra quem prefere terminar pelo navegador. Se o telefone já tem cadastro, esse link já abre com o cliente logado na própria conta — sem pedir e-mail e senha de novo — por um tempo curto, só o suficiente pra usar.</p>
          </section>

          {/* ===================== WHATSAPP: MODO LIVRE (IA) ===================== */}
          <section id="whatsapp-livre" className="doc-secao">
            <h2>Modo livre (agente de IA) <Badge tipo="pro" /></h2>
            <p className="doc-intro">Recurso de IA (planos Profissional e Enterprise): em vez do menu fixo, um agente conduz a conversa inteira de forma natural, decidindo sozinho o que perguntar e quando agir, sem abrir mão da confiabilidade do modo guiado.</p>
            <h3>Como o agente evita "inventar" informação</h3>
            <p>
              A IA nunca decide um dado de negócio sozinha. Perfis de profissionais, preços de serviços, horários realmente
              livres, se um cliente já tem cadastro: tudo isso só chega até o modelo através de consultas reais ao sistema
              (o que chamamos de <em>ferramentas</em>), na hora em que a conversa precisa daquele dado. A IA decide{' '}
              <strong>quando</strong> perguntar e <strong>como</strong> conversar sobre isso; ela nunca afirma uma disponibilidade,
              um preço ou um agendamento sem antes ter confirmado com o sistema de verdade.
            </p>
            <p>Isso significa, na prática:</p>
            <ul>
              <li>Nenhum agendamento é considerado confirmado sem ter sido de fato criado no banco de dados do negócio. A mesma checagem de conflito de horário do modo guiado se aplica aqui.</li>
              <li>Um cliente sem cadastro é sempre levado pelo mesmo fluxo de cadastro com confirmação por e-mail antes de conseguir agendar.</li>
              <li>O agente consegue ver e cancelar agendamentos existentes do cliente, com a mesma verificação de que o agendamento realmente pertence àquele número de telefone.</li>
            </ul>
            <p>O modo livre é opcional e configurável por negócio. O guiado continua sendo o padrão até o admin ativar o outro em <em>Admin → WhatsApp</em>.</p>
          </section>

          {/* ===================== WHATSAPP: PERSONALIDADE ===================== */}
          <section id="whatsapp-personalidade" className="doc-secao">
            <h2>Personalidade do assistente <Badge tipo="pro" /></h2>
            <p className="doc-intro">Em <em>Admin → WhatsApp</em>, cada negócio pode ajustar como o bot se comunica:</p>
            <div className="doc-grid-2">
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Mensagem de boas-vindas</strong>
                <p style={{ margin: '6px 0 0' }}>Disponível em qualquer plano com o bot ligado. Substitui a saudação padrão por um texto próprio do negócio.</p>
              </div>
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Nome do assistente</strong>
                <p style={{ margin: '6px 0 0' }}>Dá um nome/persona ao bot (ex: "Bia"), usado nas respostas.</p>
              </div>
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Personalidade</strong>
                <p style={{ margin: '6px 0 0' }}>Um texto livre descrevendo o tom desejado (ex: "descontraída, usa gírias e emojis"). Molda como o bot fala, sem nunca mudar o que ele fala: dados, preços, datas e horários são sempre preservados exatamente.</p>
              </div>
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Criatividade das respostas</strong>
                <p style={{ margin: '6px 0 0' }}>Um controle de 0 a 1: mais baixo deixa as respostas mais diretas e previsíveis, mais alto deixa mais variadas.</p>
              </div>
            </div>
            <p>No modo guiado, a personalidade entra só nas frases de conversa (saudação, confirmações, mensagens de erro). Nunca nas listas numeradas de opções, que continuam idênticas sempre, pra não arriscar confundir o número que o cliente vai responder em seguida.</p>
          </section>

          {/* ===================== WHATSAPP: RESUMO DIÁRIO ===================== */}
          <section id="whatsapp-resumo-profissionais" className="doc-secao">
            <h2>Resumo diário para os profissionais <Badge tipo="pro" /></h2>
            <p className="doc-intro">Além de atender clientes, o mesmo WhatsApp conectado pode avisar a própria equipe. Em <em>Admin → WhatsApp</em>, o negócio liga o resumo diário e escolhe um horário (Brasília) — todo dia, nesse horário, cada profissional ativo com telefone cadastrado (em <em>Equipe</em>) recebe uma mensagem só com os próprios atendimentos daquele dia, ou avisando que o dia está livre.</p>
            <p>É opcional e independente do modo do bot (guiado ou livre) e da personalidade configurada — é sempre um texto fixo, sem uso de IA. Um profissional sem telefone cadastrado simplesmente não recebe nada, sem travar o envio dos demais.</p>
          </section>

          {/* ===================== WHATSAPP: PIX ===================== */}
          <section id="whatsapp-pix" className="doc-secao">
            <h2>Pagamento via bot <Badge tipo="pro" /></h2>
            <p className="doc-intro">Se o negócio tem uma conta Mercado Pago conectada, o bot pode oferecer pagamento antecipado assim que um agendamento é confirmado (nos dois modos, guiado e livre).</p>
            <ol>
              <li>Depois de confirmar o agendamento, o bot pergunta se o cliente quer adiantar o pagamento via Pix.</li>
              <li>Se sim, gera a cobrança (mesma taxa e mesmas regras usadas no PDV) e manda o QR Code como imagem, seguido do código copia-e-cola em texto.</li>
              <li>A confirmação do pagamento acontece sozinha: assim que o Mercado Pago avisa que o Pix caiu, o cliente recebe uma mensagem de confirmação automaticamente, sem o admin precisar fazer nada.</li>
            </ol>
            <p>É sempre opcional. Recusar não afeta o agendamento, que já está confirmado antes mesmo da pergunta sobre o Pix.</p>
          </section>

          {/* ===================== MÚLTIPLAS UNIDADES ===================== */}
          <section id="multiplas-unidades" className="doc-secao">
            <span className="doc-secao-eyebrow">Recursos avançados</span>
            <h2>Múltiplas unidades <Badge tipo="ent" /></h2>
            <p className="doc-intro">Negócios com mais de uma filial podem gerenciar todas dentro do mesmo painel, cada uma com sua própria agenda, equipe e horário de funcionamento.</p>
            <p>Profissionais e horário de funcionamento pertencem a uma unidade específica. Já os clientes e os serviços cadastrados são do negócio como um todo, compartilhados entre todas as unidades — um cliente atendido numa filial não precisa ser recadastrado pra ser atendido em outra. Excluir uma unidade nunca apaga os profissionais ou os agendamentos que já passaram por ela, só desvincula a referência.</p>
            <p>O login principal escolhe qual unidade ver por um seletor, e é o único que acessa configurações que ficam sempre no nível do negócio como um todo (assinatura da plataforma, domínio próprio, bot de WhatsApp, conexão com o Mercado Pago, API pública, e criar/editar/desativar profissionais). Já um <strong>login de admin de unidade</strong> é restrito, sem seletor, à agenda, aos atendimentos (checkout/PDV) e à busca de clientes daquela filial específica; ele consegue <em>ver</em> a equipe da própria unidade, mas não tem permissão para criar, editar ou desativar profissionais — isso continua sendo uma configuração do negócio como um todo, feita só pelo login principal.</p>
          </section>

          {/* ===================== DOMÍNIO PRÓPRIO ===================== */}
          <section id="dominio-proprio" className="doc-secao">
            <h2>Domínio próprio <Badge tipo="ent" /></h2>
            <p className="doc-intro">Em vez do subdomínio padrão (<code>seunegocio.schednext.com.br</code>), negócios no plano Enterprise podem usar um domínio totalmente próprio (ex: <code>agenda.seusite.com.br</code>).</p>
            <p>O processo, feito em <em>Admin → Domínio</em>, envolve criar um registro CNAME apontando o domínio pra SchedNext direto no provedor onde o domínio foi comprado. A verificação (botão "Verificar") confere de fato se o DNS já resolve pro lugar certo, funcionando tanto com CNAME comum quanto com "CNAME flattening" (usado por provedores que não suportam CNAME na raiz do domínio, como o Cloudflare). Enquanto não propaga, o status mostra "Aguardando verificação de DNS"; depois, "Verificado e ativo". O certificado de segurança (HTTPS) é emitido automaticamente, sem custo ou etapa manual adicional, e o domínio pode ser removido a qualquer momento — o negócio volta a usar o subdomínio padrão na hora.</p>
          </section>

          {/* ===================== API: VISÃO GERAL ===================== */}
          <section id="api-visao-geral" className="doc-secao">
            <span className="doc-secao-eyebrow">API pública</span>
            <h2>Visão geral e autenticação <Badge tipo="ent" /></h2>
            <p className="doc-intro">Negócios Enterprise podem gerar chaves de API pra integrar o SchedNext com outros sistemas — por exemplo, um site institucional próprio ou um ERP que precisa consultar horários e criar agendamentos sem passar pela tela padrão do negócio.</p>
            <p>Todos os endpoints abaixo ficam sob o prefixo <code>/api/v1</code>, na mesma URL base do restante da API do SchedNext:</p>
            <div className="doc-code">https://schednextapi.onrender.com/api/v1</div>
            <h3>Gerando uma chave</h3>
            <p>Em <em>Admin → API pública</em>, dê um nome pra chave (ex: "Integração site institucional") e clique em <strong>Gerar chave</strong>. O valor completo só é exibido uma única vez, na hora da criação — guarde em local seguro, o SchedNext não consegue mostrar de novo depois. Uma chave pode ser revogada a qualquer momento pelo mesmo painel, o que derruba o acesso imediatamente.</p>
            <h3>Autenticação</h3>
            <p>Toda chamada precisa da chave no cabeçalho <code>Authorization</code>, no formato Bearer:</p>
            <div className="doc-code">Authorization: Bearer SUA_CHAVE_DE_API</div>
            <p>Sem esse cabeçalho (ou com uma chave inválida, revogada, ou de uma conta cujo plano não inclui API pública), toda rota responde <code>401</code> ou <code>403</code> antes mesmo de tentar processar o pedido — ver <a href="#api-erros">Erros e limites</a>.</p>
            <p>Cada chave está sempre amarrada à empresa que a gerou: não existe (nem faz sentido pedir) um <code>empresa_id</code> em nenhum parâmetro — quem identifica a conta é a própria chave.</p>
          </section>

          {/* ===================== API: PROFISSIONAIS ===================== */}
          <section id="api-profissionais" className="doc-secao">
            <div className="doc-endpoint">
              <span className="doc-metodo doc-metodo-get">GET</span>
              <span className="doc-endpoint-path">/api/v1/profissionais</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Listar profissionais</h2>
            <p className="doc-intro">Devolve os profissionais ativos da conta, sem paginação nem parâmetros — sempre a lista inteira.</p>
            <div className="doc-code">{`[
  { "id": 12, "nome": "Carlos Andrade", "ativo": true, "unidade_id": null },
  { "id": 13, "nome": "Marina Souza", "ativo": true, "unidade_id": 2 }
]`}</div>
            <p><code>unidade_id</code> só vem preenchido em negócios com <a href="#multiplas-unidades">múltiplas unidades</a>; do contrário é sempre <code>null</code>.</p>
          </section>

          {/* ===================== API: SERVIÇOS ===================== */}
          <section id="api-servicos" className="doc-secao">
            <div className="doc-endpoint">
              <span className="doc-metodo doc-metodo-get">GET</span>
              <span className="doc-endpoint-path">/api/v1/servicos</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Listar serviços</h2>
            <p className="doc-intro">Devolve os serviços ativos da conta, com preço e duração — mesma regra do endpoint de profissionais, sem parâmetros nem paginação.</p>
            <div className="doc-code">{`[
  { "id": 4, "nome": "Corte masculino", "duracao": 30, "valor": 45 },
  { "id": 7, "nome": "Barba", "duracao": 20, "valor": 30 }
]`}</div>
            <p><code>duracao</code> vem em minutos, é o mesmo valor usado pra montar os blocos de horário em <a href="#api-disponibilidade">/disponibilidade</a> e pra calcular o horário de término de um agendamento criado por essa API.</p>
          </section>

          {/* ===================== API: DISPONIBILIDADE ===================== */}
          <section id="api-disponibilidade" className="doc-secao">
            <div className="doc-endpoint">
              <span className="doc-metodo doc-metodo-get">GET</span>
              <span className="doc-endpoint-path">/api/v1/disponibilidade</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Horários livres de um profissional</h2>
            <p className="doc-intro">Checa, pra um profissional e uma data específicos, quais horários de 30 em 30 minutos estão livres dentro do horário de funcionamento configurado — já descontando agendamentos existentes (pela duração real de cada um, não só o minuto de início) e, se a data for hoje, os horários que já passaram.</p>
            <table className="doc-tabela" style={{ marginBottom: '16px' }}>
              <thead><tr><th>Parâmetro</th><th>Tipo</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
              <tbody>
                <tr><td>profissional_id</td><td>query</td><td>Sim</td><td>Id de um profissional ativo desta conta.</td></tr>
                <tr><td>data</td><td>query</td><td>Sim</td><td>Data no formato <code>AAAA-MM-DD</code>.</td></tr>
              </tbody>
            </table>
            <div className="doc-code">GET /api/v1/disponibilidade?profissional_id=12&data=2026-09-22</div>
            <div className="doc-code">{`{
  "profissional_id": 12,
  "data": "2026-09-22",
  "horarios_disponiveis": ["09:00", "09:30", "10:30", "14:00"]
}`}</div>
            <p>Se o dia cair fora do horário de funcionamento (dia fechado), a resposta continua <code>200</code>, só que com <code>horarios_disponiveis</code> vazio — não é tratado como erro.</p>
          </section>

          {/* ===================== API: AGENDAMENTOS ===================== */}
          <section id="api-agendamentos" className="doc-secao">
            <div className="doc-endpoint">
              <span className="doc-metodo doc-metodo-post">POST</span>
              <span className="doc-endpoint-path">/api/v1/agendamentos</span>
            </div>
            <h2 style={{ marginTop: 0 }}>Criar um agendamento</h2>
            <p className="doc-intro">Cria um agendamento confirmado, com a mesma checagem de conflito de horário, plano e validade de profissional/serviços usada em qualquer outro canal (site, bot, painel).</p>
            <table className="doc-tabela" style={{ marginBottom: '16px' }}>
              <thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
              <tbody>
                <tr><td>profissional_id</td><td>número</td><td>Sim</td><td>Id de um profissional ativo desta conta.</td></tr>
                <tr><td>data_hora</td><td>string (ISO)</td><td>Sim</td><td>Data e hora de início, ex: <code>2026-09-22T14:00:00</code>.</td></tr>
                <tr><td>servicos_ids</td><td>lista de números</td><td>Sim</td><td>Um ou mais ids de serviços ativos desta conta. Duração e valor totais são somados automaticamente.</td></tr>
                <tr><td>cliente_nome</td><td>string</td><td>Sim</td><td>Nome do cliente (até 150 caracteres). Esse endpoint não exige cadastro/login de cliente.</td></tr>
              </tbody>
            </table>
            <div className="doc-code">{`POST /api/v1/agendamentos
Content-Type: application/json

{
  "profissional_id": 12,
  "data_hora": "2026-09-22T14:00:00",
  "servicos_ids": [4, 7],
  "cliente_nome": "Ana Paula Ribeiro"
}`}</div>
            <div className="doc-code">{`// 201 Created
{ "id": 8831, "message": "Agendamento criado com sucesso." }`}</div>
            <p>A duração usada pra checar sobreposição de horário é a soma da duração de todos os serviços informados — dois serviços de 20 e 30 minutos criam um bloco de 50 minutos a partir de <code>data_hora</code>, do mesmo jeito que aconteceria marcando pelo site.</p>
          </section>

          {/* ===================== API: ERROS E LIMITES ===================== */}
          <section id="api-erros" className="doc-secao">
            <h2>Erros e limites</h2>
            <p className="doc-intro">Toda resposta de erro segue o mesmo formato: <code>{`{ "error": "mensagem" }`}</code>. Abaixo, os códigos que a API pode devolver e o que cada um significa.</p>
            <div className="doc-tabela-wrap">
              <table className="doc-tabela">
                <thead><tr><th>Código</th><th>Quando acontece</th></tr></thead>
                <tbody>
                  <tr><td>400</td><td>Parâmetro obrigatório faltando, ou algum campo inválido no corpo da requisição (ex: <code>servicos_ids</code> vazio, serviço que não pertence a esta conta).</td></tr>
                  <tr><td>401</td><td>Chave de API não enviada, inválida ou revogada.</td></tr>
                  <tr><td>403</td><td>Chave válida, mas o plano atual da conta não inclui API pública, ou o limite de agendamentos do mês já foi atingido.</td></tr>
                  <tr><td>404</td><td>O <code>profissional_id</code> informado não existe ou não pertence a esta conta.</td></tr>
                  <tr><td>409</td><td>Conflito: esse profissional já tem um agendamento que se sobrepõe ao horário pedido.</td></tr>
                  <tr><td>429</td><td>Muitas requisições em pouco tempo (ver limite abaixo). Aguarde e tente de novo.</td></tr>
                  <tr><td>500</td><td>Erro interno inesperado. Se persistir, entre em contato com o suporte.</td></tr>
                </tbody>
              </table>
            </div>
            <h3>Limite de requisições</h3>
            <p>A API pública aceita no máximo <strong>60 requisições por minuto</strong>. Ao passar do limite, a resposta vem com código <code>429</code> até a janela seguinte liberar. Esse limite é independente do limite mensal de agendamentos do plano (código <code>403</code> acima), que é uma regra de negócio, não de tráfego.</p>
          </section>

          {/* ===================== PLANOS ===================== */}
          <section id="planos" className="doc-secao">
            <span className="doc-secao-eyebrow">Referência</span>
            <h2>Planos e recursos</h2>
            <p className="doc-intro">O SchedNext tem quatro planos. <Link to="/#planos">Veja os preços atuais na página inicial</Link>. Esta tabela resume o que cada nível de plano libera:</p>
            <div className="doc-tabela-wrap">
              <table className="doc-tabela">
                <thead>
                  <tr><th>Recurso</th><th>Grátis</th><th>Essencial</th><th>Profissional</th><th>Enterprise</th></tr>
                </thead>
                <tbody>
                  <tr><td>Agenda online + link próprio</td><td>Sim</td><td>Sim</td><td>Sim</td><td>Sim</td></tr>
                  <tr><td>Profissionais</td><td>1</td><td>Até 5</td><td>Ilimitado</td><td>Ilimitado</td></tr>
                  <tr><td>Agendamentos por mês</td><td>60</td><td>Ilimitado</td><td>Ilimitado</td><td>Ilimitado</td></tr>
                  <tr><td>Paleta de cores personalizada</td><td>—</td><td>Sim</td><td>Sim</td><td>Sim</td></tr>
                  <tr><td>Sem marca "feito com SchedNext"</td><td>—</td><td>Sim</td><td>Sim</td><td>Sim</td></tr>
                  <tr><td>Bot de WhatsApp (guiado)</td><td>—</td><td>—</td><td>Sim</td><td>Sim</td></tr>
                  <tr><td>Agente de IA (WhatsApp livre, personalidade, sugestão de campanha)</td><td>—</td><td>—</td><td>Sim</td><td>Sim</td></tr>
                  <tr><td>Relatórios avançados</td><td>—</td><td>—</td><td>Sim</td><td>Sim</td></tr>
                  <tr><td>Múltiplas unidades</td><td>—</td><td>—</td><td>—</td><td>Sim</td></tr>
                  <tr><td>Domínio próprio</td><td>—</td><td>—</td><td>—</td><td>Sim</td></tr>
                  <tr><td>API pública</td><td>—</td><td>—</td><td>—</td><td>Sim</td></tr>
                  <tr><td>Taxa sobre Pix recebido</td><td>5%</td><td>0%</td><td>0%</td><td>0%</td></tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>É possível trocar de plano a qualquer momento direto pelo painel administrativo.</p>
          </section>

          {/* ===================== SEGURANÇA ===================== */}
          <section id="seguranca" className="doc-secao">
            <h2>Segurança e privacidade</h2>
            <ul>
              <li><strong>Dados isolados por negócio</strong>: cada empresa só acessa seus próprios dados; nenhum agendamento, cliente ou relatório é visível entre negócios diferentes.</li>
              <li><strong>Senhas nunca em texto puro</strong>: todo login (admin, admin de unidade e cliente final) usa senha com hash.</li>
              <li><strong>Tráfego sempre criptografado</strong>: todo acesso ao SchedNext (painel, site do negócio, API) usa HTTPS.</li>
              <li><strong>Dinheiro nunca passa pela SchedNext</strong>: Pix e assinaturas via Mercado Pago caem direto na conta do negócio; a plataforma só recebe sua taxa, descontada automaticamente pelo próprio Mercado Pago.</li>
              <li><strong>Chaves de API pública</strong> são mostradas em texto completo só uma vez, na criação; a partir daí ficam guardadas apenas de forma irreversível, e podem ser revogadas a qualquer momento (ver <a href="#api-visao-geral">API pública</a>).</li>
              <li><strong>Backups automáticos</strong> do banco de dados.</li>
            </ul>
          </section>

          {/* ===================== FAQ ===================== */}
          <section id="faq" className="doc-secao">
            <h2>Perguntas frequentes</h2>
            <h3>Preciso de cartão de crédito para começar?</h3>
            <p>Não. O plano Grátis não pede pagamento, é só criar a conta e começar a usar.</p>
            <h3>O bot de WhatsApp precisa do WhatsApp Business API oficial?</h3>
            <p>Não. Ele funciona com um número de WhatsApp comum, sem precisar de CNPJ nem aprovação da Meta.</p>
            <h3>A IA do modo livre pode marcar um horário errado ou inventar um preço?</h3>
            <p>Não deveria: toda informação que a IA usa (preço, disponibilidade, cadastro do cliente) vem de uma consulta real ao sistema no momento da conversa, nunca de algo que o modelo "lembra" ou supõe sozinho. Ver <a href="#whatsapp-livre">como o agente evita inventar informação</a>.</p>
            <h3>Posso desligar o modo livre e voltar pro menu fixo?</h3>
            <p>Sim, a qualquer momento em Admin → WhatsApp. A troca vale pra próxima conversa, sem precisar reconectar o número.</p>
            <h3>Posso trocar de plano depois?</h3>
            <p>Sim, a qualquer momento direto pelo painel administrativo.</p>
            <h3>Meus clientes precisam instalar algo?</h3>
            <p>Não. Agendam direto pelo navegador ou pelo WhatsApp, sem instalar nenhum aplicativo.</p>
            <h3>Posso cancelar quando quiser?</h3>
            <p>Sim, sem multa e sem burocracia.</p>
          </section>

        </main>
      </div>

      <footer style={s.footer}>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.62)', fontSize: '13px' }}>
          © {new Date().getFullYear()} SchedNext. <Link to="/" style={{ color: 'rgba(255,255,255,0.85)' }}>Voltar ao início</Link>
        </p>
      </footer>
    </div>
  );
}

const CORES = {
  fundo: '#05060d',
  fundoAlt: '#0a0c18',
  borda: 'rgba(255,255,255,0.12)'
};

const s = {
  pagina: { minHeight: '100vh', background: CORES.fundo, color: '#fff', fontFamily: "'Poppins', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 40px', borderBottom: `1px solid ${CORES.borda}`, position: 'sticky', top: 0, background: 'rgba(5,6,13,0.85)', backdropFilter: 'blur(6px)', zIndex: 10 },
  logoHeader: { height: '32px', width: 'auto' },
  linkHeader: { color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: '14px' },
  btnHeader: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '14px' },
  footer: { padding: '40px 20px', borderTop: `1px solid ${CORES.borda}` }
};

export default Docs;
