import type { CourseDetailResponse } from '@eduhub/api-client';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { courseApi } from '@eduhub/http';

export interface CourseDetailState {
  data: CourseDetailResponse | null;
  loading: boolean;
  /** 없는 과정(404). 일반 오류와 화면 문구가 달라서 따로 둔다. */
  notFound: boolean;
  error: Error | null;
}

/**
 * 과정 상세와 회차 목록 (FR-02). id가 바뀌면 다시 불러온다.
 * reloadKey를 바꾸면 같은 id라도 다시 불러온다 (회차를 바꾸거나 신청한 뒤).
 * 같은 id에서 reloadKey만 바뀐 재조회는 이전 data를 유지하고 loading만 켠다
 * (화면이 Skeleton으로 바뀌어 신청 결과 표시가 사라지지 않게). id가 바뀌면 비운다.
 */
export function useCourseDetail(id: number, reloadKey = 0): CourseDetailState {
  const [state, setState] = useState<CourseDetailState>({
    data: null,
    loading: true,
    notFound: false,
    error: null,
  });
  // 마지막으로 불러온 id. 다르면 다른 과정이므로 이전 data를 비운다.
  const loadedId = useRef(id);

  useEffect(() => {
    let ignore = false;
    if (loadedId.current === id) {
      setState((prev) => ({ ...prev, loading: true, notFound: false, error: null }));
    } else {
      loadedId.current = id;
      setState({ data: null, loading: true, notFound: false, error: null });
    }

    courseApi
      .detail(id)
      .then((response) => {
        if (!ignore)
          setState({ data: response.data, loading: false, notFound: false, error: null });
      })
      .catch((e: unknown) => {
        if (ignore) return;
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          setState({ data: null, loading: false, notFound: true, error: null });
        } else {
          setState({
            data: null,
            loading: false,
            notFound: false,
            error: e instanceof Error ? e : new Error(String(e)),
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, reloadKey]);

  return state;
}
