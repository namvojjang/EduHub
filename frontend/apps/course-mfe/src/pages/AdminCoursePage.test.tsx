import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';
import { useCourseDetail } from '../hooks/useCourseDetail';
import { renderWithProviders } from '../test/render';
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

// jsdom에는 레이아웃이 없어 Mantine 메뉴가 숨김 상태로 잡히므로, 메뉴 항목은 모두 hidden 옵션으로 찾는다.
async function openMenuItem(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /회차 작업/ }));
  return screen.findByRole('menuitem', { name, hidden: true });
}

function renderPage() {
  return renderWithProviders(
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

  it('다시 불러오는 중이어도 data가 있으면 Skeleton 없이 내용만 보여 준다', () => {
    vi.mocked(useCourseDetail).mockReturnValue({ ...detail('OPEN'), loading: true });

    renderPage();

    expect(screen.queryByRole('status', { name: '불러오는 중' })).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: '회차 관리 목록' })).toBeInTheDocument();
  });

  it('회차를 보여 주고, 모집 중인 회차만 메뉴로 수정·마감할 수 있다', async () => {
    renderPage();

    expect(useCourseDetail).toHaveBeenCalledWith(7, 0);
    const rows = within(screen.getByRole('table', { name: '회차 관리 목록' })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('2030-01-06 09:00');
    expect(rows[2]).toHaveTextContent('모집 마감');
    expect(within(rows[1]).getByRole('button', { name: /회차 작업/ })).toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button', { name: /회차 작업/ })).not.toBeInTheDocument();

    expect(await openMenuItem('수정')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '모집 마감', hidden: true })).toBeInTheDocument();
  });

  it('회차 추가 대화상자에서 저장하면 createSession을 부른다', async () => {
    actions.createSession.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/시작 일시/), {
      target: { value: '2030-03-02T13:30' },
    });
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
    actions.createSession.mockRejectedValue(
      new Error('종료된 과정에는 회차를 추가할 수 없습니다.'),
    );
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '회차 추가' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/시작 일시/), {
      target: { value: '2030-03-02T13:30' },
    });
    fireEvent.change(within(dialog).getByLabelText(/장소/), { target: { value: '본사' } });
    fireEvent.change(within(dialog).getByLabelText(/정원/), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(
      await within(dialog).findByText('종료된 과정에는 회차를 추가할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('모집 마감을 확인하면 closeSession을 부른다', async () => {
    actions.closeSession.mockResolvedValue({});
    renderPage();

    fireEvent.click(await openMenuItem('모집 마감'));
    // 확인 창의 "모집 마감" 버튼을 눌러야 호출된다.
    fireEvent.click(await screen.findByRole('button', { name: '모집 마감' }));

    await waitFor(() => expect(actions.closeSession).toHaveBeenCalledWith(70));
    expect(await screen.findByText('회차 모집을 마감했습니다.')).toBeInTheDocument();
  });

  it('확인 창에서 취소하면 closeSession을 부르지 않는다', async () => {
    renderPage();

    fireEvent.click(await openMenuItem('모집 마감'));
    fireEvent.click(await screen.findByRole('button', { name: '취소' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument(),
    );
    expect(actions.closeSession).not.toHaveBeenCalled();
  });

  it('모집 마감이 실패하면 메시지를 보여 준다', async () => {
    actions.closeSession.mockRejectedValue(new Error('이미 마감된 회차입니다.'));
    renderPage();

    fireEvent.click(await openMenuItem('모집 마감'));
    fireEvent.click(await screen.findByRole('button', { name: '모집 마감' }));

    expect(await screen.findByText('이미 마감된 회차입니다.')).toBeInTheDocument();
  });

  it('종료된 과정에서는 회차 추가 버튼이 비활성화된다', () => {
    vi.mocked(useCourseDetail).mockReturnValue(detail('CLOSED'));

    renderPage();

    expect(screen.getByRole('button', { name: '회차 추가' })).toBeDisabled();
  });
});
