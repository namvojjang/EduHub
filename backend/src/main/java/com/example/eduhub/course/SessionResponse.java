package com.example.eduhub.course;

import java.time.LocalDateTime;
import lombok.Value;

/** 과정 상세의 회차 (FR-02). */
@Value
public class SessionResponse {
  Long id;
  LocalDateTime startAt;
  String place;
  int capacity;
  int remainingSeats;
  CourseSessionStatus status;

  /** 회차 자신의 필드만 읽는다. 지연 로딩되는 course는 건드리지 않는다 (NFR-02). */
  public static SessionResponse from(CourseSession session) {
    return new SessionResponse(
        session.getId(),
        session.getStartAt(),
        session.getPlace(),
        session.getCapacity(),
        // 수강 신청(3주차) 전까지는 정원 그대로. 확정 인원 계산은 그때 붙인다.
        session.getCapacity(),
        session.getStatus());
  }
}
