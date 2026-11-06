import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none max-w-sm w-full px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-tile glass-panel-strong border border-white/90 dark:border-white/10 shadow-glass animate-toast text-xs font-bold text-ink dark:text-[#eef1ff]"
          >
            {toast.type === 'success' && (
              <span className="w-6 h-6 rounded-lg bg-teal/15 text-teal flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              </span>
            )}
            {toast.type === 'error' && (
              <span className="w-6 h-6 rounded-lg bg-rose/15 text-rose flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              </span>
            )}
            {toast.type === 'info' && (
              <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 stroke-[2.5]" />
              </span>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted hover:text-ink dark:hover:text-white p-0.5 rounded-md transition"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (msg) => console.log('Toast:', msg),
    };
  }
  return ctx;
}

