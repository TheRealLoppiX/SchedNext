// Validação simples de formato de e-mail para feedback em tempo real no formulário
// (heurística 5: prevenção de erros); o backend continua sendo a fonte de verdade.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email) {
  return REGEX_EMAIL.test(String(email || '').trim());
}

// CPF (11 dígitos) ou CNPJ (14) com máscara progressiva. Só formata e checa o tamanho; os
// dígitos verificadores são conferidos pelo backend (antifraude de cadastro).
export function formatarDocumento(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function documentoTemTamanhoValido(valor) {
  const n = String(valor || '').replace(/\D/g, '').length;
  return n === 11 || n === 14;
}
