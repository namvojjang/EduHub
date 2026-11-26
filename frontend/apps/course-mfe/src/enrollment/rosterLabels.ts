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

// 백엔드 409 code별 고정 문구(설계 4-5). 백엔드 message에는 ID가 붙어 있어 그대로 쓰지 않는다.
const CONFLICT_MESSAGE: Record<string, string> = {
  SESSION_NOT_STARTED: '회차 시작 전에는 교육 완료로 처리할 수 없습니다.',
  SESSION_ALREADY_COMPLETED: '이미 교육 완료된 회차입니다.',
  SESSION_NOT_COMPLETED: '교육 완료 처리 후 수료를 기록할 수 있습니다.',
};

/**
 * 교육 완료·수료 기록 실패를 화면 문구로 바꾼다. 409는 code 표, 그 밖은 rosterLoadErrorMessage.
 * 401은 null: 인터셉터가 로그인 화면으로 보내므로 호출하는 쪽이 알림을 생략한다.
 */
export function rosterErrorMessage(e: unknown): string | null {
  if (axios.isAxiosError<ErrorResponse>(e) && e.response?.status === 409) {
    const code = e.response.data?.code;
    if (code && CONFLICT_MESSAGE[code]) return CONFLICT_MESSAGE[code];
  }
  return rosterLoadErrorMessage(e);
}

const FAILURE_LABEL: Record<string, string> = {
  NOT_ENROLLED: '신청 없음',
  WAITING: '대기 중',
  CANCELLED: '취소됨',
  ALREADY_RECORDED: '이미 기록됨',
};

/** 일부 실패한 사원의 사유. 모르는 code면 서버 reason, 그것도 없으면 code. */
export function failureReasonLabel(code?: string, reason?: string): string {
  if (code && FAILURE_LABEL[code]) return FAILURE_LABEL[code];
  return reason ?? code ?? '알 수 없는 사유';
}
