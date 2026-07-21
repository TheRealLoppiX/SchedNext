// Rodapé "feito com SchedNext" nas telas do cliente final. Fixo no plano Grátis, removível
// a partir do Essencial (ver §3 do plano de plataforma) — é o "gancho" de white-label que
// empurra pro upgrade, então só desaparece quando o plano da empresa permitir de verdade.
function MarcaPlataforma({ empresa }) {
  if (empresa?.plano_plataforma?.permite_remover_marca) return null;

  return (
    <p style={estilo}>
      Feito com{' '}
      <a href="/" style={estiloLink}>
        <img src="/icon-schednext.png" alt="" style={estiloIcone} /> SchedNext
      </a>
    </p>
  );
}

const estilo = { textAlign: 'center', fontSize: '12px', color: 'var(--bb-text-muted)', margin: '18px 0 0' };
const estiloLink = { color: 'inherit', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' };
const estiloIcone = { height: '14px', width: 'auto' };

export default MarcaPlataforma;
