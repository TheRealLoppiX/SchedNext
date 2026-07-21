// Formata progressivamente para (xx) xxxxx-xxxx enquanto o usuário digita.
export function formatarTelefone(valor) {
  let v = (valor || '').replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  v = v.replace(/^(\d{2})(\d)/, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');
  return v;
}
