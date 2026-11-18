import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { theme as mantineTheme } from './theme';

// 단독 실행용 진입점. Module Federation으로 shell에 붙일 때는 App을 노출한다.
// MUI 테마는 화면 전환이 끝나는 T5에서 제거한다.
const theme = createTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="light">
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </MantineProvider>
  </StrictMode>,
);
