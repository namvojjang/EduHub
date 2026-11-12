import type { CourseDetailResponse } from '@eduhub/api-client';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';

export interface CourseDetailState {
  data: CourseDetailResponse | null;
  loading: boolean;
  /** 없는 과정(404). 일반 오류와 화면 문구가 달라서 따로 둔다. */
  notFound: boolean;
  error: Error | null;
}

/**
 * 과정 상세와 회차 목록 (FR-02). id가 바뀌면 다시 불러온다.
 * reloadKey를 바꾸면 같은 id라도 다시 불러온다 (관리 화면에서 회차를 바꾼 뒤).
 */
export function useCourseDetail(id: number, reloadKey = 0): CourseDetailState {
  const [state, setState] = useState<CourseDetailState>({
    data: null,
    loading: true,
    notFound: false,
    error: null,
  });

  useEffect(() => {
    let ignore = false;
    setState({ data: null, loading: true, notFound: false, error: null });

    courseApi
      .detail(id)
      .then((response) => {
        if (!ignore) setState({ data: response.data, loading: false, notFound: false, error: null });
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
