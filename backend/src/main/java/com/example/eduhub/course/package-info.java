/**
 * 과정·회차 도메인 (FR-01~03).
 *
 * <p>의존 규칙: enrollment 패키지에 의존하지 않는다. enrollment가 course를 참조한다 (NFR-07).
 *
 * <p>자리 수는 {@code SeatCounter} 인터페이스로만 받는다. 구현은 enrollment가 한다 (FR-02).
 */
package com.example.eduhub.course;
