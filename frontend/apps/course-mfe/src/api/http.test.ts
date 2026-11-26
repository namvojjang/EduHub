import { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './clients';
import { http, tokenStore, UNAUTHORIZED_EVENT } from './http';

const LOGIN_URL = '/api/v1/auth/login';
const user = { id: 1, employeeNo: 'E1001', name: '홍길동', role: 'EMPLOYEE' } as never;

/** 네트워크 대신 받은 config를 기록하고 정해진 status로 답하는 adapter. */
function fakeAdapter(status: number, seen: InternalAxiosRequestConfig[]) {
  return (config: InternalAxiosRequestConfig) => {
    seen.push(config);
    const response = { data: {}, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      return Promise.reject(
        new AxiosError('failed', String(status), config, undefined, response as never),
      );
    }
    return Promise.resolve(response);
  };
}

describe('http', () => {
  const listeners: EventListener[] = [];
  let events: number;

  beforeEach(() => {
    localStorage.clear();
    events = 0;
    const listener = () => {
      events += 1;
    };
    listeners.push(listener);
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
  });

  afterEach(() => {
    listeners.splice(0).forEach((l) => window.removeEventListener(UNAUTHORIZED_EVENT, l));
  });

  function send(status: number, config: AxiosRequestConfig) {
    const seen: InternalAxiosRequestConfig[] = [];
    const result = http.request({ ...config, adapter: fakeAdapter(status, seen) as never });
    return { seen, result };
  }

  it('H1 저장된 토큰을 Authorization에 붙인다', async () => {
    tokenStore.save('tok-1', user);
    const { seen, result } = send(200, { method: 'get', url: '/api/v1/courses' });
    await result;
    expect(seen[0].headers.get('Authorization')).toBe('Bearer tok-1');
  });

  it('H2 토큰이 없으면 헤더가 없다', async () => {
    const { seen, result } = send(200, { method: 'get', url: '/api/v1/courses' });
    await result;
    expect(seen[0].headers.get('Authorization')).toBeFalsy();
  });

  it('H3 로그인 요청에는 토큰이 있어도 붙이지 않는다', async () => {
    tokenStore.save('tok-1', user);
    const { seen, result } = send(200, { method: 'post', url: LOGIN_URL });
    await result;
    expect(seen[0].headers.get('Authorization')).toBeFalsy();
  });

  it('H4 401이면 토큰을 지우고 이벤트를 한 번 보낸다', async () => {
    tokenStore.save('tok-1', user);
    const { result } = send(401, { method: 'get', url: '/api/v1/me' });
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(tokenStore.get()).toBeNull();
    expect(tokenStore.user()).toBeNull();
    expect(events).toBe(1);
  });

  it('H4b 토큰 없는 401은 이벤트 없음', async () => {
    const { result } = send(401, { method: 'get', url: '/api/v1/me' });
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(events).toBe(0);
  });

  it('H5 로그인 요청의 401은 토큰 삭제도 이벤트도 없다', async () => {
    tokenStore.save('tok-1', user);
    const { result } = send(401, { method: 'post', url: LOGIN_URL });
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(tokenStore.get()).toBe('tok-1');
    expect(events).toBe(0);
  });

  it('H5b 생성 클라이언트 authApi.login도 헤더가 없고 401에 이벤트가 없다', async () => {
    tokenStore.save('tok-1', user);
    const seen: InternalAxiosRequestConfig[] = [];
    await expect(
      authApi.login(
        { employeeNo: 'E1001', password: 'x' },
        { adapter: fakeAdapter(401, seen) as never },
      ),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(seen[0].headers.get('Authorization')).toBeFalsy();
    expect(tokenStore.get()).toBe('tok-1');
    expect(events).toBe(0);
  });

  it('H4c 401 도착 전에 다른 토큰으로 바뀌면 토큰 유지, 이벤트 없음', async () => {
    tokenStore.save('tok-1', user);
    const seen: InternalAxiosRequestConfig[] = [];
    const inner = fakeAdapter(401, seen);
    const adapter = (config: InternalAxiosRequestConfig) => {
      tokenStore.save('tok-2', user); // 응답이 오기 전 다른 탭에서 재로그인
      return inner(config);
    };
    await expect(
      http.request({ method: 'get', url: '/api/v1/me', adapter: adapter as never }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(tokenStore.get()).toBe('tok-2');
    expect(events).toBe(0);
  });

  it('H4d 401 도착 전에 clear되면 이벤트 없음', async () => {
    tokenStore.save('tok-1', user);
    const seen: InternalAxiosRequestConfig[] = [];
    const inner = fakeAdapter(401, seen);
    const adapter = (config: InternalAxiosRequestConfig) => {
      tokenStore.clear(); // 응답이 오기 전 로그아웃
      return inner(config);
    };
    await expect(
      http.request({ method: 'get', url: '/api/v1/me', adapter: adapter as never }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(events).toBe(0);
  });

  it('H6 403은 토큰을 유지하고 이벤트도 없다', async () => {
    tokenStore.save('tok-1', user);
    const { result } = send(403, { method: 'get', url: '/api/v1/admin/courses' });
    await expect(result).rejects.toMatchObject({ response: { status: 403 } });
    expect(tokenStore.get()).toBe('tok-1');
    expect(events).toBe(0);
  });

  it('H7 user JSON이 깨져 있으면 null을 돌려주고 저장소를 정리한다', () => {
    localStorage.setItem('eduhub.accessToken', 'tok-1');
    localStorage.setItem('eduhub.user', '{깨진 json');
    expect(tokenStore.user()).toBeNull();
    expect(localStorage.getItem('eduhub.accessToken')).toBeNull();
    expect(localStorage.getItem('eduhub.user')).toBeNull();
  });
});
