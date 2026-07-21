import { useEffect } from 'react';

// Aplica a paleta customizada do tenant como CSS custom properties, sobrescrevendo os
// tokens padrão definidos em index.css — só quando o plano da empresa permite (Essencial+,
// ver §7 do plano de plataforma) e ela já configurou uma cor. Empresas no plano Grátis
// continuam com a paleta padrão da plataforma (o "gancho" visual pro upgrade).
export default function usePaletaTenant(empresa) {
  useEffect(() => {
    const permitido = empresa?.plano_plataforma?.permite_paleta_customizada;
    const raiz = document.documentElement;

    if (!permitido || !empresa?.cor_principal) {
      return;
    }

    const principal = empresa.cor_principal;
    const destaque = empresa.cor_destaque || empresa.cor_principal;

    raiz.style.setProperty('--bb-gold', principal);
    raiz.style.setProperty('--bb-gold-dark', destaque);
    raiz.style.setProperty('--bb-gold-light', principal);

    return () => {
      raiz.style.removeProperty('--bb-gold');
      raiz.style.removeProperty('--bb-gold-dark');
      raiz.style.removeProperty('--bb-gold-light');
    };
  }, [empresa]);
}
