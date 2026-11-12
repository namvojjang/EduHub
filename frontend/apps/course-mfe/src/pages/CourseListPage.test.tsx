import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourses } from '../hooks/useCourses';
import { CourseListPage } from './CourseListPage';

vi.mock('../hooks/useCourses', () => ({
  useCourses: vi.fn(),
}));

const useCoursesMock = vi.mocked(useCourses);

describe('CourseListPage', () => {
  beforeEach(() => {
    useCoursesMock.mockReset();
  });

  it('과정 목록을 표에 보여 준다', () => {
    useCoursesMock.mockReturnValue({
      data: {
        content: [
          { id: 1, title: 'Java 기초', category: '개발' },
          { id: 2, title: '데이터 분석 입문', category: '데이터' },
        ],
        page: 0,
        size: 20,
        totalElements: 2,
      },
      loading: false,
      error: null,
    });

    render(<CourseListPage />);

    expect(screen.getByText('Java 기초')).toBeInTheDocument();
    expect(screen.getByText('데이터 분석 입문')).toBeInTheDocument();
    expect(screen.getByText('1–2 / 전체 2')).toBeInTheDocument();
    // 처음에는 첫 페이지(0)를 요청한다.
    expect(useCoursesMock).toHaveBeenCalledWith({ keyword: '', category: '', page: 0, size: 20 });
  });

  it('불러오지 못하면 에러 메시지를 보여 준다', () => {
    useCoursesMock.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Network Error'),
    });

    render(<CourseListPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('과정 목록을 불러오지 못했습니다. (Network Error)');
  });
});
