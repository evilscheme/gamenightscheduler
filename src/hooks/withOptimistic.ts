/**
 * Run an optimistic mutation: apply a state change immediately, run the
 * async side-effect, then revert on failure. Optionally reconcile with a
 * normalized server result on success.
 *
 *   await withOptimistic({
 *     apply:    () => setState(next),
 *     revert:   () => setState(prev),
 *     mutation: () => upsert(),
 *   });
 *
 * Returns the mutation result (or throws if the mutation throws).
 * If the mutation resolves with `{ error }`, revert is invoked and the
 * function returns the original result so callers can inspect it.
 */
export async function withOptimistic<T extends { error?: unknown } | void>(opts: {
  apply: () => void;
  revert: () => void;
  mutation: () => Promise<T>;
  onSuccess?: (result: T) => void;
}): Promise<T> {
  opts.apply();
  try {
    const result = await opts.mutation();
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      opts.revert();
    } else {
      opts.onSuccess?.(result);
    }
    return result;
  } catch (err) {
    opts.revert();
    throw err;
  }
}
