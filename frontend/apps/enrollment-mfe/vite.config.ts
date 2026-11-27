/// <reference types="vitest" />
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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

const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [
    react(),
    // 테스트(vitest)에서는 federation 플러그인을 쓰지 않는다.
    !isTest &&
      federation({
        name: 'enrollmentMfe',
        filename: 'remoteEntry.js',
        // shell이 불러가는 화면. 노출 이름은 shell의 remotes.d.ts·App.tsx와 맞춘다.
        exposes: {
          './EnrollButton': './src/components/EnrollButton.tsx',
          './MyEnrollmentsPage': './src/pages/MyEnrollmentsPage.tsx',
          './RosterPage': './src/pages/RosterPage.tsx',
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
    port: 3002,
    strictPort: true,
    // 브라우저가 3002에서 8080을 직접 부르면 CORS로 막히므로, 개발 서버가 /api를 백엔드로 넘긴다.
    proxy: API_PROXY,
  },
  preview: {
    port: 3002,
    strictPort: true,
    proxy: API_PROXY,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
