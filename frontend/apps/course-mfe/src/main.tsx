import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminCourseListPage } from './pages/AdminCourseListPage';
import { AdminCoursePage } from './pages/AdminCoursePage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CourseListPage } from './pages/CourseListPage';

// 단독 실행용 진입점(개발 편의, 설계 2-5). shell에서 불러갈 때는 쓰이지 않는다: Provider·테마·라우터는 shell이 만든다.
// 단독 실행은 토큰이 없어 과정 API도 401이다(D-06). 화면 확인은 shell(3000)에서 한다. 신청 버튼 자리(슬롯)는 비어 있다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <BrowserRouter>
        <ModalsProvider>
          <Notifications />
          <Routes>
            <Route path="/" element={<CourseListPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/admin/courses" element={<AdminCourseListPage />} />
            <Route path="/admin/courses/:id" element={<AdminCoursePage />} />
          </Routes>
        </ModalsProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);
