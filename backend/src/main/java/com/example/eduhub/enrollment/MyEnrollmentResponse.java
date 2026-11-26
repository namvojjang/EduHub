package com.example.eduhub.enrollment;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Value;

/** 내 신청 내역 한 건 (FR-07). waitingNumber는 대기일 때만 있고, 저장하지 않고 계산한 값이다 (D-04). */
@Value
@AllArgsConstructor
public class MyEnrollmentResponse {
  Long enrollmentId;
  Long sessionId;
  Long courseId;
  String courseTitle;
  LocalDateTime sessionStartAt;
  String place;
  EnrollmentStatus status;
  Integer waitingNumber;
  LocalDateTime appliedAt;
  LocalDateTime confirmedAt;
  boolean promoted;

  // 8번째 인자에 리터럴 null을 넘기면 Integer/Long 생성자 사이에서 컴파일 모호성이 생긴다. 이 생성자는 JPQL 전용이다.
  /** JPQL 생성자 표현식용 (FR-07). 서브쿼리 결과(count)가 Long으로 들어오므로, 대기일 때만 순번으로 쓰고 아니면 null이다 (D-04). */
  public MyEnrollmentResponse(
      Long enrollmentId,
      Long sessionId,
      Long courseId,
      String courseTitle,
      LocalDateTime sessionStartAt,
      String place,
      EnrollmentStatus status,
      Long waitingRank,
      LocalDateTime appliedAt,
      LocalDateTime confirmedAt,
      boolean promoted) {
    this(
        enrollmentId,
        sessionId,
        courseId,
        courseTitle,
        sessionStartAt,
        place,
        status,
        status == EnrollmentStatus.WAITING ? Integer.valueOf(waitingRank.intValue()) : null,
        appliedAt,
        confirmedAt,
        promoted);
  }
}
