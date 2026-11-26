import type { CompletionResponse, SessionResponse } from '@eduhub/api-client';
import { useCallback, useState } from 'react';
import { enrollmentAdminApi } from '../api/clients';

/**
 * 관리자의 교육 완료·수료 기록 요청 (FR-08, D-05).
 *
 * 실패하면 예외를 그대로 던진다. 화면이 rosterErrorMessage로 문구를 고른다.
 * 중복 실행 방지는 화면(모달 1회 플래그 + 요청 중 ref)이 맡는다. pending은 버튼 비활성용이다.
 */
export function useRosterActions() {
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T>(request: () => Promise<{ data: T }>): Promise<T> => {
    setPending(true);
    try {
      return (await request()).data;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    pending,
    completeSession: (sessionId: number): Promise<SessionResponse> =>
      run(() => enrollmentAdminApi.completeSession(sessionId)),
    recordCompletions: (
      sessionId: number,
      result: 'COMPLETED' | 'NOT_COMPLETED',
      employeeIds: number[],
    ): Promise<CompletionResponse> =>
      run(() => enrollmentAdminApi.recordCompletions(sessionId, { result, employeeIds })),
  };
}
