import { fireEvent, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourses } from '../hooks/useCourses';
import { renderWithProviders } from '../test/render';
import { CourseListPage } from './CourseListPage';

vi.mock('../hooks/useCourses', () => ({
  useCourses: vi.fn(),
}));

const useCoursesMock = vi.mocked(useCourses);

function renderPage(initialEntry = '/') {
  // 헤더 검색 대신, 검색어를 바꾸는 링크를 둔다.
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Link to="/?keyword=a">검색 a</Link>
      <Link to="/?keyword=b">검색 b</Link>
      <Routes>
        <Route path="/" element={<CourseListPage />} />
        <Route path="/courses/:id" element={<div>상세 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const twoCourses = {
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
};

describe('CourseListPage', () => {
  beforeEach(() => {
    useCoursesMock.mockReset();
  });

  it('과정 목록을 카드로 보여 준다', () => {
    useCoursesMock.mockReturnValue(twoCourses);

    renderPage();

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

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('과정 목록을 불러오지 못했습니다. (Network Error)');
  });

  it('카드의 자세히 보기를 누르면 과정 상세로 이동한다', () => {
    useCoursesMock.mockReturnValue(twoCourses);

    renderPage();
    fireEvent.click(screen.getByRole('link', { name: 'Java 기초 자세히 보기' }));

    expect(screen.getByText('상세 화면')).toBeInTheDocument();
  });

  it('표로 바꾸면 과정 목록 표를 보여 주고 행을 누르면 상세로 이동한다', () => {
    useCoursesMock.mockReturnValue(twoCourses);

    renderPage();
    expect(screen.queryByRole('table', { name: '과정 목록' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('표'));

    expect(screen.getByRole('table', { name: '과정 목록' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Java 기초'));

    expect(screen.getByText('상세 화면')).toBeInTheDocument();
  });

  it('화면의 2페이지를 누르면 훅에는 page 1(0부터)로 요청한다', () => {
    useCoursesMock.mockReturnValue({
      ...twoCourses,
      data: { ...twoCourses.data, totalElements: 45 },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 1, size: 20 });
  });

  it('URL의 keyword로 조회하고 검색 지우기로 되돌린다', () => {
    useCoursesMock.mockReturnValue(twoCourses);

    renderPage('/?keyword=java');

    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: 'java', category: '', page: 0, size: 20 });
    expect(screen.getByText('‘java’ 검색 결과')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '검색 지우기' }));

    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 0, size: 20 });
    expect(screen.queryByText('‘java’ 검색 결과')).not.toBeInTheDocument();
  });

  it('분류 칩을 누르면 category로 page 0부터 조회한다', () => {
    useCoursesMock.mockReturnValue({
      ...twoCourses,
      data: { ...twoCourses.data, totalElements: 45 },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 1, size: 20 });

    fireEvent.click(screen.getByLabelText('데이터'));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '데이터', page: 0, size: 20 });

    // 전체를 고르면 훅에는 빈 문자열
    fireEvent.click(screen.getByLabelText('전체'));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 0, size: 20 });
  });

  it('결과가 없으면 빈 상태 문구와 조건 지우기를 보여 준다', () => {
    useCoursesMock.mockReturnValue({
      data: { content: [], page: 0, size: 20, totalElements: 0 },
      loading: false,
      error: null,
    });

    renderPage('/?keyword=zzz');

    expect(screen.getByText('조건에 맞는 과정이 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '조건 지우기' }));

    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 0, size: 20 });
  });

  it('조건이 없을 때 빈 결과면 조건 지우기 버튼은 없다', () => {
    useCoursesMock.mockReturnValue({
      data: { content: [], page: 0, size: 20, totalElements: 0 },
      loading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText('조건에 맞는 과정이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '조건 지우기' })).not.toBeInTheDocument();
  });

  it('검색어가 바뀌면 page 0으로 요청하고, 이전 검색어의 페이지가 되살아나지 않는다', () => {
    useCoursesMock.mockReturnValue({
      ...twoCourses,
      data: { ...twoCourses.data, totalElements: 100 },
    });

    renderPage('/?keyword=a');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: 'a', category: '', page: 2, size: 20 });

    fireEvent.click(screen.getByText('검색 b'));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: 'b', category: '', page: 0, size: 20 });

    fireEvent.click(screen.getByText('검색 a'));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: 'a', category: '', page: 0, size: 20 });
  });

  it('불러오는 중에는 aria-busy와 Skeleton 6개를 보여 준다', () => {
    useCoursesMock.mockReturnValue({ data: null, loading: true, error: null });

    const { container } = renderPage();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(6);
  });

  it('오류일 때는 아래 페이지 영역을 숨긴다', () => {
    useCoursesMock.mockReturnValue({ data: null, loading: false, error: new Error('Network Error') });

    renderPage();

    expect(screen.queryByText(/전체 0/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
  });

  it('페이지당 개수를 바꾸면 page 0으로 요청한다', () => {
    useCoursesMock.mockReturnValue({
      ...twoCourses,
      data: { ...twoCourses.data, totalElements: 100 },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 2, size: 20 });

    fireEvent.click(screen.getByRole('textbox', { name: '페이지당' }));
    fireEvent.click(screen.getByRole('option', { name: '10' }));

    expect(useCoursesMock).toHaveBeenLastCalledWith({ keyword: '', category: '', page: 0, size: 10 });
  });
});
