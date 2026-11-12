package com.example.eduhub.enrollment;

import java.time.LocalDateTime;
import lombok.Value;

/** 수강 신청 결과 (FR-04). 대기 순번은 FR-05에서 추가한다. */
@Value
public class EnrollmentResponse {
  Long id;
  Long sessionId;
  EnrollmentStatus status;
  LocalDateTime appliedAt;
  LocalDateTime confirmedAt;

  /** 회차는 ID만 읽고 연관 필드는 건드리지 않는다. */
  public static EnrollmentResponse from(Enrollment enrollment) {
    return new EnrollmentResponse(
        enrollment.getId(),
        enrollment.getSession().getId(),
        enrollment.getStatus(),
        enrollment.getAppliedAt(),
        enrollment.getConfirmedAt());
  }
}
