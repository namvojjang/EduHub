import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { CourseDetailPage } from './CourseDetailPage';

vi.mock('../hooks/useCourseDetail', () => ({
  useCourseDetail: vi.fn(),
}));

const useCourseDetailMock = vi.mocked(useCourseDetail);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/courses/:id" element={<CourseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CourseDetailPage', () => {
  beforeEach(() => {
    useCourseDetailMock.mockReset();
  });

  it('과정 정보와 회차(일정, 장소, 정원, 남은 자리)를 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({
      data: {
        id: 7,
        title: 'Java 기초',
        category: '개발',
        description: '자바 입문 과정',
        status: 'OPEN',
        sessions: [
          {
            id: 70,
            startAt: '2026-12-01T09:00:00',
            place: '본사 3층',
            capacity: 20,
            remainingSeats: 20,
            status: 'RECRUITING',
          },
        ],
      },
      loading: false,
      notFound: false,
      error: null,
    });

    renderAt('/courses/7');

    expect(useCourseDetailMock).toHaveBeenCalledWith(7);
    expect(screen.getByRole('heading', { name: 'Java 기초' })).toBeInTheDocument();
    expect(screen.getByText('자바 입문 과정')).toBeInTheDocument();
    expect(screen.getByText('운영 중')).toBeInTheDocument();

    const row = within(screen.getByRole('table', { name: '회차 목록' })).getAllByRole('row')[1];
    expect(row).toHaveTextContent('2026-12-01 09:00');
    expect(row).toHaveTextContent('본사 3층');
    expect(row).toHaveTextContent('20');
    expect(row).toHaveTextContent('모집 중');
  });

  it('회차가 없으면 안내 문구를 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({
      data: { id: 7, title: 'Java 기초', category: '개발', status: 'OPEN', sessions: [] },
      loading: false,
      notFound: false,
      error: null,
    });

    renderAt('/courses/7');

    expect(screen.getByText('등록된 회차가 없습니다.')).toBeInTheDocument();
  });

  it('없는 과정이면 안내 메시지를 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({ data: null, loading: false, notFound: true, error: null });

    renderAt('/courses/999');

    expect(screen.getByRole('alert')).toHaveTextContent('과정을 찾을 수 없습니다.');
  });

  it('불러오지 못하면 에러 메시지를 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({
      data: null,
      loading: false,
      notFound: false,
      error: new Error('Network Error'),
    });

    renderAt('/courses/7');

    expect(screen.getByRole('alert')).toHaveTextContent('과정 정보를 불러오지 못했습니다. (Network Error)');
  });
});
