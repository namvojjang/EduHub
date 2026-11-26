import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals를 켜지 않았으므로 Testing Library의 자동 정리가 돌지 않는다. 테스트마다 직접 화면을 비운다.
afterEach(() => {
  cleanup();
});

// jsdom에 없는 브라우저 API를 채운다 (Mantine 공식 테스트 안내).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;

Element.prototype.scrollIntoView = () => {};
