import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

// Substitui os alert()/toasts reimplementados em cada página por um único mecanismo
// não-bloqueante e consistente em todo o app (heurísticas 1, 4 e 9).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const show = useCallback((message, { type = 'info', duration = 4500 } = {}) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const toast = {
    success: (msg, opts) => show(msg, { ...opts, type: 'success' }),
    error: (msg, opts) => show(msg, { ...opts, type: 'error' }),
    info: (msg, opts) => show(msg, { ...opts, type: 'info' })
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="bb-toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bb-toast bb-toast-${t.type}`}
            onClick={() => remove(t.id)}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de um ToastProvider');
  return ctx;
}
