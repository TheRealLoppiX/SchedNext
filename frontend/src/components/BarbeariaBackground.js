import React from 'react';

// Ícones de barbearia em traço (mesmo estilo line-art usado no restante do app),
// desenhados na hora, sem depender de nenhuma lib de ícones externa.
const ICONS = [
  // Tesoura
  (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="10.48" x2="20" y2="16" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  ),
  // Navalha
  (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 14l10-10 5 2-8 12-6 2z" />
      <path d="M13 4l5 2" />
      <line x1="6" y1="18" x2="10.5" y2="14.5" />
    </svg>
  ),
  // Pente
  (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" {...props}>
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <line x1="5" y1="7" x2="5" y2="20" />
      <line x1="8" y1="7" x2="8" y2="20" />
      <line x1="11" y1="7" x2="11" y2="20" />
      <line x1="14" y1="7" x2="14" y2="20" />
      <line x1="17" y1="7" x2="17" y2="20" />
      <line x1="19" y1="7" x2="19" y2="20" />
    </svg>
  ),
  // Poste de barbeiro
  (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="8" y="2" width="8" height="3" rx="1" />
      <rect x="7" y="19" width="10" height="3" rx="1" />
      <rect x="9" y="5" width="6" height="14" rx="3" />
      <path d="M9 6l6 4" />
      <path d="M9 10l6 4" />
      <path d="M9 14l4.5 3" />
    </svg>
  ),
  // Máquina de cortar cabelo
  (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="7" y="3" width="8" height="10" rx="2" />
      <path d="M9 13v3M13 13v3" />
      <path d="M8 20h6l-1-4H9z" />
      <line x1="9" y1="6" x2="13" y2="6" />
      <line x1="9" y1="9" x2="13" y2="9" />
    </svg>
  )
];

// Cada entrada define: qual ícone, faixa vertical (top), tamanho e velocidade/atraso da animação.
// O atraso negativo faz a animação começar "no meio do caminho", evitando que todos apareçam
// amontoados no canto ao carregar a página.
const CONFIG = [
  { icon: 0, top: '4%', size: 42, duration: 26, delay: -3 },
  { icon: 2, top: '18%', size: 34, duration: 22, delay: -14 },
  { icon: 1, top: '32%', size: 52, duration: 32, delay: -8 },
  { icon: 3, top: '48%', size: 60, duration: 40, delay: -20 },
  { icon: 4, top: '62%', size: 46, duration: 28, delay: -5 },
  { icon: 0, top: '76%', size: 36, duration: 24, delay: -18 },
  { icon: 2, top: '88%', size: 44, duration: 30, delay: -11 }
];

function BarbeariaBackground() {
  return (
    <div className="bb-bg" aria-hidden="true">
      {CONFIG.map((cfg, i) => {
        const Icon = ICONS[cfg.icon];
        return (
          <Icon
            key={i}
            className="bb-bg-icon"
            width={cfg.size}
            height={cfg.size}
            style={{
              top: cfg.top,
              animationDuration: `${cfg.duration}s`,
              animationDelay: `${cfg.delay}s`
            }}
          />
        );
      })}
    </div>
  );
}

export default BarbeariaBackground;
