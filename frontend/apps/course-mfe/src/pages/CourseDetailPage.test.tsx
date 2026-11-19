import { screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { renderWithProviders } from '../test/render';
import { CourseDetailPage } from './CourseDetailPage';

vi.mock('../hooks/useCourseDetail', () => ({
  useCourseDetail: vi.fn(),
}));

const useCourseDetailMock = vi.mocked(useCourseDetail);

function renderAt(path: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/courses/:id" element={<CourseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// 회차 하나를 가진 과정 데이터를 mock에 넣는다.
function mockWithSession(remainingSeats: number, status: 'RECRUITING' | 'CLOSED') {
  useCourseDetailMock.mockReturnValue({
    data: {
      id: 7,
      title: 'Java 기초',
      category: '개발',
      status: 'OPEN',
      sessions: [{ id: 70, startAt: '2026-12-01T09:00:00', place: '본사 3층', capacity: 20, remainingSeats, status }],
    },
    loading: false,
    notFound: false,
    error: null,
  });
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

    const items = within(screen.getByRole('list', { name: '회차 목록' })).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('2026-12-01 09:00');
    expect(items[0]).toHaveTextContent('본사 3층');
    expect(items[0]).toHaveTextContent('남은 자리 20 / 20');
    expect(items[0]).toHaveTextContent('모집 중');
    expect(screen.queryByText('0 (정원 마감)')).not.toBeInTheDocument();
    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: '신청하기' })).toBeDisabled();
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
    expect(screen.queryByRole('list', { name: '회차 목록' })).not.toBeInTheDocument();
  });

  it('남은 자리가 0인 회차는 정원 마감을 보여 준다', () => {
    mockWithSession(0, 'CLOSED');

    renderAt('/courses/7');

    expect(screen.getByText('0 (정원 마감)')).toBeInTheDocument();
    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
  });

  it('남은 자리가 정원의 20% 이하이면 마감 임박을 보여 준다', () => {
    mockWithSession(4, 'RECRUITING');

    renderAt('/courses/7');

    expect(screen.getByText('마감 임박')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('남은 자리 4 / 20');
  });

  it('로딩 중에는 "불러오는 중" 상태 영역을 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({ data: null, loading: true, notFound: false, error: null });

    renderAt('/courses/7');

    expect(screen.getByRole('status', { name: '불러오는 중' })).toHaveAttribute('aria-busy', 'true');
  });

  it('없는 과정이면 안내 메시지를 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({ data: null, loading: false, notFound: true, error: null });

    renderAt('/courses/999');

    // 없음은 Alert가 아니라 EmptyState로 바뀌어 문구와 "목록으로" 링크로 확인한다
    expect(screen.getByText('과정을 찾을 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute('href', '/');
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
