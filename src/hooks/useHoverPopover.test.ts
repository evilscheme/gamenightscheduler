import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

beforeAll(() => {
  // jsdom never lays out, so offsetParent is always null. The hook uses it to
  // pick the visible node among duplicate responsive renders.
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return this.parentNode; },
    configurable: true,
  });
});

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

async function loadHook() {
  vi.resetModules();
  return (await import('./useHoverPopover')).useHoverPopover;
}

function mountCell(date: string, rect: Partial<DOMRect>, visible = true) {
  const host = document.createElement('div');
  const el = document.createElement('button');
  el.setAttribute('data-date', date);
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 40, height: 40, bottom: 40, right: 40, ...rect }) as DOMRect;
  if (visible) host.appendChild(el);
  document.body.appendChild(host);
  // An unattached parent yields offsetParent === null via the stub above.
  if (!visible) el.remove();
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });
beforeEach(() => { stubMatchMedia(true); });

describe('useHoverPopover', () => {
  it('reports hoverCapable false on a touch device', async () => {
    stubMatchMedia(false);
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() => useHoverPopover(null));
    expect(result.current.hoverCapable).toBe(false);
  });

  it('returns null coords when nothing is hovered', async () => {
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() => useHoverPopover(null));
    expect(result.current.coords).toBeNull();
  });

  it('anchors to the horizontal centre of the cell', async () => {
    mountCell('2026-09-04', { left: 100, width: 40, top: 500, bottom: 540 });
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() => useHoverPopover('2026-09-04'));
    expect(result.current.coords?.x).toBe(120);
  });

  it('places above a cell with room overhead', async () => {
    mountCell('2026-09-04', { top: 500, bottom: 540 });
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() => useHoverPopover('2026-09-04'));
    expect(result.current.coords).toMatchObject({ placeBelow: false, y: 494 });
  });

  it('flips below a cell near the viewport top', async () => {
    mountCell('2026-09-04', { top: 10, bottom: 50 });
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() => useHoverPopover('2026-09-04'));
    expect(result.current.coords).toMatchObject({ placeBelow: true, y: 56 });
  });

  it('returns null coords when no cell matches', async () => {
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() => useHoverPopover('2026-01-01'));
    expect(result.current.coords).toBeNull();
  });

  it('honours a custom selector', async () => {
    mountCell('2026-09-04', { left: 200, width: 20 });
    const useHoverPopover = await loadHook();
    const { result } = renderHook(() =>
      useHoverPopover('2026-09-04', { selector: (d) => `button[data-date="${d}"]` }));
    expect(result.current.coords?.x).toBe(210);
  });
});
