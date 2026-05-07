import { describe, it, expect, vi } from 'vitest';
import { withOptimistic } from './withOptimistic';

describe('withOptimistic', () => {
  it('applies state, runs mutation, and does not revert on success', async () => {
    const apply = vi.fn();
    const revert = vi.fn();
    const mutation = vi.fn().mockResolvedValue({ error: null });

    await withOptimistic({ apply, revert, mutation });

    expect(apply).toHaveBeenCalledOnce();
    expect(revert).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalledOnce();
  });

  it('reverts when mutation result has a truthy error', async () => {
    const apply = vi.fn();
    const revert = vi.fn();
    const mutation = vi.fn().mockResolvedValue({ error: new Error('nope') });

    await withOptimistic({ apply, revert, mutation });

    expect(apply).toHaveBeenCalledOnce();
    expect(revert).toHaveBeenCalledOnce();
  });

  it('reverts and re-throws when mutation rejects', async () => {
    const apply = vi.fn();
    const revert = vi.fn();
    const mutation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withOptimistic({ apply, revert, mutation })).rejects.toThrow('boom');

    expect(apply).toHaveBeenCalledOnce();
    expect(revert).toHaveBeenCalledOnce();
  });

  it('calls onSuccess with the result when no error', async () => {
    const apply = vi.fn();
    const revert = vi.fn();
    const result = { error: null, data: { id: 'abc' } };
    const mutation = vi.fn().mockResolvedValue(result);
    const onSuccess = vi.fn();

    await withOptimistic({ apply, revert, mutation, onSuccess });

    expect(onSuccess).toHaveBeenCalledWith(result);
  });

  it('does not call onSuccess when mutation result has an error', async () => {
    const apply = vi.fn();
    const revert = vi.fn();
    const mutation = vi.fn().mockResolvedValue({ error: new Error('x') });
    const onSuccess = vi.fn();

    await withOptimistic({ apply, revert, mutation, onSuccess });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('returns the mutation result for caller inspection', async () => {
    const result = { error: null, data: 'ok' };
    const ret = await withOptimistic({
      apply: () => {},
      revert: () => {},
      mutation: () => Promise.resolve(result),
    });
    expect(ret).toBe(result);
  });
});
