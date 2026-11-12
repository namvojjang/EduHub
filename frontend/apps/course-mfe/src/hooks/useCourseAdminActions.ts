import type {
  CourseDetailResponse,
  CourseRequest,
  SessionRequest,
  SessionResponse,
} from '@eduhub/api-client';
import { useCallback, useState } from 'react';
import { courseAdminApi } from '../api/courseApi';

/**
 * 관리자의 등록·수정·종료 요청 (FR-03).
 *
 * 실패하면 예외를 그대로 던진다. 화면이 getErrorMessage로 백엔드 메시지를 보여 준다.
 */
export function useCourseAdminActions() {
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T,>(request: () => Promise<{ data: T }>): Promise<T> => {
    setPending(true);
    try {
      return (await request()).data;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    pending,
    createCourse: (body: CourseRequest) =>
      run<CourseDetailResponse>(() => courseAdminApi.createCourse(body)),
    updateCourse: (id: number, body: CourseRequest) =>
      run<CourseDetailResponse>(() => courseAdminApi.updateCourse(id, body)),
    closeCourse: (id: number) => run<CourseDetailResponse>(() => courseAdminApi.closeCourse(id)),
    createSession: (courseId: number, body: SessionRequest) =>
      run<SessionResponse>(() => courseAdminApi.createSession(courseId, body)),
    updateSession: (sessionId: number, body: SessionRequest) =>
      run<SessionResponse>(() => courseAdminApi.updateSession(sessionId, body)),
    closeSession: (sessionId: number) =>
      run<SessionResponse>(() => courseAdminApi.closeSession(sessionId)),
  };
}
