/**
 * 인증과 사원 (NFR-03).
 *
 * <p>의존 규칙: enrollment는 auth의 CurrentUser와 Employee(명단 조회 읽기)만 참조한다. course는 auth에 의존하지 않는다.
 */
package com.example.eduhub.auth;
