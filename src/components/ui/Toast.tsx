'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface ToastItem {
  id: string;
  message: string;
  tone: 'primary' | 'danger';
}

interface ToastContextValue {
  show: (message: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Each toast owns its own dismissal timer. Scheduling here (rather than in
  // an effect on `toasts`) keeps each timer ticking against the moment its
  // toast was created, so showing a new toast can't reset older ones.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const show = useCallback((message: string, tone: ToastItem['tone'] = 'primary') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((p) => p.id !== id));
      timersRef.current.delete(id);
    }, TOAST_DURATION_MS);
    timersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-60 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
              t.tone === 'danger'
                ? 'bg-danger text-white'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
