import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Input } from './Input';

describe('Input label association', () => {
  it('links label to input even when no id is passed', () => {
    const { getByLabelText } = render(<Input label="Display Name" />);
    // getByLabelText only resolves if htmlFor/id are correctly linked.
    const field = getByLabelText('Display Name');
    expect(field.tagName).toBe('INPUT');
    expect(field.id).toBeTruthy();
  });

  it('respects an explicitly provided id', () => {
    const { getByLabelText } = render(<Input label="Email" id="custom-id" />);
    expect(getByLabelText('Email').id).toBe('custom-id');
  });
});
