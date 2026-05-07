import { forwardRef, HTMLAttributes } from 'react';

type PanelElement = 'div' | 'section' | 'details';

type PanelPadding = 'sm' | 'md' | 'none';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: PanelElement;
  padded?: PanelPadding;
};

const PADDING_CLASSES: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-4 sm:p-6',
};

const BASE_CLASSES = 'rounded-xl border border-border bg-card';

export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { as = 'div', padded = 'sm', className = '', children, ...props },
  ref,
) {
  const classes = [BASE_CLASSES, PADDING_CLASSES[padded], className]
    .filter(Boolean)
    .join(' ');

  if (as === 'section') {
    return (
      <section ref={ref as React.Ref<HTMLElement>} className={classes} {...props}>
        {children}
      </section>
    );
  }
  if (as === 'details') {
    return (
      <details ref={ref as React.Ref<HTMLDetailsElement>} className={classes} {...props}>
        {children}
      </details>
    );
  }
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className={classes} {...props}>
      {children}
    </div>
  );
});
