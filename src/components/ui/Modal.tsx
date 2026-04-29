'use client';

import { ReactNode, useEffect, useCallback } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  eyebrow?: ReactNode;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  dismissOnBackdrop?: boolean;
  'data-testid'?: string;
}

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
  'data-testid': dataTestId,
}: ModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleKey]);

  if (!open) return null;

  const sizeCls = size === 'lg' ? 'max-w-xl' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={dataTestId}
    >
      <div
        className={`w-full ${sizeCls} rounded-xl border border-border bg-card p-6 shadow-2xl`}
      >
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h3 className="text-lg font-semibold text-card-foreground mb-4">{title}</h3>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
