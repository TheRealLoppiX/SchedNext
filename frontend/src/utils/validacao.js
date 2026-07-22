// Validação simples de formato de e-mail para feedback em tempo real no formulário
// (heurística 5: prevenção de erros); o backend continua sendo a fonte de verdade.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email) {
  return REGEX_EMAIL.test(String(email || '').trim());
}
