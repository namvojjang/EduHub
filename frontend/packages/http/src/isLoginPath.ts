import { matchPath } from 'react-router-dom';

/**
 * 경로가 로그인 화면(/login)인지 본다. 끝 슬래시를 허용하고 대소문자를 구분하지 않는다.
 * React Router의 Route가 기본적으로 대소문자를 구분하지 않아 `/LOGIN`도 로그인 화면을 그리므로,
 * 우리 쪽 비교도 같은 기준이어야 한다(다르면 헤더 버튼이 보이거나 로그인 후 폼에 갇힌다).
 */
export function isLoginPath(pathname: string): boolean {
  return matchPath({ path: '/login', caseSensitive: false, end: true }, pathname) !== null;
}
