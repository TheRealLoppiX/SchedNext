// Campanha promocional em vigor pro plano da plataforma (vem junto de GET /planos-plataforma,
// ver backend routes/empresasPublico.js). Ciclo sem preço na campanha = preço cheio.

export function formatarReal(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

// Preço do 1º mês se a campanha definir um diferente do cheio, senão null.
export function precoPromocionalPrimeiroMes(plano) {
  const ciclo1 = plano?.campanha?.precos_por_ciclo?.find((c) => c.numero_ciclo === 1);
  if (!ciclo1 || plano.preco_mensal == null || Number(ciclo1.valor) === Number(plano.preco_mensal)) return null;
  return Number(ciclo1.valor);
}

// Ex: "1º mês R$ 9,90 · 2º mês R$ 19,90 · depois R$ 49,90/mês"
export function resumoCampanha(plano) {
  const precos = plano?.campanha?.precos_por_ciclo || [];
  if (!precos.length || plano.preco_mensal == null) return null;
  const partes = precos.map((c) => `${c.numero_ciclo}º mês R$ ${formatarReal(c.valor)}`);
  partes.push(`depois R$ ${formatarReal(plano.preco_mensal)}/mês`);
  return partes.join(' · ');
}

// Complemento do preço do 1º mês já em destaque no card: "depois R$ 99,90/mês" (ou, com mais
// ciclos promocionais, "2º mês R$ 19,90 · depois R$ 99,90/mês").
export function continuacaoCampanha(plano) {
  if (precoPromocionalPrimeiroMes(plano) == null) return null;
  const partes = plano.campanha.precos_por_ciclo
    .filter((c) => c.numero_ciclo > 1)
    .map((c) => `${c.numero_ciclo}º mês R$ ${formatarReal(c.valor)}`);
  partes.push(`depois R$ ${formatarReal(plano.preco_mensal)}/mês`);
  return partes.join(' · ');
}
