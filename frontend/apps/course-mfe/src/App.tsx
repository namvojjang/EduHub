import { Route, Routes } from 'react-router-dom';
import { AdminCourseListPage } from './pages/AdminCourseListPage';
import { AdminCoursePage } from './pages/AdminCoursePage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CourseListPage } from './pages/CourseListPage';

/** course-mfe의 화면 경로. Module Federation으로 shell에 붙일 때도 이 컴포넌트를 노출한다. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<CourseListPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
      {/* 관리자 화면 (FR-03). 인증(NFR-03)이 생기면 관리자만 들어오게 막는다. */}
      <Route path="/admin/courses" element={<AdminCourseListPage />} />
      <Route path="/admin/courses/:id" element={<AdminCoursePage />} />
    </Routes>
  );
}
