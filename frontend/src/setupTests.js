// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import { TextEncoder, TextDecoder } from 'util';

// Herdado da época do Jest do react-scripts 5, cujo jsdom não expunha TextEncoder/TextDecoder
// (o react-router v7 depende deles). O jsdom do Vitest já tem; fica só como garantia.
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// jsdom também não implementa IntersectionObserver (usado em hooks/useRevelarAoRolar.js pra
// animações de scroll). Mock mínimo: nunca "intersecta" de verdade, só evita o crash.
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom não implementa window.matchMedia (usado em Landing.js pra respeitar
// "prefers-reduced-motion"). Mock mínimo, só pra não quebrar o render em teste.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  });
}
