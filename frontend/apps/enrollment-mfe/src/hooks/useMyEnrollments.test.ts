import type { MyEnrollmentResponse } from '@eduhub/api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentApi } from '@eduhub/http';
import { useMyEnrollments } from './useMyEnrollments';
import type { MyEnrollmentStatus } from './useMyEnrollments';

vi.mock('@eduhub/http', () => ({
  enrollmentApi: { listMyEnrollments: vi.fn() },
}));

const listMock = vi.mocked(enrollmentApi.listMyEnrollments);
type ListResult = Awaited<ReturnType<typeof enrollmentApi.listMyEnrollments>>;

function result(rows: MyEnrollmentResponse[]) {
  return { data: rows } as unknown as ListResult;
}

beforeEach(() => {
  listMock.mockReset();
});

describe('useMyEnrollments', () => {
  it('내 신청 내역을 불러온다', async () => {
    const rows = [{ enrollmentId: 1, courseTitle: 'Java' }];
    listMock.mockResolvedValue(result(rows));
    const { result: r } = renderHook(() => useMyEnrollments());
    expect(r.current.loading).toBe(true);
    await waitFor(() => expect(r.current.loading).toBe(false));
    expect(r.current.data).toEqual(rows);
    expect(listMock).toHaveBeenCalledWith(undefined);
  });

  it('U1 필터를 빨리 바꾸면 늦은 응답을 버린다', async () => {
    let resolveOld: (v: ListResult) => void = () => {};
    listMock.mockImplementationOnce(() => new Promise<ListResult>((res) => (resolveOld = res)));
    listMock.mockResolvedValueOnce(result([{ enrollmentId: 2 }]));

    const { result: r, rerender } = renderHook(
      ({ s }: { s?: MyEnrollmentStatus }) => useMyEnrollments(s),
      { initialProps: { s: undefined } as { s?: MyEnrollmentStatus } },
    );
    rerender({ s: 'WAITING' });
    await waitFor(() => expect(r.current.data).toEqual([{ enrollmentId: 2 }]));

    await act(async () => resolveOld(result([{ enrollmentId: 1 }])));
    expect(r.current.data).toEqual([{ enrollmentId: 2 }]);
  });

  it('같은 status에서 reloadKey만 바뀌면 이전 data를 유지한다', async () => {
    listMock.mockResolvedValueOnce(result([{ enrollmentId: 1 }]));
    const { result: r, rerender } = renderHook(({ k }) => useMyEnrollments(undefined, k), {
      initialProps: { k: 0 },
    });
    await waitFor(() => expect(r.current.loading).toBe(false));
    listMock.mockReturnValueOnce(new Promise(() => {}));
    rerender({ k: 1 });
    expect(r.current.loading).toBe(true);
    expect(r.current.data).toEqual([{ enrollmentId: 1 }]);
  });

  it('실패하면 error를 담는다', async () => {
    listMock.mockRejectedValue(new Error('boom'));
    const { result: r } = renderHook(() => useMyEnrollments());
    await waitFor(() => expect(r.current.loading).toBe(false));
    expect(r.current.error).toEqual(new Error('boom'));
  });
});
