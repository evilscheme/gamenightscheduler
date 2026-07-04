import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './Button';

describe('Button danger variant', () => {
  it('uses semantic danger tokens, not hardcoded red', () => {
    const { getByRole } = render(<Button variant="danger">Delete</Button>);
    const cls = getByRole('button').className;
    expect(cls).toContain('bg-danger');
    expect(cls).toContain('text-danger-foreground');
    expect(cls).not.toContain('bg-red-600');
    expect(cls).not.toContain('text-white');
  });
});
