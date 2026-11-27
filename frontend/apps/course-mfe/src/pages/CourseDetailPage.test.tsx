import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { renderWithProviders } from '../test/render';
import { CourseDetailPage, type SessionActionContext } from './CourseDetailPage';

vi.mock('../hooks/useCourseDetail', () => ({
  useCourseDetail: vi.fn(),
}));

const useCourseDetailMock = vi.mocked(useCourseDetail);

type RenderAction = (
  session: { id?: number; status?: string },
  ctx: SessionActionContext,
) => ReactNode;

function renderAt(path: string, renderSessionAction?: RenderAction) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/courses/:id"
          element={<CourseDetailPage renderSessionAction={renderSessionAction} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

// 슬롯에 넘기는 가짜 신청 버튼: 받은 ctx를 화면에 드러내고, 누르면 onChanged를 부른다.
const fakeAction: RenderAction = (session, ctx) => (
  <button type="button" data-testid={`action-${session.id}`} onClick={ctx.onChanged}>
    {`슬롯 ${session.id}: ${ctx.disabledReason ?? '신청 가능'}`}
  </button>
);

// 회차 하나를 가진 과정 데이터를 mock에 넣는다.
function mockWithSession(remainingSeats: number, status: 'RECRUITING' | 'CLOSED') {
  useCourseDetailMock.mockReturnValue({
    data: {
      id: 7,
      title: 'Java 기초',
      category: '개발',
      status: 'OPEN',
      sessions: [
        {
          id: 70,
          startAt: '2026-12-01T09:00:00',
          place: '본사 3층',
          capacity: 20,
          remainingSeats,
          status,
        },
      ],
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

    expect(useCourseDetailMock).toHaveBeenCalledWith(7, 0);
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
    // 슬롯을 넘기지 않으면 카드 동작 자리에는 아무것도 그리지 않는다
    expect(within(items[0]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('슬롯에 회차와 ctx(disabledReason)를 넘겨 회차마다 그린다', () => {
    useCourseDetailMock.mockReturnValue({
      data: {
        id: 7,
        title: 'Java 기초',
        category: '개발',
        status: 'OPEN',
        sessions: [
          {
            id: 70,
            startAt: '2026-12-01T09:00:00',
            place: 'A',
            capacity: 20,
            remainingSeats: 5,
            status: 'RECRUITING',
          },
          {
            id: 71,
            startAt: '2026-12-02T09:00:00',
            place: 'B',
            capacity: 20,
            remainingSeats: 0,
            status: 'CLOSED',
          },
          {
            id: 72,
            startAt: '2026-11-01T09:00:00',
            place: 'C',
            capacity: 20,
            remainingSeats: 0,
            status: 'COMPLETED',
          },
        ],
      },
      loading: false,
      notFound: false,
      error: null,
    });

    renderAt('/courses/7', fakeAction);

    const [open, closed, done] = within(
      screen.getByRole('list', { name: '회차 목록' }),
    ).getAllByRole('listitem');
    expect(within(open).getByTestId('action-70')).toHaveTextContent('슬롯 70: 신청 가능');
    expect(within(closed).getByTestId('action-71')).toHaveTextContent(
      '슬롯 71: 모집이 마감된 회차입니다',
    );
    expect(within(done).getByTestId('action-72')).toHaveTextContent(
      '슬롯 72: 교육이 끝난 회차입니다',
    );
  });

  it('종료된 과정은 모집 중 회차여도 disabledReason에 "종료된 과정입니다"를 넘긴다', () => {
    useCourseDetailMock.mockReturnValue({
      data: {
        id: 7,
        title: 'Java 기초',
        category: '개발',
        status: 'CLOSED',
        sessions: [
          {
            id: 70,
            startAt: '2026-12-01T09:00:00',
            place: 'A',
            capacity: 20,
            remainingSeats: 5,
            status: 'RECRUITING',
          },
        ],
      },
      loading: false,
      notFound: false,
      error: null,
    });

    renderAt('/courses/7', fakeAction);

    expect(screen.getByTestId('action-70')).toHaveTextContent('슬롯 70: 종료된 과정입니다');
  });

  it('슬롯이 onChanged를 부르면 reloadKey를 올려 다시 불러온다', async () => {
    mockWithSession(5, 'RECRUITING');

    renderAt('/courses/7', fakeAction);
    expect(useCourseDetailMock).toHaveBeenLastCalledWith(7, 0);
    fireEvent.click(screen.getByTestId('action-70'));

    await waitFor(() => expect(useCourseDetailMock).toHaveBeenLastCalledWith(7, 1));
    // 다시 불러오는 동안에도 카드는 그대로 남는다
    expect(screen.getByTestId('action-70')).toBeInTheDocument();
  });

  it('슬롯이 null을 돌려주면 그 회차에는 동작 자리에 아무것도 그리지 않는다', () => {
    mockWithSession(5, 'RECRUITING');

    renderAt('/courses/7', () => null);

    expect(within(screen.getByRole('listitem')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('다시 불러오는 중이어도 data가 있으면 Skeleton 대신 내용을 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({
      data: { id: 7, title: 'Java 기초', category: '개발', status: 'OPEN', sessions: [] },
      loading: true,
      notFound: false,
      error: null,
    });

    renderAt('/courses/7');

    expect(screen.queryByRole('status', { name: '불러오는 중' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Java 기초' })).toBeInTheDocument();
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
    useCourseDetailMock.mockReturnValue({
      data: null,
      loading: true,
      notFound: false,
      error: null,
    });

    renderAt('/courses/7');

    expect(screen.getByRole('status', { name: '불러오는 중' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('없는 과정이면 안내 메시지를 보여 준다', () => {
    useCourseDetailMock.mockReturnValue({
      data: null,
      loading: false,
      notFound: true,
      error: null,
    });

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

    expect(screen.getByRole('alert')).toHaveTextContent(
      '과정 정보를 불러오지 못했습니다. (Network Error)',
    );
  });
});
