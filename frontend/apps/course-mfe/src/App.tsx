import { Route, Routes, useParams } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { MyEnrollmentsPage } from './enrollment/MyEnrollmentsPage';
import { RosterPage } from './enrollment/RosterPage';
import { AdminCourseListPage } from './pages/AdminCourseListPage';
import { AdminCoursePage } from './pages/AdminCoursePage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CourseListPage } from './pages/CourseListPage';

// 회차가 바뀌면 key로 화면을 새로 만든다: 선택·결과 알림·열린 모달이 이전 회차 것으로 남지 않게.
export function RosterRoute() {
  const { sessionId } = useParams();
  return <RosterPage key={sessionId} />;
}

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
      <Route
        path="/admin/sessions/:sessionId/roster"
        element={
          <RequireAuth admin>
            <RosterRoute />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
