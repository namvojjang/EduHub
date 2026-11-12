import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseAdminApi } from '../api/courseApi';
import { useAdminCourses } from './useAdminCourses';

vi.mock('../api/courseApi', () => ({
  courseAdminApi: { listAdminCourses: vi.fn() },
}));

const listMock = vi.mocked(courseAdminApi.listAdminCourses);
type ListResult = Awaited<ReturnType<typeof courseAdminApi.listAdminCourses>>;

describe('useAdminCourses', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('종료된 과정을 포함한 목록을 불러온다', async () => {
    const page = {
      content: [{ id: 1, title: 'Java 기초', category: '개발', status: 'CLOSED' }],
      page: 0,
      size: 20,
      totalElements: 1,
    };
    listMock.mockResolvedValue({ data: page } as unknown as ListResult);

    const { result } = renderHook(() => useAdminCourses({ keyword: 'java', page: 0, size: 20 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(page);
    expect(listMock).toHaveBeenCalledWith('java', undefined, 0, 20);
  });

  it('reloadKey가 바뀌면 다시 불러온다', async () => {
    listMock.mockResolvedValue({
      data: { content: [], page: 0, size: 20, totalElements: 0 },
    } as unknown as ListResult);

    const { result, rerender } = renderHook(
      ({ reloadKey }) => useAdminCourses({ keyword: '', page: 0, size: 20, reloadKey }),
      { initialProps: { reloadKey: 0 } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ reloadKey: 1 });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it('실패하면 error를 채운다', async () => {
    listMock.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useAdminCourses({ keyword: '', page: 0, size: 20 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Network Error');
  });
});
