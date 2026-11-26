import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { renderWithAuth } from '../test/render';
import { AppLayout } from './AppLayout';

vi.mock('../api/clients', () => ({ authApi: { login: vi.fn(), getMe: vi.fn() } }));

const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };
const admin = { employeeId: 9, employeeNo: 'A0001', name: '김관리', role: 'ADMIN' };

// 현재 location을 화면에 보여 주는 요소(이동 확인용)
function LocationDisplay() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

// 로그인 상태(tokenStore)를 렌더 전에 넣는다. 기본은 관리자(과정 관리 메뉴가 보여야 하는 테스트가 많다).
function renderAt(path: string, user: typeof admin | typeof employee | null = admin) {
  if (user) {
    tokenStore.save('tok-1', user);
    vi.mocked(authApi.getMe).mockResolvedValue({ data: user } as never);
  }
  return renderWithAuth(
    <AppLayout>
      <Routes>
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </AppLayout>,
    { route: path },
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authApi.getMe).mockReset();
});

describe('AppLayout', () => {
  it('/admin/courses에서는 과정 관리 내비가 active다', () => {
    renderAt('/admin/courses');
    expect(screen.getByRole('link', { name: /과정 관리/ })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /교육과정/ })).not.toHaveAttribute('data-active');
  });

  it('/courses/1에서는 교육과정 내비가 active다', () => {
    renderAt('/courses/1');
    expect(screen.getByRole('link', { name: /교육과정/ })).toHaveAttribute('data-active', 'true');
  });

  it('헤더 검색을 제출하면 /?keyword=…로 이동한다', () => {
    renderAt('/admin/courses');
    const input = screen.getByPlaceholderText('과정명으로 검색');
    fireEvent.change(input, { target: { value: 'java 기초' } });
    fireEvent.submit(input);
    expect(screen.getByTestId('location')).toHaveTextContent('/?keyword=java%20%EA%B8%B0%EC%B4%88');
  });

  it('빈 값으로 제출하면 /로 이동하고, 입력 초기값은 URL keyword와 같다', () => {
    renderAt('/?keyword=abc');
    const input = screen.getByPlaceholderText('과정명으로 검색');
    expect(input).toHaveValue('abc');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.submit(input);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('화면 테마 전환 버튼이 있다', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: '화면 테마 전환' })).toBeInTheDocument();
  });

  it('/에서는 과정 관리 내비가 active가 아니다', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /과정 관리/ })).not.toHaveAttribute('data-active');
  });

  it('L1 내 신청 내역은 /my/enrollments 링크이고 다른 경로에서는 active가 아니다', () => {
    renderAt('/');
    const link = screen.getByRole('link', { name: /내 신청 내역/ });
    expect(link).toHaveAttribute('href', '/my/enrollments');
    expect(link).not.toHaveAttribute('data-active');
  });

  it('/my/enrollments에서는 내 신청 내역 내비가 active다', () => {
    renderAt('/my/enrollments');
    expect(screen.getByRole('link', { name: /내 신청 내역/ })).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  it('테마 전환 버튼을 누르면 색 스킴이 바뀐다', () => {
    renderAt('/');
    const root = document.documentElement;
    const before = root.getAttribute('data-mantine-color-scheme');
    fireEvent.click(screen.getByRole('button', { name: '화면 테마 전환' }));
    const after = root.getAttribute('data-mantine-color-scheme');
    expect(after).not.toBe(before);
    expect(after).toBe('dark');
    window.localStorage.clear();
  });

  it('URL이 바뀌면 검색 입력이 따라간다', () => {
    renderWithAuth(
      <AppLayout>
        <Link to="/?keyword=x">x 검색</Link>
      </AppLayout>,
    );
    const input = screen.getByPlaceholderText('과정명으로 검색');
    expect(input).toHaveValue('');
    fireEvent.click(screen.getByRole('link', { name: 'x 검색' }));
    expect(input).toHaveValue('x');
  });

  it('제출 뒤 입력값은 trim한 값이다', () => {
    renderAt('/');
    const input = screen.getByPlaceholderText('과정명으로 검색');
    fireEvent.change(input, { target: { value: '  react  ' } });
    fireEvent.submit(input);
    expect(input).toHaveValue('react');
  });

  it('Burger는 열림 상태에 따라 라벨과 aria-expanded가 바뀐다', () => {
    renderAt('/');
    const burger = screen.getByRole('button', { name: '메뉴 열기' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(burger).toHaveAttribute('aria-controls', 'app-navbar');
    fireEvent.click(burger);
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('로그인 화면에서도 검색창이 동작한다', () => {
    renderAt('/login', null);
    const input = screen.getByPlaceholderText('과정명으로 검색');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.submit(input);
    expect(screen.getByTestId('location')).toHaveTextContent('/?keyword=abc');
  });
});

describe('AppLayout 로그인 상태별 메뉴 (L1)', () => {
  it('L1 비로그인: 로그인 버튼이 있고 과정 관리·사용자 메뉴는 없다', () => {
    renderAt('/', null);
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /과정 관리/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용자 메뉴' })).not.toBeInTheDocument();
  });

  it('로그인 화면에서는 헤더 로그인 버튼을 숨긴다', () => {
    renderAt('/login', null);
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('/LOGIN(대문자)에서도 헤더 로그인 버튼을 숨긴다', () => {
    renderAt('/LOGIN', null);
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('L1 사원: 이름(아바타 첫 글자)이 보이고 과정 관리는 없다', () => {
    renderAt('/', employee);
    expect(screen.getByRole('button', { name: '사용자 메뉴' })).toHaveTextContent('홍');
    expect(screen.getByRole('button', { name: '사용자 메뉴' })).toHaveTextContent('홍길동');
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /과정 관리/ })).not.toBeInTheDocument();
    expect(screen.getByText('내 신청 내역')).toBeInTheDocument();
  });

  it('L1 관리자: 과정 관리가 보인다', () => {
    renderAt('/', admin);
    expect(screen.getByRole('link', { name: /과정 관리/ })).toBeInTheDocument();
  });

  it('사용자 메뉴에 이름·사번·역할이 보인다', async () => {
    renderAt('/', employee);
    fireEvent.click(screen.getByRole('button', { name: '사용자 메뉴' }));
    expect(await screen.findByText('사번 E1001', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('사원')).toBeInTheDocument();
  });

  it('로그아웃하면 토큰을 지우고 /로 이동하고 토스트를 띄운다', async () => {
    renderAt('/admin/courses', admin);
    fireEvent.click(screen.getByRole('button', { name: '사용자 메뉴' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '로그아웃', hidden: true }));
    expect(tokenStore.get()).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(await screen.findByText('로그아웃했습니다')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /과정 관리/ })).not.toBeInTheDocument();
  });
});

describe('AppLayout 다른 탭의 로그인 변화 (W1)', () => {
  function dispatchStorage(key: string | null) {
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    });
  }

  it('다른 탭에서 로그아웃하면 이 탭도 비로그인이 되고 과정 관리가 사라진다', () => {
    renderAt('/', admin);
    expect(screen.getByRole('link', { name: /과정 관리/ })).toBeInTheDocument();
    localStorage.clear();
    dispatchStorage('eduhub.accessToken');
    expect(screen.queryByRole('link', { name: /과정 관리/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
  });

  it('다른 탭에서 다른 사용자로 로그인하면 이 탭의 이름이 바뀐다', () => {
    renderAt('/', admin);
    expect(screen.getByRole('button', { name: '사용자 메뉴' })).toHaveTextContent('김관리');
    tokenStore.save('tok-2', employee);
    dispatchStorage('eduhub.user');
    expect(screen.getByRole('button', { name: '사용자 메뉴' })).toHaveTextContent('홍길동');
    expect(screen.queryByRole('link', { name: /과정 관리/ })).not.toBeInTheDocument();
  });

  it('관계없는 키의 storage 이벤트는 무시한다', () => {
    renderAt('/', admin);
    localStorage.clear();
    dispatchStorage('other.key');
    expect(screen.getByRole('link', { name: /과정 관리/ })).toBeInTheDocument();
  });
});
