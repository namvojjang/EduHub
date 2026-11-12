import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseApi } from '../api/courseApi';
import { useCourses } from './useCourses';

vi.mock('../api/courseApi', () => ({
  courseApi: { list: vi.fn() },
}));

const listMock = vi.mocked(courseApi.list);

describe('useCourses', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('목록을 불러온다', async () => {
    const page = {
      content: [{ id: 1, title: 'Java 기초', category: '개발' }],
      page: 2,
      size: 10,
      totalElements: 21,
    };
    listMock.mockResolvedValue({ data: page } as unknown as Awaited<ReturnType<typeof courseApi.list>>);

    const { result } = renderHook(() =>
      useCourses({ keyword: 'java', category: '개발', page: 2, size: 10 }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(page);
    expect(result.current.error).toBeNull();
    // page는 0부터 받은 값을 그대로 넘긴다.
    expect(listMock).toHaveBeenCalledWith('java', '개발', 2, 10);
  });

  it('빈 검색어와 분류는 조건에서 뺀다', async () => {
    listMock.mockResolvedValue({
      data: { content: [], page: 0, size: 20, totalElements: 0 },
    } as unknown as Awaited<ReturnType<typeof courseApi.list>>);

    const { result } = renderHook(() => useCourses({ keyword: '', category: '', page: 0, size: 20 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listMock).toHaveBeenCalledWith(undefined, undefined, 0, 20);
  });

  it('실패하면 error를 채운다', async () => {
    listMock.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useCourses({ keyword: '', category: '', page: 0, size: 20 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Network Error');
    expect(result.current.data).toBeNull();
  });
});
