import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, tokenStore, UNAUTHORIZED_EVENT } from '@eduhub/http';
import { renderWithAuth } from '../test/render';
import { LoginPage, safeRedirectPath } from './LoginPage';

vi.mock('@eduhub/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eduhub/http')>()),
  authApi: { login: vi.fn(), getMe: vi.fn() },
}));

const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };

function LocationDisplay() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderLogin(from?: string) {
  return renderWithAuth(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { route: { pathname: '/login', state: from === undefined ? undefined : { from } } },
  );
}

function submit(no = 'E1001', pw = 'dev-password') {
  fireEvent.change(screen.getByLabelText(/사번/), { target: { value: no } });
  fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: pw } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

function loginSucceeds() {
  vi.mocked(authApi.login).mockResolvedValue({
    data: { accessToken: 'tok-1', user: employee },
  } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authApi.login).mockReset();
  vi.mocked(authApi.getMe).mockReset();
});

describe('safeRedirectPath', () => {
  it.each([
    ['/admin/courses?a=1', '/admin/courses?a=1'],
    ['/', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    ['evil.com', '/'],
    [undefined, '/'],
    [123, '/'],
    ['/login', '/'],
    ['/login?x=1', '/'],
    ['/LOGIN', '/'],
    ['/Login?x=1', '/'],
    ['/login/', '/'],
    ['/loginx', '/loginx'],
    ['/%5C/evil.com', '/%5C/evil.com'],
    ['/%09/evil.com', '/%09/evil.com'],
    ['/\t/evil.com', '/'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe('LoginPage', () => {
  it('A1 로그인에 성공하면 토큰을 저장하고 state.from으로 이동한다', async () => {
    loginSucceeds();
    renderLogin('/courses/3?x=1');
    submit();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/courses/3?x=1'));
    expect(authApi.login).toHaveBeenCalledWith({ employeeNo: 'E1001', password: 'dev-password' });
    expect(tokenStore.get()).toBe('tok-1');
    expect(tokenStore.user()).toEqual(employee);
  });

  it('A1b from이 없으면 /로 이동한다', async () => {
    loginSucceeds();
    renderLogin();
    submit();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  });

  it.each(['//evil.com', 'https://evil.com'])(
    'A1c 외부 from(%s)이면 /로 이동한다',
    async (from) => {
      loginSucceeds();
      renderLogin(from);
      submit();
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    },
  );

  it('A2 LOGIN_FAILED면 안내 문구를 보이고 이동하지 않는다', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new AxiosError('failed', '401', undefined, undefined, {
        status: 401,
        data: { code: 'LOGIN_FAILED', message: '서버 메시지' },
      } as never),
    );
    renderLogin();
    submit('E1001', 'wrong');
    expect(await screen.findByText('사번 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  it('A2b 그 밖의 오류는 getErrorMessage의 문구를 보인다', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Network Error'));
    renderLogin();
    submit();
    expect(await screen.findByText('Network Error')).toBeInTheDocument();
  });

  it('A3 세션이 만료되면 만료 안내를 보인다', () => {
    renderLogin();
    expect(screen.queryByText(/만료되었습니다/)).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    });
    expect(screen.getByText('로그인이 만료되었습니다. 다시 로그인하세요.')).toBeInTheDocument();
  });

  it('이미 로그인 상태면 /로 보낸다', () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    renderLogin('/courses/3');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });
});
