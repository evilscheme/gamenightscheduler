import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useCelebration } from './CelebrationBurst';

function Harness() {
  const { celebrate, overlay } = useCelebration();
  return (
    <div>
      <button onClick={celebrate}>go</button>
      {overlay}
    </div>
  );
}

describe('useCelebration', () => {
  beforeEach(() => {
    // Minimal 2D context stub for jsdom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => ({
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(), setTransform: vi.fn(),
      // fields the renderer may set
      globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '',
    }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { void cb; return 1; });
  });

  it('mounts a canvas overlay only after celebrate() is called', () => {
    const { container, getByText } = render(<Harness />);
    expect(container.querySelector('canvas')).toBeNull();
    act(() => { getByText('go').click(); });
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });
});
