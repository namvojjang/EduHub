import { act, renderHook, waitFor } from '@testing-library/react';
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

  it('같은 id에서 reloadKey만 바뀌면 이전 data를 유지하고 loading만 켠다', async () => {
    const first = { id: 1, title: 'Java 기초', category: '개발', status: 'OPEN', sessions: [] };
    const second = { ...first, title: '새 제목' };
    detailMock.mockResolvedValueOnce({ data: first } as unknown as DetailResult);
    let resolveSecond: (value: DetailResult) => void = () => {};
    detailMock.mockReturnValueOnce(
      new Promise<DetailResult>((resolve) => (resolveSecond = resolve)) as ReturnType<
        typeof courseApi.detail
      >,
    );

    const { result, rerender } = renderHook(({ key }) => useCourseDetail(1, key), {
      initialProps: { key: 0 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ key: 1 });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toEqual(first);

    resolveSecond({ data: second } as unknown as DetailResult);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(second);
    expect(detailMock).toHaveBeenCalledTimes(2);
  });

  it('id가 바뀌면 이전 과정의 data를 비운다', async () => {
    const first = { id: 1, title: 'Java 기초', category: '개발', status: 'OPEN', sessions: [] };
    detailMock.mockResolvedValueOnce({ data: first } as unknown as DetailResult);
    detailMock.mockReturnValueOnce(new Promise(() => {}) as ReturnType<typeof courseApi.detail>);

    const { result, rerender } = renderHook(({ id }) => useCourseDetail(id), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(result.current.data).toEqual(first));

    rerender({ id: 2 });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('재조회 중 옛 요청의 늦은 응답은 무시한다', async () => {
    const first = { id: 1, title: '첫째', category: '개발', status: 'OPEN', sessions: [] };
    const latest = { ...first, title: '최신' };
    let resolveOld: (value: DetailResult) => void = () => {};
    detailMock.mockReturnValueOnce(
      new Promise<DetailResult>((resolve) => (resolveOld = resolve)) as ReturnType<
        typeof courseApi.detail
      >,
    );
    detailMock.mockResolvedValueOnce({ data: latest } as unknown as DetailResult);

    const { result, rerender } = renderHook(({ key }) => useCourseDetail(1, key), {
      initialProps: { key: 0 },
    });
    rerender({ key: 1 });
    await waitFor(() => expect(result.current.data).toEqual(latest));

    await act(async () => {
      resolveOld({ data: first } as unknown as DetailResult);
    });
    expect(result.current.data).toEqual(latest);
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
