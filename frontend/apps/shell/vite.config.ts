/// <reference types="vitest" />
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const API_PROXY = { '/api': 'http://localhost:8080' };

// shared 목록은 세 앱이 같아야 한다(설계 2-4). singleton이라 React·Mantine·라우터·http가 한 벌만 뜬다.
const shared = {
  react: { singleton: true, requiredVersion: '^18' },
  'react-dom': { singleton: true, requiredVersion: '^18' },
  'react-router-dom': { singleton: true },
  '@mantine/core': { singleton: true },
  '@mantine/hooks': { singleton: true },
  '@mantine/modals': { singleton: true },
  '@mantine/notifications': { singleton: true },
  '@eduhub/http': { singleton: true },
  '@eduhub/api-client': { singleton: true },
};

// 테스트(vitest)에서는 federation 플러그인을 쓰지 않는다. remote 모듈 ID(courseMfe/…, enrollmentMfe/…)를
// 빈 가상 모듈로 풀어 두고, 각 테스트가 vi.mock('courseMfe/…', factory)로 내용을 채운다.
const remoteStub: Plugin = {
  name: 'eduhub-remote-stub',
  resolveId(id) {
    return /^(courseMfe|enrollmentMfe)\//.test(id) ? `\0${id}` : undefined;
  },
  load(id) {
    return id.startsWith('\0courseMfe/') || id.startsWith('\0enrollmentMfe/')
      ? 'export {};'
      : undefined;
  },
};

const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [
    react(),
    isTest
      ? remoteStub
      : federation({
          name: 'shell',
          // remote는 Vite ESM이므로 type: 'module'. 포트는 courseMfe 3001, enrollmentMfe 3002.
          remotes: {
            courseMfe: {
              type: 'module',
              name: 'courseMfe',
              entry: 'http://localhost:3001/remoteEntry.js',
            },
            enrollmentMfe: {
              type: 'module',
              name: 'enrollmentMfe',
              entry: 'http://localhost:3002/remoteEntry.js',
            },
          },
          shared,
          dts: false,
        }),
  ],
  build: {
    // Module Federation 런타임이 top-level await를 쓰므로 최신 타깃이 필요하다.
    target: 'esnext',
  },
  server: {
    port: 3000,
    strictPort: true,
    // 브라우저가 3000에서 8080을 직접 부르면 CORS로 막히므로, 개발 서버가 /api를 백엔드로 넘긴다.
    proxy: API_PROXY,
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: API_PROXY,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
