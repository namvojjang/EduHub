import type { ErrorResponse } from '@eduhub/api-client';
import axios from 'axios';
import { getErrorMessage } from '../api/errorMessage';

// 회차 상태 라벨·색. constants/statusLabels와 같은 값을 복제한다:
// enrollment/는 constants/를 import하지 않는다(6회차 enrollment-mfe 분리, 설계 Q4).
export const SESSION_STATUS_LABEL: Record<string, string> = {
  RECRUITING: '모집 중',
  CLOSED: '모집 마감',
  COMPLETED: '교육 완료',
};

export const SESSION_STATUS_COLOR: Record<string, string> = {
  RECRUITING: 'indigo',
  CLOSED: 'gray',
  COMPLETED: 'dark',
};

/** 없는 회차(404 SESSION_NOT_FOUND). 일반 오류와 화면이 달라서 따로 가려낸다. */
export function isSessionNotFound(e: unknown): boolean {
  return (
    axios.isAxiosError<ErrorResponse>(e) &&
    e.response?.status === 404 &&
    e.response.data?.code === 'SESSION_NOT_FOUND'
  );
}

/**
 * 명단 조회 실패를 화면 문구로 바꾼다. 403은 고정 문구, 그 밖은 getErrorMessage.
 * 401은 null: 인터셉터가 로그인 화면으로 보내므로 호출하는 쪽이 Alert를 생략한다.
 */
export function rosterLoadErrorMessage(e: unknown): string | null {
  if (axios.isAxiosError(e) && e.response?.status === 401) return null;
  if (axios.isAxiosError(e) && e.response?.status === 403) return '관리자만 볼 수 있습니다.';
  return getErrorMessage(e);
}
