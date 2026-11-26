import type { MyEnrollmentResponse } from '@eduhub/api-client';
import { useEffect, useRef, useState } from 'react';
import { enrollmentApi } from '../api/clients';

export type MyEnrollmentStatus =
  'CONFIRMED' | 'WAITING' | 'CANCELLED' | 'COMPLETED' | 'NOT_COMPLETED';

export interface MyEnrollmentsState {
  data: MyEnrollmentResponse[] | null;
  loading: boolean;
  error: unknown;
}

/**
 * 내 신청 내역 (FR-07). status가 바뀌면 다시 불러온다. status가 없으면 전체.
 * 같은 status에서 reloadKey만 바뀐 재조회는 이전 data를 유지하고 loading만 켠다
 * (취소 뒤 표가 깜빡이지 않게). status가 바뀌면 비운다.
 */
export function useMyEnrollments(status?: MyEnrollmentStatus, reloadKey = 0): MyEnrollmentsState {
  const [state, setState] = useState<MyEnrollmentsState>({
    data: null,
    loading: true,
    error: null,
  });
  const loadedStatus = useRef(status);

  useEffect(() => {
    let ignore = false;
    if (loadedStatus.current === status) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    } else {
      loadedStatus.current = status;
      setState({ data: null, loading: true, error: null });
    }

    enrollmentApi
      .listMyEnrollments(status)
      .then((response) => {
        if (!ignore) setState({ data: response.data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setState({
          data: null,
          loading: false,
          error: e,
        });
      });

    return () => {
      ignore = true;
    };
  }, [status, reloadKey]);

  return state;
}
