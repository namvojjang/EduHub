package com.example.eduhub.enrollment;

import java.time.LocalDateTime;
import lombok.Value;

/** 수강 신청 결과 (FR-04, FR-05, FR-06). waitingNumber는 대기일 때만 있고, 저장하지 않고 계산한 값이다 (D-04). */
@Value
public class EnrollmentResponse {
  Long id;
  Long sessionId;
  EnrollmentStatus status;
  LocalDateTime appliedAt;
  LocalDateTime confirmedAt;
  Integer waitingNumber;
  boolean promoted;

  /** 회차는 ID만 읽고 연관 필드는 건드리지 않는다. 대기가 아니면 waitingNumber는 null이다. */
  public static EnrollmentResponse from(Enrollment enrollment, Integer waitingNumber) {
    return new EnrollmentResponse(
        enrollment.getId(),
        enrollment.getSession().getId(),
        enrollment.getStatus(),
        enrollment.getAppliedAt(),
        enrollment.getConfirmedAt(),
        waitingNumber,
        enrollment.isPromoted());
  }
}
