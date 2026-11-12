import type { ErrorResponse } from '@eduhub/api-client';
import axios from 'axios';

/** 백엔드 ErrorResponse의 message가 있으면 그것을, 없으면 일반 오류 문구를 돌려준다. */
export function getErrorMessage(e: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(e) && e.response?.data?.message) {
    return e.response.data.message;
  }
  return e instanceof Error ? e.message : String(e);
}
