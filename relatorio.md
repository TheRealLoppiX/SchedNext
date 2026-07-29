# Relatório de implementação — 2026-07-29

Sessão de implementação em cima do levantamento de pendências (`PENDENCIAS.md`) e da task list trazida do Trello. Tudo abaixo foi implementado, testado (sintaxe do backend, build + suíte de testes do frontend, smoke test de rotas novas com servidor local) e commitado nos dois repositórios (`SchedNextAPI` e `SchedNext`), branch `dev`.

---

## 1. Bug crítico corrigido: cliente assinante cobrado o valor cheio

**Causa raiz**: `agendamentos.valor_total` era sempre a soma do preço cheio dos serviços escolhidos, sem nunca checar se o cliente é assinante nem se o serviço está incluso no plano dele. A tela de agendamento do cliente e o modal de checkout do admin já *mostravam* o valor descontado corretamente, mas isso era só cosmético — o valor que ia pro banco (e pro e-mail de confirmação) sempre foi o cheio.

**Correção**:
- Novo helper `backend/src/utils/valorAssinante.js` (`calcularValorComDescontoAssinante`): dado um `usuario_id` e uma lista de serviços, verifica se o cliente é assinante e desconta os serviços que estão em `plano_servicos` do plano dele.
- Aplicado em `POST /agendar` e `POST /admin/agendar-encaixe` (valor calculado corretamente desde a criação do agendamento).
- `POST /admin/finalizar-servico-checkout` agora **recalcula** o valor base a partir dos serviços de fato vinculados ao agendamento (`agendamento_servicos`) e do status de assinatura **atual** do cliente, em vez de confiar no `valor_total` gravado na criação — cobre também os casos em que o cliente virou (ou deixou de ser) assinante depois de agendar, e qualquer rota de criação que não tenha sido diretamente corrigida.

---

## 2. Automações que eram só manuais viraram automáticas

Novo cron `backend/src/cron/recuperacaoClientes.js` (roda 1x/dia, 10h):
- **Recuperação de cliente inativo**: identifica clientes sem atendimento concluído entre 45 e 60 dias e dispara a mensagem "sentimos sua falta" sozinho, sem esperar o admin clicar em nada. Não repete pro mesmo cliente antes de 90 dias.
- **Aniversário**: identifica aniversariantes do dia e dispara parabéns automaticamente, uma vez por ano por cliente.
- Ambos usam e-mail sempre, e WhatsApp também quando o plano da empresa permite (`permite_whatsapp_bot`).

Novo serviço `backend/src/services/fidelidade.js`: depois de todo fechamento de atendimento (`POST /admin/finalizar-servico-checkout`), verifica se o cliente acabou de bater a meta da campanha de fidelidade ativa e, se sim, avisa automaticamente por e-mail/WhatsApp — antes o cliente só descobria se abrisse a tela dele mesmo. Protegido contra notificação duplicada (tabela nova `fidelidade_premios_notificados`, com constraint única).

Conteúdo de e-mail/WhatsApp compartilhado entre o disparo automático e o manual num novo módulo (`backend/src/services/mensagensCliente.js`), pra não duplicar texto.

---

## 3. WhatsApp como canal em mais pontos do sistema

- `POST /admin/clientes/followup` (disparo manual de recuperação/aniversário) agora aceita `canal: 'email' | 'whatsapp' | 'ambos'`. Frontend (`AdminClientes.js`) ganhou botões de WhatsApp ao lado dos de e-mail, tanto na lista quanto no modal de edição do cliente (só aparecem se o plano permite e o cliente tem telefone cadastrado).
- Confirmação de agendamento (`POST /agendar`) e aviso de cancelamento (`POST /admin/cancelar-agendamento`) agora também enviam WhatsApp, além do e-mail que já existia — mesmo gate de plano (`permite_whatsapp_bot`) usado no bot e nos lembretes.

---

## 4. Financeiro: forma de pagamento, taxas de maquineta e comissionamento

- **Forma de pagamento**: `POST /admin/finalizar-servico-checkout` agora aceita e grava `forma_pagamento` (dinheiro/crédito/débito/pix). Seletor visual adicionado no checkout (`AgendaModal.js`). Não gera QR code de Pix real — isso depende do gateway de pagamento (ver pendência 3.1 no `PENDENCIAS.md`).
- **Taxas de maquineta**: nova rota `backend/src/routes/financeiro.js` (`GET`/`PUT /admin/taxas-pagamento`), com painel de configuração dentro de "Relatórios e financeiro" no admin. Guardadas em `empresas.taxas_pagamento` (JSON).
- **Comissionamento por profissional**: novo campo `barbeiros.percentual_comissao`, editável em `AdminBarbeiros.js`. Novo relatório `GET /admin/relatorios/comissionamento/:empresaId` mostra, por profissional, quantidade de atendimentos, receita bruta, receita líquida (já descontando a taxa de maquineta conforme a forma de pagamento) e o valor de comissão a pagar. **Não é exclusivo do plano Enterprise** — decisão deliberada, já que isso é necessidade operacional básica, diferente dos outros relatórios avançados.
  - Rateio de cliente assinante: como o atendimento do assinante sai a R$0 pra ele (corretamente, depois do fix da seção 1), o cálculo de comissão substitui esse valor pela fatia proporcional da mensalidade do plano dele (preço do plano ÷ visitas concluídas naquele mês), atribuída ao profissional que atendeu em cada visita.
- **Receita líquida** também aparece agora no resumo dos Relatórios avançados (`backend/src/routes/relatorios.js`), ao lado do faturamento bruto.

---

## 5. Painel do admin absoluto (super-admin) ganhou gestão de verdade

Antes só listava leads do formulário Enterprise. Agora tem 4 abas:
- **Métricas**: total de empresas, MRR (soma dos planos pagos com assinatura ativa), distribuição por status e por plano.
- **Empresas**: listagem com busca por nome/slug/e-mail, e botão de suspender/reativar cada uma. Empresa suspensa tem o login do admin bloqueado (`POST /admin/login` agora checa `status_assinatura === 'suspensa'` antes de validar a senha).
- **Planos**: CRUD completo de `planos_plataforma` (preço, limites, todas as flags `permite_*`) — antes só dava pra mudar isso escrevendo direto no banco pelo Supabase.
- **Leads Enterprise**: comportamento que já existia, sem mudanças.

Novo arquivo de rotas: `backend/src/routes/superAdminPlataforma.js`.

---

## 6. Segurança e infraestrutura de projeto

- `POST /registrar` (cadastro de cliente final) ganhou rate limit (15 tentativas/hora) — antes era o único fluxo de cadastro sem limite nenhum.
- Criado `.env.example` na raiz do projeto, documentando todas as variáveis de ambiente usadas pelo backend e frontend (sem valores reais).

---

## 7. `npm test` do frontend, que estava completamente quebrado, agora passa

A suíte não chegava nem a rodar. Encontrei e corrigi, em sequência, 4 incompatibilidades entre dependências modernas (`react-router-dom` v7, `date-fns` recente) e o Jest antigo empacotado no `react-scripts` 5 (Create React App está sem atualização há anos):

1. `react-router-dom` v7 importa um subpath (`react-router/dom`) que o resolvedor de módulos do Jest 27 não entende — corrigido com um `moduleNameMapper` em `package.json` apontando pro arquivo CJS real.
2. Faltava `TextEncoder`/`TextDecoder` no ambiente jsdom do teste (usado internamente pelo `react-router`) — polyfill adicionado em `setupTests.js` a partir do módulo nativo `util` do Node.
3. `date-fns` mais novo vem em ESM puro, que o Jest ignora por padrão em `node_modules` — adicionado `transformIgnorePatterns` no `package.json` pra incluir esse pacote na transformação.
4. `window.matchMedia` e `IntersectionObserver` não existem no jsdom por padrão (usados em `Landing.js` e `useRevelarAoRolar.js`) — mocks mínimos adicionados em `setupTests.js`.

Além disso, o único teste existente (`App.test.js`) era o boilerplate padrão do Create React App, procurando um texto ("learn react") que nunca existiu na Landing real do projeto. Substituído por um smoke test real: renderiza o `App` e confirma que a Landing page monta na rota raiz.

---

## O que **não** foi feito (e por quê)

- **Pagamento antecipado do cliente (PIX) e cobrança recorrente de assinatura de cliente**: dependem de um gateway de pagamento configurado (Mercado Pago), que por sua vez depende de credenciais que só o dono do projeto pode gerar. Documentado em detalhe no `PENDENCIAS.md`.
- **QR code de Pix real no fechamento de caixa**: mesma dependência de gateway acima.
- **Exportar relatório em PDF/Excel**: exigiria adicionar uma biblioteca nova ao frontend — não tomei essa decisão sozinho; CSV continua disponível.
- **Bot de WhatsApp enviando de verdade**: o código já está pronto (inclusive as automações novas desta sessão já usam o mesmo canal), só falta a VPS com Evolution API rodando e as 3 variáveis de ambiente (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`) — sem elas, todo envio de WhatsApp cai no modo simulado (só loga no console).
- **Corrigir os warnings de lint que quebram `npm run build` com `CI=true`**: pré-existente, de baixo risco no ambiente atual (Render não parece rodar com `CI=true`), e envolve mexer em 5 arquivos por motivos não relacionados a esta rodada de trabalho — deixei documentado, não touchei pra não misturar escopo.

---

## Variáveis de ambiente: o que falta preencher no `.env`

Comparando o `.env` atual com o `.env.example` criado nesta sessão:

**Faltando (variáveis que o código já usa, mas não estão configuradas):**
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — sem elas, todo WhatsApp (bot, lembretes, confirmação/cancelamento, recuperação de cliente, aviso de fidelidade) fica no modo simulado. É a peça que mais destrava funcionalidade de uma vez só.
- `DOMINIO_RAIZ_PLATAFORMA` — opcional, o código já usa `schednext.com.br` como padrão se não for definida; só vale setar explicitamente por clareza.
- `REACT_APP_API_URL` — essa é do **frontend**, não do `.env` da raiz (que é lido pelo backend). Precisa estar configurada como variável de ambiente do build do frontend no Render (Static Site), não aqui.

**Sobrando no `.env` (não usadas por nenhum código atual, seguras pra remover se quiser limpar):**
- `GMAIL_USER`, `GMAIL_PASS` — resíduo do envio via Gmail/nodemailer, abandonado numa sessão anterior em favor da Brevo.
- `SENDGRID_API_KEY` — nunca chegou a ser usada no código.
- `TWILIO_ACCOUNT_SID`, `TWILIO_SECRET_KEY`, `TWILIO_SID_KEY` — resíduo de uma tentativa de WhatsApp via Twilio, antes do Evolution API.
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_PROVIDER_TOKEN`, `WHATSAPP_VERIFY_TOKEN` — resíduo da integração com a Meta Cloud API, abandonada por exigir CNPJ.
- `SUPABASE_ANON_KEY` — não referenciada em nenhuma rota (só `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são usadas).

**Mantidas por serem úteis, mas não são "runtime" do servidor:**
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` — não são lidas pelo `server.js`, servem só pra rodar migrações pontuais via API de Management do Supabase (é assim que as colunas/tabelas novas desta sessão foram criadas). Vale manter.
