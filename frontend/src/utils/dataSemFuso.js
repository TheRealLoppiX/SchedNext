// Formata datas "puras" (sem horário: colunas DATE do Postgres, ex: data_nascimento,
// data_inicio/data_fim de campanha) sem passar por `new Date(str)` + `toLocaleDateString`.
//
// Por quê: "2026-07-22" (sem componente de hora) é interpretado pelo JS como meia-noite EM
// UTC, um caso especial da spec, diferente de "2026-07-22T00:00:00" (sem offset), que é
// interpretado como meia-noite LOCAL. Ao converter aquela meia-noite UTC de volta pro fuso
// do Brasil (UTC-3) pra exibir, o resultado cai no dia ANTERIOR. Isso já causou um bug real:
// a comparação de aniversário de cliente (AdminClientes.js) comparava sempre com o dia
// errado. Sempre usar estas funções pra colunas DATE; para colunas TIMESTAMP/TIMESTAMPTZ
// (instantes de verdade, ex: criado_em, proxima_cobranca_em), new Date + toLocaleDateString
// continua correto.
export function partesDataSemFuso(dataStr) {
  const [ano, mes, dia] = String(dataStr).split('T')[0].split('-').map(Number);
  return { ano, mes, dia }; // mes: 1-12
}

export function formatarDataSemFuso(dataStr, { somenteDiaMes = false } = {}) {
  if (!dataStr) return '';
  const { ano, mes, dia } = partesDataSemFuso(dataStr);
  const diaStr = String(dia).padStart(2, '0');
  const mesStr = String(mes).padStart(2, '0');
  return somenteDiaMes ? `${diaStr}/${mesStr}` : `${diaStr}/${mesStr}/${ano}`;
}

// Compara mês/dia de uma data-only (ex: data_nascimento) contra uma data local de referência
// (normalmente `new Date()`, que é um instante de verdade e não sofre desse bug).
export function ehMesDiaIgual(dataStr, referencia) {
  if (!dataStr) return false;
  const { mes, dia } = partesDataSemFuso(dataStr);
  return dia === referencia.getDate() && (mes - 1) === referencia.getMonth();
}
