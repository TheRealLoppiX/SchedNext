// Cobrança cancelada: a empresa usa o plano até o dia anterior ao vencimento, e no dia do
// vencimento o cron do backend (src/cron/assinaturas.js) passa a conta pro Grátis.
const DIA_MS = 24 * 60 * 60 * 1000;
const FUSO = 'America/Sao_Paulo';

// Data (AAAA-MM-DD) no fuso de Brasília, pra contar dias de calendário sem erro de fuso.
const diaBrasilia = (data) => new Date(data).toLocaleDateString('en-CA', { timeZone: FUSO });

export function acessoAteCancelamento(proximaCobrancaEm) {
  const ultimoDia = new Date(new Date(proximaCobrancaEm).getTime() - DIA_MS);
  const dias = Math.round((Date.parse(diaBrasilia(ultimoDia)) - Date.parse(diaBrasilia(Date.now()))) / DIA_MS);
  return {
    data: ultimoDia.toLocaleDateString('pt-BR', { timeZone: FUSO }),
    dias: Math.max(dias, 0)
  };
}

export function textoDiasRestantes(dias) {
  if (dias === 0) return 'Hoje é o último dia do seu plano.';
  if (dias === 1) return 'Falta 1 dia de plano.';
  return `Faltam ${dias} dias de plano.`;
}
