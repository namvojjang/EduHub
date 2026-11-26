import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, enrollmentApi } from '../api/clients';
import { tokenStore } from '../api/http';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { renderWithAuth } from '../test/render';
import { CourseDetailPage } from './CourseDetailPage';

vi.mock('../hooks/useCourseDetail', () => ({
  useCourseDetail: vi.fn(),
}));
vi.mock('../api/clients', () => ({
  authApi: { login: vi.fn(), getMe: vi.fn() },
  enrollmentApi: { applyEnrollment: vi.fn(), cancelEnrollment: vi.fn() },
}));

const useCourseDetailMock = vi.mocked(useCourseDetail);

function renderAt(path: string) {
  return renderWithAuth(
    <Routes>
      <Route path="/courses/:id" element={<CourseDetailPage />} />
    </Routes>,
    { route: path },
  );
}

const employee = { employeeId: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' };

function login() {
  tokenStore.save('tok-1', employee);
}

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
    localStorage.clear();
    vi.mocked(authApi.getMe).mockReset();
    vi.mocked(authApi.getMe).mockResolvedValue({ data: employee } as never);
    useCourseDetailMock.mockReset();
    vi.mocked(enrollmentApi.applyEnrollment).mockReset();
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
    expect(screen.queryByText('수강 신청 화면 준비 중')).not.toBeInTheDocument();
  });

  it('D1 로그인하면 모집 중 회차에는 신청 버튼이, 모집 마감 회차에는 비활성 버튼이 보인다', () => {
    login();
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

    renderAt('/courses/7');

    const [open, closed, done] = within(
      screen.getByRole('list', { name: '회차 목록' }),
    ).getAllByRole('listitem');
    expect(within(open).getByRole('button', { name: '신청하기' })).toBeEnabled();
    // 이유 문구는 상태 Badge와 다르므로, 버튼의 aria-describedby가 가리키는 요소로 직접 확인한다.
    const describedText = (button: HTMLElement) =>
      document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent;
    const closedButton = within(closed).getByRole('button', { name: '신청하기' });
    expect(closedButton).toBeDisabled();
    expect(describedText(closedButton)).toBe('모집이 마감된 회차입니다');
    const doneButton = within(done).getByRole('button', { name: '신청하기' });
    expect(doneButton).toBeDisabled();
    expect(describedText(doneButton)).toBe('교육이 끝난 회차입니다');
  });

  it('비로그인이면 회차마다 "로그인 후 신청" 링크가 보인다', () => {
    mockWithSession(10, 'RECRUITING');

    renderAt('/courses/7');

    expect(screen.getByRole('link', { name: '로그인 후 신청' })).toHaveAttribute('href', '/login');
  });

  it('종료된 과정은 모집 중 회차여도 신청 버튼을 막고 "종료된 과정입니다"를 보인다', () => {
    login();
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

    renderAt('/courses/7');

    const button = screen.getByRole('button', { name: '신청하기' });
    expect(button).toBeDisabled();
    expect(
      document.getElementById(button.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent('종료된 과정입니다');
  });

  it('신청에 성공하면 reloadKey를 올려 다시 불러오고 결과 표시는 남는다', async () => {
    login();
    mockWithSession(5, 'RECRUITING');
    vi.mocked(enrollmentApi.applyEnrollment).mockResolvedValue({
      data: { id: 1, sessionId: 70, status: 'CONFIRMED' },
    } as never);

    renderAt('/courses/7');
    fireEvent.click(screen.getByRole('button', { name: '신청하기' }));

    expect(await screen.findByText('신청이 확정되었습니다.')).toBeInTheDocument();
    await waitFor(() => expect(useCourseDetailMock).toHaveBeenLastCalledWith(7, 1));
    expect(screen.getByText('신청이 확정되었습니다.')).toBeInTheDocument();
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
