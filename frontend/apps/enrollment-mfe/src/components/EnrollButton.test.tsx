import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentApi } from '@eduhub/http';
import { renderWithRouter } from '../test/render';
import { EnrollButton } from './EnrollButton';

// getErrorMessage 등 나머지 export는 실제 것을 쓰고 API 객체만 대체한다.
vi.mock('@eduhub/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eduhub/http')>()),
  enrollmentApi: { applyEnrollment: vi.fn(), cancelEnrollment: vi.fn() },
}));

const applyMock = vi.mocked(enrollmentApi.applyEnrollment);

let loggedIn = false;

// 로그인 상태는 shell이 prop으로 내려 준다. 로그인한 테스트는 렌더 전에 login()을 부른다.
function login() {
  loggedIn = true;
}

function renderButton(props: { disabledReason?: string; onChanged?: () => void } = {}) {
  return renderWithRouter(
    <Routes>
      <Route
        path="/courses/:id"
        element={<EnrollButton sessionId={7} loggedIn={loggedIn} {...props} />}
      />
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
  loggedIn = false;
  applyMock.mockReset();
  vi.mocked(enrollmentApi.cancelEnrollment).mockReset();
});

describe('EnrollButton', () => {
  it('loggedIn이 true에서 false로 바뀌면 "로그인 후 신청" 안내로 바뀐다', () => {
    // shell이 로그아웃 때 prop만 바꿔 다시 그리는 상황
    function Harness() {
      const [on, setOn] = useState(true);
      return (
        <>
          <button onClick={() => setOn(false)}>로그아웃 시뮬레이션</button>
          <Routes>
            <Route path="/courses/:id" element={<EnrollButton sessionId={7} loggedIn={on} />} />
          </Routes>
        </>
      );
    }
    renderWithRouter(<Harness />, { route: '/courses/3' });
    expect(screen.queryByRole('link', { name: '로그인 후 신청' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '로그아웃 시뮬레이션' }));

    expect(screen.getByRole('link', { name: '로그인 후 신청' })).toHaveAttribute('href', '/login');
  });

  it('E1 비로그인이면 "로그인 후 신청" 링크가 /login으로 간다', () => {
    renderButton();

    expect(screen.getByRole('link', { name: '로그인 후 신청' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: '신청하기' })).not.toBeInTheDocument();
  });

  it('E2 확정 응답이면 확정 안내를 보이고 apply(7)와 onChanged를 호출한다', async () => {
    login();
    applyMock.mockResolvedValue({ data: { id: 1, sessionId: 7, status: 'CONFIRMED' } } as never);
    const onChanged = vi.fn();
    renderButton({ onChanged });

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('신청이 확정되었습니다.')).toBeInTheDocument();
    expect(applyMock).toHaveBeenCalledWith({ sessionId: 7 });
    expect(onChanged).toHaveBeenCalledTimes(1);
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
    const onChanged = vi.fn();
    renderButton({ onChanged });

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(
      await screen.findByText('이미 이 과정에 신청했습니다. 내 신청 내역에서 확인하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/: 3/)).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: '신청하기' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));
    await waitFor(() => expect(applyMock).toHaveBeenCalledTimes(2));
  });

  it('409 SESSION_NOT_RECRUITING이면 문구를 보이고 onChanged를 호출한다', async () => {
    login();
    applyMock.mockRejectedValue(conflict('SESSION_NOT_RECRUITING'));
    const onChanged = vi.fn();
    renderButton({ onChanged });

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('모집 중인 회차가 아닙니다.')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('401이면 오류 문구를 띄우지 않는다', async () => {
    login();
    const config = { headers: new AxiosHeaders() };
    applyMock.mockRejectedValue(
      new AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        statusText: '',
        headers: {},
        config,
        data: { message: '인증 필요' },
      }),
    );
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    await waitFor(() => expect(applyMock).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('비로그인이어도 disabledReason이 있으면 비활성 버튼과 이유를 보이고 로그인 링크는 없다', () => {
    renderButton({ disabledReason: '모집 마감' });

    expect(screen.getByRole('button', { name: '신청하기' })).toBeDisabled();
    expect(screen.getByText('모집 마감')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인 후 신청' })).not.toBeInTheDocument();
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
    // 같은 act 안에서 두 번: loading이 화면에 반영되기 전의 클릭을 흉내 낸다(ref 가드만 막을 수 있다).
    act(() => {
      button.click();
      button.click();
    });

    await waitFor(() => expect(button).toHaveAttribute('data-loading', 'true'));
    expect(applyMock).toHaveBeenCalledTimes(1);

    resolve({ data: { status: 'CONFIRMED' } });
    expect(await screen.findByText('신청이 확정되었습니다.')).toBeInTheDocument();
  });

  it('E1 비로그인 링크를 누르면 현재 경로(쿼리 포함)를 from으로 넘긴다', () => {
    renderWithRouter(
      <Routes>
        <Route path="/courses/:id" element={<EnrollButton sessionId={7} loggedIn={false} />} />
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
