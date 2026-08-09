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
// keeps the real one for its own internal scheduling. The stub hands back an
// incrementing nonzero id, like real browsers do (ids start at 1): a stub that
// returned 0 would coincide with the guard's post-callback reset value and
// mask a naive `if (frame === 0)` guard wedging on synchronous rAF.
let rafHandle = 0;
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  const realRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return ++rafHandle;
  }) as typeof window.requestAnimationFrame;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  window.requestAnimationFrame = realRaf;
}

// Same rAF-synchronising trick as scrollTo(), but for a 'resize' event: sets
// window.innerHeight then dispatches 'resize' so the component's throttled
// handler runs synchronously inside the act() block.
function resizeTo(height: number) {
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  const realRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return ++rafHandle;
  }) as typeof window.requestAnimationFrame;
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  window.requestAnimationFrame = realRaf;
}

const button = () => screen.queryByRole('button', { name: 'Back to top' });

describe('ScrollToTopButton', () => {
  let realScrollTo: typeof window.scrollTo;
  let realInnerHeight: number;

  beforeEach(() => {
    realScrollTo = window.scrollTo;
    window.scrollTo = vi.fn();
    realInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    stubMatchMedia(false);
  });

  afterEach(() => {
    window.scrollTo = realScrollTo;
    Object.defineProperty(window, 'innerHeight', { value: realInnerHeight, configurable: true });
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

  it('stays mounted while hidden, so showing and hiding can be a transition', () => {
    render(<ScrollToTopButton />);

    // Present in the DOM (queried by testid, which ignores the a11y tree)...
    const el = screen.getByTestId('scroll-to-top');
    expect(el).toBeInTheDocument();

    // ...but out of the accessibility tree and out of the tab order, which is
    // what keeps the faded-out button from being reachable. `button()` above
    // queries by role, so it is aria-hidden that makes every other test's
    // "not in the document" assertion mean "not available to the user".
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveAttribute('tabindex', '-1');

    scrollTo(3 * window.innerHeight);

    expect(el).toHaveAttribute('aria-hidden', 'false');
    expect(el).not.toHaveAttribute('tabindex');
  });

  it('re-evaluates the threshold on resize without a new scroll event', () => {
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    render(<ScrollToTopButton />);
    scrollTo(1000);
    expect(button()).toBeInTheDocument();

    // scrollY stays at 1000; only the viewport grows, so the threshold
    // (2 * innerHeight) rises from 800 to 1800, putting the unchanged
    // scroll position back under it. Without a 'resize' listener, no scroll
    // event fires here and the button would incorrectly stay visible.
    resizeTo(900);
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
