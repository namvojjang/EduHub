import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { MyEnrollmentsPage } from './pages/MyEnrollmentsPage';
import { RosterPage } from './pages/RosterPage';

// 회차가 바뀌면 key로 화면을 새로 만든다(shell의 RosterRoute와 같은 동작).
function RosterRoute() {
  const { sessionId } = useParams();
  return <RosterPage key={sessionId} />;
}

// 단독 실행용 진입점(개발·확인 전용). 실제 서비스에서는 shell이 remoteEntry.js로 화면만 불러간다.
// Provider·라우터는 여기에만 두고, 로그인 화면은 없다. 포트가 달라 shell의 토큰(localStorage)을 볼 수 없어 API는 401이다(D-06). 화면 확인은 shell(3000)에서 한다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <BrowserRouter>
        <ModalsProvider>
          <Notifications />
          <Routes>
            <Route path="/my/enrollments" element={<MyEnrollmentsPage />} />
            <Route path="/admin/sessions/:sessionId/roster" element={<RosterRoute />} />
          </Routes>
        </ModalsProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);
