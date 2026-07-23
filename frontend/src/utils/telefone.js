// Formata progressivamente para (xx) xxxxx-xxxx (celular) ou (xx) xxxx-xxxx (fixo) enquanto
// o usuário digita.
export function formatarTelefone(valor) {
  let v = (valor || '').replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  v = v.replace(/^(\d{2})(\d)/, '($1) $2');
  // Fixo tem 8 dígitos locais (10 no total com DDD), celular tem 9 (11 no total) — sem essa
  // distinção, um fixo completo saía com o hífen no grupo errado (ex: "3333-444" virava
  // "33334-44" pelo grupo de 5 aplicado sempre).
  if (v.replace(/\D/g, '').length > 10) {
    v = v.replace(/(\d{5})(\d)/, '$1-$2');
  } else {
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
  }
  return v;
}
