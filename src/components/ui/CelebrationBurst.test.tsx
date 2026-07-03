import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SessionGlow } from './CelebrationBurst';

function stubCanvas2dContext() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => ({
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
    closePath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
  }));
}

function stubRect(width: number, height: number) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('SessionGlow', () => {
  beforeEach(() => {
    stubCanvas2dContext();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a canvas and schedules the glow when it has a drawable box', () => {
    stubRect(320, 84);
    const onDone = vi.fn();
    const { container } = render(<SessionGlow onDone={onDone} />);
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('finishes immediately (no animation) when there is no drawable surface', async () => {
    stubRect(0, 0);
    const onDone = vi.fn();
    render(<SessionGlow onDone={onDone} />);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0)); // flush queueMicrotask
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
