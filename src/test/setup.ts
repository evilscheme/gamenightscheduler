import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom does not implement Element.prototype.scrollIntoView. Components that
// call it (e.g., RankedRow's auto-scroll-to-expanded effect) would throw in
// tests. Stub it as a no-op for the entire test suite.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Node.js 26 exposes a built-in `localStorage` that is `undefined` without
// the --localstorage-file flag, which prevents vitest/jsdom from overriding it.
// Explicitly restore the jsdom-backed Storage objects on globalThis so tests
// that touch window.localStorage / window.sessionStorage work correctly.
const maybeJsdom = (globalThis as unknown as { jsdom?: { window: Window } }).jsdom;
if (maybeJsdom) {
  const win = maybeJsdom.window;
  Object.defineProperty(globalThis, "localStorage", {
    get: () => win.localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    get: () => win.sessionStorage,
    configurable: true,
  });
}
