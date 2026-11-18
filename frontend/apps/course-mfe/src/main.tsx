import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppLayout } from './layout/AppLayout';
import { theme as mantineTheme } from './theme';

// 단독 실행용 진입점. Module Federation으로 shell에 붙일 때는 App을 노출한다.
// MUI 테마는 화면 전환이 끝나는 R6에서 제거한다.
const theme = createTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="light">
      {/* BrowserRouter는 ModalsProvider보다 바깥: 확인 창 안에서도 router를 쓸 수 있게 한다. */}
      <BrowserRouter>
        <ModalsProvider>
          <Notifications />
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppLayout>
              <App />
            </AppLayout>
          </ThemeProvider>
        </ModalsProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);
