import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentAdminApi } from '@eduhub/http';
import { renderWithProviders } from '../test/render';
import { RosterPage } from './RosterPage';

vi.mock('@eduhub/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eduhub/http')>()),
  enrollmentAdminApi: { getRoster: vi.fn(), completeSession: vi.fn(), recordCompletions: vi.fn() },
}));

// shell의 RosterRoute와 같은 모양: 회차가 바뀌면 key로 화면을 새로 만든다. 이 remote는 래퍼 없이 RosterPage만 노출한다.
function KeyedRoster() {
  const { sessionId } = useParams();
  return <RosterPage key={sessionId} />;
}

const navigateRef: { current: NavigateFunction | null } = { current: null };
function NavCapture() {
  navigateRef.current = useNavigate();
  return null;
}

const getRosterMock = vi.mocked(enrollmentAdminApi.getRoster);
const recordMock = vi.mocked(enrollmentAdminApi.recordCompletions);

function rosterOf(sessionId: number) {
  return {
    data: {
      sessionId,
      courseId: 9,
      courseTitle: 'Java 기초',
      sessionStartAt: '2026-12-01T09:00:00',
      sessionStatus: 'COMPLETED',
      capacity: 20,
      confirmed: [
        {
          enrollmentId: 1,
          employeeId: 1,
          employeeNo: 'E1001',
          name: '김사원',
          status: 'CONFIRMED',
        },
        {
          enrollmentId: 2,
          employeeId: 3,
          employeeNo: 'E1003',
          name: '박사원',
          status: 'CONFIRMED',
        },
      ],
      waiting: [],
    },
  } as never;
}

beforeEach(() => {
  getRosterMock.mockReset();
  recordMock.mockReset();
});

describe('RosterPage (key={sessionId})', () => {
  it('같은 라우트에서 회차가 바뀌면 선택과 결과 알림이 초기화된다', async () => {
    getRosterMock.mockImplementation((id: number) => Promise.resolve(rosterOf(id)));
    recordMock.mockResolvedValue({ data: { processed: [1], failed: [] } } as never);
    renderWithProviders(
      <MemoryRouter initialEntries={['/admin/sessions/4/roster']}>
        <NavCapture />
        <Routes>
          <Route path="/admin/sessions/:sessionId/roster" element={<KeyedRoster />} />
        </Routes>
      </MemoryRouter>,
    );

    // 회차 4에서 김사원을 수료 처리해 결과 알림을 만들고, 박사원을 선택해 둔다.
    fireEvent.click(await screen.findByRole('checkbox', { name: '김사원(E1001) 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택한 1명 수료 처리' }));
    const confirm = await screen.findByRole('button', { name: '수료 처리' });
    fireEvent.click(confirm);
    await screen.findByText('1명을 수료 처리했습니다.');
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: '박사원(E1003) 선택' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: '박사원(E1003) 선택' }));
    expect(screen.getByRole('checkbox', { name: '박사원(E1003) 선택' })).toBeChecked();

    act(() => {
      void navigateRef.current?.('/admin/sessions/5/roster');
    });
    await waitFor(() => expect(getRosterMock).toHaveBeenLastCalledWith(5));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: '박사원(E1003) 선택' })).toBeEnabled(),
    );
    expect(screen.getByRole('checkbox', { name: '박사원(E1003) 선택' })).not.toBeChecked();
    expect(screen.queryByText('1명을 수료 처리했습니다.')).not.toBeInTheDocument();
  });
});
