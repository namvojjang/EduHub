import axios, { type AxiosRequestConfig } from 'axios';
import type { MeResponse } from '@eduhub/api-client';

const TOKEN_KEY = 'eduhub.accessToken';
const USER_KEY = 'eduhub.user';

/** 401을 받아 토큰을 지웠을 때 window로 보내는 이벤트 이름. AuthContext가 듣는다. */
export const UNAUTHORIZED_EVENT = 'eduhub:unauthorized';

/** 로그인 토큰과 사용자 정보를 localStorage에 두고 꺼내는 곳 (NFR-03). */
export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  /** 저장된 사용자. JSON이 깨져 있으면 null을 돌려주고 저장소를 정리한다. */
  user(): MeResponse | null {
    const raw = localStorage.getItem(USER_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as MeResponse;
    } catch {
      tokenStore.clear();
      return null;
    }
  },
  save(accessToken: string, user: MeResponse): void {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/**
 * 로그인 요청(POST .../api/v1/auth/login)인지 판별한다.
 * 로그인 요청에 만료된 토큰이 붙으면 서버가 로그인도 401로 거절하므로 (NFR-03) 토큰을 붙이지 않는다.
 * 또 로그인 요청의 401은 비밀번호 오류(LOGIN_FAILED)이지 세션 만료가 아니므로 만료 처리에서도 뺀다.
 */
export function isLoginRequest(config: Pick<AxiosRequestConfig, 'method' | 'url'>): boolean {
  return (
    (config.method ?? 'get').toLowerCase() === 'post' &&
    !!config.url?.endsWith('/api/v1/auth/login')
  );
}

/** 생성 클라이언트가 공유하는 Axios 인스턴스. 토큰 첨부와 401 처리를 여기서 한다. */
export const http = axios.create();

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token && !isLoginRequest(config)) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // 403(권한 없음)은 로그인 상태와 무관하므로 아무것도 하지 않는다.
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !(error.config && isLoginRequest(error.config))
    ) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);
