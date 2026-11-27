import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { theme } from './theme';

// shell(host) 진입점. 테마·Provider·라우터·로그인 상태는 여기 한 곳에만 둔다(NFR-07). remote 화면은 App이 불러온다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      {/* BrowserRouter는 ModalsProvider보다 바깥: 확인 창 안에서도 router를 쓸 수 있게 한다. */}
      <BrowserRouter>
        <ModalsProvider>
          <Notifications />
          <AuthProvider>
            <AppLayout>
              <App />
            </AppLayout>
          </AuthProvider>
        </ModalsProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);
