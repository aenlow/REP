import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

// jsdom gaps
window.scrollTo = () => undefined;
if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
}
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => undefined;
}
