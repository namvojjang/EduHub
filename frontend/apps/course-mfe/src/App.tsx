import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { MyEnrollmentsPage } from './enrollment/MyEnrollmentsPage';
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
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/my/enrollments"
        element={
          <RequireAuth>
            <MyEnrollmentsPage />
          </RequireAuth>
        }
      />
      {/* 관리자 화면 (FR-03). 화면에서도 ADMIN만 들어오게 하지만 실제 차단은 백엔드다 (NFR-03). */}
      <Route
        path="/admin/courses"
        element={
          <RequireAuth admin>
            <AdminCourseListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/courses/:id"
        element={
          <RequireAuth admin>
            <AdminCoursePage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
