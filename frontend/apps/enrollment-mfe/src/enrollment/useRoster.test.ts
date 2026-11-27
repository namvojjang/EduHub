import type { RosterResponse } from '@eduhub/api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentAdminApi } from '../api/clients';
import { useRoster } from './useRoster';

vi.mock('../api/clients', () => ({
  enrollmentAdminApi: { getRoster: vi.fn() },
}));

const getRosterMock = vi.mocked(enrollmentAdminApi.getRoster);
type RosterResult = Awaited<ReturnType<typeof enrollmentAdminApi.getRoster>>;

function result(body: RosterResponse) {
  return { data: body } as unknown as RosterResult;
}

beforeEach(() => {
  getRosterMock.mockReset();
});

describe('useRoster', () => {
  it('명단을 불러온다', async () => {
    getRosterMock.mockResolvedValue(result({ sessionId: 4 }));
    const { result: r } = renderHook(() => useRoster(4));
    expect(r.current.loading).toBe(true);
    await waitFor(() => expect(r.current.loading).toBe(false));
    expect(r.current.data).toEqual({ sessionId: 4 });
    expect(getRosterMock).toHaveBeenCalledWith(4);
  });

  it('R10 sessionId를 빨리 바꾸면 늦은 응답을 버린다', async () => {
    let resolveOld: (v: RosterResult) => void = () => {};
    getRosterMock.mockImplementationOnce(
      () => new Promise<RosterResult>((res) => (resolveOld = res)),
    );
    getRosterMock.mockResolvedValueOnce(result({ sessionId: 5 }));

    const { result: r, rerender } = renderHook(({ id }) => useRoster(id), {
      initialProps: { id: 4 },
    });
    rerender({ id: 5 });
    await waitFor(() => expect(r.current.data).toEqual({ sessionId: 5 }));

    await act(async () => resolveOld(result({ sessionId: 4 })));
    expect(r.current.data).toEqual({ sessionId: 5 });
  });

  it('sessionId가 바뀌면 이전 data를 비운다', async () => {
    getRosterMock.mockResolvedValueOnce(result({ sessionId: 4 }));
    // 렌더마다 (요청한 id, 돌려받은 data)를 기록해 id가 바뀐 첫 렌더도 검사한다.
    const renders: { id: number; data: RosterResponse | null }[] = [];
    const { result: r, rerender } = renderHook(
      ({ id }) => {
        const state = useRoster(id);
        renders.push({ id, data: state.data });
        return state;
      },
      { initialProps: { id: 4 } },
    );
    await waitFor(() => expect(r.current.loading).toBe(false));
    getRosterMock.mockReturnValueOnce(new Promise(() => {}));
    rerender({ id: 5 });
    // effect 결과를 기다리기 전, 새 요청이 pending인 상태
    expect(r.current.loading).toBe(true);
    expect(r.current.data).toBeNull();
    // id 5로 그려진 렌더 어디에도 회차 4의 data가 없다
    expect(renders.filter((x) => x.id === 5 && x.data !== null)).toEqual([]);
  });

  it('reloadKey가 바뀐 첫 렌더에 이미 loading이고 직전 data는 유지한다', async () => {
    getRosterMock.mockResolvedValueOnce(result({ sessionId: 4 }));
    const renders: { k: number; loading: boolean; data: RosterResponse | null }[] = [];
    const { result: r, rerender } = renderHook(
      ({ k }) => {
        const state = useRoster(4, k);
        renders.push({ k, loading: state.loading, data: state.data });
        return state;
      },
      { initialProps: { k: 0 } },
    );
    await waitFor(() => expect(r.current.loading).toBe(false));
    getRosterMock.mockReturnValueOnce(new Promise(() => {}));
    rerender({ k: 1 });
    const first = renders.find((x) => x.k === 1);
    expect(first).toEqual({ k: 1, loading: true, data: { sessionId: 4 } });
  });

  it('같은 sessionId의 재조회가 실패해도 직전 data는 유지하고 error를 담는다', async () => {
    getRosterMock.mockResolvedValueOnce(result({ sessionId: 4 }));
    const { result: r, rerender } = renderHook(({ k }) => useRoster(4, k), {
      initialProps: { k: 0 },
    });
    await waitFor(() => expect(r.current.loading).toBe(false));
    getRosterMock.mockRejectedValueOnce(new Error('boom'));
    rerender({ k: 1 });
    await waitFor(() => expect(r.current.error).toEqual(new Error('boom')));
    expect(r.current.loading).toBe(false);
    expect(r.current.data).toEqual({ sessionId: 4 });
  });

  it('양의 정수가 아닌 sessionId는 요청하지 않는다', () => {
    renderHook(() => useRoster(Number.NaN));
    renderHook(() => useRoster(0));
    expect(getRosterMock).not.toHaveBeenCalled();
  });

  it('같은 sessionId에서 reloadKey만 바뀌면 이전 data를 유지한다', async () => {
    getRosterMock.mockResolvedValueOnce(result({ sessionId: 4 }));
    const { result: r, rerender } = renderHook(({ k }) => useRoster(4, k), {
      initialProps: { k: 0 },
    });
    await waitFor(() => expect(r.current.loading).toBe(false));
    getRosterMock.mockReturnValueOnce(new Promise(() => {}));
    rerender({ k: 1 });
    expect(r.current.loading).toBe(true);
    expect(r.current.data).toEqual({ sessionId: 4 });
  });

  it('실패하면 error를 그대로 담는다', async () => {
    getRosterMock.mockRejectedValue(new Error('boom'));
    const { result: r } = renderHook(() => useRoster(4));
    await waitFor(() => expect(r.current.loading).toBe(false));
    expect(r.current.error).toEqual(new Error('boom'));
    expect(r.current.data).toBeNull();
  });
});
