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
      { id: 'clientes', titulo: 'Clientes e fidelidade' },
      { id: 'estoque-pdv', titulo: 'Estoque e finalização de atendimento' },
      { id: 'pagamentos', titulo: 'Pagamentos e Pix' },
      { id: 'relatorios', titulo: 'Relatórios' },
      { id: 'acoes-fidelidade', titulo: 'Ações e fidelidade' }
    ]
  },
  {
    grupo: 'Bot de WhatsApp',
    itens: [
      { id: 'whatsapp-conectar', titulo: 'Conectando o WhatsApp' },
      { id: 'whatsapp-guiado', titulo: 'Modo guiado' },
      { id: 'whatsapp-livre', titulo: 'Modo livre (agente de IA)' },
      { id: 'whatsapp-personalidade', titulo: 'Personalidade do assistente' },
      { id: 'whatsapp-pix', titulo: 'Pagamento via bot' }
    ]
  },
  {
    grupo: 'Recursos avançados',
    itens: [
      { id: 'multiplas-unidades', titulo: 'Múltiplas unidades' },
      { id: 'dominio-proprio', titulo: 'Domínio próprio' },
      { id: 'api-publica', titulo: 'API pública' }
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
        <p>Tudo sobre como configurar sua agenda, atender seus clientes e usar o bot de WhatsApp com IA — do primeiro cadastro aos recursos mais avançados.</p>
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
              agenda, seu próprio painel administrativo e sua própria página (ou subdomínio) para os clientes marcarem horário —
              tudo isolado dos demais negócios que usam a plataforma.
            </p>
            <p>Funciona bem para negócios que atendem por hora marcada com um ou mais profissionais: barbearias, salões de beleza, estúdios de unhas, e outros formatos parecidos.</p>
            <p>Existem três "papéis" dentro do sistema:</p>
            <ul>
              <li><strong>Cliente final</strong> — quem agenda um horário, pelo site do negócio ou pelo WhatsApp.</li>
              <li><strong>Admin da empresa</strong> — o dono ou gerente do negócio, que configura agenda, equipe, serviços e acompanha tudo pelo painel.</li>
              <li><strong>Admin de unidade</strong> (só em negócios com múltiplas filiais) — um login restrito à agenda e equipe de uma unidade específica.</li>
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
                <p>Em <Link to="/cadastrar">schednext.com.br/cadastrar</Link>, escolha o nome do seu negócio e o tipo de serviço (barbearia, salão, estúdio de unhas ou genérico). Não pede cartão de crédito — o plano Grátis já é suficiente pra começar.</p>
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
                <p>Se o seu plano incluir o bot de WhatsApp, conecte um número em <em>Admin → WhatsApp</em> e seus clientes passam a poder agendar também por lá — ver a seção <a href="#whatsapp-conectar">Bot de WhatsApp</a>.</p>
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
            <p>O mesmo motor de disponibilidade (checar horário livre, evitar dois agendamentos no mesmo horário pro mesmo profissional) é usado tanto no site quanto no bot de WhatsApp — não existem duas lógicas de agenda diferentes rodando em paralelo.</p>
          </section>

          {/* ===================== EQUIPE E SERVIÇOS ===================== */}
          <section id="equipe-servicos" className="doc-secao">
            <h2>Equipe e serviços</h2>
            <p className="doc-intro">Cada profissional cadastrado tem sua própria agenda dentro do negócio, e cada serviço tem preço e duração próprios — a duração é o que define o tamanho do "bloco" reservado na agenda.</p>
            <p>É possível ativar ou desativar um profissional ou serviço sem apagar o histórico de agendamentos já feitos com ele — só deixa de aparecer como opção pra novos agendamentos.</p>
          </section>

          {/* ===================== CLIENTES ===================== */}
          <section id="clientes" className="doc-secao">
            <h2>Clientes e fidelidade</h2>
            <p className="doc-intro">Toda pessoa que agenda um horário (pelo site ou pelo WhatsApp) fica registrada como cliente do negócio, com histórico de atendimentos.</p>
            <h3>Assinatura do cliente final <Badge tipo="none" /></h3>
            <p>
              Além do agendamento avulso, o admin pode oferecer planos de assinatura mensal pros próprios clientes (ex: "plano
              ilimitado de cortes"). O cliente contrata, e a mensalidade pode ser cobrada automaticamente:
            </p>
            <ul>
              <li><strong>No cartão</strong>, via débito recorrente (o cliente autoriza uma vez, e a cobrança se repete sozinha todo mês).</li>
              <li><strong>No Pix</strong>, gerado manualmente todo ciclo (Pix recorrente automático não existe no Mercado Pago) — o admin gera e envia, ou o próprio cliente gera pelo site.</li>
            </ul>
            <p>O primeiro mês pode ser pago pessoalmente, sem precisar configurar cobrança automática. Se uma mensalidade não é confirmada, a conta entra em <strong>inadimplência</strong>: continua cadastrada, mas o preço/benefício de assinante fica suspenso até regularizar (via cobrança automática ou diretamente com o negócio) — o checkout de atendimento volta a cobrar o valor cheio nesse período. Cancelar a cobrança automática não remove o plano do cliente; isso continua sob controle do admin.</p>
          </section>

          {/* ===================== ESTOQUE E PDV ===================== */}
          <section id="estoque-pdv" className="doc-secao">
            <h2>Estoque e finalização de atendimento</h2>
            <p className="doc-intro">Na hora de fechar um atendimento, o admin abre o painel "Vender produtos de estoque" e não fica limitado ao valor do serviço agendado.</p>
            <ul>
              <li><strong>Produtos vendidos</strong>: o negócio mantém um estoque simples (ex: pomada, shampoo) e pode adicionar itens vendidos junto do atendimento — entram automaticamente no valor final e dão baixa na quantidade em estoque.</li>
              <li><strong>Serviços adicionais</strong>: serviços extras feitos na hora (não pré-agendados) também entram no fechamento.</li>
              <li><strong>Pagamento dividido</strong>: o valor final pode ser cobrado em até duas formas de pagamento na mesma finalização (ex: metade no dinheiro, metade no Pix) — a soma das duas precisa bater exatamente com o total, e no máximo uma das duas pode ser Pix, que precisa já estar confirmado como aprovado antes de fechar o atendimento.</li>
            </ul>
            <p>O valor final é sempre recalculado no servidor no momento de fechar (nunca confia no valor que a tela envia), e qualquer Pix envolvido é reconfirmado direto com o Mercado Pago antes de aceitar — evita a situação de cobrar um valor e fechar o caixa com outro.</p>
          </section>

          {/* ===================== PAGAMENTOS ===================== */}
          <section id="pagamentos" className="doc-secao">
            <h2>Pagamentos e Pix</h2>
            <p className="doc-intro">O SchedNext usa o Mercado Pago como gateway de pagamento — cada negócio conecta sua própria conta (Admin → Mercado Pago), e o dinheiro cai direto lá, nunca passando pela SchedNext.</p>
            <h3>Onde o Pix aparece</h3>
            <ul>
              <li>Na finalização de um atendimento (PDV), avulso ou dividido com outra forma de pagamento.</li>
              <li>Na assinatura mensal de um cliente final, quando ele opta por pagar por Pix em vez de cartão.</li>
              <li>No bot de WhatsApp, como pagamento antecipado opcional logo após confirmar um agendamento — ver <a href="#whatsapp-pix">Pagamento via bot</a>.</li>
            </ul>
            <h3>Taxa da plataforma</h3>
            <p>Uma pequena porcentagem de cada Pix cobrado fica retida automaticamente como taxa da SchedNext (a própria API do Mercado Pago desconta na hora, sem o negócio precisar repassar nada manualmente). O percentual varia por plano — planos superiores têm taxa menor ou zero.</p>
          </section>

          {/* ===================== RELATÓRIOS ===================== */}
          <section id="relatorios" className="doc-secao">
            <h2>Relatórios</h2>
            <p className="doc-intro">O painel de relatórios dá visão financeira do negócio sem precisar de planilha paralela: faturamento total, faturamento líquido (já descontando a taxa da maquininha de cada forma de pagamento, configurável por método), ticket médio, atendimentos concluídos, taxa de cancelamento e variação em relação ao período anterior — além de um gráfico de faturamento por dia e o comissionamento por profissional (com visitas de assinantes rateadas proporcionalmente na comissão).</p>
            <p>Com <Badge tipo="pro" /> os relatórios ganham uma camada avançada: serviços mais vendidos, profissionais com melhor desempenho e taxa de recorrência de clientes. Tudo pode ser exportado em CSV ou num PDF completo (as tabelas avançadas só entram no PDF pra quem tem esse recurso liberado).</p>
          </section>

          {/* ===================== AÇÕES E FIDELIDADE ===================== */}
          <section id="acoes-fidelidade" className="doc-secao">
            <h2>Ações e fidelidade</h2>
            <p className="doc-intro">Em <em>Admin → Ações</em>, o negócio cria campanhas de fidelidade com prazo definido: um nome, data de início e fim, uma meta (ex: "5 cortes no período"), um gasto mínimo opcional, e uma recompensa quando o cliente bate a meta — um serviço grátis, um produto grátis, ou um desconto em % ou em R$.</p>
            <p>Campanhas podem ser pausadas, reativadas ou excluídas a qualquer momento. Negócios com IA liberada no plano <Badge tipo="pro" /> ainda contam com uma sugestão de campanha gerada automaticamente, baseada no faturamento e na frequência de atendimentos dos últimos 30 dias.</p>
          </section>

          {/* ===================== WHATSAPP: CONECTAR ===================== */}
          <section id="whatsapp-conectar" className="doc-secao">
            <span className="doc-secao-eyebrow">Bot de WhatsApp</span>
            <h2>Conectando o WhatsApp <Badge tipo="pro" /></h2>
            <p className="doc-intro">O bot de agendamento por WhatsApp funciona com um número de WhatsApp de verdade conectado ao negócio (não é o WhatsApp Business API oficial da Meta — funciona com qualquer número, sem precisar de CNPJ ou aprovação da Meta).</p>
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
              <div>Pronto — o número já está ligado ao bot. A tela confirma sozinha quando a conexão for feita, sem precisar recarregar a página.</div>
            </div>
            <p>Se o celular for desparelhado do lado do WhatsApp (ex: trocou de aparelho), o painel avisa que a conexão caiu e permite escanear um QR Code novo. Ao clicar em "Desconectar", a conexão é encerrada por completo — pra reconectar depois (mesmo número ou outro) é preciso escanear o QR Code de novo.</p>
          </section>

          {/* ===================== WHATSAPP: MODO GUIADO ===================== */}
          <section id="whatsapp-guiado" className="doc-secao">
            <h2>Modo guiado</h2>
            <p className="doc-intro">O modo padrão do bot, disponível em qualquer plano com WhatsApp. Funciona por menu numerado — rápido, previsível, e não depende de IA pra funcionar.</p>
            <p>Um atendimento típico:</p>
            <ol>
              <li>O cliente manda qualquer mensagem e recebe o menu: <em>1. Agendar um horário</em> / <em>2. Ver ou cancelar meus agendamentos</em>.</li>
              <li>Escolhe o profissional, depois a data, depois o horário (só os horários realmente livres aparecem), depois o serviço.</li>
              <li>Se o número já tem cadastro no negócio, o agendamento é confirmado na hora.</li>
              <li>Se não tem, o bot conduz um <strong>cadastro completo</strong>: nome, e-mail e senha, com confirmação por um código de 6 dígitos enviado por e-mail — a mesma conta pode depois ser usada pra entrar no site do negócio.</li>
            </ol>
            <p>Mesmo no modo guiado, o cliente não precisa ficar preso ao número do menu: escrever algo como "quero cortar amanhã de tarde" ou "quero ver meus agendamentos" já direciona pro fluxo certo, usando um classificador de intenção leve por IA (quando o plano libera IA) — o menu continua existindo como alternativa sempre disponível (digitando <em>MENU</em>).</p>
          </section>

          {/* ===================== WHATSAPP: MODO LIVRE (IA) ===================== */}
          <section id="whatsapp-livre" className="doc-secao">
            <h2>Modo livre (agente de IA) <Badge tipo="pro" /></h2>
            <p className="doc-intro">Recurso de IA (planos Profissional e Enterprise): em vez do menu fixo, um agente conduz a conversa inteira de forma natural, decidindo sozinho o que perguntar e quando agir — sem abrir mão da confiabilidade do modo guiado.</p>
            <h3>Como o agente evita "inventar" informação</h3>
            <p>
              A IA nunca decide um dado de negócio sozinha. Perfis de profissionais, preços de serviços, horários realmente
              livres, se um cliente já tem cadastro — tudo isso só chega até o modelo através de consultas reais ao sistema
              (o que chamamos de <em>ferramentas</em>), na hora em que a conversa precisa daquele dado. A IA decide{' '}
              <strong>quando</strong> perguntar e <strong>como</strong> conversar sobre isso; ela nunca afirma uma disponibilidade,
              um preço ou um agendamento sem antes ter confirmado com o sistema de verdade.
            </p>
            <p>Isso significa, na prática:</p>
            <ul>
              <li>Nenhum agendamento é considerado confirmado sem ter sido de fato criado no banco de dados do negócio — a mesma checagem de conflito de horário do modo guiado se aplica aqui.</li>
              <li>Um cliente sem cadastro é sempre levado pelo mesmo fluxo de cadastro com confirmação por e-mail antes de conseguir agendar.</li>
              <li>O agente consegue ver e cancelar agendamentos existentes do cliente, com a mesma verificação de que o agendamento realmente pertence àquele número de telefone.</li>
            </ul>
            <p>O modo livre é opcional e configurável por negócio — o guiado continua sendo o padrão até o admin ativar o outro em <em>Admin → WhatsApp</em>.</p>
          </section>

          {/* ===================== WHATSAPP: PERSONALIDADE ===================== */}
          <section id="whatsapp-personalidade" className="doc-secao">
            <h2>Personalidade do assistente <Badge tipo="pro" /></h2>
            <p className="doc-intro">Em <em>Admin → WhatsApp</em>, cada negócio pode ajustar como o bot se comunica:</p>
            <div className="doc-grid-2">
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Mensagem de boas-vindas</strong>
                <p style={{ margin: '6px 0 0' }}>Disponível em qualquer plano com o bot ligado — substitui a saudação padrão por um texto próprio do negócio.</p>
              </div>
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Nome do assistente</strong>
                <p style={{ margin: '6px 0 0' }}>Dá um nome/persona ao bot (ex: "Bia"), usado nas respostas.</p>
              </div>
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Personalidade</strong>
                <p style={{ margin: '6px 0 0' }}>Um texto livre descrevendo o tom desejado (ex: "descontraída, usa gírias e emojis") — molda como o bot fala, sem nunca mudar o que ele fala: dados, preços, datas e horários são sempre preservados exatamente.</p>
              </div>
              <div className="doc-card">
                <strong style={{ color: '#fff' }}>Criatividade das respostas</strong>
                <p style={{ margin: '6px 0 0' }}>Um controle de 0 a 1: mais baixo deixa as respostas mais diretas e previsíveis, mais alto deixa mais variadas.</p>
              </div>
            </div>
            <p>No modo guiado, a personalidade entra só nas frases de conversa (saudação, confirmações, mensagens de erro) — nunca nas listas numeradas de opções, que continuam idênticas sempre, pra não arriscar confundir o número que o cliente vai responder em seguida.</p>
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
            <p>É sempre opcional — recusar não afeta o agendamento, que já está confirmado antes mesmo da pergunta sobre o Pix.</p>
          </section>

          {/* ===================== MÚLTIPLAS UNIDADES ===================== */}
          <section id="multiplas-unidades" className="doc-secao">
            <span className="doc-secao-eyebrow">Recursos avançados</span>
            <h2>Múltiplas unidades <Badge tipo="ent" /></h2>
            <p className="doc-intro">Negócios com mais de uma filial podem gerenciar todas dentro do mesmo painel, cada uma com sua própria agenda, equipe e horário de funcionamento.</p>
            <p>O login principal escolhe qual unidade ver por um seletor, e é o único que acessa configurações que ficam sempre no nível do negócio como um todo (assinatura da plataforma, domínio próprio, bot de WhatsApp, conexão com o Mercado Pago e API pública). Já um <strong>login de admin de unidade</strong> é automaticamente restrito à agenda, equipe e estatísticas básicas daquela filial específica — sem seletor, porque só enxerga a própria unidade, e sem acesso às configurações do negócio como um todo.</p>
          </section>

          {/* ===================== DOMÍNIO PRÓPRIO ===================== */}
          <section id="dominio-proprio" className="doc-secao">
            <h2>Domínio próprio <Badge tipo="ent" /></h2>
            <p className="doc-intro">Em vez do subdomínio padrão (<code>seunegocio.schednext.com.br</code>), negócios no plano Enterprise podem usar um domínio totalmente próprio (ex: <code>agenda.seusite.com.br</code>).</p>
            <p>O processo, feito em <em>Admin → Domínio</em>, envolve criar um registro CNAME (apontando o domínio pra SchedNext) direto no provedor onde o domínio foi comprado — o painel mostra exatamente qual registro cadastrar e confirma sozinho (botão "Verificar") assim que o DNS propagar, funcionando tanto com CNAME comum quanto com "CNAME flattening" (ex: Cloudflare). Enquanto não propaga, o status mostra "Aguardando verificação de DNS"; depois, "Verificado e ativo". O certificado de segurança (HTTPS) é emitido automaticamente, sem custo ou etapa manual adicional, e o domínio pode ser removido a qualquer momento.</p>
          </section>

          {/* ===================== API PÚBLICA ===================== */}
          <section id="api-publica" className="doc-secao">
            <h2>API pública <Badge tipo="ent" /></h2>
            <p className="doc-intro">Negócios Enterprise podem gerar chaves de API (em <em>Admin → API</em>) pra integrar o SchedNext com outros sistemas — por exemplo, um site ou app próprio que agenda direto no SchedNext sem passar pela tela padrão.</p>
            <p>A API permite listar profissionais e serviços ativos, checar os horários livres de um profissional num dia, e criar um agendamento — com a mesma validação contra horário duplicado e limite mensal do plano usada em qualquer outro canal. Cada chave é vinculada ao negócio que a gerou, mostrada só uma vez na criação, e pode ser revogada a qualquer momento pelo painel.</p>
          </section>

          {/* ===================== PLANOS ===================== */}
          <section id="planos" className="doc-secao">
            <span className="doc-secao-eyebrow">Referência</span>
            <h2>Planos e recursos</h2>
            <p className="doc-intro">O SchedNext tem quatro planos — <Link to="/#planos">veja os preços atuais na página inicial</Link>. Esta tabela resume o que cada nível de plano libera:</p>
            <div className="doc-tabela-wrap">
              <table className="doc-tabela">
                <thead>
                  <tr><th>Recurso</th><th>Grátis</th><th>Essencial</th><th>Profissional</th><th>Enterprise</th></tr>
                </thead>
                <tbody>
                  <tr><td>Agenda online + link próprio</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Profissionais</td><td>1</td><td>Até 5</td><td>Ilimitado</td><td>Ilimitado</td></tr>
                  <tr><td>Agendamentos por mês</td><td>60</td><td>Ilimitado</td><td>Ilimitado</td><td>Ilimitado</td></tr>
                  <tr><td>Paleta de cores personalizada</td><td>—</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Sem marca "feito com SchedNext"</td><td>—</td><td>✅</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Bot de WhatsApp (guiado)</td><td>—</td><td>—</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Agente de IA (WhatsApp livre, personalidade, sugestão de campanha)</td><td>—</td><td>—</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Relatórios avançados</td><td>—</td><td>—</td><td>✅</td><td>✅</td></tr>
                  <tr><td>Múltiplas unidades</td><td>—</td><td>—</td><td>—</td><td>✅</td></tr>
                  <tr><td>Domínio próprio</td><td>—</td><td>—</td><td>—</td><td>✅</td></tr>
                  <tr><td>API pública</td><td>—</td><td>—</td><td>—</td><td>✅</td></tr>
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
              <li><strong>Dados isolados por negócio</strong> — cada empresa só acessa seus próprios dados; nenhum agendamento, cliente ou relatório é visível entre negócios diferentes.</li>
              <li><strong>Senhas nunca em texto puro</strong> — todo login (admin, admin de unidade e cliente final) usa senha com hash.</li>
              <li><strong>Tráfego sempre criptografado</strong> — todo acesso ao SchedNext (painel, site do negócio, API) usa HTTPS.</li>
              <li><strong>Dinheiro nunca passa pela SchedNext</strong> — Pix e assinaturas via Mercado Pago caem direto na conta do negócio; a plataforma só recebe sua taxa, descontada automaticamente pelo próprio Mercado Pago.</li>
              <li><strong>Backups automáticos</strong> do banco de dados.</li>
            </ul>
          </section>

          {/* ===================== FAQ ===================== */}
          <section id="faq" className="doc-secao">
            <h2>Perguntas frequentes</h2>
            <h3>Preciso de cartão de crédito para começar?</h3>
            <p>Não. O plano Grátis não pede pagamento — é só criar a conta e começar a usar.</p>
            <h3>O bot de WhatsApp precisa do WhatsApp Business API oficial?</h3>
            <p>Não. Ele funciona com um número de WhatsApp comum, sem precisar de CNPJ nem aprovação da Meta.</p>
            <h3>A IA do modo livre pode marcar um horário errado ou inventar um preço?</h3>
            <p>Não deveria: toda informação que a IA usa (preço, disponibilidade, cadastro do cliente) vem de uma consulta real ao sistema no momento da conversa, nunca de algo que o modelo "lembra" ou supõe sozinho — ver <a href="#whatsapp-livre">como o agente evita inventar informação</a>.</p>
            <h3>Posso desligar o modo livre e voltar pro menu fixo?</h3>
            <p>Sim, a qualquer momento em Admin → WhatsApp — a troca vale pra próxima conversa, sem precisar reconectar o número.</p>
            <h3>Posso trocar de plano depois?</h3>
            <p>Sim, a qualquer momento direto pelo painel administrativo.</p>
            <h3>Meus clientes precisam instalar algo?</h3>
            <p>Não — agendam direto pelo navegador ou pelo WhatsApp, sem instalar nenhum aplicativo.</p>
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
