import { Route, Routes } from 'react-router-dom';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CourseListPage } from './pages/CourseListPage';

/** course-mfe의 화면 경로. Module Federation으로 shell에 붙일 때도 이 컴포넌트를 노출한다. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<CourseListPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
    </Routes>
  );
}
