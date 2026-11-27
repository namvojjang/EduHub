import type { RosterResponse } from '@eduhub/api-client';
import { useEffect, useState } from 'react';
import { enrollmentAdminApi } from '@eduhub/http';

export interface RosterState {
  data: RosterResponse | null;
  loading: boolean;
  error: unknown;
}

interface Stored extends RosterState {
  /** 이 상태를 조회한 회차. 현재 sessionId와 다르면 다른 회차의 data라서 쓰지 않는다. */
  sessionId: number;
  /** 마지막으로 조회를 시작한 reloadKey. 현재 값과 다르면 재조회가 막 요청된 것이다. */
  reloadKey: number;
}

/** 요청을 보낼 수 있는 회차 ID인지(양의 정수). */
export function isValidSessionId(sessionId: number): boolean {
  return Number.isInteger(sessionId) && sessionId > 0;
}

/**
 * 회차 명단 (FR-08). sessionId가 바뀌면 다시 불러온다.
 * 같은 sessionId에서 reloadKey만 바뀐 재조회는 이전 data를 유지하고 loading만 켠다
 * (처리 뒤 표가 깜빡이지 않게). 재조회가 실패해도 같은 회차의 직전 data는 유지한다.
 * sessionId가 바뀌면 렌더 시점에 바로 비운다(이전 회차 data로 처리 요청을 보내지 않게).
 * 양의 정수가 아닌 sessionId는 요청하지 않는다.
 */
export function useRoster(sessionId: number, reloadKey = 0): RosterState {
  const [stored, setStored] = useState<Stored>({
    sessionId,
    reloadKey,
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!isValidSessionId(sessionId)) return;
    let ignore = false;
    setStored((prev) =>
      prev.sessionId === sessionId
        ? { ...prev, reloadKey, loading: true, error: null }
        : { sessionId, reloadKey, data: null, loading: true, error: null },
    );

    enrollmentAdminApi
      .getRoster(sessionId)
      .then((response) => {
        if (!ignore) {
          setStored({ sessionId, reloadKey, data: response.data, loading: false, error: null });
        }
      })
      .catch((e: unknown) => {
        if (ignore) return;
        setStored((prev) => ({
          sessionId,
          reloadKey,
          data: prev.sessionId === sessionId ? prev.data : null,
          loading: false,
          error: e,
        }));
      });

    return () => {
      ignore = true;
    };
  }, [sessionId, reloadKey]);

  if (stored.sessionId !== sessionId) return { data: null, loading: true, error: null };
  // reloadKey가 바뀐 첫 렌더(effect가 loading을 켜기 전)에도 loading으로 본다. 직전 data는 유지한다.
  if (isValidSessionId(sessionId) && stored.reloadKey !== reloadKey) {
    return { data: stored.data, loading: true, error: null };
  }
  return { data: stored.data, loading: stored.loading, error: stored.error };
}
