import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentAdminApi } from '@eduhub/http';
import { renderWithProviders } from '../test/render';
import { RosterPage } from './RosterPage';

// getErrorMessage 등 나머지 export는 실제 것을 쓰고 API 객체만 대체한다.
vi.mock('@eduhub/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eduhub/http')>()),
  enrollmentAdminApi: {
    getRoster: vi.fn(),
    completeSession: vi.fn(),
    recordCompletions: vi.fn(),
  },
}));

const getRosterMock = vi.mocked(enrollmentAdminApi.getRoster);
const completeMock = vi.mocked(enrollmentAdminApi.completeSession);
const recordMock = vi.mocked(enrollmentAdminApi.recordCompletions);

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
  completeMock.mockReset();
  recordMock.mockReset();
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

const completedRoster = {
  ...roster,
  sessionStatus: 'COMPLETED',
  confirmed: [
    { enrollmentId: 11, employeeId: 1, employeeNo: 'E1001', name: '김사원', status: 'CONFIRMED' },
    { enrollmentId: 12, employeeId: 2, employeeNo: 'E1002', name: '이수료', status: 'COMPLETED' },
    { enrollmentId: 13, employeeId: 3, employeeNo: 'E1003', name: '박사원', status: 'CONFIRMED' },
    {
      enrollmentId: 14,
      employeeId: 4,
      employeeNo: 'E1004',
      name: '최미수',
      status: 'NOT_COMPLETED',
    },
  ],
  waiting: [],
};

function rosterResult(body: unknown) {
  return { data: body } as never;
}

function recordButton(n: number, label: '수료' | '미수료') {
  return screen.getByRole('button', { name: `선택한 ${n}명 ${label} 처리` });
}

describe('RosterPage 교육 완료·수료 처리', () => {
  it('R2 교육 완료 전에는 체크박스·처리 버튼이 비활성이고 교육 완료 처리 버튼이 보인다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    renderPage();
    expect(
      await screen.findByText('교육 완료 처리 후 수료를 기록할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '교육 완료 처리' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: '김사원(E1001) 선택' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '전체 선택' })).toBeDisabled();
    expect(recordButton(0, '수료')).toBeDisabled();
    expect(recordButton(0, '미수료')).toBeDisabled();
  });

  it('R3 교육 완료 처리 확인 → completeSession(4) → 알림 → 재조회, 모달에 대기 N건 안내', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    completeMock.mockResolvedValue({ data: {} } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/남은 대기 신청 1건은 취소됩니다/)).toBeInTheDocument();
    expect(completeMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '교육 완료 처리' }));
    await waitFor(() => expect(completeMock).toHaveBeenCalledWith(4));
    expect(await screen.findByText('교육 완료로 처리했습니다.')).toBeInTheDocument();
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
  });

  it('R3 시작 전 409 SESSION_NOT_STARTED면 문구를 보이고 다시 불러오지 않는다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    completeMock.mockRejectedValue(axiosError(409, { code: 'SESSION_NOT_STARTED', message: 'x' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '교육 완료 처리' }));
    expect(
      await screen.findByText('회차 시작 전에는 교육 완료로 처리할 수 없습니다.'),
    ).toBeInTheDocument();
    // 서버 상태가 그대로라 다시 불러오지 않는다.
    expect(getRosterMock).toHaveBeenCalledTimes(1);
  });

  it('교육 완료 성공 뒤 재조회가 끝나기 전에는 교육 완료·수료 버튼이 비활성이다', async () => {
    getRosterMock.mockResolvedValueOnce(rosterResult(roster));
    getRosterMock.mockReturnValueOnce(new Promise(() => {}));
    completeMock.mockResolvedValue({ data: {} } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '교육 완료 처리' }));
    await screen.findByText('교육 완료로 처리했습니다.');
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
    // 닫히는 중인 모달의 같은 이름 버튼이 남아 있을 수 있어 화면 본문의 버튼만 고른다.
    const pageButton = screen
      .getAllByRole('button', { name: '교육 완료 처리', hidden: true })
      .find((b) => !b.closest('[role="dialog"]'));
    expect(pageButton).toBeDisabled();
    expect(recordButton(0, '수료')).toBeDisabled();
    expect(recordButton(0, '미수료')).toBeDisabled();
  });

  it('교육 완료 확인 버튼을 같은 act 안에서 두 번 눌러도 요청은 한 번만 나간다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    completeMock.mockResolvedValue({ data: {} } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '교육 완료 처리' });
    act(() => {
      confirm.click();
      confirm.click();
    });
    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1));
    await screen.findByText('교육 완료로 처리했습니다.');
    fireEvent.click(confirm);
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it('처리 중 401이면 알림을 띄우지 않는다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    completeMock.mockRejectedValue(axiosError(401, { code: 'UNAUTHORIZED', message: '인증 필요' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '교육 완료 처리' }));
    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '교육 완료 처리' })).toBeEnabled(),
    );
    expect(screen.queryByText('인증 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('교육 완료로 처리했습니다.')).not.toBeInTheDocument();
    expect(getRosterMock).toHaveBeenCalledTimes(1);
  });

  it('화면을 떠나면 열려 있던 확인 모달도 닫힌다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    renderWithProviders(
      <MemoryRouter initialEntries={['/admin/sessions/4/roster']}>
        <Routes>
          <Route path="/admin/sessions/:sessionId/roster" element={<RosterPage />} />
          <Route path="/admin/courses/:id" element={<div>과정 화면</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    await screen.findByRole('dialog');
    // 페이지만 내리고 ModalsProvider는 남긴다: 스스로 닫지 않으면 모달이 남는다.
    fireEvent.click(screen.getByRole('link', { name: '← 과정 관리로' }));
    expect(await screen.findByText('과정 화면')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('R4 확정 행을 선택해 수료 처리 → recordCompletions(4, COMPLETED, [1]) → 결과 Alert', async () => {
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    recordMock.mockResolvedValue({ data: { processed: [1], failed: [] } } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: '김사원(E1001) 선택' }));
    fireEvent.click(recordButton(1, '수료'));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('선택한 1명을 수료로 기록합니다. 되돌릴 수 없습니다.'),
    ).toBeInTheDocument();
    expect(recordMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '수료 처리' }));
    await waitFor(() =>
      expect(recordMock).toHaveBeenCalledWith(4, { result: 'COMPLETED', employeeIds: [1] }),
    );
    expect(await screen.findByText('1명을 수료 처리했습니다.')).toBeInTheDocument();
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
    expect(recordButton(0, '수료')).toBeDisabled();
  });

  it('R5 미수료 처리는 result NOT_COMPLETED로 보낸다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    recordMock.mockResolvedValue({ data: { processed: [3], failed: [] } } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: '박사원(E1003) 선택' }));
    fireEvent.click(recordButton(1, '미수료'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '미수료 처리' }));
    await waitFor(() =>
      expect(recordMock).toHaveBeenCalledWith(4, { result: 'NOT_COMPLETED', employeeIds: [3] }),
    );
    expect(await screen.findByText('1명을 미수료 처리했습니다.')).toBeInTheDocument();
  });

  it('R6 일부 실패면 처리 인원과 "이름(사번): 사유"를 보인다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    recordMock.mockResolvedValue({
      data: {
        processed: [3],
        failed: [
          { employeeId: 1, code: 'ALREADY_RECORDED', reason: 'server' },
          { employeeId: 99, code: 'NOT_ENROLLED', reason: 'server' },
        ],
      },
    } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: '전체 선택' }));
    fireEvent.click(recordButton(2, '수료'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '수료 처리' }));
    await waitFor(() =>
      expect(recordMock).toHaveBeenCalledWith(4, { result: 'COMPLETED', employeeIds: [1, 3] }),
    );
    expect(
      await screen.findByText(/1명을 수료 처리했습니다\. 2명은 처리하지 못했습니다/),
    ).toBeInTheDocument();
    expect(screen.getByText('김사원(E1001): 이미 기록됨')).toBeInTheDocument();
    expect(screen.getByText('사원 #99: 신청 없음')).toBeInTheDocument();
  });

  it('R7 수료·미수료 행은 체크할 수 없고 전체 선택은 선택 가능한 행만 고른다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    renderPage();
    expect(await screen.findByRole('checkbox', { name: '이수료(E1002) 선택' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '최미수(E1004) 선택' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '김사원(E1001) 선택' })).toBeEnabled();

    const all = screen.getByRole('checkbox', { name: '전체 선택' });
    fireEvent.click(screen.getByRole('checkbox', { name: '김사원(E1001) 선택' }));
    expect(all).toHaveProperty('indeterminate', true);
    fireEvent.click(all);
    expect(screen.getByRole('checkbox', { name: '김사원(E1001) 선택' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '박사원(E1003) 선택' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '이수료(E1002) 선택' })).not.toBeChecked();
    expect(recordButton(2, '수료')).toBeEnabled();
    fireEvent.click(all);
    expect(recordButton(0, '수료')).toBeDisabled();
  });

  it('R9 확인 버튼을 같은 act 안에서 두 번 눌러도 요청은 한 번만 나간다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    recordMock.mockResolvedValue({ data: { processed: [1], failed: [] } } as never);
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: '김사원(E1001) 선택' }));
    fireEvent.click(recordButton(1, '수료'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: '수료 처리' });
    act(() => {
      confirm.click();
      confirm.click();
    });
    await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1));
    await screen.findByText('1명을 수료 처리했습니다.');
    fireEvent.click(confirm);
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it('수료 기록 409 SESSION_NOT_COMPLETED면 문구를 보이고 다시 불러온다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    recordMock.mockRejectedValue(axiosError(409, { code: 'SESSION_NOT_COMPLETED', message: 'x' }));
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: '김사원(E1001) 선택' }));
    fireEvent.click(recordButton(1, '수료'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '수료 처리' }));
    expect(
      await screen.findByText('교육 완료 처리 후 수료를 기록할 수 있습니다.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
  });

  it('재조회 뒤 더 이상 선택할 수 없는 사원은 선택에서 빠진다', async () => {
    getRosterMock.mockResolvedValueOnce(rosterResult(completedRoster));
    recordMock.mockRejectedValue(axiosError(409, { code: 'SESSION_NOT_COMPLETED', message: 'x' }));
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: '김사원(E1001) 선택' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: '박사원(E1003) 선택' }));
    expect(recordButton(2, '수료')).toBeEnabled();
    // 다시 불러오면 김사원이 이미 수료로 바뀌어 있다.
    getRosterMock.mockResolvedValueOnce(
      rosterResult({
        ...completedRoster,
        confirmed: completedRoster.confirmed.map((e) =>
          e.employeeId === 1 ? { ...e, status: 'COMPLETED' } : e,
        ),
      }),
    );
    fireEvent.click(recordButton(2, '수료'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '수료 처리' }));
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: '선택한 1명 수료 처리' })).toBeEnabled();
  });

  it('재조회가 실패해도 직전 표와 오류 Alert가 함께 보인다', async () => {
    getRosterMock.mockResolvedValueOnce(rosterResult(roster));
    getRosterMock.mockRejectedValueOnce(new Error('서버 오류'));
    completeMock.mockRejectedValue(
      axiosError(409, { code: 'SESSION_ALREADY_COMPLETED', message: 'x' }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '교육 완료 처리' }));
    expect(await screen.findByText('서버 오류')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '확정자 명단' })).toBeInTheDocument();
    // 표가 최신이 아닐 수 있으므로 안내하고 처리 버튼·체크박스를 막는다.
    expect(screen.getByText(/표가 최신이 아닐 수 있습니다/)).toBeInTheDocument();
    const pageButton = screen
      .getAllByRole('button', { name: '교육 완료 처리', hidden: true })
      .find((b) => !b.closest('[role="dialog"]'));
    expect(pageButton).toBeDisabled();
    expect(recordButton(0, '수료')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '김사원(E1001) 선택' })).toBeDisabled();
  });

  it('교육 완료 성공 뒤 열려 있던 두 번째 모달을 확인해도 요청하지 않는다', async () => {
    getRosterMock.mockResolvedValueOnce(rosterResult(roster));
    getRosterMock.mockResolvedValue(rosterResult(completedRoster));
    completeMock.mockResolvedValue({ data: {} } as never);
    renderPage();
    const open = await screen.findByRole('button', { name: '교육 완료 처리' });
    // 같은 버튼으로 모달 두 개를 연다(요청 전이라 버튼이 활성이다).
    fireEvent.click(open);
    await screen.findByRole('dialog');
    fireEvent.click(open);
    // Mantine은 쌓인 모달 중 맨 위 하나만 그린다. 두 번째 모달이 열릴 시간을 준다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // 맨 위(두 번째) 모달을 확인한다 → 요청 1회, 그 모달은 닫힌다.
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '교육 완료 처리' }),
    );
    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1));
    await screen.findByText('교육 완료로 처리했습니다.');
    await waitFor(() => expect(getRosterMock).toHaveBeenCalledTimes(2));
    await screen.findByText('교육 완료', { selector: '.mantine-Badge-label' });

    // 아래에 깔려 있던 첫 모달이 다시 보인다. 이미 교육 완료이므로 확인해도 요청하지 않는다.
    const first = await screen.findByRole('dialog');
    fireEvent.click(within(first).getByRole('button', { name: '교육 완료 처리' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(completeMock).toHaveBeenCalledTimes(1);
  });

  it('언마운트 뒤에 도착한 응답은 알림을 띄우지 않는다', async () => {
    getRosterMock.mockResolvedValue(rosterResult(roster));
    let resolveComplete: (v: never) => void = () => {};
    completeMock.mockReturnValue(new Promise<never>((res) => (resolveComplete = res)));
    renderWithProviders(
      <MemoryRouter initialEntries={['/admin/sessions/4/roster']}>
        <Routes>
          <Route path="/admin/sessions/:sessionId/roster" element={<RosterPage />} />
          <Route path="/admin/courses/:id" element={<div>과정 화면</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '교육 완료 처리' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '교육 완료 처리' }));
    await waitFor(() => expect(completeMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('link', { name: '← 과정 관리로' }));
    expect(await screen.findByText('과정 화면')).toBeInTheDocument();
    await act(async () => resolveComplete({ data: {} } as never));
    expect(screen.queryByText('교육 완료로 처리했습니다.')).not.toBeInTheDocument();
    expect(getRosterMock).toHaveBeenCalledTimes(1);
  });
});
