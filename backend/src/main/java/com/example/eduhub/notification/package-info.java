/**
 * 알림 기록 (FR-09). 신청 확정·대기 승급 이벤트를 받아 notification 테이블에 남긴다.
 *
 * <p>의존 규칙: enrollment의 이벤트(EnrollmentConfirmedEvent, ConfirmationReason)만 참조한다. enrollment는
 * notification을 모른다. course는 둘 다 모른다 (NFR-07).
 */
package com.example.eduhub.notification;
