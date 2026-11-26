import { screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentAdminApi } from '../api/clients';
import { renderWithProviders } from '../test/render';
import { RosterPage } from './RosterPage';

vi.mock('../api/clients', () => ({
  enrollmentAdminApi: { getRoster: vi.fn() },
}));

const getRosterMock = vi.mocked(enrollmentAdminApi.getRoster);

const roster = {
  sessionId: 4,
  courseId: 9,
  courseTitle: 'Java 기초',
  sessionStartAt: '2026-12-01T09:00:00',
  sessionStatus: 'RECRUITING',
  capacity: 20,
  confirmed: [
    {
      enrollmentId: 11,
      employeeId: 1,
      employeeNo: 'E1001',
      name: '김사원',
      status: 'CONFIRMED',
      promoted: true,
      confirmedAt: '2026-11-05T10:00:00',
    },
    {
      enrollmentId: 12,
      employeeId: 2,
      employeeNo: 'E1002',
      status: 'COMPLETED',
      confirmedAt: '2026-11-06T10:00:00',
    },
  ],
  waiting: [
    {
      enrollmentId: 13,
      employeeId: 3,
      employeeNo: 'E1003',
      name: '이대기',
      status: 'WAITING',
      waitingNumber: 1,
      appliedAt: '2026-11-07T10:00:00',
    },
  ],
};

function axiosError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/admin/sessions/4/roster']}>
      <Routes>
        <Route path="/admin/sessions/:sessionId/roster" element={<RosterPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getRosterMock.mockReset();
});

describe('RosterPage', () => {
  it('R1 명단을 보인다: 머리, 확정자(상태·승급), 대기 N번, getRoster(4)', async () => {
    getRosterMock.mockResolvedValue({ data: roster } as never);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Java 기초 명단' })).toBeInTheDocument();
    expect(getRosterMock).toHaveBeenCalledWith(4);
    expect(screen.getByText('2026-12-01 09:00 · 정원 20명')).toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← 과정 관리로' })).toHaveAttribute(
      'href',
      '/admin/courses/9',
    );

    const confirmed = within(screen.getByRole('table', { name: '확정자 명단' }));
    const first = confirmed.getByText('김사원').closest('tr') as HTMLElement;
    expect(within(first).getByText('E1001')).toBeInTheDocument();
    expect(within(first).getByText('확정')).toBeInTheDocument();
    expect(within(first).getByText('대기에서 확정')).toBeInTheDocument();
    expect(within(first).getByText('2026-11-05 10:00')).toBeInTheDocument();

    const second = confirmed.getByText('(알 수 없음)').closest('tr') as HTMLElement;
    expect(within(second).getByText('E1002')).toBeInTheDocument();
    expect(within(second).getByText('수료')).toBeInTheDocument();

    const waiting = within(screen.getByRole('table', { name: '대기자 명단' }));
    expect(waiting.getByText('대기 1번')).toBeInTheDocument();
    expect(waiting.getByText('이대기')).toBeInTheDocument();
    expect(waiting.getByText('E1003')).toBeInTheDocument();
  });

  it('확정자·대기자가 없으면 안내를 보인다', async () => {
    getRosterMock.mockResolvedValue({ data: { ...roster, confirmed: [], waiting: [] } } as never);
    renderPage();
    expect(await screen.findByText('확정된 신청자가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('대기자가 없습니다.')).toBeInTheDocument();
  });

  it('R8 조회가 403이면 관리자 전용 문구를 보인다', async () => {
    getRosterMock.mockRejectedValue(axiosError(403, { code: 'FORBIDDEN', message: 'x' }));
    renderPage();
    expect(await screen.findByText('관리자만 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('404 SESSION_NOT_FOUND면 회차 없음 안내와 과정 관리로 버튼을 보인다', async () => {
    getRosterMock.mockRejectedValue(
      axiosError(404, { code: 'SESSION_NOT_FOUND', message: '회차 없음: 4' }),
    );
    renderPage();
    expect(await screen.findByText('회차를 찾을 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '과정 관리로' })).toHaveAttribute(
      'href',
      '/admin/courses',
    );
  });

  it('404여도 code가 SESSION_NOT_FOUND가 아니면 일반 오류 Alert를 보인다', async () => {
    getRosterMock.mockRejectedValue(axiosError(404, { code: 'OTHER', message: '다른 404' }));
    renderPage();
    expect(await screen.findByText('다른 404')).toBeInTheDocument();
    expect(screen.queryByText('회차를 찾을 수 없습니다.')).not.toBeInTheDocument();
  });

  it('조회가 401이면 오류 Alert를 띄우지 않는다', async () => {
    getRosterMock.mockRejectedValue(
      axiosError(401, { code: 'UNAUTHORIZED', message: '인증 필요' }),
    );
    renderPage();
    await waitFor(() => expect(getRosterMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: '불러오는 중' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('명단을 불러오지 못했습니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('인증 필요')).not.toBeInTheDocument();
  });

  it('회차 ID가 양의 정수가 아니면 요청하지 않고 회차 없음 화면을 보인다', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/admin/sessions/abc/roster']}>
        <Routes>
          <Route path="/admin/sessions/:sessionId/roster" element={<RosterPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('회차를 찾을 수 없습니다.')).toBeInTheDocument();
    expect(getRosterMock).not.toHaveBeenCalled();
  });

  it('그 밖의 오류는 오류 Alert를 보인다', async () => {
    getRosterMock.mockRejectedValue(new Error('서버 오류'));
    renderPage();
    expect(await screen.findByText('서버 오류')).toBeInTheDocument();
  });
});
