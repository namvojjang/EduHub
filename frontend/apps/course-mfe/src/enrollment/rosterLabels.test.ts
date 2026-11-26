import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { isSessionNotFound, rosterLoadErrorMessage } from './rosterLabels';

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
