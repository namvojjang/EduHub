import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseApi } from '../api/courseApi';
import { useCourseDetail } from './useCourseDetail';

vi.mock('../api/courseApi', () => ({
  courseApi: { detail: vi.fn() },
}));

const detailMock = vi.mocked(courseApi.detail);

type DetailResult = Awaited<ReturnType<typeof courseApi.detail>>;

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  });
}

describe('useCourseDetail', () => {
  beforeEach(() => {
    detailMock.mockReset();
  });

  it('과정 상세를 불러온다', async () => {
    const course = { id: 1, title: 'Java 기초', category: '개발', status: 'OPEN', sessions: [] };
    detailMock.mockResolvedValue({ data: course } as unknown as DetailResult);

    const { result } = renderHook(() => useCourseDetail(1));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(course);
    expect(result.current.notFound).toBe(false);
    expect(detailMock).toHaveBeenCalledWith(1);
  });

  it('404면 notFound를 켠다', async () => {
    detailMock.mockRejectedValue(httpError(404));

    const { result } = renderHook(() => useCourseDetail(999));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('그 밖의 실패는 error를 채운다', async () => {
    detailMock.mockRejectedValue(httpError(500));

    const { result } = renderHook(() => useCourseDetail(1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('Request failed');
    expect(result.current.notFound).toBe(false);
  });
});
