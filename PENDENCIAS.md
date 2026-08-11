**Atualização 2026-08-11**: Asaas foi completamente descontinuado (`backend/src/services/asaas.js` apagado) — toda cobrança recorrente (assinatura da própria plataforma E assinatura do cliente final) agora passa pelo Mercado Pago. Falta preencher `MERCADOPAGO_PLATAFORMA_ACCESS_TOKEN` no Render (Access Token de produção da conta dona da aplicação, painel Credenciais — diferente do OAuth do Pix avulso) e testar o upgrade de plano ponta a ponta.

# SchedNext — o que falta para ficar 100%

Levantamento original de 2026-07-29, atualizado no mesmo dia depois de uma rodada de correções (ver `relatorio.md` pra detalhe completo do que foi implementado). Itens resolvidos foram removidos daqui; o que segue abaixo é o que **ainda falta**.

---

## 1. Pagamento antecipado do cliente (Mercado Pago) — código pronto, falta credencial real + rodar o SQL

Implementado em 2026-08-11: modelo OAuth "vendedor conectado" (cada empresa conecta a própria conta Mercado Pago, cobrança de Pix sai com o access_token dela, SchedNext fica com uma fatia via `application_fee`).
- Backend: `backend/src/services/mercadopago.js` (cliente HTTP), `backend/src/routes/mercadopago.js` (conectar/desconectar/cobrar/status/callback OAuth/webhook), `backend/src/cron/mercadoPago.js` (renovação de token), `backend/src/services/pagamentoAgendamento.js` (cálculo de valor compartilhado com o fechamento de caixa).
- Frontend: `frontend/src/pages/admin/AdminMercadoPago.js` (conectar/desconectar), Pix no PDV em `AgendaModal.js`, Pix no agendamento do cliente em `Agenda.js`.
- Taxa de marketplace por plano: `taxa_marketplace_percentual` em `planos_plataforma`, editável pelo admin absoluto (mesmo CRUD de planos já existente).
- **Migração de banco já aplicada em produção (2026-08-11, via Management API do Supabase)**: colunas novas em `empresas` (`mercadopago_user_id`, `mercadopago_access_token`, `mercadopago_refresh_token`, `mercadopago_token_expira_em`), `agendamentos.asaas_payment_id` renomeada pra `mercadopago_payment_id`, `planos_plataforma.taxa_marketplace_percentual` criada (5% no Grátis, 0% nos demais).
- **Aplicação "SchedNext" cadastrada no Mercado Pago e credenciais de produção configuradas no Render** (`MERCADOPAGO_CLIENT_ID`/`SECRET`/`WEBHOOK_SECRET`, Checkout Transparente + API de Pagamentos).
- **Fluxo de conexão OAuth confirmado funcionando em produção (2026-08-11)**: testado de ponta a ponta pelo usuário (`/admin/mercadopago` → Conectar → autorizar com uma conta diferente da dona da aplicação → volta conectado). Bug corrigido nesse teste: `redirect_uri` virava a string `"undefined"` quando `BACKEND_URL` não estava setado no serviço certo do Render — corrigido tanto configurando a env var quanto com fallback no código (deriva do host da própria requisição se `BACKEND_URL` faltar).
- **Falta pra terminar de validar**:
  1. Gerar um Pix de teste de verdade (PDV ou agendamento do cliente) e confirmar que o QR code aparece e o webhook marca `pagamento_status = 'pago'` depois de pago.

Fora de escopo por decisão consciente: cancelamento automático de agendamento não pago, revogação de token ao desconectar, split de dinheiro pra comissão de profissional (isso continua sendo só relatório interno, não mexe em dinheiro real — ver `percentual_comissao` em `barbeiros`).

---

## 2. Depende de infraestrutura externa (código pronto, falta ligar)

### 2.1 Bot de agendamento via WhatsApp
Código completo e correto: máquina de estados em `backend/src/services/whatsapp/bot.js` (menu → escolher profissional → data → horário → serviço → confirmação), webhook gateado por plano em `backend/src/routes/whatsapp.js`. Sem `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE` configurados no `.env`, `backend/src/services/whatsapp/provider.js` só loga a mensagem no console ("[WhatsApp simulado]") em vez de enviar de verdade — isso afeta não só o bot, mas **todos** os envios de WhatsApp do sistema (lembretes, confirmação/cancelamento de agendamento, recuperação de cliente, aviso de fidelidade). Falta: subir a VPS na Oracle Cloud com o Evolution API self-hosted e preencher essas 3 variáveis.

### 2.2 Domínio próprio (Enterprise)
Backend e frontend prontos (`backend/src/routes/dominioCustomizado.js`, `frontend/src/pages/admin/AdminDominio.js`), mas nunca foi testado ponta a ponta com um domínio real de cliente apontando via DNS. Vale rodar um teste real assim que o primeiro cliente Enterprise pedir isso.

### 2.3 Certificado SSL wildcard do Render
Estava "Certificate Pending" na última verificação (2026-07-29, cedo). Não foi reverificado desde então — confirmar no painel do Render se já saiu do pending.

---

## 3. Board do Trello (2026-07-29) — o que ainda falta

### 3.1 PIX de verdade no fechamento do atendimento
Implementado junto com o item 1 (2026-08-11): quando "Pix" é selecionado como forma de pagamento no PDV (`AgendaModal.js`) e a empresa tem o Mercado Pago conectado, aparece um botão "Gerar Pix" que cria a cobrança de verdade (`POST /admin/mercadopago/pix/:agendamentoId`) e mostra QR Code + código copia-e-cola, com confirmação automática por polling. Mesmo bloqueio do item 1 pra funcionar em produção (SQL + credenciais reais).

### 3.2 Exportar relatório em PDF ou Excel
Os Relatórios avançados (`AdminRelatorios.js`) exportam em **CSV** hoje. PDF e `.xlsx` de verdade não foram implementados (exigiria biblioteca nova no frontend, decisão que não tomei sozinho).

### 3.3 Cobrança recorrente automática do cliente assinante
Implementado em 2026-08-11 (junto com a migração do Asaas — ver item 1): o cliente final agora tem uma página própria (`/:empresaSlug/assinatura`) pra ativar cobrança automática por cartão via Mercado Pago Preapproval, usando o access_token da própria empresa (mesmo OAuth do Pix avulso), com a fatia da SchedNext via `application_fee`. É **aditivo** — o toggle manual do admin (`PUT /admin/clientes/:id/plano`) continua funcionando sozinho, sem cobrança nenhuma, pra quem prefere combinar por fora. Falta testar ponta a ponta em produção (sem precedente de código pra espelhar, diferente do Pix avulso que tinha o Asaas — ver `routes/mercadopago.js`, `processarNotificacaoAssinatura`).

---

## 4. Qualidade / segurança menores

- `npm run build` (frontend) ainda falha se `CI=true` for setado (bug pré-existente, não desta sessão): ~15 warnings de lint (variáveis não usadas, `==` em vez de `===`, dependências de hook faltando) em `Agenda.js`, `Barbeiros.js`, `Dashboard.js`, `AdminAcoes.js`, `AdminClientes.js`. Sem `CI=true` o build passa normal, então não afeta o deploy atual — só é risco se a config do Render mudar um dia.
- `frontend/README.md` continua sendo o boilerplate padrão do Create React App. Não existe README no `backend/`. (O `.env.example` na raiz já cobre a parte de variáveis de ambiente.)

---

## O que está funcionando (confirmado testando o código, não só lendo)

- **Cobrança de assinante corrigida**: `/agendar` e `/admin/finalizar-servico-checkout` agora descontam os serviços já inclusos no plano do cliente antes de gravar `valor_total`.
- Agendamento (cliente e admin), multi-unidade, API pública, IA, paleta customizada, remover marca, relatórios avançados, domínio próprio: funcionando e corretamente gateados por plano.
- Recuperação automática de cliente inativo e aniversário (cron diário), notificação automática de prêmio de fidelidade conquistado, WhatsApp como canal em confirmação/cancelamento/recuperação de cliente (quando o plano permite e a Evolution API estiver configurada).
- Taxas de maquineta cadastráveis, comissionamento por profissional (com rateio de assinante) e receita líquida nos relatórios.
- Painel do admin absoluto: CRUD de planos da plataforma, listagem/suspensão de empresas, métricas gerais (MRR, empresas por plano/status).
- Cobrança recorrente da própria plataforma (assinatura SchedNext, migrada do Asaas pro Mercado Pago em 2026-08-11 — ver item 1), e-mail transacional (Brevo), confirmação de cadastro por código, recuperação de senha, wildcard de subdomínio por tenant.
- `npm test` do frontend passa de verdade agora (era completamente quebrado antes).