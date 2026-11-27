import { Alert } from '@mantine/core';
import { Component, lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';

// 불러오기에 실패한 remote 화면의 lazy를 새것으로 바꾸는 함수들(아래 lazyRemote가 등록).
const failedRemotes = new Set<() => void>();

/**
 * remote 화면을 필요할 때 불러오는 컴포넌트. 흐름:
 * 1) React.lazy는 실패(reject)를 기억한다.
 * 2) 경계(RemoteBoundary)가 오류를 잡으면 실패한 lazy를 새로 만든다.
 * 3) 경로가 바뀌어 경계의 key가 바뀌면 새 lazy로 다시 불러오기를 시도한다.
 * 4) 같은 경로에서는 다시 시도하지 않는다(새로고침하거나 다른 화면에 갔다 와야 한다).
 * 실제 Chrome에서 remote를 껐다 켠 뒤 다른 화면에 갔다 오면 새로고침 없이 복구되는 것을 확인했다.
 */
function lazyRemote<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const make = () =>
    lazy(() =>
      load().then(
        (component) => ({ default: component }),
        (error) => {
          failedRemotes.add(() => {
            Current = make();
          });
          throw error;
        },
      ),
    ) as unknown as ComponentType<P>;
  let Current = make();
  return function RemoteScreen(props: P) {
    return <Current {...props} />;
  };
}

// remote 화면은 필요할 때 네트워크로 불러온다(Module Federation). 노출 이름은 vite.config.ts의 remotes와 맞춘다.
const CourseListPage = lazyRemote(() =>
  import('courseMfe/CourseListPage').then((m) => m.CourseListPage),
);
const CourseDetailPage = lazyRemote(() =>
  import('courseMfe/CourseDetailPage').then((m) => m.CourseDetailPage),
);
const AdminCourseListPage = lazyRemote(() =>
  import('courseMfe/AdminCourseListPage').then((m) => m.AdminCourseListPage),
);
const AdminCoursePage = lazyRemote(() =>
  import('courseMfe/AdminCoursePage').then((m) => m.AdminCoursePage),
);
const EnrollButton = lazyRemote(() =>
  import('enrollmentMfe/EnrollButton').then((m) => m.EnrollButton),
);
const MyEnrollmentsPage = lazyRemote(() =>
  import('enrollmentMfe/MyEnrollmentsPage').then((m) => m.MyEnrollmentsPage),
);
const RosterPage = lazyRemote(() => import('enrollmentMfe/RosterPage').then((m) => m.RosterPage));

/** remote를 못 불러왔을 때(꺼짐, 네트워크 오류) 그 자리만 안내하고 shell과 다른 remote는 그대로 둔다. */
class RemoteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  componentDidCatch() {
    // 실패한 lazy는 계속 실패만 기억하므로, 다음에 다시 시도할 수 있게 새것으로 바꾼다.
    failedRemotes.forEach((renew) => renew());
    failedRemotes.clear();
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <Alert color="red" role="alert">
          화면을 불러오지 못했습니다. 잠시 후 다시 시도하세요.
        </Alert>
      );
    }
    return this.props.children;
  }
}

/** remote 화면 하나를 오류 경계와 로딩 대기로 감싼다. */
function Remote({ children }: { children: ReactNode }) {
  // 같은 구조의 라우트 사이를 이동하면 React가 경계를 재사용해 실패 상태가 남는다. 경로가 바뀌면 새로 만든다.
  const { pathname } = useLocation();
  return (
    <RemoteBoundary key={pathname}>
      <Suspense fallback={null}>{children}</Suspense>
    </RemoteBoundary>
  );
}

// 회차가 바뀌면 key로 화면을 새로 만든다: 선택·결과 알림·열린 모달이 이전 회차 것으로 남지 않게.
export function RosterRoute() {
  const { sessionId } = useParams();
  return <RosterPage key={sessionId} />;
}

/**
 * shell의 화면 경로. 라우터는 shell에만 있고, remote는 화면 컴포넌트만 내준다.
 * D-06: 모든 화면은 로그인 후. `/login`만 레이아웃 밖이고, 나머지는 보호 레이아웃 라우트 안에 둔다.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout>
              <Outlet />
            </AppLayout>
          </RequireAuth>
        }
      >
        <Route
          path="/"
          element={
            <Remote>
              <CourseListPage />
            </Remote>
          }
        />
        <Route
          path="/courses/:id"
          element={
            <Remote>
              {/* course-mfe는 신청을 모른다: 회차마다 enrollment-mfe의 신청 버튼을 슬롯으로 끼운다(설계 2-3). */}
              <CourseDetailPage
                renderSessionAction={(session, ctx) =>
                  session.id != null && (
                    <Remote>
                      <EnrollButton sessionId={session.id} {...ctx} />
                    </Remote>
                  )
                }
              />
            </Remote>
          }
        />
        <Route
          path="/my/enrollments"
          element={
            <Remote>
              <MyEnrollmentsPage />
            </Remote>
          }
        />
        {/* 관리자 화면 (FR-03). 화면에서도 ADMIN만 들어오게 하지만 실제 차단은 백엔드다 (NFR-03). */}
        <Route
          path="/admin/courses"
          element={
            <RequireAuth admin>
              <Remote>
                <AdminCourseListPage />
              </Remote>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/courses/:id"
          element={
            <RequireAuth admin>
              <Remote>
                <AdminCoursePage />
              </Remote>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/sessions/:sessionId/roster"
          element={
            <RequireAuth admin>
              <Remote>
                <RosterRoute />
              </Remote>
            </RequireAuth>
          }
        />
        {/* 없는 경로는 목록으로(404 화면은 범위 밖, Q2). */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
