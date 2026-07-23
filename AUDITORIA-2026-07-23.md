# Auditoria de código — 2026-07-23

Revisão completa do backend (`SchedNextAPI`) e frontend (`SchedNext`) em busca de bugs de lógica e de referências residuais a "barbearia" como se fosse o único tipo de negócio atendido pela plataforma (hoje também atende salões, estúdios de unhas e negócios genéricos).

Feita em 4 rodadas de auditoria (rotas de backend, núcleo de backend, frontend, e uma rodada extra nas páginas de admin que faltaram) mais uma revisão manual dos itens mais arriscados. Tudo que está marcado **[CORRIGIDO]** já está no working tree, aguardando commit/push. Tudo marcado **[REPORTADO]** foi deixado de propósito para você decidir, por envolver mudança de comportamento visível ou não ter certeza de que era bug.

---

## Bugs de lógica corrigidos

### Condição de corrida no estoque (`backend/src/routes/estoque.js`)
Duas movimentações de estoque simultâneas no mesmo produto liam a mesma quantidade inicial em JS e a segunda gravação sobrescrevia a primeira ("lost update"). Também não havia proteção contra deixar a quantidade negativa, e o insert de auditoria em `estoque_movimentacoes` não checava erro.
**Correção**: nova function `movimentar_estoque` no Postgres (incremento atômico via `UPDATE ... SET quantidade = quantidade + delta WHERE ... AND quantidade + delta >= 0`), chamada via `supabase.rpc(...)`. Testada diretamente (incremento, decremento e tentativa de deixar negativo).

### Double-booking na API pública Enterprise (`backend/src/routes/apiPublica.js`)
`POST /api/v1/agendamentos` criava agendamentos sem checar conflito de horário com o mesmo profissional — diferente do fluxo normal do app, que só oferece horários livres.
**Correção**: checagem de sobreposição de intervalo (mesma lógica de `[início, fim)` já usada em `/disponibilidade-filtro`) antes de criar o agendamento, retornando 409 em caso de conflito.

### `/api/v1/disponibilidade` ignorava duração do serviço e horário de funcionamento (`backend/src/routes/apiPublica.js`)
Só marcava como ocupado o minuto exato de início de um agendamento existente (um serviço de 45min ocupando 09:00–09:45 deixava 09:30 aparecer como livre), e usava uma janela fixa de 8h–20h pra qualquer empresa, ignorando `empresas.horarios_funcionamento`.
**Correção**: passou a considerar o intervalo completo `[início, início + duração)` de cada agendamento existente, e a respeitar o horário de funcionamento real do dia da semana da empresa (fechado = lista vazia).

### Bug de fuso horário não replicado em `backend/src/routes/perfil.js`
O projeto tem uma convenção documentada (`OFFSET_BRASILIA_MS`, já usada em `cron/lembretes.js`): `data_hora` é gravado como "horário de parede ingênuo rotulado como UTC", então comparar direto contra `new Date()` erra por 3h. Duas comparações em `perfil.js` (marcar agendamento como "expirado", e bloquear cancelamento de horário passado) não aplicavam essa conversão — um agendamento podia aparecer "expirado" até 3h antes da hora real, e cancelamentos podiam ser bloqueados 3h cedo demais.
**Correção**: lógica extraída para `backend/src/utils/horarioBrasilia.js` (compartilhado agora por `perfil.js` e `cron/lembretes.js`, eliminando a duplicação) e aplicada nos dois pontos que faltavam.

### Lembrete por WhatsApp sem DDI (`backend/src/cron/lembretes.js`)
`usuarios.telefone` é salvo **sem DDI** (documentado em `utils/telefone.js`), mas o envio de lembrete por WhatsApp mandava esse valor direto pra Evolution API, que espera o número completo com código do país. O fluxo do bot interativo não tinha esse problema (ali o telefone já vem com DDI direto do WhatsApp). Resultado: lembrete por WhatsApp provavelmente falhava ou ia pro número errado.
**Correção**: prefixa `55` só nesse ponto de envio específico.

### Redirect de cliente quebrado em subdomínio (`frontend/src/services/authFetch.js`)
Ao expirar a sessão em modo subdomínio (`empresa.schednext.com.br/agenda`), o código pegava o primeiro segmento do `pathname` como se fosse o slug do tenant — mas em subdomínio o slug mora no host, não no path. Resultado: redirect pra uma rota inexistente, caindo no fallback do React Router e mandando o cliente pra Landing em vez do login do próprio tenant.
**Correção**: reaproveita `obterSlugSubdominio()` (já existente), priorizado sobre o parsing do path.

### `location.pathname.includes('/admin')` em `frontend/src/pages/Dashboard.js`
Mesma classe de bug já corrigida antes em `components/Layout.js`: `.includes` casa qualquer slug de tenant que comece com "admin" (ex: empresa com slug `admin-servicos` gera path `/admin-servicos/perfil`, que contém a substring `/admin`). Um cliente desse tenant caía na visão administrativa por engano.
**Correção**: trocado para `pathname === '/admin' || pathname.startsWith('/admin/')`, igual ao padrão já usado em `Layout.js`.

### Input não controlado em `frontend/src/pages/RecuperarSenha.js`
Campo de nova senha sem `value=`, inconsistente com o resto do formulário (todo controlado). Funcionava por acidente, mas sem garantia se algo reinicializasse o campo.
**Correção**: adicionado `value={novaSenha}`.

### Terminologia hardcoded em `frontend/src/pages/Barbeiros.js`
"Nenhum barbeiro disponível" era fixo, mesmo o app já tendo um sistema de terminologia por vertical usado em todas as páginas de admin.
**Correção**: agora usa `obterTerminologia(empresaPlano?.vertical)`, igual ao resto do app.

### Off-by-one no filtro de anos (`frontend/src/pages/admin/AdminDashboard.js`)
O dropdown de anos gerava um ano a mais que o atual (em 2026, aparecia até 2027).
**Correção**: ajustado o cálculo do tamanho do array.

### Logs de diagnóstico esquecidos em produção (`frontend/src/components/AgendaModal.js`)
Dois `console.log` (um literalmente rotulado `'DIAGNOSTICO >>> ...'`) expunham `agendamento_id`, `empresaId` e a resposta completa da API no console do navegador de qualquer usuário.
**Correção**: removidos.

### Erro engolido em silêncio (`backend/src/middleware/apiKeyAuth.js`)
Atualização de `ultimo_uso_em` da API key descartava qualquer erro sem log.
**Correção**: erro agora é logado (não bloqueia a autenticação, é só telemetria).

### Código morto removido (`frontend/src/pages/Dashboard.js`)
Componente `ModalAvaliacao` (definido, nunca renderizado — o fluxo real de avaliação usa um modal inline diferente) removido.

---

## Referências a "barbearia" trocadas por linguagem neutra

- `backend/src/routes/auth.js`: mensagem de erro do login administrativo, 2 ocorrências ("E-mail ou senha da barbearia incorretos" → "E-mail ou senha incorretos").
- `backend/src/routes/empresasPublico.js`, `backend/src/schemas/index.js`, `backend/src/middleware/adminAuth.js`, `backend/server.js`, `backend/src/utils/tenantContext.js`: comentários internos (não visíveis ao usuário) ajustados.
- `frontend/src/components/HelpButton.js`: "Escolha o barbeiro" → "Escolha o profissional" na FAQ.
- `frontend/src/pages/Barbeiros.js`: mensagem de vazio ("Nenhum barbeiro disponível") passou a usar terminologia dinâmica (ver acima).
- E-mails do sistema, formulário de cadastro de empresa e correção do bug de conta-criada-antes-da-confirmação: já haviam sido tratados numa sessão anterior a esta auditoria.

Varredura por "barbearia" (case-insensitive) em **todo** o projeto não encontrou mais nenhuma ocorrência fora de usos legítimos (o vertical `'barbearia'` como uma opção entre várias no enum, nome do repositório/pasta do projeto, e a palavra "barbeiro" isolada como nome de tabela/campo interno do banco, que não foi pedida pra trocar).

---

## Decidido com o usuário

### Senha do sublogin de estoque virou PIN numérico de 4 dígitos
`estoqueCriarSubloginSchema.nova_senha` exigia só 3 caracteres livres (bem mais fraco que os 6 exigidos no resto do sistema). Decisão: virou um PIN numérico de exatamente 4 dígitos (`/^\d{4}$/`), com o input do formulário (`AdminEstoque.js`) restrito a `inputMode="numeric"` e 4 caracteres. O login (`estoqueLoginSchema.senha`) não mudou — esse campo é compartilhado com o login de admin (senha normal da empresa), só a criação do PIN do colaborador ficou restrita.

## Reportado, não corrigido (decisão sua)

### `backend/src/routes/servicos.js` — `/disponibilidade-filtro` sem filtro de empresa
A query busca **todos** os agendamentos da plataforma inteira (não filtra por `empresa_id`/`barbeiro_id`) pra montar a lista de horários ocupados. Não vaza dado sensível (só retorna `barbeiro_id`s ocupados), mas é um full table scan em toda chamada — não escala conforme a base cresce. Não corrigi porque a forma certa de limitar (por lista de `barbeiro_id`s da empresa, ou por período) depende de como o endpoint é chamado no frontend hoje.

### Achados sem risco / informativos
- `AdminBarbeiros.js` e `AdminAcoes.js`: um parâmetro de query `?empresa=...` que o backend ignora (filtra por `req.empresaId` do token, não pelo query param) — inofensivo, mas a variável que guardava isso em `AdminBarbeiros.js` tinha o nome errado (`empresaSlug` guardando um `empresa_id`); renomeada para `empresaId` por clareza. Não mexi em `AdminAcoes.js` (mesmo padrão inofensivo, sem nome enganoso).
- `AdminAgendamentos.js`: `getStatusInfo` monta `Date` sem timezone explícito — funciona porque assume fuso local = Brasília (convenção já usada no resto do projeto), não é uma regressão nova.
- Avisos de lint pré-existentes (não introduzidos por esta auditoria, não corrigidos): `Barbeiros.js` (comparações `==` em vez de `===`, dependências de `useEffect`), `Dashboard.js` (`setDados` não usado, dependência de `useEffect`).

---

## Arquivos revisados sem achados

`barbeiros.js`, `servicos.js` (fora do item acima), `fidelidade.js`, `ia.js`, `pagamentos.js`, `superAdmin.js`, `unidades.js`, `whatsapp.js`, `apiKeys.js` no backend; `services/asaas.js`, `services/groq.js`, `services/leadsEnterprise.js`, `services/pagamento.js`, `services/whatsapp/provider.js` e `bot.js`, `utils/limitesPlano.js`, `utils/senha.js`, `middleware/clienteAuth.js`, `middleware/superAdminAuth.js`, `middleware/validate.js`, `cron/assinaturas.js`, `config/supabase.js`; e no frontend `AdminEstoque.js`, `AdminUnidades.js`, `GestaoServicos.js`, `EmptyState.js`, `Login.js`, `LoginAdmin.js`, `AdminConta.js`, `AdminApiKeys.js`, `AdminAssinaturas.js`, `Layout.js`, `App.js`, `Agenda.js`, `SuperAdminLogin.js`, `SuperAdminDashboard.js`, `tenantSubdominio.js`, `terminologia.js`, `services/api.js`, hooks, `MarcaPlataforma.js`, `ConfirmDialog.js`, `Toast.js`, `LoadingButton.js`, `utils/dataSemFuso.js`, `utils/validacao.js`.

---

## Verificação

- Todos os arquivos de backend modificados passaram por `node --check` sem erro de sintaxe.
- Todos os arquivos de frontend modificados passaram por `eslint` sem erro (só warnings pré-existentes, sem relação com as mudanças).
- A function `movimentar_estoque` foi testada diretamente no banco (incremento, decremento, e tentativa de deixar quantidade negativa).
- As correções de `apiPublica.js` (disponibilidade e double-booking) não foram testadas ponta a ponta via HTTP (precisam de uma API key configurada) — a lógica reaproveita o mesmo padrão já validado em `/disponibilidade-filtro`.
