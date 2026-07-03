import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SessionCelebration } from './CelebrationBurst';

describe('SessionCelebration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the trace rect with fill="none" so it can never be a black box', () => {
    const { container } = render(<SessionCelebration />);
    const rect = container.querySelector('svg rect');
    expect(rect).not.toBeNull();
    // The fill is an attribute (not a CSS class), so a missing stylesheet can
    // never leave the SVG rect's default black fill showing.
    expect(rect?.getAttribute('fill')).toBe('none');
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('signals completion via onDone after the celebration finishes', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SessionCelebration onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
