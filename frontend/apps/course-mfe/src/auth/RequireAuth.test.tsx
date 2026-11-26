import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { renderWithAuth } from '../test/render';
import { RequireAuth } from './RequireAuth';

vi.mock('../api/clients', () => ({ authApi: { login: vi.fn(), getMe: vi.fn() } }));

const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };
const admin = { employeeId: 9, employeeNo: 'A0001', name: '관리자', role: 'ADMIN' };

function LoginProbe() {
  const { pathname, state } = useLocation();
  return (
    <div data-testid="login">
      {pathname} from={(state as { from?: string } | null)?.from}
    </div>
  );
}

function renderAdminRoute() {
  return renderWithAuth(
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route
        path="/admin/courses"
        element={
          <RequireAuth admin>
            <div>관리자 목록</div>
          </RequireAuth>
        }
      />
    </Routes>,
    { route: '/admin/courses?page=2' },
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authApi.getMe).mockReset();
});

describe('RequireAuth', () => {
  it('R1 로그인하지 않았으면 /login으로 보내고 원래 경로를 from으로 넘긴다', () => {
    renderAdminRoute();
    expect(screen.getByTestId('login')).toHaveTextContent('/login from=/admin/courses?page=2');
    expect(screen.queryByText('관리자 목록')).not.toBeInTheDocument();
  });

  it('R2 사원이 관리자 화면에 오면 경고를 보이고 로그아웃시키지 않는다', () => {
    tokenStore.save('tok-1', employee);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    renderAdminRoute();
    expect(screen.getByText('관리자만 사용할 수 있는 화면입니다.')).toBeInTheDocument();
    expect(screen.queryByText('관리자 목록')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
    expect(tokenStore.get()).toBe('tok-1');
  });

  it('관리자는 화면을 본다', () => {
    tokenStore.save('tok-1', admin);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: admin } as never);
    renderAdminRoute();
    expect(screen.getByText('관리자 목록')).toBeInTheDocument();
  });
});
