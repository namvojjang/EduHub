import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, enrollmentApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { renderWithAuth } from '../test/render';
import { EnrollButton } from './EnrollButton';

vi.mock('../api/clients', () => ({
  authApi: { login: vi.fn(), getMe: vi.fn() },
  enrollmentApi: { applyEnrollment: vi.fn(), cancelEnrollment: vi.fn() },
}));

const applyMock = vi.mocked(enrollmentApi.applyEnrollment);
const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };

function login() {
  tokenStore.save('tok-1', employee);
}

function renderButton(props: { disabledReason?: string; onApplied?: () => void } = {}) {
  return renderWithAuth(
    <Routes>
      <Route path="/courses/:id" element={<EnrollButton sessionId={7} {...props} />} />
    </Routes>,
    { route: '/courses/3?tab=sessions' },
  );
}

function conflict(code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status: 409,
    statusText: '',
    headers: {},
    config,
    data: { code, message: '이미 신청한 과정입니다: 3' },
  });
}

beforeEach(() => {
  localStorage.clear();
  // 로그인 상태면 AuthProvider가 시작 시 /me를 확인한다
  vi.mocked(authApi.getMe).mockReset();
  vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
  applyMock.mockReset();
  vi.mocked(enrollmentApi.cancelEnrollment).mockReset();
});

describe('EnrollButton', () => {
  it('E1 비로그인이면 "로그인 후 신청" 링크가 /login으로 간다', () => {
    renderButton();

    expect(screen.getByRole('link', { name: '로그인 후 신청' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: '신청하기' })).not.toBeInTheDocument();
  });

  it('E2 확정 응답이면 확정 안내를 보이고 apply(7)와 onApplied를 호출한다', async () => {
    login();
    applyMock.mockResolvedValue({ data: { id: 1, sessionId: 7, status: 'CONFIRMED' } } as never);
    const onApplied = vi.fn();
    renderButton({ onApplied });

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('신청이 확정되었습니다.')).toBeInTheDocument();
    expect(applyMock).toHaveBeenCalledWith({ sessionId: 7 });
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: '내 신청 내역' })).toHaveAttribute(
      'href',
      '/my/enrollments',
    );
    expect(screen.queryByRole('button', { name: '신청하기' })).not.toBeInTheDocument();
  });

  it('E3 대기 응답이면 서버가 준 대기 번호를 보여 준다', async () => {
    login();
    applyMock.mockResolvedValue({
      data: { id: 2, sessionId: 7, status: 'WAITING', waitingNumber: 2 },
    } as never);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('대기 2번으로 등록되었습니다.')).toBeInTheDocument();
  });

  it('WAITING인데 waitingNumber가 없으면 번호 없이 "대기로 등록되었습니다."를 보인다', async () => {
    login();
    applyMock.mockResolvedValue({ data: { id: 2, sessionId: 7, status: 'WAITING' } } as never);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('대기로 등록되었습니다.')).toBeInTheDocument();
  });

  it('waitingNumber가 null이어도 "대기 null번"이 아니라 "대기로 등록되었습니다."를 보인다', async () => {
    login();
    applyMock.mockResolvedValue({
      data: { id: 2, sessionId: 7, status: 'WAITING', waitingNumber: null },
    } as never);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('대기로 등록되었습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it('CONFIRMED·WAITING이 아닌 status는 확정이라고 단정하지 않는다', async () => {
    login();
    applyMock.mockResolvedValue({ data: { id: 3, sessionId: 7, status: 'COMPLETED' } } as never);
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(
      await screen.findByText('신청이 접수되었습니다. 내 신청 내역에서 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('신청이 확정되었습니다.')).not.toBeInTheDocument();
  });

  it('E4 409 DUPLICATE_ENROLLMENT면 고정 안내를 보이고 다시 누를 수 있다', async () => {
    login();
    applyMock.mockRejectedValue(conflict('DUPLICATE_ENROLLMENT'));
    const onApplied = vi.fn();
    renderButton({ onApplied });

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(
      await screen.findByText('이미 이 과정에 신청했습니다. 내 신청 내역에서 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/: 3/)).not.toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: '신청하기' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));
    await waitFor(() => expect(applyMock).toHaveBeenCalledTimes(2));
  });

  it('E5 disabledReason이 있으면 비활성 버튼과 이유를 보여 준다', () => {
    login();
    renderButton({ disabledReason: '모집 마감' });

    const button = screen.getByRole('button', { name: '신청하기' });
    expect(button).toBeDisabled();
    expect(screen.getByText('모집 마감')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-describedby', screen.getByText('모집 마감').id);
  });

  it('진행 중에는 버튼이 loading이고 빠르게 두 번 눌러도 한 번만 요청한다', async () => {
    login();
    let resolve: (value: unknown) => void = () => {};
    applyMock.mockReturnValue(new Promise((r) => (resolve = r)) as never);
    renderButton();

    const button = screen.getByRole('button', { name: '신청하기' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('data-loading', 'true'));
    expect(applyMock).toHaveBeenCalledTimes(1);

    resolve({ data: { status: 'CONFIRMED' } });
    expect(await screen.findByText('신청이 확정되었습니다.')).toBeInTheDocument();
  });

  it('E1 비로그인 링크를 누르면 현재 경로(쿼리 포함)를 from으로 넘긴다', () => {
    renderWithAuth(
      <Routes>
        <Route path="/courses/:id" element={<EnrollButton sessionId={7} />} />
        <Route path="/login" element={<FromDisplay />} />
      </Routes>,
      { route: '/courses/3?tab=sessions' },
    );

    fireEvent.click(screen.getByRole('link', { name: '로그인 후 신청' }));

    expect(screen.getByTestId('from')).toHaveTextContent('/courses/3?tab=sessions');
  });
});

function FromDisplay() {
  const location = useLocation();
  return <div data-testid="from">{(location.state as { from?: string } | null)?.from}</div>;
}
