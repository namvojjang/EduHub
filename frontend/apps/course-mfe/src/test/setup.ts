import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals를 켜지 않았으므로 Testing Library의 자동 정리가 돌지 않는다. 테스트마다 직접 화면을 비운다.
afterEach(() => {
  cleanup();
});
