'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icon or emoji to display (optional) */
  icon?: ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Action button or link (optional) */
  action?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-8 ${className}`}>
      {icon && <span className="text-5xl mb-4 block">{icon}</span>}
      <h2 className="text-xl font-semibold text-card-foreground mb-2">{title}</h2>
      {description && (
        <p className="text-muted-foreground mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
