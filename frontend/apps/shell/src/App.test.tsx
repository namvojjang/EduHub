import { authApi, tokenStore } from '@eduhub/http';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { Suspense } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, RosterRoute } from './App';
import { AppLayout } from './layout/AppLayout';
import { renderWithAuth } from './test/render';

vi.mock('@eduhub/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eduhub/http')>()),
  authApi: { login: vi.fn(), getMe: vi.fn() },
}));

// remote 모듈은 vite.config.ts의 테스트용 가상 모듈로 풀리고, 여기서 내용을 채운다.
vi.mock('courseMfe/CourseListPage', () => ({
  CourseListPage: () => <div>과정 목록 화면</div>,
}));
vi.mock('courseMfe/CourseDetailPage', () => ({
  // 실제 화면처럼 회차마다 슬롯을 부른다. id가 없는 회차 하나를 섞어 둔다.
  CourseDetailPage: ({
    renderSessionAction,
  }: {
    renderSessionAction?: (
      session: { id?: number },
      ctx: { disabledReason?: string; onChanged: () => void },
    ) => React.ReactNode;
  }) => (
    <div>
      <div>과정 상세 화면</div>
      <div data-testid="slot-open">{renderSessionAction?.({ id: 7 }, { onChanged: () => {} })}</div>
      <div data-testid="slot-closed">
        {renderSessionAction?.(
          { id: 8 },
          { disabledReason: '마감된 회차입니다.', onChanged: () => {} },
        )}
      </div>
      <div data-testid="slot-noid">{renderSessionAction?.({}, { onChanged: () => {} })}</div>
    </div>
  ),
}));
vi.mock('courseMfe/AdminCourseListPage', () => ({
  AdminCourseListPage: () => <div>관리 목록</div>,
}));
// down.value가 true인 동안은 불러오기에 실패하고, false가 되면(복구) 정상 화면을 낸다.
const remote = vi.hoisted(() => ({ down: true, rosterMounts: 0 }));
vi.mock('courseMfe/AdminCoursePage', () => ({
  get AdminCoursePage() {
    if (remote.down) throw new Error('remote down');
    return () => <div>관리 상세</div>;
  },
}));
vi.mock('enrollmentMfe/EnrollButton', () => ({
  EnrollButton: (p: {
    sessionId: number;
    loggedIn: boolean;
    disabledReason?: string;
    onChanged?: () => void;
  }) => (
    <div>{`신청:${p.sessionId}:${p.loggedIn}:${p.disabledReason ?? '-'}:${typeof p.onChanged}`}</div>
  ),
}));
vi.mock('enrollmentMfe/RosterPage', () => ({
  // 회차 상태를 흉내 낸다: 선택 상태는 컴포넌트 안에 있고, 마운트될 때마다 횟수가 늘어난다.
  RosterPage: () => {
    const [selected, setSelected] = useState(() => {
      remote.rosterMounts += 1;
      return false;
    });
    return (
      <div>
        <div>{selected ? '선택됨' : '선택 없음'}</div>
        <button onClick={() => setSelected(true)}>선택</button>
      </div>
    );
  },
}));
// 이 remote만 불러오기에 실패한다(꺼진 remote를 흉내).
vi.mock('enrollmentMfe/MyEnrollmentsPage', () => ({
  get MyEnrollmentsPage(): never {
    throw new Error('remote down');
  },
}));

const navigateRef: { current: NavigateFunction | null } = { current: null };
function NavCapture() {
  navigateRef.current = useNavigate();
  return null;
}
const admin = { employeeId: 9, employeeNo: 'A0001', name: '관리자', role: 'ADMIN' } as never;
const employee = { employeeId: 1, employeeNo: 'E1001', name: '김사원', role: 'EMPLOYEE' } as never;

beforeEach(() => {
  localStorage.clear();
  remote.down = true;
  remote.rosterMounts = 0;
  // 오류 경계가 잡은 오류를 React가 console.error로 남긴다. 테스트 출력만 조용히 한다.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shell App 라우트', () => {
  it('과정 목록 경로에서 courseMfe 화면을 그린다', async () => {
    renderWithAuth(<App />, { route: '/' });

    expect(await screen.findByText('과정 목록 화면')).toBeInTheDocument();
  });

  it('과정 상세는 회차마다 EnrollButton을 슬롯으로 조립한다(비로그인이면 loggedIn=false)', async () => {
    renderWithAuth(<App />, { route: '/courses/3' });

    expect(await screen.findByText('신청:7:false:-:function')).toBeInTheDocument();
    // 상세 화면이 정한 마감 사유와 재조회 콜백이 그대로 넘어온다
    expect(screen.getByText('신청:8:false:마감된 회차입니다.:function')).toBeInTheDocument();
  });

  it('로그인했으면 EnrollButton에 loggedIn=true를 넘긴다', async () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    renderWithAuth(<App />, { route: '/courses/3' });

    expect(await screen.findByText('신청:7:true:-:function')).toBeInTheDocument();
  });

  it('id가 없는 회차에는 신청 버튼을 그리지 않는다', async () => {
    renderWithAuth(<App />, { route: '/courses/3' });

    await screen.findByText('신청:7:false:-:function');
    expect(screen.getByTestId('slot-noid')).toBeEmptyDOMElement();
  });

  it('로그인하지 않고 관리자 경로에 가면 remote 화면 대신 로그인으로 보낸다', async () => {
    renderWithAuth(<App />, { route: '/admin/courses' });

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByText('관리 목록')).not.toBeInTheDocument();
  });
});

describe('remote 오류 경계', () => {
  it('remote 하나를 불러오지 못하면 그 자리만 Alert이고 레이아웃과 다른 remote는 그대로다', async () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    renderWithAuth(
      <AppLayout>
        <App />
      </AppLayout>,
      { route: '/my/enrollments' },
    );

    expect(
      await screen.findByText('화면을 불러오지 못했습니다. 잠시 후 다시 시도하세요.'),
    ).toBeInTheDocument();
    // 레이아웃(헤더·메뉴)은 그대로 보인다
    expect(screen.getByRole('link', { name: 'EduHub 홈' })).toBeInTheDocument();

    // 다른 remote(courseMfe)의 화면은 정상으로 열린다
    fireEvent.click(screen.getByRole('link', { name: '교육과정' }));
    expect(await screen.findByText('과정 목록 화면')).toBeInTheDocument();
  });

  it('같은 구조의 라우트로 이동하면 이전 실패 상태가 남지 않고 정상 remote가 보인다', async () => {
    tokenStore.save('tok-1', admin);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: admin } as never);
    renderWithAuth(
      <>
        <NavCapture />
        <App />
      </>,
      { route: '/admin/courses/1' },
    );
    // courseMfe의 AdminCoursePage만 실패한 상태
    await screen.findByText('화면을 불러오지 못했습니다. 잠시 후 다시 시도하세요.');

    // 같은 RequireAuth > Remote 구조의 다른 라우트(AdminCourseListPage, 정상)로 이동
    act(() => {
      void navigateRef.current?.('/admin/courses');
    });
    expect(await screen.findByText('관리 목록')).toBeInTheDocument();
    expect(
      screen.queryByText('화면을 불러오지 못했습니다. 잠시 후 다시 시도하세요.'),
    ).not.toBeInTheDocument();
  });

  it('remote가 복구되면 경로를 바꿨다 돌아왔을 때 새로고침 없이 다시 불러온다', async () => {
    // lazy는 모듈 전역에 남으므로, 다른 테스트와 순서가 얽히지 않게 모듈을 새로 불러와 격리한다.
    vi.resetModules();
    const rtl = await import('@testing-library/react');
    const router = await import('react-router-dom');
    const http = await import('@eduhub/http');
    const { App: FreshApp } = await import('./App');
    const { renderWithAuth: renderFresh } = await import('./test/render');
    const nav: { current: NavigateFunction | null } = { current: null };
    function FreshNavCapture() {
      nav.current = router.useNavigate();
      return null;
    }

    http.tokenStore.save('tok-1', admin);
    vi.mocked(http.authApi.getMe).mockResolvedValue({ data: admin } as never);
    renderFresh(
      <>
        <FreshNavCapture />
        <FreshApp />
      </>,
      { route: '/admin/courses/1' },
    );
    await rtl.screen.findByText('화면을 불러오지 못했습니다. 잠시 후 다시 시도하세요.');

    remote.down = false; // remote가 다시 켜졌다
    rtl.act(() => {
      void nav.current?.('/admin/courses');
    });
    await rtl.screen.findByText('관리 목록');
    rtl.act(() => {
      void nav.current?.('/admin/courses/1');
    });
    expect(await rtl.screen.findByText('관리 상세')).toBeInTheDocument();
  });
});

describe('RosterRoute', () => {
  it('같은 라우트에서 회차가 바뀌면 RosterPage를 새로 만들어 선택 상태가 초기화된다', async () => {
    tokenStore.save('tok-1', admin);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: admin } as never);
    renderWithAuth(
      <>
        <NavCapture />
        <App />
      </>,
      { route: '/admin/sessions/4/roster' },
    );

    fireEvent.click(await screen.findByRole('button', { name: '선택' }));
    expect(screen.getByText('선택됨')).toBeInTheDocument();
    expect(remote.rosterMounts).toBe(1);

    act(() => {
      void navigateRef.current?.('/admin/sessions/5/roster');
    });
    await waitFor(() => expect(remote.rosterMounts).toBe(2));
    expect(screen.getByText('선택 없음')).toBeInTheDocument();
  });

  it('Remote 경계 없이 RosterRoute만으로도 회차가 바뀌면 RosterPage를 새로 만든다(key={sessionId})', async () => {
    tokenStore.save('tok-1', admin);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: admin } as never);
    // App의 Remote(pathname key)를 거치지 않고 RosterRoute만 렌더해, RosterRoute의 key만으로 재마운트됨을 본다.
    renderWithAuth(
      <>
        <NavCapture />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/admin/sessions/:sessionId/roster" element={<RosterRoute />} />
          </Routes>
        </Suspense>
      </>,
      { route: '/admin/sessions/4/roster' },
    );

    fireEvent.click(await screen.findByRole('button', { name: '선택' }));
    expect(screen.getByText('선택됨')).toBeInTheDocument();
    expect(remote.rosterMounts).toBe(1);

    act(() => {
      void navigateRef.current?.('/admin/sessions/5/roster');
    });
    await waitFor(() => expect(remote.rosterMounts).toBe(2));
    expect(screen.getByText('선택 없음')).toBeInTheDocument();
  });
});
