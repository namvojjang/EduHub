import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminCourses } from '../hooks/useAdminCourses';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';
import { renderWithProviders } from '../test/render';
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

// jsdom에는 레이아웃이 없어 Mantine 메뉴가 숨김 상태로 잡히므로, 메뉴 항목은 모두 hidden 옵션으로 찾는다.
async function openMenuItem(title: string, name: string) {
  fireEvent.click(screen.getByRole('button', { name: `${title} 작업` }));
  return screen.findByRole('menuitem', { name, hidden: true });
}

function renderPage() {
  return renderWithProviders(
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

  it('종료된 과정도 상태와 함께 보여 주고, 운영 중인 과정만 종료할 수 있다', async () => {
    renderPage();

    const rows = within(screen.getByRole('table', { name: '관리자 과정 목록' })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Java 기초');
    expect(rows[1]).toHaveTextContent('운영 중');
    expect(rows[2]).toHaveTextContent('종료');
    expect(screen.getByText('전체 2개')).toBeInTheDocument();

    expect(await openMenuItem('Java 기초', '종료')).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: '관리', hidden: true })).toBeInTheDocument();
  });

  it('다른 작업이 진행 중이면 종료 메뉴 항목이 비활성화된다', async () => {
    vi.mocked(useCourseAdminActions).mockReturnValue({ ...actions, pending: true });
    renderPage();

    expect(await openMenuItem('Java 기초', '종료')).toBeDisabled();
  });

  it('종료된 과정의 메뉴에는 종료 항목이 없다', async () => {
    renderPage();

    expect(await openMenuItem('옛 과정', '관리')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '종료', hidden: true })).not.toBeInTheDocument();
  });

  it('과정 등록 대화상자에서 저장하면 createCourse를 부른다', async () => {
    actions.createCourse.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '과정 등록' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/과정명/), { target: { value: 'React 입문' } });
    const category = within(dialog).getByRole('textbox', { name: /분류/ });
    fireEvent.click(category);
    // jsdom에는 레이아웃이 없어 Mantine이 드롭다운을 display:none(referenceHidden)으로 두므로 hidden 옵션을 쓴다.
    fireEvent.click(await screen.findByRole('option', { name: '개발', hidden: true }));
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(actions.createCourse).toHaveBeenCalledWith({
        title: 'React 입문',
        category: '개발',
        description: undefined,
      }),
    );
  });

  it('확인 창에서 취소하면 closeCourse를 부르지 않는다', async () => {
    renderPage();

    fireEvent.click(await openMenuItem('Java 기초', '종료'));
    fireEvent.click(await screen.findByRole('button', { name: '취소' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument());
    expect(actions.closeCourse).not.toHaveBeenCalled();
  });

  it('검색어가 없고 과정이 없으면 등록 안내를 보여 준다', () => {
    vi.mocked(useAdminCourses).mockReturnValue({
      data: { content: [], page: 0, size: 20, totalElements: 0 },
      loading: false,
      error: null,
    });
    renderPage();

    expect(screen.getByText('등록된 과정이 없습니다.')).toBeInTheDocument();
  });

  it('검색어가 있는데 결과가 없으면 조건 안내를 보여 준다', () => {
    vi.mocked(useAdminCourses).mockReturnValue({
      data: { content: [], page: 0, size: 20, totalElements: 0 },
      loading: false,
      error: null,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('과정명 검색'), { target: { value: '없는과정' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    expect(screen.getByText('조건에 맞는 과정이 없습니다.')).toBeInTheDocument();
  });

  it('종료에 성공하면 토스트를 보여 준다', async () => {
    actions.closeCourse.mockResolvedValue({});
    renderPage();

    fireEvent.click(await openMenuItem('Java 기초', '종료'));
    fireEvent.click(await screen.findByRole('button', { name: '종료' }));

    expect(await screen.findByText('과정을 종료했습니다.')).toBeInTheDocument();
  });

  it('종료를 확인하면 closeCourse를 부르고, 실패하면 메시지를 보여 준다', async () => {
    actions.closeCourse.mockRejectedValue(new Error('이미 종료된 과정입니다.'));
    renderPage();

    fireEvent.click(await openMenuItem('Java 기초', '종료'));
    // 확인 창의 빨간 "종료" 버튼을 눌러야 호출된다.
    fireEvent.click(await screen.findByRole('button', { name: '종료' }));

    await waitFor(() => expect(actions.closeCourse).toHaveBeenCalledWith(1));
    expect(await screen.findByText('이미 종료된 과정입니다.')).toBeInTheDocument();
  });
});
