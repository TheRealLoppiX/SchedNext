import { useEffect, useState } from 'react';
import { aplicarTema, temaAtual } from '../estilo/tema';

// Alterna entre tema claro e escuro. Mostra o sol no escuro (vai pro claro) e a lua no claro.
function BotaoTema({ className = '', comRotulo = false }) {
  const [tema, setTema] = useState(temaAtual);
  useEffect(() => {
    const ouvir = (e) => setTema(e.detail);
    window.addEventListener('sn-tema', ouvir);
    return () => window.removeEventListener('sn-tema', ouvir);
  }, []);
  const proximo = tema === 'claro' ? 'escuro' : 'claro';
  const rotulo = proximo === 'claro' ? 'Modo claro' : 'Modo escuro';
  return (
    <button type="button" className={`oc-tema-botao ${className}`} onClick={() => aplicarTema(proximo, true)} aria-label={rotulo} title={rotulo}>
      {tema === 'claro' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
      )}
      {comRotulo && <span className="oc-trilho-rotulo">{rotulo}</span>}
    </button>
  );
}

export default BotaoTema;
