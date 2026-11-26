import { AuthApi } from '@eduhub/api-client';
import { http } from './http';

// 토큰 처리가 들어 있는 http로 만든다. basePath 처리는 courseApi.ts의 주석 참고.
export const authApi = new AuthApi(undefined, '', http);
