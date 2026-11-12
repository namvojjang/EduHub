import type { PageResponseCourseSummaryResponse } from '@eduhub/api-client';
import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';

export interface CourseQuery {
  keyword: string;
  category: string;
  /** 0부터 시작. 받은 값을 그대로 API에 넘긴다. */
  page: number;
  size: number;
}

export interface CoursesState {
  data: PageResponseCourseSummaryResponse | null;
  loading: boolean;
  error: Error | null;
}

/** 과정 목록 조회 (FR-01). 조건이 바뀔 때마다 다시 불러온다. */
export function useCourses({ keyword, category, page, size }: CourseQuery): CoursesState {
  const [state, setState] = useState<CoursesState>({ data: null, loading: true, error: null });

  useEffect(() => {
    // 응답이 늦게 와서 순서가 뒤바뀌어도 이전 요청의 결과로 화면을 덮어쓰지 않는다.
    let ignore = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    courseApi
      .list(keyword || undefined, category || undefined, page, size)
      .then((response) => {
        if (!ignore) setState({ data: response.data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (!ignore) {
          setState({ data: null, loading: false, error: e instanceof Error ? e : new Error(String(e)) });
        }
      });

    return () => {
      ignore = true;
    };
  }, [keyword, category, page, size]);

  return state;
}
