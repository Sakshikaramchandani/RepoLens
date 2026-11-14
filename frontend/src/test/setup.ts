import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../mocks/server";

/**
 * Node ≥ 25 ships its own experimental `localStorage` global, which is `undefined` unless Node
 * runs with --localstorage-file — and it shadows jsdom's. Install an in-memory Web Storage
 * whenever the environment's is missing, so tests behave the same on every Node version.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof globalThis[name]?.getItem !== "function") {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}

// jsdom does not implement ResizeObserver, matchMedia or <dialog>; provide small stand-ins.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

/**
 * jsdom's AbortSignal is not accepted by Node's fetch/Request ("Expected signal to be an instance
 * of AbortSignal"), so any fetch with a signal fails in tests (real browsers are fine). Wrap the
 * MSW-patched fetch: drop the foreign signal but still honour an abort before the response arrives.
 */
function withJsdomSignals(inner: typeof fetch): typeof fetch {
  return (input, init) => {
    const signal = init?.signal;
    if (!signal) return inner(input, init);
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      inner(input, { ...init, signal: undefined }).then(resolve, reject);
    });
  };
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  globalThis.fetch = withJsdomSignals(globalThis.fetch);
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterAll(() => server.close());
