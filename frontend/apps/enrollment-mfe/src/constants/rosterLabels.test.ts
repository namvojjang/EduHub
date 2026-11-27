import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  failureReasonLabel,
  isSessionNotFound,
  rosterErrorMessage,
  rosterLoadErrorMessage,
} from './rosterLabels';

function axiosError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

describe('rosterLoadErrorMessage', () => {
  it('401은 null이다(인터셉터가 로그인 화면으로 보낸다)', () => {
    expect(
      rosterLoadErrorMessage(axiosError(401, { code: 'UNAUTHORIZED', message: 'x' })),
    ).toBeNull();
  });

  it('403은 관리자 전용 문구다', () => {
    expect(rosterLoadErrorMessage(axiosError(403, { code: 'FORBIDDEN', message: 'x' }))).toBe(
      '관리자만 볼 수 있습니다.',
    );
  });

  it('그 밖은 서버 message를 쓴다', () => {
    expect(rosterLoadErrorMessage(axiosError(500, { code: 'INTERNAL', message: '잠시 후' }))).toBe(
      '잠시 후',
    );
    expect(rosterLoadErrorMessage(new Error('서버 오류'))).toBe('서버 오류');
  });
});

describe('rosterErrorMessage', () => {
  it('409 code별 고정 문구', () => {
    const msg = (code: string) => rosterErrorMessage(axiosError(409, { code, message: '회차 4' }));
    expect(msg('SESSION_NOT_STARTED')).toBe('회차 시작 전에는 교육 완료로 처리할 수 없습니다.');
    expect(msg('SESSION_ALREADY_COMPLETED')).toBe('이미 교육 완료된 회차입니다.');
    expect(msg('SESSION_NOT_COMPLETED')).toBe('교육 완료 처리 후 수료를 기록할 수 있습니다.');
  });

  it('401은 null, 알 수 없는 409와 그 밖은 서버 message', () => {
    expect(rosterErrorMessage(axiosError(401, { code: 'UNAUTHORIZED', message: 'x' }))).toBeNull();
    expect(rosterErrorMessage(axiosError(409, { code: 'OTHER', message: '충돌' }))).toBe('충돌');
    expect(rosterErrorMessage(new Error('네트워크 오류'))).toBe('네트워크 오류');
  });
});

describe('rosterErrorMessage 403·404', () => {
  it('처리 403은 처리 문구(조회 403 문구와 다르다)', () => {
    const e = axiosError(403, { code: 'FORBIDDEN', message: 'x' });
    expect(rosterErrorMessage(e)).toBe('관리자만 처리할 수 있습니다.');
    expect(rosterLoadErrorMessage(e)).toBe('관리자만 볼 수 있습니다.');
  });

  it('404는 서버 message(ID 포함) 대신 고정 문구다', () => {
    expect(
      rosterErrorMessage(axiosError(404, { code: 'SESSION_NOT_FOUND', message: '회차 없음: 4' })),
    ).toBe('회차를 찾을 수 없습니다.');
    expect(
      rosterErrorMessage(axiosError(404, { code: 'EMPLOYEE_NOT_FOUND', message: '사원 없음: 7' })),
    ).toBe('대상을 찾을 수 없습니다.');
  });
});

describe('failureReasonLabel', () => {
  it('알려진 code는 고정 문구', () => {
    expect(failureReasonLabel('NOT_ENROLLED', 'x')).toBe('신청 없음');
    expect(failureReasonLabel('WAITING', 'x')).toBe('대기 중');
    expect(failureReasonLabel('CANCELLED', 'x')).toBe('취소됨');
    expect(failureReasonLabel('ALREADY_RECORDED', 'x')).toBe('이미 기록됨');
  });

  it('모르는 code는 서버 reason, 둘 다 없으면 code', () => {
    expect(failureReasonLabel('NEW_CODE', '서버 사유')).toBe('서버 사유');
    expect(failureReasonLabel('NEW_CODE')).toBe('NEW_CODE');
  });
});

describe('isSessionNotFound', () => {
  it('404 SESSION_NOT_FOUND만 true다', () => {
    expect(isSessionNotFound(axiosError(404, { code: 'SESSION_NOT_FOUND', message: 'x' }))).toBe(
      true,
    );
    expect(isSessionNotFound(axiosError(404, { code: 'OTHER', message: 'x' }))).toBe(false);
    expect(isSessionNotFound(axiosError(403, { code: 'SESSION_NOT_FOUND', message: 'x' }))).toBe(
      false,
    );
    expect(isSessionNotFound(new Error('x'))).toBe(false);
  });
});
