import { HTMLAttributes } from 'react';

interface EyebrowLabelProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'muted' | 'danger' | 'warning';
}

const VARIANT_CLS: Record<NonNullable<EyebrowLabelProps['variant']>, string> = {
  primary: 'text-primary',
  muted: 'text-muted-foreground',
  danger: 'text-danger',
  warning: 'text-warning',
};

export function EyebrowLabel({ variant = 'primary', className = '', children, ...props }: EyebrowLabelProps) {
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.08em] font-bold ${VARIANT_CLS[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
