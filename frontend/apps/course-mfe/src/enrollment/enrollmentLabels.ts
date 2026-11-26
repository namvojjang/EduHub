import type { ErrorResponse } from '@eduhub/api-client';
import axios from 'axios';
import { getErrorMessage } from '../api/errorMessage';

// 신청 상태 코드를 화면 문구·색으로 바꾼다 (D-05). 색은 Mantine 색 이름.
export const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: '확정',
  WAITING: '대기',
  CANCELLED: '취소',
  COMPLETED: '수료',
  NOT_COMPLETED: '미수료',
};

export const ENROLLMENT_STATUS_COLOR: Record<string, string> = {
  CONFIRMED: 'teal',
  WAITING: 'blue',
  CANCELLED: 'gray',
  COMPLETED: 'indigo',
  NOT_COMPLETED: 'orange',
};

// 백엔드 409 code별 고정 문구. 백엔드 message에는 ID가 붙어 있어 그대로 쓰지 않는다 (D-03).
const CONFLICT_MESSAGE: Record<string, string> = {
  DUPLICATE_ENROLLMENT: '이미 이 과정에 신청했습니다. 내 신청 내역에서 확인하세요.',
  ALREADY_COMPLETED_COURSE: '이미 수료한 과정입니다.',
  SESSION_NOT_RECRUITING: '모집 중인 회차가 아닙니다.',
  SESSION_ALREADY_STARTED: '이미 시작된 회차라 취소할 수 없습니다.',
  ENROLLMENT_NOT_CANCELLABLE: '취소할 수 없는 신청입니다.',
};

/** 신청·취소 실패를 화면 문구로 바꾼다. 409는 code 표, 그 밖은 getErrorMessage. */
export function enrollmentErrorMessage(e: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(e) && e.response?.status === 409) {
    const code = e.response.data?.code;
    if (code && CONFLICT_MESSAGE[code]) return CONFLICT_MESSAGE[code];
  }
  return getErrorMessage(e);
}
