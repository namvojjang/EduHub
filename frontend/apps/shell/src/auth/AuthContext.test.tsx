import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, tokenStore, UNAUTHORIZED_EVENT } from '@eduhub/http';
import { renderWithAuth } from '../test/render';
import { useAuth } from './AuthContext';

vi.mock('@eduhub/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eduhub/http')>()),
  authApi: { login: vi.fn(), getMe: vi.fn() },
}));

const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };

function Probe() {
  const { user, expired } = useAuth();
  const { pathname, search, key, state } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="state">
        user={user?.name ?? 'none'} expired={String(expired)}
      </div>
      <div data-testid="where">{pathname + search}</div>
      <div data-testid="key">{key}</div>
      <button onClick={() => navigate('/')}>go-home</button>
      <div data-testid="from">{(state as { from?: string } | null)?.from}</div>
    </>
  );
}

function fire401() {
  act(() => {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authApi.getMe).mockReset();
});

describe('AuthProvider', () => {
  it('L2 401 이벤트를 받으면 expired가 되고 사용자를 비우고 /login으로 이동한다', () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    renderWithAuth(<Probe />, { route: '/admin/courses?page=2' });
    expect(screen.getByTestId('state')).toHaveTextContent('user=홍길동 expired=false');

    fire401();

    expect(screen.getByTestId('state')).toHaveTextContent('user=none expired=true');
    expect(screen.getByTestId('where')).toHaveTextContent('/login');
    expect(screen.getByTestId('from')).toHaveTextContent('/admin/courses?page=2');
  });

  it('L2b 이미 /login이면 이벤트가 연달아 와도 다시 이동하지 않는다', () => {
    renderWithAuth(<Probe />, { route: '/login' });
    const keyBefore = screen.getByTestId('key').textContent;
    fire401();
    fire401();
    expect(screen.getByTestId('state')).toHaveTextContent('expired=true');
    expect(screen.getByTestId('key').textContent).toBe(keyBefore);
  });

  it('저장된 사용자 형식이 이상하면(role 없음) 로그인하지 않은 것으로 본다', () => {
    localStorage.setItem('eduhub.accessToken', 'tok-1');
    localStorage.setItem('eduhub.user', JSON.stringify({ name: '홍길동' }));
    vi.mocked(authApi.getMe).mockReturnValue(new Promise(() => {}) as never);
    renderWithAuth(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('user=none');
  });

  it('시작할 때 토큰이 있으면 getMe로 확인해 서버 값으로 갱신한다', async () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({
      data: { ...employee, name: '홍길순' },
    } as never);
    renderWithAuth(<Probe />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user=홍길순'));
    expect(tokenStore.user()?.name).toBe('홍길순');
  });

  it('토큰 없이 사용자만 저장돼 있으면 비로그인으로 시작하고 저장소를 정리한다', () => {
    localStorage.setItem('eduhub.user', JSON.stringify(employee));
    renderWithAuth(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('user=none');
    expect(localStorage.getItem('eduhub.user')).toBeNull();
  });

  it('만료 안내는 /login이 아닌 경로로 이동하면 false로 돌아간다', () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    renderWithAuth(<Probe />, { route: '/admin/courses' });
    fire401();
    expect(screen.getByTestId('state')).toHaveTextContent('expired=true');
    fireEvent.click(screen.getByRole('button', { name: 'go-home' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
    expect(screen.getByTestId('state')).toHaveTextContent('expired=false');
  });

  it('시작 시 getMe 응답 전에 토큰이 바뀌면 옛 응답으로 user와 저장소를 덮지 않는다', async () => {
    tokenStore.save('tok-1', employee);
    let resolveMe: (v: unknown) => void = () => {};
    vi.mocked(authApi.getMe).mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }) as never,
    );
    renderWithAuth(<Probe />);
    // 확인하는 동안 다른 탭에서 다른 사람으로 로그인했다고 가정한다.
    tokenStore.save('tok-2', { ...employee, employeeId: 2, name: '김새로' });

    await act(async () => {
      resolveMe({ data: { ...employee, name: '옛응답' } });
    });

    expect(screen.getByTestId('state')).toHaveTextContent('user=홍길동');
    expect(screen.getByTestId('state')).not.toHaveTextContent('옛응답');
    expect(tokenStore.get()).toBe('tok-2');
    expect(tokenStore.user()?.name).toBe('김새로');
  });

  it('토큰이 없으면 getMe를 부르지 않는다', () => {
    renderWithAuth(<Probe />);
    expect(authApi.getMe).not.toHaveBeenCalled();
  });
});
