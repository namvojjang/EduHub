import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  ENROLLMENT_STATUS_COLOR,
  ENROLLMENT_STATUS_LABEL,
  enrollmentErrorMessage,
} from './enrollmentLabels';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

describe('ENROLLMENT_STATUS_LABEL', () => {
  it('미수료를 포함한 5개 상태의 라벨과 색이 있다', () => {
    expect(ENROLLMENT_STATUS_LABEL).toEqual({
      CONFIRMED: '확정',
      WAITING: '대기',
      CANCELLED: '취소',
      COMPLETED: '수료',
      NOT_COMPLETED: '미수료',
    });
    expect(Object.keys(ENROLLMENT_STATUS_COLOR).sort()).toEqual(
      Object.keys(ENROLLMENT_STATUS_LABEL).sort(),
    );
  });
});

describe('enrollmentErrorMessage', () => {
  it.each([
    ['DUPLICATE_ENROLLMENT', '이미 이 과정에 신청했습니다. 내 신청 내역에서 확인하세요.'],
    ['ALREADY_COMPLETED_COURSE', '이미 수료한 과정입니다.'],
    ['SESSION_NOT_RECRUITING', '모집 중인 회차가 아닙니다.'],
    ['SESSION_ALREADY_STARTED', '이미 시작된 회차라 취소할 수 없습니다.'],
    ['ENROLLMENT_NOT_CANCELLABLE', '취소할 수 없는 신청입니다.'],
  ])('409 %s는 고정 문구를 쓰고 백엔드 메시지(ID)를 노출하지 않는다', (code, expected) => {
    const message = enrollmentErrorMessage(httpError(409, { code, message: `백엔드 메시지: 3` }));
    expect(message).toBe(expected);
  });

  it('모르는 409 code는 백엔드 message를 쓴다', () => {
    expect(enrollmentErrorMessage(httpError(409, { code: 'OTHER', message: '다른 충돌' }))).toBe(
      '다른 충돌',
    );
  });

  it('409가 아니면 code와 상관없이 getErrorMessage를 쓴다', () => {
    expect(
      enrollmentErrorMessage(httpError(404, { code: 'DUPLICATE_ENROLLMENT', message: '없음' })),
    ).toBe('없음');
  });

  it('Axios 오류가 아니면 일반 오류 메시지를 쓴다', () => {
    expect(enrollmentErrorMessage(new Error('Network Error'))).toBe('Network Error');
  });
});
