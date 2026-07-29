// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// O ambiente jsdom do Jest bundlado no react-scripts 5 não expõe TextEncoder/TextDecoder
// globalmente (só existem em jsdom mais novo), mas o react-router v7 depende deles internamente.
// Node já tem os dois em `util` desde a v11, só falta colocar no escopo global do teste.
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
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
