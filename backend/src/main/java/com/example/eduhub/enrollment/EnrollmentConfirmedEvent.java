package com.example.eduhub.enrollment;

import lombok.Value;

/**
 * 신청이 확정되었다는 사실 (FR-09). 커밋 직전에 처리하는 쪽(알림 등)이 다른 도메인을 다시 조회하지 않도록 과정명을 담는다. 이벤트 계약은 발행하는
 * enrollment가 가진다.
 */
@Value
public class EnrollmentConfirmedEvent {
  Long enrollmentId;
  Long employeeId;
  Long sessionId;
  Long courseId;
  String courseTitle;
  ConfirmationReason reason;
}
