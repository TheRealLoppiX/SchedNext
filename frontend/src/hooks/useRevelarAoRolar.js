import { useEffect, useRef, useState } from 'react';

// Adiciona a classe "ln-visible" quando o elemento entra na viewport, usado pra animar
// seções da landing ao rolar a página (ver Landing.css). Só observa uma vez: depois que
// aparece, para de observar (não some de novo ao rolar pra cima).
export default function useRevelarAoRolar() {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  return [ref, visivel];
}
