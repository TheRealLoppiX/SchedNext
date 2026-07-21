import { useEffect, useState } from 'react';

// Atrasa a atualização de um valor — usado pra não refiltrar uma lista a cada
// tecla digitada numa busca (heurística 7: eficiência).
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
