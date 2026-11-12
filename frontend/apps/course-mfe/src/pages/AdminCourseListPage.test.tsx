import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminCourses } from '../hooks/useAdminCourses';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';
import { AdminCourseListPage } from './AdminCourseListPage';

vi.mock('../hooks/useAdminCourses', () => ({ useAdminCourses: vi.fn() }));
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

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminCourseListPage />
    </MemoryRouter>,
  );
}

describe('AdminCourseListPage', () => {
  beforeEach(() => {
    vi.mocked(useCourseAdminActions).mockReturnValue(actions);
    Object.values(actions).forEach((fn) => typeof fn === 'function' && fn.mockReset());
    vi.mocked(useAdminCourses).mockReturnValue({
      data: {
        content: [
          { id: 1, title: 'Java 기초', category: '개발', status: 'OPEN' },
          { id: 2, title: '옛 과정', category: '데이터', status: 'CLOSED' },
        ],
        page: 0,
        size: 20,
        totalElements: 2,
      },
      loading: false,
      error: null,
    });
  });

  it('종료된 과정도 상태와 함께 보여 주고, 운영 중인 과정만 종료 버튼이 있다', () => {
    renderPage();

    const rows = within(screen.getByRole('table', { name: '관리자 과정 목록' })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Java 기초');
    expect(rows[1]).toHaveTextContent('운영 중');
    expect(within(rows[1]).getByRole('button', { name: '종료' })).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('종료');
    expect(within(rows[2]).queryByRole('button', { name: '종료' })).not.toBeInTheDocument();
  });

  it('과정 등록 대화상자에서 저장하면 createCourse를 부른다', async () => {
    actions.createCourse.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '과정 등록' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/과정명/), { target: { value: 'React 입문' } });
    fireEvent.mouseDown(within(dialog).getByLabelText(/분류/));
    fireEvent.click(screen.getByRole('option', { name: '개발' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(actions.createCourse).toHaveBeenCalledWith({
        title: 'React 입문',
        category: '개발',
        description: undefined,
      }),
    );
  });

  it('종료를 확인하면 closeCourse를 부르고, 실패하면 메시지를 보여 준다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    actions.closeCourse.mockRejectedValue(new Error('이미 종료된 과정입니다.'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '종료' }));

    await waitFor(() => expect(actions.closeCourse).toHaveBeenCalledWith(1));
    expect(await screen.findByText('이미 종료된 과정입니다.')).toBeInTheDocument();
  });
});
