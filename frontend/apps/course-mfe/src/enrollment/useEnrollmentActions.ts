import type { EnrollmentResponse } from '@eduhub/api-client';
import { useCallback, useState } from 'react';
import { enrollmentApi } from '../api/clients';

/**
 * 수강생의 신청·취소 요청 (FR-04, FR-06).
 *
 * 실패하면 예외를 그대로 던진다. 화면이 enrollmentErrorMessage로 문구를 고른다.
 */
export function useEnrollmentActions() {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (request: () => Promise<{ data: EnrollmentResponse }>): Promise<EnrollmentResponse> => {
      setPending(true);
      try {
        return (await request()).data;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return {
    pending,
    apply: (sessionId: number) => run(() => enrollmentApi.applyEnrollment({ sessionId })),
    cancel: (enrollmentId: number) => run(() => enrollmentApi.cancelEnrollment(enrollmentId)),
  };
}
