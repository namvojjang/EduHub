import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { courseAdminApi } from '../api/courseApi';
import { useCourseAdminActions } from './useCourseAdminActions';

vi.mock('../api/courseApi', () => ({
  courseAdminApi: {
    createCourse: vi.fn(),
    createSession: vi.fn(),
    closeSession: vi.fn(),
  },
}));

describe('useCourseAdminActions', () => {
  beforeEach(() => {
    vi.mocked(courseAdminApi.createCourse).mockReset();
    vi.mocked(courseAdminApi.createSession).mockReset();
    vi.mocked(courseAdminApi.closeSession).mockReset();
  });

  it('과정을 등록하고 응답 본문을 돌려준다', async () => {
    const created = { id: 1, title: 'Java 기초', category: '개발', status: 'OPEN', sessions: [] };
    vi.mocked(courseAdminApi.createCourse).mockResolvedValue({ data: created } as never);
    const { result } = renderHook(() => useCourseAdminActions());

    let response: unknown;
    await act(async () => {
      response = await result.current.createCourse({ title: 'Java 기초', category: '개발' });
    });

    expect(response).toEqual(created);
    expect(courseAdminApi.createCourse).toHaveBeenCalledWith({ title: 'Java 기초', category: '개발' });
    expect(result.current.pending).toBe(false);
  });

  it('회차 등록은 과정 id와 본문을 넘긴다', async () => {
    vi.mocked(courseAdminApi.createSession).mockResolvedValue({ data: { id: 10 } } as never);
    const { result } = renderHook(() => useCourseAdminActions());
    const body = { startAt: '2030-01-06T09:00:00', place: '본사', capacity: 20 };

    await act(async () => {
      await result.current.createSession(7, body);
    });

    expect(courseAdminApi.createSession).toHaveBeenCalledWith(7, body);
  });

  it('실패하면 예외를 그대로 던지고 pending을 끈다', async () => {
    vi.mocked(courseAdminApi.closeSession).mockRejectedValue(new Error('conflict'));
    const { result } = renderHook(() => useCourseAdminActions());

    await act(async () => {
      await expect(result.current.closeSession(10)).rejects.toThrow('conflict');
    });

    expect(result.current.pending).toBe(false);
  });
});
