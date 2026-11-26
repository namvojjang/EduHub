import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, enrollmentApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { renderWithAuth } from '../test/render';
import { MyEnrollmentsPage } from './MyEnrollmentsPage';

vi.mock('../api/clients', () => ({
  authApi: { login: vi.fn(), getMe: vi.fn() },
  enrollmentApi: { listMyEnrollments: vi.fn(), cancelEnrollment: vi.fn() },
}));

const listMock = vi.mocked(enrollmentApi.listMyEnrollments);
const cancelMock = vi.mocked(enrollmentApi.cancelEnrollment);
const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };

const rows = [
  {
    enrollmentId: 11,
    courseId: 1,
    courseTitle: 'Java 기초',
    sessionStartAt: '2026-12-01T09:00:00',
    place: '3층',
    status: 'CONFIRMED',
    promoted: true,
    appliedAt: '2026-11-01T10:00:00',
  },
  {
    enrollmentId: 12,
    courseId: 2,
    courseTitle: 'Spring 심화',
    sessionStartAt: '2026-12-05T09:00:00',
    place: '온라인',
    status: 'WAITING',
    waitingNumber: 3,
    appliedAt: '2026-11-02T10:00:00',
  },
  {
    enrollmentId: 13,
    courseId: 3,
    courseTitle: 'SQL',
    status: 'CANCELLED',
    appliedAt: '2026-11-03T10:00:00',
  },
];

function listResult(data: unknown[]) {
  return { data } as never;
}

function renderPage() {
  return renderWithAuth(<MyEnrollmentsPage />, { route: '/my/enrollments' });
}

beforeEach(() => {
  localStorage.clear();
  tokenStore.save('tok-1', employee);
  vi.mocked(authApi.getMe).mockReset();
  vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
  listMock.mockReset();
  cancelMock.mockReset();
});

describe('MyEnrollmentsPage', () => {
  it('M1 목록: 대기 N번, 승급 표시, 취소 버튼은 확정·대기에만 있다', async () => {
    listMock.mockResolvedValue(listResult(rows));
    renderPage();

    expect(await screen.findByRole('link', { name: 'Java 기초' })).toHaveAttribute(
      'href',
      '/courses/1',
    );
    expect(screen.getByText('대기 3번')).toBeInTheDocument();
    expect(screen.getByText('대기에서 확정')).toBeInTheDocument();
    expect(screen.getByText('2026-12-01 09:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Java 기초 신청 취소' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spring 심화 신청 취소' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SQL 신청 취소' })).not.toBeInTheDocument();
  });

  it('대기 번호가 숫자가 아니면 "대기"만 쓴다', async () => {
    listMock.mockResolvedValue(
      listResult([{ ...rows[1], waitingNumber: undefined, courseTitle: 'X' }]),
    );
    renderPage();
    const row = (await screen.findByRole('link', { name: 'X' })).closest('tr') as HTMLElement;
    expect(within(row).getByText('대기')).toBeInTheDocument();
    expect(within(row).queryByText(/번/)).not.toBeInTheDocument();
  });

  it('M2 필터 "대기"를 누르면 listMyEnrollments("WAITING")을 부른다', async () => {
    listMock.mockResolvedValue(listResult(rows));
    renderPage();
    await screen.findByRole('link', { name: 'Java 기초' });
    expect(listMock).toHaveBeenLastCalledWith(undefined);

    fireEvent.click(screen.getByRole('radio', { name: '대기', hidden: true }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith('WAITING'));
  });

  it('M3 취소 확인 → cancelEnrollment(id) → 알림 → 재조회', async () => {
    listMock.mockResolvedValue(listResult(rows));
    cancelMock.mockResolvedValue({ data: {} } as never);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Java 기초 신청 취소' }));
    expect(await screen.findByText(/대기 1순위가 있으면 자동으로 확정됩니다/)).toBeInTheDocument();
    expect(cancelMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }));

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(11));
    expect(await screen.findByText('신청을 취소했습니다.')).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it('대기 신청의 확인 문구에는 자동 확정 안내가 없다', async () => {
    listMock.mockResolvedValue(listResult(rows));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Spring 심화 신청 취소' }));
    expect(await screen.findByText('신청을 취소할까요?')).toBeInTheDocument();
    expect(screen.queryByText(/자동으로 확정/)).not.toBeInTheDocument();
  });

  it('409로 취소가 실패하면 알림 문구를 보이고 목록을 다시 불러온다', async () => {
    listMock.mockResolvedValue(listResult(rows));
    const config = { headers: new AxiosHeaders() };
    cancelMock.mockRejectedValue(
      new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, {
        status: 409,
        statusText: '',
        headers: {},
        config,
        data: { code: 'SESSION_ALREADY_STARTED', message: 'x' },
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Java 기초 신청 취소' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }));

    expect(await screen.findByText('이미 시작된 회차라 취소할 수 없습니다.')).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it('409가 아닌 취소 실패는 알림만 띄우고 재조회하지 않는다', async () => {
    listMock.mockResolvedValue(listResult(rows));
    cancelMock.mockRejectedValue(new Error('네트워크 오류'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Java 기초 신청 취소' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '신청 취소' }));
    expect(await screen.findByText('네트워크 오류')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('확인 모달에서 닫기를 누르면 취소하지 않는다', async () => {
    listMock.mockResolvedValue(listResult(rows));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Java 기초 신청 취소' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('M4 빈 목록이면 안내와 교육과정 보기 링크를 보인다', async () => {
    listMock.mockResolvedValue(listResult([]));
    renderPage();
    expect(await screen.findByText('신청 내역이 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '교육과정 보기' })).toHaveAttribute('href', '/');
  });

  it('조회가 axios 오류면 서버 message를 Alert에 보인다', async () => {
    const config = { headers: new AxiosHeaders() };
    listMock.mockRejectedValue(
      new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', config, null, {
        status: 500,
        statusText: '',
        headers: {},
        config,
        data: { code: 'INTERNAL', message: '잠시 후 다시 시도하세요.' },
      }),
    );
    renderPage();
    expect(await screen.findByText('잠시 후 다시 시도하세요.')).toBeInTheDocument();
    expect(screen.queryByText(/status code 500/)).not.toBeInTheDocument();
  });

  it('조회가 실패하면 오류 Alert를 보인다', async () => {
    listMock.mockRejectedValue(new Error('서버 오류'));
    renderPage();
    expect(await screen.findByText('서버 오류')).toBeInTheDocument();
  });
});
