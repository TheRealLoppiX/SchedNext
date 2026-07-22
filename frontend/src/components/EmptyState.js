import React from 'react';

// Estado vazio com orientação de próximo passo. Antes as telas só diziam "nada aqui"
// sem dizer o que fazer a respeito (heurísticas 1 e 10). Cores neutras de propósito:
// este componente é usado dentro do conteúdo das páginas (ainda no tema claro antigo),
// não é um overlay como o toast/confirm/ajuda.
function EmptyState({ icon = '📭', title, hint, action }) {
  return (
    <div style={s.wrap}>
      <div style={s.icon}>{icon}</div>
      <p style={s.title}>{title}</p>
      {hint && <p style={s.hint}>{hint}</p>}
      {action}
    </div>
  );
}

const s = {
  wrap: { textAlign: 'center', padding: '40px 20px', color: '#6b7280' },
  icon: { fontSize: '32px', marginBottom: '10px', opacity: 0.6 },
  title: { fontWeight: '600', color: '#374151', margin: '0 0 6px', fontSize: '15px' },
  hint: { fontSize: '13.5px', margin: '0 0 16px', color: '#9ca3af' }
};

export default EmptyState;
