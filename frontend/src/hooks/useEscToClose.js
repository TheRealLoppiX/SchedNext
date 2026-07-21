import { useEffect } from 'react';

// Fecha modais/painéis com Esc — usado por todo modal do app (heurística 7: eficiência).
export default function useEscToClose(active, onClose) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}
