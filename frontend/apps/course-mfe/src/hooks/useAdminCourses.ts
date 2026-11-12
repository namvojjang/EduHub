import type { PageResponseAdminCourseSummaryResponse } from '@eduhub/api-client';
import { useEffect, useState } from 'react';
import { courseAdminApi } from '../api/courseApi';

export interface AdminCourseQuery {
  keyword: string;
  /** 0부터 시작 */
  page: number;
  size: number;
  /** 등록·수정·종료 뒤 값을 바꾸면 목록을 다시 불러온다. */
  reloadKey?: number;
}

export interface AdminCoursesState {
  data: PageResponseAdminCourseSummaryResponse | null;
  loading: boolean;
  error: Error | null;
}

/** 관리자 과정 목록 (FR-03). 종료된 과정도 포함한다. */
export function useAdminCourses({
  keyword,
  page,
  size,
  reloadKey = 0,
}: AdminCourseQuery): AdminCoursesState {
  const [state, setState] = useState<AdminCoursesState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let ignore = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    courseAdminApi
      .listAdminCourses(keyword || undefined, undefined, page, size)
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
  }, [keyword, page, size, reloadKey]);

  return state;
}
