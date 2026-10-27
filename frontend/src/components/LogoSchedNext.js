import React from 'react';

// Marca da SchedNext: ícone + nome escrito ("Sched" na cor do texto, "Next" no azul da marca).
// O arquivo logo-schednext.png tem o "Sched" branco (feito pra fundo escuro) e some em fundo
// claro, por isso o nome é texto aqui. `claro` = versão pra fundo escuro (tudo branco).
function LogoSchedNext({ tamanho = 28, claro = false, className = '', style = {} }) {
  return (
    <span
      className={`logo-schednext ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(tamanho * 0.3), fontSize: Math.round(tamanho * 0.78), ...style }}
    >
      <img src="/icon-schednext.png" alt="SchedNext" style={{ height: tamanho, width: 'auto', display: 'block' }} />
      <span style={{ fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1, color: claro ? '#fff' : 'var(--logo-texto, #0f172a)' }}>
        Sched<span style={{ color: claro ? '#bcd0ff' : 'var(--logo-azul, #2554eb)' }}>Next</span>
      </span>
    </span>
  );
}

export default LogoSchedNext;
