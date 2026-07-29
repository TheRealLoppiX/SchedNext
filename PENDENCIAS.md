# SchedNext — o que falta para ficar 100%

Levantamento original de 2026-07-29, atualizado no mesmo dia depois de uma rodada de correções (ver `relatorio.md` pra detalhe completo do que foi implementado). Itens resolvidos foram removidos daqui; o que segue abaixo é o que **ainda falta**.

---

## 1. Feature pausada no meio (pagamento antecipado do cliente)

**Zero código no repositório ainda** (confirmado via grep: nenhuma referência a `mercadopago`, `pagamento_status`, `asaas_wallet` em `backend/src`). O que existe:
- Colunas mortas no banco: `empresas.asaas_wallet_id`, `agendamentos.pagamento_status`, `agendamentos.asaas_payment_id` — criadas numa sessão anterior, não usadas por nenhuma rota.
- Decisão já tomada: Asaas foi descartado (bloqueia subconta pra quem é CPF, e a SchedNext é CPF), pivotando pra Mercado Pago (OAuth "vendedor conectado", suporta split de PIX com `marketplace_fee`).
- Faltando: pegar as credenciais de teste do Mercado Pago (Public Key + Access Token) com o usuário, implementar o fluxo de OAuth (empresa conecta a própria conta MP), a rota de cobrança PIX no agendamento, e o webhook de confirmação automática.

Continua sendo o maior item pendente do projeto.

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
O campo "forma de pagamento" (dinheiro/crédito/débito/pix) já é registrado no fechamento de caixa (`POST /admin/finalizar-servico-checkout`), com seletor em `AgendaModal.js`. **O que ainda não existe**: gerar um QR code de Pix real com o valor final pro cliente escanear e confirmar automaticamente — isso exige o mesmo gateway de pagamento (Mercado Pago) do item 1, então está no mesmo bloqueio.

### 3.2 Exportar relatório em PDF ou Excel
Os Relatórios avançados (`AdminRelatorios.js`) exportam em **CSV** hoje. PDF e `.xlsx` de verdade não foram implementados (exigiria biblioteca nova no frontend, decisão que não tomei sozinho).

### 3.3 Cobrança recorrente automática do cliente assinante
Hoje `usuarios.assinante` continua sendo **um botão manual** que o admin liga/desliga (`PUT /admin/clientes/:id/assinante`) — o valor da comissão já leva em conta o preço do plano (ver `relatorio.md`), mas não existe cobrança de cartão/Pix recorrente de verdade nem baixa automática de pagamento. Mesma dependência de gateway do item 1: dá pra reaproveitar a mesma integração com Mercado Pago quando ela existir, pra cobrar tanto o agendamento avulso quanto a assinatura mensal do cliente.

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
- Cobrança recorrente da própria plataforma (assinatura SchedNext via Asaas), e-mail transacional (Brevo), confirmação de cadastro por código, recuperação de senha, wildcard de subdomínio por tenant.
- `npm test` do frontend passa de verdade agora (era completamente quebrado antes).
