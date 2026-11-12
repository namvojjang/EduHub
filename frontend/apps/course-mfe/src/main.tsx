import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CourseListPage } from './pages/CourseListPage';

// 단독 실행용 진입점. Module Federation으로 shell에 붙일 때는 CourseListPage를 노출한다.
const theme = createTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CourseListPage />
    </ThemeProvider>
  </StrictMode>,
);
