import { fireEvent, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { AppLayout } from './AppLayout';

// 현재 location을 화면에 보여 주는 요소(이동 확인용)
function LocationDisplay() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderAt(path: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout>
        <Routes>
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </AppLayout>
    </MemoryRouter>,
  );
}

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

  it('내 신청 내역은 비활성이다', () => {
    renderAt('/');
    const item = screen.getByText('내 신청 내역').closest('a, button');
    expect(item).toHaveAttribute('data-disabled', 'true');
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
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout>
          <Link to="/?keyword=x">x 검색</Link>
        </AppLayout>
      </MemoryRouter>,
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
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute('aria-expanded', 'true');
  });
});
