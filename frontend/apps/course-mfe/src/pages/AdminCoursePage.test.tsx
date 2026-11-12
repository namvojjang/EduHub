import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { AdminCoursePage } from './AdminCoursePage';

vi.mock('../hooks/useCourseDetail', () => ({ useCourseDetail: vi.fn() }));
vi.mock('../hooks/useCourseAdminActions', () => ({ useCourseAdminActions: vi.fn() }));

const actions = {
  pending: false,
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  closeCourse: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  closeSession: vi.fn(),
};

function detail(status: 'OPEN' | 'CLOSED') {
  return {
    data: {
      id: 7,
      title: 'Java 기초',
      category: '개발',
      description: '입문 과정',
      status,
      sessions: [
        {
          id: 70,
          startAt: '2030-01-06T09:00:00',
          place: '본사 3층',
          capacity: 20,
          remainingSeats: 20,
          status: 'RECRUITING' as const,
        },
        {
          id: 71,
          startAt: '2030-02-03T09:00:00',
          place: '별관',
          capacity: 10,
          remainingSeats: 10,
          status: 'CLOSED' as const,
        },
      ],
    },
    loading: false,
    notFound: false,
    error: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/courses/7']}>
      <Routes>
        <Route path="/admin/courses/:id" element={<AdminCoursePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminCoursePage', () => {
  beforeEach(() => {
    vi.mocked(useCourseAdminActions).mockReturnValue(actions);
    Object.values(actions).forEach((fn) => typeof fn === 'function' && fn.mockReset());
    vi.mocked(useCourseDetail).mockReturnValue(detail('OPEN'));
  });

  it('회차를 보여 주고, 모집 중인 회차만 수정·마감할 수 있다', () => {
    renderPage();

    expect(useCourseDetail).toHaveBeenCalledWith(7, 0);
    const rows = within(screen.getByRole('table', { name: '회차 관리 목록' })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('2030-01-06 09:00');
    expect(within(rows[1]).getByRole('button', { name: '모집 마감' })).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('모집 마감');
    expect(within(rows[2]).queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  });

  it('회차 추가 대화상자에서 저장하면 createSession을 부른다', async () => {
    actions.createSession.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/시작 일시/), { target: { value: '2030-03-02T13:30' } });
    fireEvent.change(within(dialog).getByLabelText(/장소/), { target: { value: '본사 5층' } });
    fireEvent.change(within(dialog).getByLabelText(/정원/), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(actions.createSession).toHaveBeenCalledWith(7, {
        startAt: '2030-03-02T13:30:00',
        place: '본사 5층',
        capacity: 15,
      }),
    );
  });

  it('저장이 실패하면 대화상자에 백엔드 메시지를 보여 준다', async () => {
    actions.createSession.mockRejectedValue(new Error('종료된 과정에는 회차를 추가할 수 없습니다.'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/시작 일시/), { target: { value: '2030-03-02T13:30' } });
    fireEvent.change(within(dialog).getByLabelText(/장소/), { target: { value: '본사' } });
    fireEvent.change(within(dialog).getByLabelText(/정원/), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await within(dialog).findByText('종료된 과정에는 회차를 추가할 수 없습니다.')).toBeInTheDocument();
  });

  it('모집 마감을 확인하면 closeSession을 부른다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    actions.closeSession.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '모집 마감' }));

    await waitFor(() => expect(actions.closeSession).toHaveBeenCalledWith(70));
  });

  it('종료된 과정에서는 회차 추가 버튼이 비활성화된다', () => {
    vi.mocked(useCourseDetail).mockReturnValue(detail('CLOSED'));

    renderPage();

    expect(screen.getByRole('button', { name: '회차 추가' })).toBeDisabled();
  });
});
