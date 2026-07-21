import React from 'react';

// Botão com spinner + desabilitado durante requisições assíncronas — evita duplo
// envio e dá visibilidade de que algo está acontecendo (heurística 1).
function LoadingButton({ loading, children, disabled, ...props }) {
  return (
    <button disabled={loading || disabled} {...props}>
      {loading ? <span className="bb-spinner" /> : children}
    </button>
  );
}

export default LoadingButton;
