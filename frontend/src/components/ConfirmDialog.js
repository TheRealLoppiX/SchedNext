import React, { createContext, useContext, useState } from 'react';
import useEscToClose from '../hooks/useEscToClose';

const ConfirmContext = createContext(null);

// Substitui window.confirm() por um modal consistente, com nível de severidade e
// texto de consequência explícito (heurísticas 3, 4 e 5).
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = (message, opts = {}) =>
    new Promise((resolve) => {
      setState({
        message,
        detail: opts.detail || '',
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        danger: !!opts.danger,
        resolve
      });
    });

  const responder = (resultado) => {
    state.resolve(resultado);
    setState(null);
  };

  useEscToClose(!!state, () => responder(false));

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="bb-modal-overlay" onClick={() => responder(false)}>
          <div
            className={`bb-confirm-box ${state.danger ? 'bb-confirm-danger' : ''}`}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <p className="bb-confirm-message">{state.message}</p>
            {state.detail && <p className="bb-confirm-detail">{state.detail}</p>}
            <div className="bb-confirm-actions">
              <button className="bb-btn-secondary" onClick={() => responder(false)}>
                {state.cancelText}
              </button>
              <button
                className={state.danger ? 'bb-btn-danger' : 'bb-btn'}
                onClick={() => responder(true)}
                autoFocus
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de um ConfirmProvider');
  return ctx;
}
