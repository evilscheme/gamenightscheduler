import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScrollToTopButton } from './ScrollToTopButton';

// jsdom does not implement window.matchMedia; the component reads it on click
// to honour prefers-reduced-motion.
function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// jsdom never actually scrolls, so set scrollY directly and fire the event the
// component listens for. requestAnimationFrame is made synchronous for just
// this dispatch so the state update settles inside the act() block — userEvent
// keeps the real one for its own internal scheduling.
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  const realRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  window.requestAnimationFrame = realRaf;
}

const button = () => screen.queryByRole('button', { name: 'Back to top' });

describe('ScrollToTopButton', () => {
  let realScrollTo: typeof window.scrollTo;

  beforeEach(() => {
    realScrollTo = window.scrollTo;
    window.scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    stubMatchMedia(false);
  });

  afterEach(() => {
    window.scrollTo = realScrollTo;
    vi.restoreAllMocks();
  });

  it('is hidden at the top of the page', () => {
    render(<ScrollToTopButton />);
    expect(button()).not.toBeInTheDocument();
  });

  it('stays hidden at exactly two viewport heights', () => {
    render(<ScrollToTopButton />);
    scrollTo(2 * window.innerHeight);
    expect(button()).not.toBeInTheDocument();
  });

  it('appears past two viewport heights', () => {
    render(<ScrollToTopButton />);
    scrollTo(2 * window.innerHeight + 1);
    expect(button()).toBeInTheDocument();
  });

  it('hides again when scrolled back below the threshold', () => {
    render(<ScrollToTopButton />);
    scrollTo(3 * window.innerHeight);
    expect(button()).toBeInTheDocument();

    scrollTo(window.innerHeight);
    expect(button()).not.toBeInTheDocument();
  });

  it('scrolls smoothly to the top when clicked', async () => {
    const user = userEvent.setup();
    render(<ScrollToTopButton />);
    scrollTo(3 * window.innerHeight);

    await user.click(screen.getByRole('button', { name: 'Back to top' }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps without animation when the user prefers reduced motion', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(<ScrollToTopButton />);
    scrollTo(3 * window.innerHeight);

    await user.click(screen.getByRole('button', { name: 'Back to top' }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('removes its scroll listener on unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ScrollToTopButton />);

    unmount();

    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
